import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { WebSocketServer } from 'ws';
import { ProcessManager } from '../lib/process-manager';
import jsonrpcLite from 'jsonrpc-lite';
const { JSONRPCRequest, JSONRPCResponse, parseJSONRPCRequest } = jsonrpcLite;
import { logger } from '../lib/logger';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { cacheMiddleware } from './middleware/cache';
import { z } from 'zod';

const RequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.any().optional(),
  id: z.union([z.string(), z.number()]).optional(),
});

export function createProxyRouter(processManager: ProcessManager) {
  const app = new Hono();

  app.use('/*', cors());

  app.post('/mcp/:serviceId/*', rateLimitMiddleware(), cacheMiddleware(), async (c) => {
    const serviceId = c.req.param('serviceId');
    const mcpProcess = processManager.getProcess(serviceId);

    if (!mcpProcess) {
      throw new HTTPException(404, { message: `Service ${serviceId} not found` });
    }

    const state = mcpProcess.getState();
    if (state.status !== 'running') {
      throw new HTTPException(503, { 
        message: `Service ${serviceId} is not running`,
        cause: { status: state.status, error: state.lastError },
      });
    }

    try {
      const body = await c.req.json();
      const validatedRequest = RequestSchema.parse(body);
      
      const request = parseJSONRPCRequest(JSON.stringify(validatedRequest));
      
      if ('type' in request && request.type === 'invalid') {
        return c.json({ 
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: null,
        }, 400);
      }

      const response = await mcpProcess.sendRequest(request as JSONRPCRequest);
      
      return c.json(response);
    } catch (error) {
      logger.error(`Proxy error for ${serviceId}:`, error);
      
      if (error instanceof z.ZodError) {
        return c.json({
          jsonrpc: '2.0',
          error: { 
            code: -32602, 
            message: 'Invalid params',
            data: error.errors,
          },
          id: null,
        }, 400);
      }
      
      return c.json({
        jsonrpc: '2.0',
        error: { 
          code: -32603, 
          message: error instanceof Error ? error.message : 'Internal error',
        },
        id: null,
      }, 500);
    }
  });

  app.get('/mcp/:serviceId/health', async (c) => {
    const serviceId = c.req.param('serviceId');
    const mcpProcess = processManager.getProcess(serviceId);

    if (!mcpProcess) {
      return c.json({ status: 'not_found' }, 404);
    }

    const state = mcpProcess.getState();
    const metrics = mcpProcess.getMetrics();

    return c.json({
      status: state.status,
      metrics,
      lastError: state.lastError,
    });
  });

  return app;
}

export function createWebSocketProxy(
  server: any,
  processManager: ProcessManager,
) {
  const wss = new WebSocketServer({ server, path: '/mcp/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const serviceId = url.searchParams.get('service');

    if (!serviceId) {
      ws.send(JSON.stringify({ 
        error: 'Service ID required',
      }));
      ws.close();
      return;
    }

    const mcpProcess = processManager.getProcess(serviceId);
    if (!mcpProcess) {
      ws.send(JSON.stringify({ 
        error: `Service ${serviceId} not found`,
      }));
      ws.close();
      return;
    }

    const state = mcpProcess.getState();
    if (state.status !== 'running') {
      ws.send(JSON.stringify({ 
        error: `Service ${serviceId} is not running`,
      }));
      ws.close();
      return;
    }

    logger.info(`WebSocket connection established for service ${serviceId}`);

    const notificationHandler = (notification: any) => {
      ws.send(JSON.stringify(notification));
    };

    const errorHandler = (error: string) => {
      ws.send(JSON.stringify({ 
        type: 'error',
        message: error,
      }));
    };

    mcpProcess.on('notification', notificationHandler);
    mcpProcess.on('error', errorHandler);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const request = parseJSONRPCRequest(JSON.stringify(message));
        
        if ('type' in request && request.type === 'invalid') {
          ws.send(JSON.stringify({ 
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: null,
          }));
          return;
        }

        const response = await mcpProcess.sendRequest(request as JSONRPCRequest);
        ws.send(JSON.stringify(response));
      } catch (error) {
        logger.error(`WebSocket error for ${serviceId}:`, error);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          error: { 
            code: -32603, 
            message: error instanceof Error ? error.message : 'Internal error',
          },
          id: null,
        }));
      }
    });

    ws.on('close', () => {
      logger.info(`WebSocket connection closed for service ${serviceId}`);
      mcpProcess.removeListener('notification', notificationHandler);
      mcpProcess.removeListener('error', errorHandler);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for ${serviceId}:`, error);
    });
  });

  return wss;
}