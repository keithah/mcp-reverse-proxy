import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as winston from 'winston';

const execAsync = promisify(exec);

export interface TunnelConfig {
  type: 'cloudflare' | 'tailscale' | 'ngrok' | 'upnp';
  enabled: boolean;
  config?: {
    cloudflare?: {
      token?: string;
      domain?: string;
    };
    tailscale?: {
      authKey?: string;
      funnel?: boolean;
    };
    ngrok?: {
      authToken?: string;
      domain?: string;
      region?: string;
    };
    upnp?: {
      enabled: boolean;
      ports: number[];
    };
  };
}

export class TunnelManager {
  private logger: winston.Logger;
  private processes: Map<string, ChildProcess> = new Map();
  private config: TunnelConfig;
  private configPath: string;

  constructor(logger: winston.Logger, configPath: string = './data') {
    this.logger = logger;
    this.configPath = configPath;

    // Ensure config directory exists
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true });
    }

    this.config = this.loadConfig();
  }

  private loadConfig(): TunnelConfig {
    const configFile = join(this.configPath, 'tunnel-config.json');
    try {
      if (existsSync(configFile)) {
        return JSON.parse(require('fs').readFileSync(configFile, 'utf8'));
      }
    } catch (error) {
      this.logger.warn('Failed to load tunnel config, using defaults', { error });
    }

    return {
      type: 'upnp',
      enabled: false,
      config: {
        upnp: {
          enabled: false,
          ports: [8437, 3437, 8443]
        }
      }
    };
  }

  private saveConfig(): void {
    const configFile = join(this.configPath, 'tunnel-config.json');
    try {
      writeFileSync(configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      this.logger.error('Failed to save tunnel config', { error });
    }
  }

  async setupCloudflareeTunnel(token: string, domain?: string): Promise<string> {
    try {
      // If domain is provided and contains a dot, it's a custom domain
      // Otherwise, use the trycloudflare.com subdomain
      const isCustomDomain = domain && domain.includes('.');
      const tunnelName = isCustomDomain ? domain.split('.')[0] : (domain || 'mcp-proxy');
      const hostname = isCustomDomain ? domain : `${tunnelName}.trycloudflare.com`;

      // Create cloudflared config
      const tunnelConfig = {
        tunnel: tunnelName,
        credentials: token,
        ingress: [
          {
            hostname: hostname,
            service: 'http://localhost:3437'
          },
          // For custom domains, also handle API subdomain
          ...(isCustomDomain ? [{
            hostname: `api.${domain}`,
            service: 'http://localhost:8437'
          }] : [{
            hostname: `api-${tunnelName}.trycloudflare.com`,
            service: 'http://localhost:8437'
          }]),
          {
            service: 'http_status:404'
          }
        ]
      };

      const configFile = join(this.configPath, 'cloudflared.yml');
      writeFileSync(configFile, require('yaml').stringify(tunnelConfig));

      // Start cloudflared
      const process = spawn('cloudflared', ['tunnel', 'run', '--config', configFile], {
        stdio: 'pipe'
      });

      process.stdout?.on('data', (data) => {
        this.logger.info('Cloudflare Tunnel:', { data: data.toString() });
      });

      process.stderr?.on('data', (data) => {
        this.logger.info('Cloudflare Tunnel:', { data: data.toString() });
      });

      this.processes.set('cloudflare', process);
      this.config.type = 'cloudflare';
      this.config.enabled = true;
      this.config.config!.cloudflare = { token, domain };
      this.saveConfig();

      return `https://${hostname}`;
    } catch (error) {
      this.logger.error('Failed to setup Cloudflare tunnel', { error });
      throw error;
    }
  }

  async setupNgrok(authToken?: string, domain?: string, region?: string): Promise<string> {
    try {
      // Authenticate with ngrok if token provided
      if (authToken) {
        await execAsync(`ngrok config add-authtoken ${authToken}`);
      }

      // Start ngrok tunnel for web interface
      const ngrokArgs = [
        'http',
        '3437',
        '--log=stdout',
        '--log-level=info'
      ];

      // Add custom domain if provided
      if (domain) {
        ngrokArgs.push(`--hostname=${domain}`);
      }

      // Add region if provided
      if (region) {
        ngrokArgs.push(`--region=${region}`);
      }

      const process = spawn('ngrok', ngrokArgs, {
        stdio: 'pipe'
      });

      let tunnelUrl = '';

      process.stdout?.on('data', (data) => {
        const output = data.toString();
        this.logger.info('ngrok:', { data: output });

        // Extract tunnel URL from ngrok output
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9.-]+\.ngrok[a-zA-Z0-9.-]*\.io/);
        if (urlMatch) {
          tunnelUrl = urlMatch[0];
        }
      });

      process.stderr?.on('data', (data) => {
        this.logger.info('ngrok:', { data: data.toString() });
      });

      this.processes.set('ngrok', process);
      this.config.type = 'ngrok';
      this.config.enabled = true;
      this.config.config!.ngrok = { authToken, domain, region };
      this.saveConfig();

      // Wait a bit for ngrok to establish tunnel
      await new Promise(resolve => setTimeout(resolve, 3000));

      // If we couldn't get URL from stdout, try ngrok API
      if (!tunnelUrl) {
        try {
          const { stdout } = await execAsync('curl -s http://localhost:4040/api/tunnels');
          const tunnels = JSON.parse(stdout);
          if (tunnels.tunnels && tunnels.tunnels.length > 0) {
            tunnelUrl = tunnels.tunnels[0].public_url;
          }
        } catch (error) {
          this.logger.warn('Failed to get ngrok tunnel URL from API', { error });
        }
      }

      return domain ? `https://${domain}` : (tunnelUrl || 'https://your-tunnel.ngrok.io');
    } catch (error) {
      this.logger.error('Failed to setup ngrok tunnel', { error });
      throw error;
    }
  }

  async setupTailscaleFunnel(authKey?: string): Promise<string> {
    try {
      if (authKey) {
        // Authenticate with Tailscale
        await execAsync(`tailscale up --authkey=${authKey}`);
      }

      // Get tailscale IP
      const { stdout } = await execAsync('tailscale ip -4');
      const tailscaleIP = stdout.trim();

      // Enable funnel for web interface
      await execAsync(`tailscale serve --bg --https 443 --set-path / http://localhost:3437`);
      await execAsync(`tailscale serve --bg --https 443 --set-path /api http://localhost:8437`);

      // Enable funnel (public access)
      await execAsync('tailscale funnel 443 on');

      this.config.type = 'tailscale';
      this.config.enabled = true;
      this.config.config!.tailscale = { authKey, funnel: true };
      this.saveConfig();

      // Get public funnel URL
      const { stdout: funnelInfo } = await execAsync('tailscale serve status');
      this.logger.info('Tailscale Funnel setup complete', { info: funnelInfo });

      return `https://${tailscaleIP}`;
    } catch (error) {
      this.logger.error('Failed to setup Tailscale funnel', { error });
      throw error;
    }
  }

  async setupUPnP(): Promise<void> {
    const natUpnp = require('nat-upnp');
    const client = natUpnp.createClient();

    try {
      const ports = this.config.config?.upnp?.ports || [8437, 3437, 8443];

      for (const port of ports) {
        await new Promise((resolve, reject) => {
          client.portMapping({
            public: port,
            private: port,
            ttl: 10800 // 3 hours
          }, (err: any) => {
            if (err) {
              this.logger.warn(`Failed to map port ${port}`, { error: err });
              resolve(null);
            } else {
              this.logger.info(`Successfully mapped port ${port} via UPnP`);
              resolve(null);
            }
          });
        });
      }

      this.config.type = 'upnp';
      this.config.enabled = true;
      this.saveConfig();

      this.logger.info('UPnP port mapping completed');
    } catch (error) {
      this.logger.error('Failed to setup UPnP', { error });
      throw error;
    }
  }

  async getExternalURL(): Promise<string | null> {
    if (!this.config.enabled) return null;

    switch (this.config.type) {
      case 'cloudflare':
        const domain = this.config.config?.cloudflare?.domain || 'mcp-proxy';
        const isCustomDomain = domain.includes('.');
        return `https://${isCustomDomain ? domain : `${domain}.trycloudflare.com`}`;

      case 'tailscale':
        try {
          const { stdout } = await execAsync('tailscale ip -4');
          return `https://${stdout.trim()}`;
        } catch {
          return null;
        }

      case 'ngrok':
        try {
          // Try to get URL from ngrok API
          const { stdout } = await execAsync('curl -s http://localhost:4040/api/tunnels');
          const tunnels = JSON.parse(stdout);
          if (tunnels.tunnels && tunnels.tunnels.length > 0) {
            return tunnels.tunnels[0].public_url;
          }

          // Fallback to configured domain
          const ngrokDomain = this.config.config?.ngrok?.domain;
          return ngrokDomain ? `https://${ngrokDomain}` : null;
        } catch {
          return null;
        }

      case 'upnp':
        try {
          const publicIP = require('public-ip');
          const ip = await publicIP.v4();
          return `http://${ip}:3437`;
        } catch {
          return null;
        }

      default:
        return null;
    }
  }

  getConfig(): TunnelConfig {
    return this.config;
  }

  async updateConfig(config: Partial<TunnelConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.saveConfig();

    if (config.enabled === false) {
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    // Stop all running processes
    for (const [name, process] of this.processes) {
      try {
        process.kill();
        this.processes.delete(name);
        this.logger.info(`Stopped tunnel process: ${name}`);
      } catch (error) {
        this.logger.warn(`Failed to stop tunnel process: ${name}`, { error });
      }
    }

    // Clean up UPnP mappings if needed
    if (this.config.type === 'upnp') {
      try {
        const natUpnp = require('nat-upnp');
        const client = natUpnp.createClient();
        const ports = this.config.config?.upnp?.ports || [8437, 3437, 8443];

        for (const port of ports) {
          await new Promise((resolve) => {
            client.portUnmapping({ public: port }, () => resolve(null));
          });
        }
      } catch (error) {
        this.logger.warn('Failed to clean up UPnP mappings', { error });
      }
    }
  }
}