import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  repositoryUrl: text('repository_url'),
  repositoryBranch: text('repository_branch').default('main'),
  repositoryPath: text('repository_path').default('./'),
  entryPoint: text('entry_point').notNull(),
  environment: text('environment').default('{}'),
  proxyPath: text('proxy_path').notNull().unique(),
  rateLimit: integer('rate_limit').default(100),
  cacheTTL: integer('cache_ttl').default(300),
  timeout: integer('timeout').default(30000),
  autoRestart: integer('auto_restart', { mode: 'boolean' }).default(true),
  maxRestarts: integer('max_restarts').default(5),
  maxMemory: text('max_memory').default('512MB'),
  healthCheckInterval: integer('health_check_interval').default(30),
  status: text('status').default('stopped'),
  lastError: text('last_error'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const metrics = sqliteTable('metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serviceId: text('service_id').notNull().references(() => services.id),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
  cpuUsage: real('cpu_usage'),
  memoryUsage: real('memory_usage'),
  requestCount: integer('request_count').default(0),
  errorCount: integer('error_count').default(0),
  avgResponseTime: real('avg_response_time'),
});

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serviceId: text('service_id').notNull().references(() => services.id),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
  level: text('level').notNull(),
  message: text('message').notNull(),
  metadata: text('metadata'),
});

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  permissions: text('permissions').default('{}'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastUsed: text('last_used'),
  active: integer('active', { mode: 'boolean' }).default(true),
});