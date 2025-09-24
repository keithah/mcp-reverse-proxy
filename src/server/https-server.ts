import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import https from 'https';
import http from 'http';
import { SSLManager } from '../lib/network/ssl-manager';
import { logger } from '../lib/logger';

export interface HTTPSServerOptions {
  app: Hono;
  httpPort: number;
  httpsPort: number;
  sslManager: SSLManager;
  forceSSL?: boolean;
}

export class HTTPSServer {
  private httpServer?: http.Server;
  private httpsServer?: https.Server;
  private options: HTTPSServerOptions;

  constructor(options: HTTPSServerOptions) {
    this.options = options;
  }

  async start(): Promise<{ http: http.Server; https?: https.Server }> {
    const redirectApp = new Hono();
    
    if (this.options.forceSSL !== false && this.options.sslManager.isSSLEnabled()) {
      redirectApp.use('*', async (c) => {
        const url = new URL(c.req.url);
        const domain = this.options.sslManager.getDomain() || c.req.header('host');
        
        if (c.req.header('x-forwarded-proto') === 'https') {
          return c.next();
        }
        
        const httpsUrl = `https://${domain}:${this.options.httpsPort}${url.pathname}${url.search}`;
        
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        
        return c.redirect(httpsUrl, 301);
      });
      
      logger.info('SSL redirect enabled - forcing HTTPS');
    } else {
      redirectApp.route('/', this.options.app);
    }

    this.httpServer = serve({
      fetch: redirectApp.fetch,
      port: this.options.httpPort,
      hostname: '0.0.0.0',
    });

    logger.info(`HTTP server running on port ${this.options.httpPort}`);

    const certs = await this.options.sslManager.getCertificates();
    
    if (certs) {
      const httpsApp = new Hono();
      
      httpsApp.use('*', async (c, next) => {
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('X-Frame-Options', 'DENY');
        c.header('X-XSS-Protection', '1; mode=block');
        c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        if (process.env.NODE_ENV === 'production') {
          c.header('Content-Security-Policy', 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' wss: ws:; " +
            "frame-ancestors 'none';"
          );
        }
        
        await next();
      });
      
      httpsApp.route('/', this.options.app);

      this.httpsServer = https.createServer(
        {
          key: certs.key,
          cert: certs.cert,
          ca: certs.ca,
          honorCipherOrder: true,
          ciphers: [
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA',
            'ECDHE-RSA-AES128-SHA',
            'DHE-RSA-AES256-GCM-SHA384',
            'DHE-RSA-AES128-GCM-SHA256',
            'DHE-RSA-AES256-SHA256',
            'DHE-RSA-AES128-SHA256',
            'DHE-RSA-AES256-SHA',
            'DHE-RSA-AES128-SHA',
            'RSA-AES256-GCM-SHA384',
            'RSA-AES128-GCM-SHA256',
            'RSA-AES256-SHA256',
            'RSA-AES128-SHA256',
            'RSA-AES256-SHA',
            'RSA-AES128-SHA',
          ].join(':'),
          secureProtocol: 'TLSv1_2_method',
        },
        httpsApp.fetch as any
      );

      this.httpsServer.listen(this.options.httpsPort, '0.0.0.0', () => {
        logger.info(`HTTPS server running on port ${this.options.httpsPort}`);
        logger.info(`SSL enabled with ${certs.ca ? 'Let\'s Encrypt' : 'self-signed'} certificate`);
      });
    } else {
      logger.warn('No SSL certificates available, running HTTP only');
    }

    return {
      http: this.httpServer,
      https: this.httpsServer,
    };
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    if (this.httpsServer) {
      await new Promise<void>((resolve) => {
        this.httpsServer!.close(() => resolve());
      });
    }
  }

  getServers() {
    return {
      http: this.httpServer,
      https: this.httpsServer,
    };
  }
}