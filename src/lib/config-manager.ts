import { db } from './db';
import { settings } from './db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import CryptoJS from 'crypto-js';
import { z } from 'zod';
import { logger } from './logger';
import fs from 'fs/promises';
import path from 'path';

const ConfigSchema = z.object({
  // Server Configuration
  server: z.object({
    backendPort: z.number().min(1024).max(65535).default(8437),
    frontendPort: z.number().min(1024).max(65535).default(3437),
    httpsPort: z.number().min(1024).max(65535).default(8443),
    nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  }),
  
  // SSL Configuration
  ssl: z.object({
    enabled: z.boolean().default(false),
    forceSSL: z.boolean().default(true),
    provider: z.enum(['letsencrypt', 'self-signed']).default('letsencrypt'),
    domain: z.string().optional(),
    email: z.string().email().optional(),
    staging: z.boolean().default(false),
    cloudflareToken: z.string().optional(),
  }),
  
  // Network Configuration
  network: z.object({
    enableUPnP: z.boolean().default(true),
    autoMapPorts: z.boolean().default(true),
    publicIP: z.string().optional(),
    privateIP: z.string().optional(),
  }),
  
  // Database Configuration
  database: z.object({
    url: z.string().default('./data/mcp-proxy.db'),
    backupEnabled: z.boolean().default(true),
    backupInterval: z.number().default(86400000), // 24 hours
  }),
  
  // Redis Configuration
  redis: z.object({
    enabled: z.boolean().default(false),
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0),
    tls: z.boolean().default(false),
  }),
  
  // Security Configuration
  security: z.object({
    apiKeyRequired: z.boolean().default(true),
    apiKey: z.string().optional(),
    jwtSecret: z.string().optional(),
    encryptionKey: z.string().optional(),
    allowedOrigins: z.array(z.string()).default(['localhost']),
    sessionTimeout: z.number().default(86400000), // 24 hours
  }),
  
  // GitHub Configuration
  github: z.object({
    enabled: z.boolean().default(true),
    token: z.string().optional(),
    webhookSecret: z.string().optional(),
    cloneDirectory: z.string().default('./mcp-services'),
    autoUpdate: z.boolean().default(true),
  }),
  
  // Monitoring Configuration
  monitoring: z.object({
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableMetrics: z.boolean().default(true),
    metricsInterval: z.number().default(60000), // 1 minute
    retentionDays: z.number().default(30),
  }),
  
  // System Configuration
  system: z.object({
    autoStart: z.boolean().default(true),
    maxProcesses: z.number().default(10),
    processTimeout: z.number().default(30000),
    healthCheckInterval: z.number().default(30000),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private config: Config | null = null;
  private encryptionKey: string;
  private configFile = path.join(process.cwd(), 'data', 'config.json');
  private isInitialized = false;

  constructor() {
    // Use a default key if none is provided, will be replaced on first setup
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Try to load from database first
      await this.loadFromDatabase();
      
      if (!this.config) {
        // If no config in database, try to load from file
        await this.loadFromFile();
        
        if (!this.config) {
          // If no config anywhere, check for environment variables
          this.config = this.loadFromEnv();
          
          // Save the initial config to database
          await this.saveToDatabase();
        }
      }
      
      this.isInitialized = true;
      logger.info('Configuration manager initialized');
    } catch (error) {
      logger.error('Failed to initialize configuration:', error);
      // Use default configuration
      this.config = ConfigSchema.parse({});
    }
  }

  private async loadFromDatabase(): Promise<void> {
    try {
      const rows = await db.select().from(settings);
      
      if (rows.length === 0) {
        this.config = null;
        return;
      }
      
      const configData: any = {};
      
      for (const row of rows) {
        const value = row.encrypted 
          ? this.decrypt(row.value)
          : JSON.parse(row.value);
        
        // Build nested object from key path
        const keys = row.key.split('.');
        let current = configData;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
      }
      
      this.config = ConfigSchema.parse(configData);
    } catch (error) {
      logger.warn('Failed to load config from database:', error);
      this.config = null;
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.configFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.config = ConfigSchema.parse(parsed);
      
      // Migrate file config to database
      await this.saveToDatabase();
      
      // Remove the file after migration
      await fs.unlink(this.configFile).catch(() => {});
    } catch (error) {
      // File doesn't exist or is invalid
      this.config = null;
    }
  }

  private loadFromEnv(): Config {
    return ConfigSchema.parse({
      server: {
        backendPort: parseInt(process.env.BACKEND_PORT || '8437'),
        frontendPort: parseInt(process.env.FRONTEND_PORT || '3437'),
        httpsPort: parseInt(process.env.HTTPS_PORT || '8443'),
        nodeEnv: process.env.NODE_ENV || 'production',
      },
      ssl: {
        enabled: process.env.SSL_ENABLED === 'true',
        forceSSL: process.env.FORCE_SSL !== 'false',
        provider: process.env.SSL_PROVIDER as any || 'letsencrypt',
        domain: process.env.DOMAIN,
        email: process.env.SSL_EMAIL,
        staging: process.env.SSL_STAGING === 'true',
        cloudflareToken: process.env.CLOUDFLARE_TOKEN,
      },
      network: {
        enableUPnP: process.env.ENABLE_UPNP !== 'false',
        autoMapPorts: process.env.AUTO_MAP_PORTS !== 'false',
        publicIP: process.env.PUBLIC_IP,
        privateIP: process.env.PRIVATE_IP,
      },
      database: {
        url: process.env.DATABASE_URL || './data/mcp-proxy.db',
      },
      redis: {
        enabled: !!process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      security: {
        apiKey: process.env.API_KEY,
        jwtSecret: process.env.JWT_SECRET,
        encryptionKey: process.env.ENCRYPTION_KEY,
      },
      github: {
        token: process.env.GITHUB_TOKEN,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        cloneDirectory: process.env.CLONE_DIRECTORY || './mcp-services',
      },
      monitoring: {
        logLevel: process.env.LOG_LEVEL as any || 'info',
        enableMetrics: process.env.ENABLE_METRICS === 'true',
      },
    });
  }

  async saveToDatabase(): Promise<void> {
    if (!this.config) return;
    
    const flatConfig = this.flattenConfig(this.config);
    
    for (const [key, value] of Object.entries(flatConfig)) {
      const isSecret = this.isSecretField(key);
      const encrypted = isSecret && value ? this.encrypt(value) : null;
      
      await db.insert(settings)
        .values({
          key,
          value: encrypted || JSON.stringify(value),
          encrypted: !!encrypted,
          category: key.split('.')[0],
          description: this.getFieldDescription(key),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: encrypted || JSON.stringify(value),
            encrypted: !!encrypted,
            updatedAt: new Date().toISOString(),
          },
        });
    }
  }

  private flattenConfig(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenConfig(value, fullKey));
      } else {
        flattened[fullKey] = value;
      }
    }
    
    return flattened;
  }

  private isSecretField(key: string): boolean {
    const secretFields = [
      'security.apiKey',
      'security.jwtSecret',
      'security.encryptionKey',
      'ssl.cloudflareToken',
      'redis.password',
      'github.token',
      'github.webhookSecret',
    ];
    
    return secretFields.includes(key);
  }

  private encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, this.encryptionKey).toString();
  }

  private decrypt(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private getFieldDescription(key: string): string {
    const descriptions: Record<string, string> = {
      'server.backendPort': 'Main backend API port',
      'server.frontendPort': 'Frontend UI port',
      'server.httpsPort': 'HTTPS port',
      'ssl.enabled': 'Enable SSL/HTTPS',
      'ssl.domain': 'Domain name for SSL certificate',
      'ssl.email': 'Email for Let\'s Encrypt notifications',
      'network.enableUPnP': 'Enable automatic port forwarding via UPnP',
      'redis.enabled': 'Enable Redis for caching and queues',
      'security.apiKey': 'API key for authentication',
      'github.token': 'GitHub personal access token',
      'monitoring.logLevel': 'Logging verbosity level',
    };
    
    return descriptions[key] || '';
  }

  async get<K extends keyof Config>(key: K): Promise<Config[K]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.config![key];
  }

  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.config![key] = value;
    await this.saveToDatabase();
  }

  async update(updates: Partial<Config>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.config = ConfigSchema.parse({ ...this.config, ...updates });
    await this.saveToDatabase();
  }

  async getAll(): Promise<Config> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.config!;
  }

  async reset(): Promise<void> {
    await db.delete(settings);
    this.config = ConfigSchema.parse({});
    this.isInitialized = false;
    await this.initialize();
  }

  async backup(): Promise<string> {
    const config = await this.getAll();
    const backupPath = path.join(
      process.cwd(),
      'backups',
      `config-${Date.now()}.json`
    );
    
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2));
    
    return backupPath;
  }

  async restore(backupPath: string): Promise<void> {
    const data = await fs.readFile(backupPath, 'utf-8');
    const config = ConfigSchema.parse(JSON.parse(data));
    
    this.config = config;
    await this.saveToDatabase();
  }

  async isFirstRun(): Promise<boolean> {
    const rows = await db.select().from(settings).limit(1);
    return rows.length === 0;
  }

  async setSetupComplete(): Promise<void> {
    await db.insert(settings)
      .values({
        key: 'system.setupComplete',
        value: 'true',
        encrypted: false,
        category: 'system',
        description: 'Initial setup completed',
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true' },
      });
  }

  async isSetupComplete(): Promise<boolean> {
    const [row] = await db.select()
      .from(settings)
      .where(eq(settings.key, 'system.setupComplete'))
      .limit(1);
    
    return row?.value === 'true';
  }
}

export const configManager = new ConfigManager();
export { Config, ConfigSchema };