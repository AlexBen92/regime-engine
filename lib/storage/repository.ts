import Database from 'better-sqlite3';
import { Bar, Feature, Regime, RiskProfile, RegimeType } from '../types';
import { withTransaction } from '../db';

export class Repository {
  constructor(private db: Database.Database) {}

  // Insert a bar and return its ID
  insertBar(bar: Bar): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bars (
        symbol, exchange, timeframe, open_time,
        open, high, low, close, volume, oi, funding_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      bar.symbol,
      bar.exchange,
      bar.timeframe,
      bar.open_time,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.volume,
      bar.oi ?? null,
      bar.funding_rate ?? null
    );

    // Get the bar ID
    const barStmt = this.db.prepare(`
      SELECT id FROM bars WHERE symbol = ? AND exchange = ? AND timeframe = ? AND open_time = ?
    `);

    const row = barStmt.get(bar.symbol, bar.exchange, bar.timeframe, bar.open_time) as { id: number };
    return row.id;
  }

  // Insert multiple bars
  insertBars(bars: Bar[]): number {
    let inserted = 0;

    for (const bar of bars) {
      try {
        this.insertBar(bar);
        inserted++;
      } catch (e) {
        console.error(`Failed to insert bar for ${bar.symbol} at ${bar.open_time}:`, e);
      }
    }

    return inserted;
  }

  // Get latest bar for a symbol
  getLatestBar(symbol: string, timeframe: string): Bar | null {
    const stmt = this.db.prepare(`
      SELECT * FROM bars
      WHERE symbol = ? AND timeframe = ?
      ORDER BY open_time DESC
      LIMIT 1
    `);

    const row = stmt.get(symbol, timeframe) as any;
    return row ? this.rowToBar(row) : null;
  }

  // Get bars for a symbol in a time range
  getBars(
    symbol: string,
    timeframe: string,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Bar[] {
    let sql = `
      SELECT * FROM bars
      WHERE symbol = ? AND timeframe = ?
    `;
    const params: any[] = [symbol, timeframe];

    if (startTime !== undefined) {
      sql += ' AND open_time >= ?';
      params.push(startTime);
    }

    if (endTime !== undefined) {
      sql += ' AND open_time <= ?';
      params.push(endTime);
    }

    sql += ' ORDER BY open_time ASC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map((r) => this.rowToBar(r));
  }

  // Insert feature
  insertFeature(barId: number, feature: Feature): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO features (
        bar_id, returns, volatility, vol_regime, volume_change, oi_change
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      barId,
      feature.returns,
      feature.volatility,
      feature.vol_regime,
      feature.volume_change,
      feature.oi_change
    );
  }

  // Insert regime
  insertRegime(
    barId: number,
    symbol: string,
    exchange: string,
    timeframe: string,
    openTime: number,
    regime: RegimeType,
    confidence: number
  ): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO regimes (
        bar_id, symbol, exchange, timeframe, open_time, regime, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(barId, symbol, exchange, timeframe, openTime, regime, confidence);

    // Get regime ID
    const idStmt = this.db.prepare(`SELECT id FROM regimes WHERE bar_id = ?`);
    const row = idStmt.get(barId) as { id: number };
    return row.id;
  }

  // Insert risk profile
  insertRiskProfile(regimeId: number, riskProfile: RiskProfile): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO risk_profiles (
        regime_id, symbol, open_time, max_leverage, max_risk_pct, trade_allowed, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      regimeId,
      riskProfile.symbol,
      riskProfile.open_time,
      riskProfile.max_leverage,
      riskProfile.max_risk_pct,
      riskProfile.trade_allowed ? 1 : 0,
      riskProfile.notes
    );
  }

  // Get latest regime for a symbol
  getLatestRegime(symbol: string, timeframe: string): Regime | null {
    const stmt = this.db.prepare(`
      SELECT * FROM regimes
      WHERE symbol = ? AND timeframe = ?
      ORDER BY open_time DESC
      LIMIT 1
    `);

    const row = stmt.get(symbol, timeframe) as any;
    return row ? this.rowToRegime(row) : null;
  }

  // Get regime history for a symbol
  getRegimeHistory(
    symbol: string,
    timeframe: string,
    limit: number
  ): Regime[] {
    const stmt = this.db.prepare(`
      SELECT * FROM regimes
      WHERE symbol = ? AND timeframe = ?
      ORDER BY open_time DESC
      LIMIT ?
    `);

    const rows = stmt.all(symbol, timeframe, limit) as any[];
    return rows.map((r) => this.rowToRegime(r));
  }

  // Get history with risk profiles for backtest
  getHistoryWithRisk(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number
  ): Array<{
    open_time: number;
    regime: RegimeType;
    close: number;
    volume: number;
    max_leverage: number;
    max_risk_pct: number;
    trade_allowed: boolean;
  }> {
    const stmt = this.db.prepare(`
      SELECT
        b.open_time,
        r.regime,
        b.close,
        b.volume,
        rp.max_leverage,
        rp.max_risk_pct,
        rp.trade_allowed
      FROM bars b
      JOIN regimes r ON b.id = r.bar_id
      JOIN risk_profiles rp ON r.id = rp.regime_id
      WHERE b.symbol = ? AND b.timeframe = ?
        AND b.open_time >= ? AND b.open_time <= ?
      ORDER BY b.open_time ASC
    `);

    const rows = stmt.all(symbol, timeframe, startTime, endTime) as any[];
    return rows.map((r) => ({
      open_time: r.open_time,
      regime: r.regime as RegimeType,
      close: r.close,
      volume: r.volume,
      max_leverage: r.max_leverage,
      max_risk_pct: r.max_risk_pct,
      trade_allowed: r.trade_allowed === 1,
    }));
  }

  // Get all distinct symbols
  getSymbols(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT symbol FROM bars ORDER BY symbol
    `);

    const rows = stmt.all() as any[];
    return rows.map((r) => r.symbol);
  }

  // Get full state for a symbol (latest bar + regime + risk)
  getFullState(symbol: string, timeframe: string): any {
    const stmt = this.db.prepare(`
      SELECT
        b.*,
        r.regime,
        r.confidence,
        rp.max_leverage,
        rp.max_risk_pct,
        rp.trade_allowed,
        rp.notes as risk_notes
      FROM bars b
      JOIN regimes r ON b.id = r.bar_id
      JOIN risk_profiles rp ON r.id = rp.regime_id
      WHERE b.symbol = ? AND b.timeframe = ?
      ORDER BY b.open_time DESC
      LIMIT 1
    `);

    const row = stmt.get(symbol, timeframe) as any;
    return row;
  }

  // Update metadata
  setMetadata(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  getMetadata(key: string): string | null {
    const stmt = this.db.prepare(`SELECT value FROM metadata WHERE key = ?`);
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  // Helper methods
  private rowToBar(row: any): Bar {
    return {
      id: row.id,
      symbol: row.symbol,
      exchange: row.exchange,
      timeframe: row.timeframe,
      open_time: row.open_time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      oi: row.oi,
      funding_rate: row.funding_rate,
    };
  }

  private rowToRegime(row: any): Regime {
    return {
      id: row.id,
      bar_id: row.bar_id,
      symbol: row.symbol,
      exchange: row.exchange,
      timeframe: row.timeframe,
      open_time: row.open_time,
      regime: row.regime as RegimeType,
      confidence: row.confidence,
    };
  }
}

export function createRepository(db: Database.Database): Repository {
  return new Repository(db);
}
