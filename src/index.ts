import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import dotenv from 'dotenv';
import { ProcessManager } from './lib/process-manager';
import { createProxyRouter, createWebSocketProxy } from './server/proxy';
import { createManagementAPI } from './server/api';
import { createGitHubAPI } from './server/github-api';
import { createNetworkAPI } from './server/network-api';
import { GitHubService } from './lib/github';
import { SSLManager, SSLConfigSchema } from './lib/network/ssl-manager';
import { UPnPManager, NetworkConfigSchema } from './lib/network/upnp-manager';
import { HTTPSServer } from './server/https-server';
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

    // Initialize SSL Manager
    const sslConfig = SSLConfigSchema.parse({
      enabled: process.env.SSL_ENABLED === 'true',
      domain: process.env.DOMAIN,
      email: process.env.SSL_EMAIL,
      staging: process.env.SSL_STAGING !== 'false',
      forceSSL: process.env.FORCE_SSL !== 'false',
      provider: process.env.SSL_PROVIDER || 'letsencrypt',
      cloudflareToken: process.env.CLOUDFLARE_TOKEN,
    });

    const sslManager = new SSLManager(sslConfig);
    await sslManager.initialize();

    // Initialize UPnP Manager with non-standard ports
    const networkConfig = NetworkConfigSchema.parse({
      enableUPnP: process.env.ENABLE_UPNP !== 'false',
      autoMapPorts: process.env.AUTO_MAP_PORTS !== 'false',
      publicIP: process.env.PUBLIC_IP,
      privateIP: process.env.PRIVATE_IP,
      ports: {
        backend: parseInt(process.env.BACKEND_PORT || '8437'),
        frontend: parseInt(process.env.FRONTEND_PORT || '3437'),
        https: parseInt(process.env.HTTPS_PORT || '8443'),
      },
    });

    const upnpManager = new UPnPManager(networkConfig);
    await upnpManager.initialize();
    
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
    const networkAPI = createNetworkAPI(sslManager, upnpManager);

    app.route('/', proxyRouter);
    app.route('/api', managementAPI);
    app.route('/api/github', githubAPI);
    app.route('/api/network', networkAPI);
    
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
    
    // Use non-standard ports
    const httpPort = networkConfig.ports.backend;
    const httpsPort = networkConfig.ports.https;

    const httpsServer = new HTTPSServer({
      app,
      httpPort,
      httpsPort,
      sslManager,
      forceSSL: sslConfig.forceSSL,
    });

    const servers = await httpsServer.start();

    createWebSocketProxy(servers.http, processManager);
    if (servers.https) {
      createWebSocketProxy(servers.https, processManager);
    }

    const publicIP = await upnpManager.getExternalIP();
    const domain = sslManager.getDomain();

    logger.info('========================================');
    logger.info('MCP Reverse Proxy Started Successfully');
    logger.info('========================================');
    logger.info(`HTTP Server: http://localhost:${httpPort}`);
    if (servers.https) {
      logger.info(`HTTPS Server: https://localhost:${httpsPort}`);
    }
    if (domain && publicIP) {
      logger.info(`Public URL: https://${domain}:${httpsPort}`);
    } else if (publicIP) {
      logger.info(`Public IP: ${publicIP}`);
    }
    logger.info('----------------------------------------');
    logger.info(`Management API: /api`);
    logger.info(`Network Config: /api/network`);
    logger.info(`Health Check: /health`);
    logger.info('========================================');

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await upnpManager.cleanup();
      await processManager.stopAll();
      await httpsServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await upnpManager.cleanup();
      await processManager.stopAll();
      await httpsServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();