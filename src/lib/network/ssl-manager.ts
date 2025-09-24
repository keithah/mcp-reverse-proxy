import Greenlock from 'greenlock-express';
import path from 'path';
import fs from 'fs/promises';
import forge from 'node-forge';
import { logger } from '../logger';
import { db } from '../db';
import { z } from 'zod';

export const SSLConfigSchema = z.object({
  enabled: z.boolean().default(false),
  domain: z.string().optional(),
  email: z.string().email().optional(),
  staging: z.boolean().default(true),
  forceSSL: z.boolean().default(true),
  autoRenew: z.boolean().default(true),
  provider: z.enum(['letsencrypt', 'self-signed']).default('letsencrypt'),
  cloudflareToken: z.string().optional(),
});

export type SSLConfig = z.infer<typeof SSLConfigSchema>;

export class SSLManager {
  private config: SSLConfig;
  private greenlock?: any;
  private certsPath: string;

  constructor(config: SSLConfig) {
    this.config = config;
    this.certsPath = path.join(process.cwd(), 'data', 'certs');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.certsPath, { recursive: true });

    if (this.config.provider === 'self-signed') {
      await this.generateSelfSignedCert();
      return;
    }

    if (this.config.enabled && this.config.domain && this.config.email) {
      await this.setupLetsEncrypt();
    }
  }

  private async setupLetsEncrypt(): Promise<void> {
    try {
      const packageRoot = path.join(process.cwd());
      const configDir = path.join(this.certsPath, 'greenlock');
      
      await fs.mkdir(configDir, { recursive: true });

      this.greenlock = Greenlock.init({
        packageRoot,
        configDir,
        packageAgent: process.env.npm_package_name + '/' + process.env.npm_package_version,
        maintainerEmail: this.config.email!,
        cluster: false,
        workers: 1,
      });

      await this.greenlock.manager.defaults({
        agreeToTerms: true,
        subscriberEmail: this.config.email,
        challenges: {
          'dns-01': this.config.cloudflareToken ? {
            module: 'acme-dns-01-cloudflare',
            token: this.config.cloudflareToken,
          } : undefined,
          'http-01': {
            module: 'acme-http-01-standalone',
          },
        },
        store: {
          module: 'greenlock-store-fs',
          basePath: configDir,
        },
      });

      await this.greenlock.sites.add({
        subject: this.config.domain,
        altnames: [this.config.domain, `www.${this.config.domain}`],
      });

      logger.info(`Let's Encrypt initialized for domain: ${this.config.domain}`);
      
      if (this.config.autoRenew) {
        this.setupAutoRenewal();
      }
    } catch (error) {
      logger.error('Failed to setup Let\'s Encrypt:', error);
      throw error;
    }
  }

  private async generateSelfSignedCert(): Promise<{ key: string; cert: string }> {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [
      { name: 'commonName', value: this.config.domain || 'localhost' },
      { name: 'organizationName', value: 'MCP Proxy' },
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: this.config.domain || 'localhost' },
          { type: 2, value: `*.${this.config.domain || 'localhost'}` },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ]);
    
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCert = forge.pki.certificateToPem(cert);
    
    const keyPath = path.join(this.certsPath, 'self-signed-key.pem');
    const certPath = path.join(this.certsPath, 'self-signed-cert.pem');
    
    await fs.writeFile(keyPath, pemKey);
    await fs.writeFile(certPath, pemCert);
    
    logger.info('Generated self-signed certificate');
    
    return { key: pemKey, cert: pemCert };
  }

  private setupAutoRenewal(): void {
    const checkInterval = 24 * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        if (this.greenlock) {
          await this.greenlock.renew();
          logger.info('Certificate renewal check completed');
        }
      } catch (error) {
        logger.error('Certificate renewal failed:', error);
      }
    }, checkInterval);
  }

  async getCertificates(): Promise<{ key: string; cert: string; ca?: string } | null> {
    if (this.config.provider === 'self-signed') {
      const keyPath = path.join(this.certsPath, 'self-signed-key.pem');
      const certPath = path.join(this.certsPath, 'self-signed-cert.pem');
      
      try {
        const key = await fs.readFile(keyPath, 'utf-8');
        const cert = await fs.readFile(certPath, 'utf-8');
        return { key, cert };
      } catch (error) {
        logger.warn('Self-signed certificate not found, generating new one');
        return await this.generateSelfSignedCert();
      }
    }

    if (!this.greenlock || !this.config.domain) {
      return null;
    }

    try {
      const site = await this.greenlock.sites.get({ subject: this.config.domain });
      if (site && site.pems) {
        return {
          key: site.pems.privkey,
          cert: site.pems.cert,
          ca: site.pems.chain,
        };
      }
    } catch (error) {
      logger.error('Failed to get certificates:', error);
    }

    return null;
  }

  async updateConfig(newConfig: Partial<SSLConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled && this.config.domain && this.config.email) {
      await this.setupLetsEncrypt();
    }
  }

  isSSLEnabled(): boolean {
    return this.config.enabled && this.config.forceSSL;
  }

  getDomain(): string | undefined {
    return this.config.domain;
  }
}