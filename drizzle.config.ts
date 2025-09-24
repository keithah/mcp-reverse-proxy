import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/mcp-proxy.db',
  },
} satisfies Config;