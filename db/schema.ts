import Database from 'better-sqlite3';
import path from 'path';

const SCHEMA_VERSION = 1;

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Bars table: raw OHLCV data
      CREATE TABLE IF NOT EXISTS bars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        oi REAL,
        funding_rate REAL,
        UNIQUE(symbol, exchange, timeframe, open_time)
      );

      -- Features table: computed features per bar
      CREATE TABLE IF NOT EXISTS features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bar_id INTEGER NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
        returns REAL NOT NULL,
        volatility REAL NOT NULL,
        vol_regime TEXT NOT NULL CHECK(vol_regime IN ('low', 'normal', 'high')),
        volume_change REAL NOT NULL,
        oi_change REAL NOT NULL,
        UNIQUE(bar_id)
      );

      -- Regimes table: regime classifications per bar
      CREATE TABLE IF NOT EXISTS regimes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bar_id INTEGER NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        regime TEXT NOT NULL CHECK(regime IN (
          'TREND_UP', 'TREND_DOWN', 'CHOP_RANGE',
          'SQUEEZE_INCOMING', 'LIQUIDATION_CASCADE', 'UNKNOWN'
        )),
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        UNIQUE(bar_id)
      );

      -- Risk profiles table: risk recommendations per bar
      CREATE TABLE IF NOT EXISTS risk_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        regime_id INTEGER NOT NULL REFERENCES regimes(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        max_leverage REAL NOT NULL CHECK(max_leverage >= 0),
        max_risk_pct REAL NOT NULL CHECK(max_risk_pct >= 0 AND max_risk_pct <= 100),
        trade_allowed INTEGER NOT NULL CHECK(trade_allowed IN (0, 1)),
        notes TEXT NOT NULL,
        UNIQUE(regime_id)
      );

      -- Metadata table: track migrations and last ingest time
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_bars_symbol_time ON bars(symbol, open_time DESC);
      CREATE INDEX IF NOT EXISTS idx_bars_timeframe ON bars(timeframe);
      CREATE INDEX IF NOT EXISTS idx_regimes_symbol_time ON regimes(symbol, open_time DESC);
      CREATE INDEX IF NOT EXISTS idx_risk_profiles_symbol_time ON risk_profiles(symbol, open_time DESC);
    `,
  },
];

export class SchemaManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  migrate(): void {
    // Get current version
    const meta = this.db
      .prepare('SELECT value FROM metadata WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;

    const currentVersion = meta ? parseInt(meta.value, 10) : 0;

    // Apply migrations
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`Applying migration: ${migration.name}`);
        this.db.exec(migration.sql);

        // Update version
        this.db
          .prepare(
            'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)'
          )
          .run('schema_version', migration.version.toString());
      }
    }
  }

  static initialize(dbPath: string): SchemaManager {
    const db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create metadata table if not exists (for tracking migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const manager = new SchemaManager(db);
    manager.migrate();

    return manager;
  }
}
