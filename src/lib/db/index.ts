import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_URL || './data/mcp-proxy.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export async function runMigrations() {
  const migrationsFolder = path.join(__dirname, '../../migrations');

  // Skip migrations if folder doesn't exist (development mode)
  if (!fs.existsSync(migrationsFolder)) {
    console.log('Migrations folder not found, creating tables directly (development mode)');

    // Create tables directly from schema
    try {
      // Create settings table
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          encrypted INTEGER DEFAULT 0,
          description TEXT,
          category TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create services table
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          repository_url TEXT,
          repository_branch TEXT DEFAULT 'main',
          repository_path TEXT DEFAULT './',
          entry_point TEXT NOT NULL,
          environment TEXT DEFAULT '{}',
          proxy_path TEXT NOT NULL UNIQUE,
          rate_limit INTEGER DEFAULT 100,
          cache_ttl INTEGER DEFAULT 300,
          timeout INTEGER DEFAULT 30000,
          auto_restart INTEGER DEFAULT 1,
          max_restarts INTEGER DEFAULT 5,
          max_memory TEXT DEFAULT '512MB',
          health_check_interval INTEGER DEFAULT 30,
          status TEXT DEFAULT 'stopped',
          last_error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create other tables as needed
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          key TEXT NOT NULL UNIQUE,
          last_used TEXT DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          service_id TEXT,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT DEFAULT '{}'
        )
      `);

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS metrics (
          id TEXT PRIMARY KEY,
          service_id TEXT,
          metric_name TEXT NOT NULL,
          value REAL NOT NULL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          labels TEXT DEFAULT '{}'
        )
      `);

      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Failed to create database tables:', error);
      throw error;
    }
    return;
  }

  await migrate(db, {
    migrationsFolder,
  });
}

export { schema };