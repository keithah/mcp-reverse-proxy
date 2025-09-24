import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export function rateLimitMiddleware(options?: {
  limit?: number;
  windowMs?: number;
}) {
  const limit = options?.limit || 100;
  const windowMs = options?.windowMs || 60000;

  return createMiddleware(async (c, next) => {
    const serviceId = c.req.param('serviceId');
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const key = `${serviceId}:${clientIp}`;
    
    const now = Date.now();
    
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    store[key].count++;
    
    if (store[key].count > limit) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      throw new HTTPException(429, {
        message: 'Too many requests',
        res: new Response(null, {
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': store[key].resetTime.toString(),
          },
        }),
      });
    }
    
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', (limit - store[key].count).toString());
    c.header('X-RateLimit-Reset', store[key].resetTime.toString());
    
    await next();
  });
}

setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 60000);