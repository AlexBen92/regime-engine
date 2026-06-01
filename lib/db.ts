import Database from 'better-sqlite3';
import path from 'path';
import { SchemaManager } from '../db/schema';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'regime.db');

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    require('fs').mkdirSync(dataDir, { recursive: true });

    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    // Initialize schema
    const schemaManager = new SchemaManager(dbInstance);
    schemaManager.migrate();
  }

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// For transaction support
export function withTransaction<T>(
  db: Database.Database,
  fn: () => T
): T {
  const tx = db.transaction(fn);
  return tx();
}
