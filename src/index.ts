import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import dotenv from 'dotenv';
import { ProcessManager } from './lib/process-manager';
import { createProxyRouter, createWebSocketProxy } from './server/proxy';
import { createManagementAPI } from './server/api';
import { createGitHubAPI } from './server/github-api';
import { GitHubService } from './lib/github';
import { db, runMigrations } from './lib/db';
import { services } from './lib/db/schema';
import { logger } from './lib/logger';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    logger.info('Starting MCP Reverse Proxy...');
    
    await runMigrations();
    logger.info('Database migrations completed');
    
    const processManager = new ProcessManager();
    const githubService = new GitHubService();
    
    const dbServices = await db.select().from(services);
    for (const service of dbServices) {
      const config = {
        id: service.id,
        name: service.name,
        repository: {
          url: service.repositoryUrl || '',
          branch: service.repositoryBranch || 'main',
          path: service.repositoryPath || './',
          entryPoint: service.entryPoint,
        },
        environment: JSON.parse(service.environment || '{}'),
        proxy: {
          path: service.proxyPath,
          rateLimit: service.rateLimit || 100,
          cacheTTL: service.cacheTTL || 300,
          timeout: service.timeout || 30000,
        },
        process: {
          autoRestart: service.autoRestart !== false,
          maxRestarts: service.maxRestarts || 5,
          maxMemory: service.maxMemory || '512MB',
          healthCheckInterval: service.healthCheckInterval || 30,
        },
      };
      
      const process = await processManager.addProcess(config);
      
      if (service.status === 'running') {
        await process.start().catch(err => {
          logger.error(`Failed to start service ${service.id}:`, err);
        });
      }
    }
    logger.info(`Loaded ${dbServices.length} services from database`);
    
    const app = new Hono();
    
    app.use('*', honoLogger());
    app.use('*', cors());
    
    const proxyRouter = createProxyRouter(processManager);
    const managementAPI = createManagementAPI(processManager, githubService);
    const githubAPI = createGitHubAPI(processManager, githubService);

    app.route('/', proxyRouter);
    app.route('/api', managementAPI);
    app.route('/api/github', githubAPI);
    
    app.get('/health', (c) => {
      const processes = processManager.getAllProcesses();
      const runningCount = processes.filter(p => p.getState().status === 'running').length;
      
      return c.json({
        status: 'healthy',
        services: {
          total: processes.length,
          running: runningCount,
          stopped: processes.length - runningCount,
        },
        timestamp: new Date().toISOString(),
      });
    });
    
    const port = parseInt(process.env.PORT || '8080');
    
    const server = serve({
      fetch: app.fetch,
      port,
    });
    
    createWebSocketProxy(server, processManager);
    
    logger.info(`MCP Reverse Proxy running on http://localhost:${port}`);
    logger.info(`Management API available at http://localhost:${port}/api`);
    logger.info(`Health check available at http://localhost:${port}/health`);
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await processManager.stopAll();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await processManager.stopAll();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();