import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../lib/db';
import { apiKeys } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export function authMiddleware(options?: {
  required?: boolean;
}) {
  const required = options?.required ?? true;

  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header('x-api-key') || c.req.query('api_key');
    
    if (!apiKey) {
      if (required) {
        throw new HTTPException(401, { message: 'API key required' });
      }
      await next();
      return;
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const [keyRecord] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.key, hashedKey))
      .limit(1);
    
    if (!keyRecord) {
      throw new HTTPException(401, { message: 'Invalid API key' });
    }
    
    if (!keyRecord.active) {
      throw new HTTPException(401, { message: 'API key is inactive' });
    }
    
    await db.update(apiKeys)
      .set({ lastUsed: new Date().toISOString() })
      .where(eq(apiKeys.id, keyRecord.id));
    
    c.set('apiKey', keyRecord);
    
    await next();
  });
}