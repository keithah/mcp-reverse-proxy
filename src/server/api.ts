import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ProcessManager, MCPConfigSchema } from '../lib/process-manager';
import { db } from '../lib/db/index';
import { services, logs, metrics } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { GitHubService } from '../lib/github';
import { authMiddleware } from './middleware/auth';

const CreateServiceSchema = MCPConfigSchema.omit({ id: true });
const UpdateServiceSchema = MCPConfigSchema.partial();

export function createManagementAPI(
  processManager: ProcessManager,
  githubService: GitHubService,
) {
  const app = new Hono();

  app.use('/*', cors());
  app.use('/*', authMiddleware());

  app.get('/services', async (c) => {
    try {
      const dbServices = await db.select().from(services);
      
      const servicesWithStatus = dbServices.map(service => {
        const process = processManager.getProcess(service.id);
        const state = process?.getState();
        const metrics = process?.getMetrics();
        
        return {
          ...service,
          environment: JSON.parse(service.environment || '{}'),
          status: state?.status || 'stopped',
          metrics,
        };
      });
      
      return c.json(servicesWithStatus);
    } catch (error) {
      logger.error('Failed to list services:', error);
      throw new HTTPException(500, { message: 'Failed to list services' });
    }
  });

  app.get('/services/:id', async (c) => {
    const id = c.req.param('id');
    
    try {
      const [service] = await db.select().from(services).where(eq(services.id, id));
      
      if (!service) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      const process = processManager.getProcess(id);
      const state = process?.getState();
      const metrics = process?.getMetrics();
      
      return c.json({
        ...service,
        environment: JSON.parse(service.environment || '{}'),
        status: state?.status || 'stopped',
        metrics,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to get service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to get service' });
    }
  });

  app.post('/services', async (c) => {
    try {
      const body = await c.req.json();
      const validated = CreateServiceSchema.parse(body);
      
      const id = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const config = {
        ...validated,
        id,
      };
      
      await db.insert(services).values({
        id,
        name: config.name,
        repositoryUrl: config.repository.url,
        repositoryBranch: config.repository.branch,
        repositoryPath: config.repository.path,
        entryPoint: config.repository.entryPoint,
        environment: JSON.stringify(config.environment),
        proxyPath: config.proxy.path,
        rateLimit: config.proxy.rateLimit,
        cacheTTL: config.proxy.cacheTTL,
        timeout: config.proxy.timeout,
        autoRestart: config.process.autoRestart,
        maxRestarts: config.process.maxRestarts,
        maxMemory: config.process.maxMemory,
        healthCheckInterval: config.process.healthCheckInterval,
      });
      
      const process = await processManager.addProcess(config);
      
      if (body.autoStart) {
        await process.start();
      }
      
      return c.json({ id, message: 'Service created successfully' }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { 
          message: 'Validation error',
          cause: error.errors,
        });
      }
      logger.error('Failed to create service:', error);
      throw new HTTPException(500, { message: 'Failed to create service' });
    }
  });

  app.put('/services/:id', async (c) => {
    const id = c.req.param('id');
    
    try {
      const body = await c.req.json();
      const validated = UpdateServiceSchema.parse(body);
      
      const [existingService] = await db.select().from(services).where(eq(services.id, id));
      
      if (!existingService) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      const updates: any = {};
      
      if (validated.name !== undefined) updates.name = validated.name;
      if (validated.repository?.url !== undefined) updates.repositoryUrl = validated.repository.url;
      if (validated.repository?.branch !== undefined) updates.repositoryBranch = validated.repository.branch;
      if (validated.repository?.path !== undefined) updates.repositoryPath = validated.repository.path;
      if (validated.repository?.entryPoint !== undefined) updates.entryPoint = validated.repository.entryPoint;
      if (validated.environment !== undefined) updates.environment = JSON.stringify(validated.environment);
      if (validated.proxy?.path !== undefined) updates.proxyPath = validated.proxy.path;
      if (validated.proxy?.rateLimit !== undefined) updates.rateLimit = validated.proxy.rateLimit;
      if (validated.proxy?.cacheTTL !== undefined) updates.cacheTTL = validated.proxy.cacheTTL;
      if (validated.proxy?.timeout !== undefined) updates.timeout = validated.proxy.timeout;
      if (validated.process?.autoRestart !== undefined) updates.autoRestart = validated.process.autoRestart;
      if (validated.process?.maxRestarts !== undefined) updates.maxRestarts = validated.process.maxRestarts;
      if (validated.process?.maxMemory !== undefined) updates.maxMemory = validated.process.maxMemory;
      if (validated.process?.healthCheckInterval !== undefined) updates.healthCheckInterval = validated.process.healthCheckInterval;
      
      updates.updatedAt = new Date().toISOString();
      
      await db.update(services).set(updates).where(eq(services.id, id));
      
      const process = processManager.getProcess(id);
      if (process) {
        await process.restart();
      }
      
      return c.json({ message: 'Service updated successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { 
          message: 'Validation error',
          cause: error.errors,
        });
      }
      logger.error(`Failed to update service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to update service' });
    }
  });

  app.delete('/services/:id', async (c) => {
    const id = c.req.param('id');
    
    try {
      const [service] = await db.select().from(services).where(eq(services.id, id));
      
      if (!service) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      await processManager.removeProcess(id);
      await db.delete(services).where(eq(services.id, id));
      
      return c.json({ message: 'Service deleted successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to delete service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to delete service' });
    }
  });

  app.post('/services/:id/start', async (c) => {
    const id = c.req.param('id');
    
    try {
      const process = processManager.getProcess(id);
      
      if (!process) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      await process.start();
      
      await db.update(services)
        .set({ status: 'running' })
        .where(eq(services.id, id));
      
      return c.json({ message: 'Service started successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to start service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to start service' });
    }
  });

  app.post('/services/:id/stop', async (c) => {
    const id = c.req.param('id');
    
    try {
      const process = processManager.getProcess(id);
      
      if (!process) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      await process.stop();
      
      await db.update(services)
        .set({ status: 'stopped' })
        .where(eq(services.id, id));
      
      return c.json({ message: 'Service stopped successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to stop service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to stop service' });
    }
  });

  app.post('/services/:id/restart', async (c) => {
    const id = c.req.param('id');
    
    try {
      const process = processManager.getProcess(id);
      
      if (!process) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      await process.restart();
      
      return c.json({ message: 'Service restarted successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to restart service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to restart service' });
    }
  });

  app.get('/services/:id/logs', async (c) => {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '100');
    
    try {
      const serviceLogs = await db.select()
        .from(logs)
        .where(eq(logs.serviceId, id))
        .orderBy(logs.timestamp)
        .limit(limit);
      
      return c.json(serviceLogs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })));
    } catch (error) {
      logger.error(`Failed to get logs for service ${id}:`, error);
      throw new HTTPException(500, { message: 'Failed to get logs' });
    }
  });

  // Note: WebSocket support for log streaming is handled by createWebSocketProxy
  // in the main server setup, not via Hono's WebSocket API

  return app;
}