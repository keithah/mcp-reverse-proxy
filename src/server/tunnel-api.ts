import { Hono } from 'hono';
import { TunnelManager, TunnelConfig } from './tunnel-manager.js';
import * as winston from 'winston';

export function createTunnelAPI(tunnelManager: TunnelManager, logger: winston.Logger) {
  const app = new Hono();

  // Get current tunnel configuration
  app.get('/config', async (c) => {
    try {
      const config = tunnelManager.getConfig();
      const externalURL = await tunnelManager.getExternalURL();

      return c.json({
        success: true,
        data: {
          ...config,
          externalURL
        }
      });
    } catch (error) {
      logger.error('Failed to get tunnel config', { error });
      return c.json({
        success: false,
        error: 'Failed to get tunnel configuration'
      }, 500);
    }
  });

  // Update tunnel configuration
  app.post('/config', async (c) => {
    try {
      const body = await c.req.json();
      await tunnelManager.updateConfig(body);

      return c.json({
        success: true,
        message: 'Tunnel configuration updated'
      });
    } catch (error) {
      logger.error('Failed to update tunnel config', { error });
      return c.json({
        success: false,
        error: 'Failed to update tunnel configuration'
      }, 500);
    }
  });

  // Setup Cloudflare Tunnel
  app.post('/cloudflare/setup', async (c) => {
    try {
      const { token, domain } = await c.req.json();

      if (!token) {
        return c.json({
          success: false,
          error: 'Cloudflare token is required'
        }, 400);
      }

      const url = await tunnelManager.setupCloudflareeTunnel(token, domain);

      return c.json({
        success: true,
        data: { url },
        message: 'Cloudflare Tunnel setup successfully'
      });
    } catch (error) {
      logger.error('Failed to setup Cloudflare tunnel', { error });
      return c.json({
        success: false,
        error: 'Failed to setup Cloudflare tunnel'
      }, 500);
    }
  });

  // Setup Tailscale Funnel
  app.post('/tailscale/setup', async (c) => {
    try {
      const { authKey } = await c.req.json();
      const url = await tunnelManager.setupTailscaleFunnel(authKey);

      return c.json({
        success: true,
        data: { url },
        message: 'Tailscale Funnel setup successfully'
      });
    } catch (error) {
      logger.error('Failed to setup Tailscale funnel', { error });
      return c.json({
        success: false,
        error: 'Failed to setup Tailscale funnel'
      }, 500);
    }
  });

  // Setup UPnP
  app.post('/upnp/setup', async (c) => {
    try {
      await tunnelManager.setupUPnP();
      const url = await tunnelManager.getExternalURL();

      return c.json({
        success: true,
        data: { url },
        message: 'UPnP port mapping setup successfully'
      });
    } catch (error) {
      logger.error('Failed to setup UPnP', { error });
      return c.json({
        success: false,
        error: 'Failed to setup UPnP port mapping'
      }, 500);
    }
  });

  // Stop all tunnels
  app.post('/stop', async (c) => {
    try {
      await tunnelManager.stop();

      return c.json({
        success: true,
        message: 'All tunnels stopped successfully'
      });
    } catch (error) {
      logger.error('Failed to stop tunnels', { error });
      return c.json({
        success: false,
        error: 'Failed to stop tunnels'
      }, 500);
    }
  });

  // Test external connectivity
  app.post('/test', async (c) => {
    try {
      const url = await tunnelManager.getExternalURL();

      if (!url) {
        return c.json({
          success: false,
          error: 'No external URL configured'
        });
      }

      // Try to fetch the health endpoint through the external URL
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${url}/health`, {
        timeout: 10000,
        headers: { 'User-Agent': 'MCP-Proxy-Health-Check' }
      });

      if (response.ok) {
        return c.json({
          success: true,
          data: { url, accessible: true },
          message: 'External access is working correctly'
        });
      } else {
        return c.json({
          success: false,
          data: { url, accessible: false, status: response.status },
          error: 'External URL is not accessible'
        });
      }
    } catch (error) {
      logger.error('Failed to test external connectivity', { error });
      return c.json({
        success: false,
        error: 'Failed to test external connectivity'
      }, 500);
    }
  });

  return app;
}