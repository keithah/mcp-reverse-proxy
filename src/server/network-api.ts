import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { SSLManager, SSLConfigSchema } from '../lib/network/ssl-manager';
import { UPnPManager, NetworkConfigSchema, PortMappingSchema } from '../lib/network/upnp-manager';
import { logger } from '../lib/logger';
import { authMiddleware } from './middleware/auth';
import si from 'systeminformation';

export function createNetworkAPI(
  sslManager: SSLManager,
  upnpManager: UPnPManager,
) {
  const app = new Hono();

  app.use('/*', authMiddleware());

  app.get('/status', async (c) => {
    try {
      const networkStatus = upnpManager.getNetworkStatus();
      const portStatus = await upnpManager.checkPortForwarding();
      const systemInfo = await si.networkInterfaces();
      
      return c.json({
        network: networkStatus,
        portForwarding: Array.from(portStatus.entries()).map(([port, open]) => ({
          port,
          open,
        })),
        interfaces: systemInfo,
        ssl: {
          enabled: sslManager.isSSLEnabled(),
          domain: sslManager.getDomain(),
        },
      });
    } catch (error) {
      logger.error('Failed to get network status:', error);
      throw new HTTPException(500, { message: 'Failed to get network status' });
    }
  });

  app.get('/ssl/status', async (c) => {
    try {
      const certs = await sslManager.getCertificates();
      
      return c.json({
        enabled: sslManager.isSSLEnabled(),
        domain: sslManager.getDomain(),
        hasCertificate: !!certs,
        certificateType: certs ? (certs.ca ? 'letsencrypt' : 'self-signed') : null,
      });
    } catch (error) {
      logger.error('Failed to get SSL status:', error);
      throw new HTTPException(500, { message: 'Failed to get SSL status' });
    }
  });

  app.post('/ssl/configure', async (c) => {
    try {
      const body = await c.req.json();
      const config = SSLConfigSchema.parse(body);
      
      await sslManager.updateConfig(config);
      await sslManager.initialize();
      
      return c.json({ message: 'SSL configuration updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Invalid SSL configuration',
          cause: error.errors,
        });
      }
      logger.error('Failed to configure SSL:', error);
      throw new HTTPException(500, { message: 'Failed to configure SSL' });
    }
  });

  app.post('/ssl/generate-self-signed', async (c) => {
    try {
      const body = await c.req.json();
      const { domain } = z.object({ domain: z.string() }).parse(body);
      
      await sslManager.updateConfig({
        provider: 'self-signed',
        domain,
        enabled: true,
      });
      
      await sslManager.initialize();
      
      return c.json({ message: 'Self-signed certificate generated successfully' });
    } catch (error) {
      logger.error('Failed to generate self-signed certificate:', error);
      throw new HTTPException(500, { message: 'Failed to generate certificate' });
    }
  });

  app.get('/upnp/status', async (c) => {
    try {
      const status = upnpManager.getNetworkStatus();
      const mappings = await upnpManager.getMappedPorts();
      
      return c.json({
        ...status,
        allMappings: mappings,
      });
    } catch (error) {
      logger.error('Failed to get UPnP status:', error);
      throw new HTTPException(500, { message: 'Failed to get UPnP status' });
    }
  });

  app.post('/upnp/map-port', async (c) => {
    try {
      const body = await c.req.json();
      const mapping = PortMappingSchema.parse(body);
      
      const success = await upnpManager.mapPort(mapping);
      
      if (!success) {
        throw new HTTPException(500, { message: 'Failed to map port' });
      }
      
      return c.json({ message: 'Port mapped successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: 'Invalid port mapping',
          cause: error.errors,
        });
      }
      logger.error('Failed to map port:', error);
      throw new HTTPException(500, { message: 'Failed to map port' });
    }
  });

  app.delete('/upnp/unmap-port', async (c) => {
    try {
      const { protocol, port } = z.object({
        protocol: z.enum(['tcp', 'udp']),
        port: z.number(),
      }).parse(await c.req.json());
      
      const success = await upnpManager.unmapPort(protocol, port);
      
      if (!success) {
        throw new HTTPException(500, { message: 'Failed to unmap port' });
      }
      
      return c.json({ message: 'Port unmapped successfully' });
    } catch (error) {
      logger.error('Failed to unmap port:', error);
      throw new HTTPException(500, { message: 'Failed to unmap port' });
    }
  });

  app.get('/upnp/check-ports', async (c) => {
    try {
      const results = await upnpManager.checkPortForwarding();
      
      return c.json(
        Array.from(results.entries()).map(([port, open]) => ({
          port,
          open,
          status: open ? 'reachable' : 'unreachable',
        }))
      );
    } catch (error) {
      logger.error('Failed to check ports:', error);
      throw new HTTPException(500, { message: 'Failed to check ports' });
    }
  });

  app.get('/upnp/find-available-ports', async (c) => {
    try {
      const count = parseInt(c.req.query('count') || '3');
      const startPort = parseInt(c.req.query('start') || '8000');
      
      const ports = await upnpManager.findAvailablePorts(count, startPort);
      
      return c.json({ ports });
    } catch (error) {
      logger.error('Failed to find available ports:', error);
      throw new HTTPException(500, { message: 'Failed to find available ports' });
    }
  });

  app.get('/system/network-info', async (c) => {
    try {
      const [networkInterfaces, networkStats, internetConnectivity] = await Promise.all([
        si.networkInterfaces(),
        si.networkStats(),
        si.inetChecksite('https://google.com'),
      ]);
      
      const publicIP = await upnpManager.getExternalIP();
      const privateIP = await upnpManager.getInternalIP();
      
      return c.json({
        publicIP,
        privateIP,
        interfaces: networkInterfaces,
        stats: networkStats,
        internetConnected: internetConnectivity.ok,
        latency: internetConnectivity.ms,
      });
    } catch (error) {
      logger.error('Failed to get network info:', error);
      throw new HTTPException(500, { message: 'Failed to get network info' });
    }
  });

  return app;
}