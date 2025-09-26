import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import crypto from 'crypto';
import { z } from 'zod';
import { ProcessManager } from '../lib/process-manager';
import { GitHubService, DeployRequestSchema } from '../lib/github';
import { db } from '../lib/db/index';
import { services } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { authMiddleware } from './middleware/auth';

const WebhookEventSchema = z.object({
  ref: z.string(),
  repository: z.object({
    full_name: z.string(),
    clone_url: z.string(),
  }),
  pusher: z.object({
    name: z.string(),
    email: z.string().optional(),
  }).optional(),
});

export function createGitHubAPI(
  processManager: ProcessManager,
  githubService: GitHubService,
) {
  const app = new Hono();

  app.use('/*', authMiddleware());

  app.post('/deploy', async (c) => {
    try {
      const body = await c.req.json();
      const validated = DeployRequestSchema.parse(body);
      
      const deployment = await githubService.deployFromGitHub(validated);
      
      const id = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const config = {
        id,
        name: validated.serviceName,
        repository: {
          url: validated.repositoryUrl,
          branch: validated.branch,
          path: deployment.path,
          entryPoint: deployment.manifest.entryPoint,
        },
        environment: {
          ...deployment.manifest.defaultEnv,
          ...validated.environment,
        },
        proxy: {
          path: `/mcp/${validated.serviceName}`,
          rateLimit: 100,
          cacheTTL: 300,
          timeout: 30000,
        },
        process: {
          autoRestart: true,
          maxRestarts: 5,
          maxMemory: '512MB',
          healthCheckInterval: 30,
        },
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
      await process.start();
      
      return c.json({
        id,
        message: 'Service deployed successfully',
        manifest: deployment.manifest,
        path: deployment.path,
      }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Validation error',
          cause: error.errors,
        });
      }
      logger.error('Failed to deploy from GitHub:', error);
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to deploy service',
      });
    }
  });

  app.post('/update/:id', async (c) => {
    const id = c.req.param('id');
    
    try {
      const [service] = await db.select().from(services).where(eq(services.id, id));
      
      if (!service) {
        throw new HTTPException(404, { message: 'Service not found' });
      }
      
      await githubService.updateFromGitHub(
        service.repositoryPath!,
        service.repositoryBranch || 'main'
      );
      
      const process = processManager.getProcess(id);
      if (process) {
        await process.restart();
      }
      
      return c.json({ message: 'Service updated successfully' });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error(`Failed to update service ${id} from GitHub:`, error);
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to update service',
      });
    }
  });

  app.get('/repos', async (c) => {
    try {
      const repos = await githubService.listDeployedServices();
      return c.json(repos);
    } catch (error) {
      logger.error('Failed to list GitHub repos:', error);
      throw new HTTPException(500, { message: 'Failed to list repositories' });
    }
  });

  app.post('/webhook', async (c) => {
    const signature = c.req.header('x-hub-signature-256');
    const event = c.req.header('x-github-event');
    
    if (!signature) {
      throw new HTTPException(400, { message: 'Missing signature' });
    }
    
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('GitHub webhook secret not configured');
      throw new HTTPException(500, { message: 'Webhook not configured' });
    }
    
    const body = await c.req.text();
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;
    
    if (signature !== expectedSignature) {
      throw new HTTPException(401, { message: 'Invalid signature' });
    }
    
    if (event !== 'push') {
      return c.json({ message: `Event ${event} ignored` });
    }
    
    try {
      const payload = JSON.parse(body);
      const validated = WebhookEventSchema.parse(payload);
      
      const branch = validated.ref.replace('refs/heads/', '');
      const repoUrl = validated.repository.clone_url;
      
      const affectedServices = await db.select()
        .from(services)
        .where(eq(services.repositoryUrl, repoUrl));
      
      for (const service of affectedServices) {
        if (service.repositoryBranch === branch) {
          logger.info(`Updating service ${service.id} from webhook`);
          
          try {
            await githubService.updateFromGitHub(
              service.repositoryPath!,
              branch
            );
            
            const process = processManager.getProcess(service.id);
            if (process) {
              await process.restart();
            }
          } catch (error) {
            logger.error(`Failed to update service ${service.id}:`, error);
          }
        }
      }
      
      return c.json({
        message: 'Webhook processed',
        updated: affectedServices.length,
      });
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      throw new HTTPException(500, { message: 'Failed to process webhook' });
    }
  });

  return app;
}