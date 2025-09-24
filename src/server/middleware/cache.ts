import { createMiddleware } from 'hono/factory';
import crypto from 'crypto';

interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

export function cacheMiddleware(options?: {
  ttl?: number;
}) {
  const ttl = options?.ttl || 300000;

  return createMiddleware(async (c, next) => {
    const method = c.req.method;
    
    if (method !== 'POST') {
      await next();
      return;
    }

    const body = await c.req.text();
    const serviceId = c.req.param('serviceId');
    const cacheKey = `${serviceId}:${crypto.createHash('md5').update(body).digest('hex')}`;
    
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      c.header('X-Cache', 'HIT');
      return c.json(cached.data);
    }
    
    await next();
    
    if (c.res.status === 200) {
      const responseData = await c.res.clone().json();
      cache.set(cacheKey, {
        data: responseData,
        expiry: Date.now() + ttl,
      });
      c.header('X-Cache', 'MISS');
    }
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiry < now) {
      cache.delete(key);
    }
  }
}, 60000);