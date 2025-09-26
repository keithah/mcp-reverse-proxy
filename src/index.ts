import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { ProcessManager } from './lib/process-manager';
import { createProxyRouter, createWebSocketProxy } from './server/proxy';
import { createManagementAPI } from './server/api';
import { createGitHubAPI } from './server/github-api';
import { createNetworkAPI } from './server/network-api';
import { createConfigAPI } from './server/config-api';
import { createTunnelAPI } from './server/tunnel-api';
import { TunnelManager } from './server/tunnel-manager';
import { GitHubService } from './lib/github';
import { SSLManager } from './lib/network/ssl-manager';
import { UPnPManager } from './lib/network/upnp-manager';
import { HTTPSServer } from './server/https-server';
import { configManager } from './lib/config-manager';
import { db, runMigrations } from './lib/db/index';
import { services } from './lib/db/schema';
import { logger } from './lib/logger';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    logger.info('Starting MCP Reverse Proxy...');
    
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize configuration manager
    await configManager.initialize();
    const config = await configManager.getAll();

    // Check if setup is required
    const isFirstRun = await configManager.isFirstRun();
    if (isFirstRun && process.env.INITIAL_SETUP === 'true') {
      logger.info('First run detected - configuration will be done through web UI');
    }

    const processManager = new ProcessManager();
    const githubService = new GitHubService(config.github?.cloneDirectory);

    // Initialize SSL Manager from config
    const sslManager = new SSLManager(config.ssl);
    await sslManager.initialize();

    // Initialize UPnP Manager from config
    const upnpManager = new UPnPManager({
      ...config.network,
      ports: {
        backend: config.server.backendPort,
        frontend: config.server.frontendPort,
        https: config.server.httpsPort,
      },
    });
    await upnpManager.initialize();

    // Initialize Tunnel Manager
    const tunnelManager = new TunnelManager(logger, path.join(__dirname, '../data'));

    // Auto-enable UPnP tunneling if configured
    if (config.network.enableUPnP) {
      try {
        await tunnelManager.updateConfig({
          type: 'upnp',
          enabled: true,
          config: {
            upnp: {
              enabled: true,
              ports: [config.server.backendPort, config.server.frontendPort, config.server.httpsPort]
            }
          }
        });
        await tunnelManager.setupUPnP();
        logger.info('Auto-enabled UPnP tunneling from configuration');
      } catch (error) {
        logger.warn('Failed to auto-enable UPnP tunneling', { error });
      }
    }
    
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
    const configAPI = createConfigAPI();
    const tunnelAPI = createTunnelAPI(tunnelManager, logger);

    app.route('/', proxyRouter);
    app.route('/api', managementAPI);
    app.route('/api/github', githubAPI);
    app.route('/api/network', networkAPI);
    app.route('/api/config', configAPI);
    app.route('/api/tunnel', tunnelAPI);
    
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
    
    // Use ports from configuration
    const httpPort = config.server.backendPort;
    const httpsPort = config.server.httpsPort;

    const httpsServer = new HTTPSServer({
      app,
      httpPort,
      httpsPort,
      sslManager,
      forceSSL: config.ssl.forceSSL,
    });

    const servers = await httpsServer.start();

    createWebSocketProxy(servers.http, processManager);
    if (servers.https) {
      createWebSocketProxy(servers.https, processManager);
    }

    const publicIP = await upnpManager.getExternalIP();
    const domain = sslManager.getDomain();
    const externalURL = await tunnelManager.getExternalURL();

    logger.info('========================================');
    logger.info('MCP Reverse Proxy Started Successfully');
    logger.info('========================================');
    logger.info(`HTTP Server: http://localhost:${httpPort}`);
    if (servers.https) {
      logger.info(`HTTPS Server: https://localhost:${httpsPort}`);
    }
    if (externalURL) {
      logger.info(`External URL: ${externalURL}`);
    } else if (domain && publicIP) {
      logger.info(`Public URL: https://${domain}:${httpsPort}`);
    } else if (publicIP) {
      logger.info(`Public IP: ${publicIP}`);
    }
    logger.info('----------------------------------------');
    logger.info(`Management API: /api`);
    logger.info(`Network Config: /api/network`);
    logger.info(`Tunnel Config: /api/tunnel`);
    logger.info(`Health Check: /health`);
    logger.info('========================================');

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await tunnelManager.stop();
      await upnpManager.cleanup();
      await processManager.stopAll();
      await httpsServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await tunnelManager.stop();
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