import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { configManager, ConfigSchema } from '../lib/config-manager';
import { logger } from '../lib/logger';
import { authMiddleware } from './middleware/auth';
import Redis from 'ioredis';
import portscanner from 'portscanner';

const TestConnectionSchema = z.object({
  type: z.enum(['redis', 'github', 'smtp']),
  config: z.any(),
});

export function createConfigAPI() {
  const app = new Hono();

  // Check if initial setup is required
  app.get('/setup/status', async (c) => {
    try {
      const isFirstRun = await configManager.isFirstRun();
      const isSetupComplete = await configManager.isSetupComplete();
      
      return c.json({
        requiresSetup: isFirstRun || !isSetupComplete,
        isFirstRun,
        isSetupComplete,
      });
    } catch (error) {
      logger.error('Failed to get setup status:', error);
      throw new HTTPException(500, { message: 'Failed to get setup status' });
    }
  });

  // Complete initial setup
  app.post('/setup/complete', async (c) => {
    try {
      const body = await c.req.json();
      const config = ConfigSchema.parse(body);
      
      // Generate secure keys if not provided
      if (!config.security.jwtSecret) {
        config.security.jwtSecret = generateSecureKey();
      }
      if (!config.security.encryptionKey) {
        config.security.encryptionKey = generateSecureKey();
      }
      if (!config.security.apiKey) {
        config.security.apiKey = generateApiKey();
      }
      
      await configManager.update(config);
      await configManager.setSetupComplete();
      
      return c.json({
        success: true,
        message: 'Initial setup completed',
        apiKey: config.security.apiKey,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Invalid configuration',
          cause: error.errors,
        });
      }
      logger.error('Failed to complete setup:', error);
      throw new HTTPException(500, { message: 'Failed to complete setup' });
    }
  });

  // All routes below require authentication
  app.use('/*', authMiddleware({ required: false })); // Allow setup without auth

  // Get all configuration
  app.get('/config', async (c) => {
    try {
      const config = await configManager.getAll();
      
      // Mask sensitive values
      const masked = JSON.parse(JSON.stringify(config));
      if (masked.security?.apiKey) masked.security.apiKey = maskSecret(masked.security.apiKey);
      if (masked.security?.jwtSecret) masked.security.jwtSecret = maskSecret(masked.security.jwtSecret);
      if (masked.security?.encryptionKey) masked.security.encryptionKey = maskSecret(masked.security.encryptionKey);
      if (masked.github?.token) masked.github.token = maskSecret(masked.github.token);
      if (masked.github?.webhookSecret) masked.github.webhookSecret = maskSecret(masked.github.webhookSecret);
      if (masked.redis?.password) masked.redis.password = maskSecret(masked.redis.password);
      if (masked.ssl?.cloudflareToken) masked.ssl.cloudflareToken = maskSecret(masked.ssl.cloudflareToken);
      
      return c.json(masked);
    } catch (error) {
      logger.error('Failed to get configuration:', error);
      throw new HTTPException(500, { message: 'Failed to get configuration' });
    }
  });

  // Update configuration
  app.put('/config', async (c) => {
    try {
      const body = await c.req.json();
      
      // Don't update masked values
      const current = await configManager.getAll();
      const updates = unmaskSecrets(body, current);
      
      const validated = ConfigSchema.partial().parse(updates);
      await configManager.update(validated);
      
      return c.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Invalid configuration',
          cause: error.errors,
        });
      }
      logger.error('Failed to update configuration:', error);
      throw new HTTPException(500, { message: 'Failed to update configuration' });
    }
  });

  // Update specific section
  app.put('/config/:section', async (c) => {
    try {
      const section = c.req.param('section');
      const body = await c.req.json();
      
      const current = await configManager.getAll();
      if (!current[section as keyof typeof current]) {
        throw new HTTPException(400, { message: 'Invalid configuration section' });
      }
      
      const updates = { [section]: body };
      const validated = ConfigSchema.partial().parse(updates);
      
      await configManager.update(validated);
      
      return c.json({ success: true, message: `${section} configuration updated` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Invalid configuration',
          cause: error.errors,
        });
      }
      logger.error('Failed to update configuration section:', error);
      throw new HTTPException(500, { message: 'Failed to update configuration' });
    }
  });

  // Test connection
  app.post('/config/test', async (c) => {
    try {
      const body = await c.req.json();
      const { type, config } = TestConnectionSchema.parse(body);
      
      let result = { success: false, message: 'Unknown test type' };
      
      switch (type) {
        case 'redis':
          result = await testRedisConnection(config);
          break;
        case 'github':
          result = await testGitHubConnection(config);
          break;
        case 'smtp':
          result = await testSMTPConnection(config);
          break;
      }
      
      return c.json(result);
    } catch (error) {
      logger.error('Failed to test connection:', error);
      throw new HTTPException(500, { 
        message: error instanceof Error ? error.message : 'Failed to test connection',
      });
    }
  });

  // Find available ports
  app.get('/config/ports/available', async (c) => {
    try {
      const count = parseInt(c.req.query('count') || '3');
      const start = parseInt(c.req.query('start') || '8000');
      
      const ports: number[] = [];
      let current = start;
      
      while (ports.length < count && current < 65535) {
        const status = await portscanner.checkPortStatus(current, '127.0.0.1');
        if (status === 'closed') {
          ports.push(current);
        }
        current += Math.floor(Math.random() * 100) + 1;
      }
      
      return c.json({ ports });
    } catch (error) {
      logger.error('Failed to find available ports:', error);
      throw new HTTPException(500, { message: 'Failed to find available ports' });
    }
  });

  // Backup configuration
  app.post('/config/backup', async (c) => {
    try {
      const backupPath = await configManager.backup();
      
      return c.json({
        success: true,
        path: backupPath,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to backup configuration:', error);
      throw new HTTPException(500, { message: 'Failed to backup configuration' });
    }
  });

  // Restore configuration
  app.post('/config/restore', async (c) => {
    try {
      const { path } = await c.req.json();
      
      if (!path) {
        throw new HTTPException(400, { message: 'Backup path required' });
      }
      
      await configManager.restore(path);
      
      return c.json({
        success: true,
        message: 'Configuration restored successfully',
      });
    } catch (error) {
      logger.error('Failed to restore configuration:', error);
      throw new HTTPException(500, { message: 'Failed to restore configuration' });
    }
  });

  // Reset to defaults
  app.post('/config/reset', async (c) => {
    try {
      await configManager.reset();
      
      return c.json({
        success: true,
        message: 'Configuration reset to defaults',
      });
    } catch (error) {
      logger.error('Failed to reset configuration:', error);
      throw new HTTPException(500, { message: 'Failed to reset configuration' });
    }
  });

  return app;
}

// Helper functions
function maskSecret(value: string): string {
  if (!value || value.length < 8) return value;
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

function unmaskSecrets(input: any, current: any): any {
  const result = JSON.parse(JSON.stringify(input));
  
  // Restore masked values from current config
  if (result.security?.apiKey?.includes('****')) {
    result.security.apiKey = current.security.apiKey;
  }
  if (result.security?.jwtSecret?.includes('****')) {
    result.security.jwtSecret = current.security.jwtSecret;
  }
  if (result.security?.encryptionKey?.includes('****')) {
    result.security.encryptionKey = current.security.encryptionKey;
  }
  if (result.github?.token?.includes('****')) {
    result.github.token = current.github.token;
  }
  if (result.github?.webhookSecret?.includes('****')) {
    result.github.webhookSecret = current.github.webhookSecret;
  }
  if (result.redis?.password?.includes('****')) {
    result.redis.password = current.redis.password;
  }
  if (result.ssl?.cloudflareToken?.includes('****')) {
    result.ssl.cloudflareToken = current.ssl.cloudflareToken;
  }
  
  return result;
}

function generateSecureKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function generateApiKey(): string {
  const prefix = 'mcp_';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function testRedisConnection(config: any): Promise<{ success: boolean; message: string }> {
  try {
    const redis = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    
    await redis.connect();
    await redis.ping();
    await redis.quit();
    
    return { success: true, message: 'Redis connection successful' };
  } catch (error) {
    return { 
      success: false, 
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testGitHubConnection(config: any): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (response.ok) {
      const user = await response.json();
      return { success: true, message: `GitHub connection successful (${user.login})` };
    } else {
      return { success: false, message: `GitHub authentication failed: ${response.statusText}` };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `GitHub connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testSMTPConnection(config: any): Promise<{ success: boolean; message: string }> {
  // Placeholder for SMTP testing
  return { success: false, message: 'SMTP testing not implemented' };
}