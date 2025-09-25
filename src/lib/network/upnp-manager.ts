import natUpnp from 'nat-upnp';
import { publicIpv4, publicIpv6 } from 'public-ip';
import { internalIpV4, internalIpV6 } from 'internal-ip';
import portscanner from 'portscanner';
import { networkInterfaces } from 'os';
import { logger } from '../logger';
import { z } from 'zod';

export const PortMappingSchema = z.object({
  protocol: z.enum(['tcp', 'udp']),
  public: z.number(),
  private: z.number(),
  description: z.string(),
  ttl: z.number().default(0),
});

export type PortMapping = z.infer<typeof PortMappingSchema>;

export const NetworkConfigSchema = z.object({
  enableUPnP: z.boolean().default(true),
  autoMapPorts: z.boolean().default(true),
  publicIP: z.string().optional(),
  privateIP: z.string().optional(),
  ports: z.object({
    backend: z.number().default(8437),
    frontend: z.number().default(3437),
    https: z.number().default(8443),
  }),
  mappings: z.array(PortMappingSchema).default([]),
});

export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

export class UPnPManager {
  private client: any;
  private config: NetworkConfig;
  private mappedPorts: Map<string, PortMapping> = new Map();
  private publicIP?: string;
  private privateIP?: string;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.client = natUpnp.createClient();
  }

  async initialize(): Promise<void> {
    try {
      await this.detectNetworkConfiguration();
      
      if (this.config.enableUPnP && this.config.autoMapPorts) {
        await this.setupPortMappings();
      }
      
      await this.checkPortForwarding();
    } catch (error) {
      logger.error('Failed to initialize UPnP:', error);
    }
  }

  private async detectNetworkConfiguration(): Promise<void> {
    try {
      this.publicIP = this.config.publicIP || await publicIpv4();
      this.privateIP = this.config.privateIP || await internalIpV4();
      
      logger.info(`Network configuration detected:`);
      logger.info(`  Public IP: ${this.publicIP}`);
      logger.info(`  Private IP: ${this.privateIP}`);
      
      const interfaces = networkInterfaces();
      const activeInterfaces = Object.entries(interfaces)
        .filter(([name, addrs]) => 
          addrs && addrs.some(addr => !addr.internal && addr.family === 'IPv4')
        )
        .map(([name]) => name);
      
      logger.info(`  Active interfaces: ${activeInterfaces.join(', ')}`);
    } catch (error) {
      logger.warn('Could not detect network configuration:', error);
      
      this.privateIP = '127.0.0.1';
      logger.info('Falling back to localhost configuration');
    }
  }

  private async setupPortMappings(): Promise<void> {
    const ports = [
      { 
        public: this.config.ports.backend, 
        private: this.config.ports.backend, 
        protocol: 'tcp' as const,
        description: 'MCP Proxy Backend',
      },
      { 
        public: this.config.ports.frontend, 
        private: this.config.ports.frontend, 
        protocol: 'tcp' as const,
        description: 'MCP Proxy Frontend',
      },
      { 
        public: this.config.ports.https, 
        private: this.config.ports.https, 
        protocol: 'tcp' as const,
        description: 'MCP Proxy HTTPS',
      },
    ];

    for (const port of ports) {
      await this.mapPort(port);
    }
  }

  async mapPort(mapping: Omit<PortMapping, 'ttl'>): Promise<boolean> {
    if (!this.config.enableUPnP) {
      logger.warn('UPnP is disabled, skipping port mapping');
      return false;
    }

    try {
      await this.client.portMapping({
        public: mapping.public,
        private: mapping.private,
        protocol: mapping.protocol.toUpperCase(),
        description: mapping.description,
        ttl: 0,
      });

      const key = `${mapping.protocol}:${mapping.public}`;
      this.mappedPorts.set(key, { ...mapping, ttl: 0 });
      
      logger.info(`Successfully mapped port ${mapping.public} (${mapping.protocol}) - ${mapping.description}`);
      return true;
    } catch (error) {
      logger.error(`Failed to map port ${mapping.public}:`, error);
      return false;
    }
  }

  async unmapPort(protocol: 'tcp' | 'udp', publicPort: number): Promise<boolean> {
    try {
      await this.client.portUnmapping({
        public: publicPort,
        protocol: protocol.toUpperCase(),
      });

      const key = `${protocol}:${publicPort}`;
      this.mappedPorts.delete(key);
      
      logger.info(`Successfully unmapped port ${publicPort} (${protocol})`);
      return true;
    } catch (error) {
      logger.error(`Failed to unmap port ${publicPort}:`, error);
      return false;
    }
  }

  async checkPortForwarding(): Promise<Map<number, boolean>> {
    const results = new Map<number, boolean>();
    const portsToCheck = [
      this.config.ports.backend,
      this.config.ports.frontend,
      this.config.ports.https,
    ];

    if (!this.publicIP) {
      logger.warn('No public IP detected, cannot check port forwarding');
      return results;
    }

    logger.info('Checking port forwarding status...');
    
    for (const port of portsToCheck) {
      try {
        const status = await portscanner.checkPortStatus(port, this.publicIP);
        const isOpen = status === 'open';
        results.set(port, isOpen);
        
        logger.info(`  Port ${port}: ${isOpen ? 'OPEN' : 'CLOSED'}`);
        
        if (!isOpen && this.mappedPorts.has(`tcp:${port}`)) {
          logger.warn(`Port ${port} is mapped via UPnP but not accessible from public IP`);
          logger.warn('Check your router/firewall settings');
        }
      } catch (error) {
        logger.error(`Failed to check port ${port}:`, error);
        results.set(port, false);
      }
    }

    return results;
  }

  async findAvailablePorts(count: number = 3, startPort: number = 8000): Promise<number[]> {
    const availablePorts: number[] = [];
    let currentPort = startPort;
    
    while (availablePorts.length < count && currentPort < 65535) {
      if (await this.isPortAvailable(currentPort)) {
        availablePorts.push(currentPort);
      }
      
      currentPort += Math.floor(Math.random() * 100) + 1;
    }
    
    return availablePorts;
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      const status = await portscanner.checkPortStatus(port, '127.0.0.1');
      return status === 'closed';
    } catch {
      return false;
    }
  }

  async getExternalIP(): Promise<string | null> {
    try {
      const ip = await publicIpv4();
      return ip;
    } catch (error) {
      logger.error('Failed to get external IP:', error);
      return null;
    }
  }

  async getInternalIP(): Promise<string | null> {
    try {
      const ip = await internalIpV4();
      return ip || '127.0.0.1';
    } catch (error) {
      logger.error('Failed to get internal IP:', error);
      return '127.0.0.1';
    }
  }

  async getMappedPorts(): Promise<PortMapping[]> {
    try {
      const mappings = await this.client.getMappings();
      return mappings.map((m: any) => ({
        protocol: m.protocol.toLowerCase(),
        public: m.public.port,
        private: m.private.port,
        description: m.description,
        ttl: m.ttl,
      }));
    } catch (error) {
      logger.error('Failed to get port mappings:', error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up UPnP port mappings...');
    
    for (const [key, mapping] of this.mappedPorts) {
      await this.unmapPort(mapping.protocol, mapping.public);
    }
    
    this.client.close();
  }

  getNetworkStatus() {
    return {
      publicIP: this.publicIP,
      privateIP: this.privateIP,
      upnpEnabled: this.config.enableUPnP,
      mappedPorts: Array.from(this.mappedPorts.values()),
      ports: this.config.ports,
    };
  }
}