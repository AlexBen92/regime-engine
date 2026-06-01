import { getConfig } from '../config';
import { createHyperliquidClient } from '../exchanges/hyperliquid';
import { createRepository } from '../storage/repository';
import { getDatabase } from '../db';
import { computeFeatures, computeVolatility, computeVolumeChange, resampleBars } from '../features/bars';
import { classifyRegime, checkConsecutiveLowVol, calculateConfidence } from '../features/regimes';
import { getRiskProfile } from '../features/risk';
import { Bar } from '../types';

export interface CollectorStats {
  totalBars: number;
  insertedBars: number;
  errors: number;
  lastSymbol?: string;
  lastUpdate: Date;
}

export class DataCollector {
  private stats: CollectorStats = {
    totalBars: 0,
    insertedBars: 0,
    errors: 0,
    lastUpdate: new Date(),
  };

  async collectOnce(): Promise<CollectorStats> {
    const config = getConfig();
    const exchange = createHyperliquidClient();
    const db = getDatabase();
    const repo = createRepository(db);

    const symbols = config.SYMBOLS;
    const baseTimeframe = config.BASE_TIMEFRAME;
    const aggregationTimeframes = config.AGGREGATION_TIMEFRAMES;

    let totalBars = 0;
    let insertedBars = 0;
    let errors = 0;
    let lastSymbol = '';

    for (const symbol of symbols) {
      lastSymbol = symbol;

      try {
        // Fetch latest bars from exchange
        const candles = await exchange.getCandles(symbol, baseTimeframe, 1000);

        if (candles.length === 0) {
          console.log(`No candles returned for ${symbol}`);
          continue;
        }

        const bars = candles.map((c) => ({
          symbol,
          exchange: exchange.name,
          timeframe: baseTimeframe,
          open_time: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          oi: c.oi ?? null,
          funding_rate: c.funding_rate ?? null,
        } as Bar));

        // Store bars and compute features
        const result = await this.processBars(bars, repo);
        totalBars += result.totalBars;
        insertedBars += result.insertedBars;
        errors += result.errors;

        // Process aggregated timeframes if needed
        for (const aggTf of aggregationTimeframes) {
          if (aggTf === baseTimeframe) continue;

          const aggBars = resampleBars(bars, aggTf);
          const aggResult = await this.processBars(aggBars, repo);
          totalBars += aggResult.totalBars;
          insertedBars += aggResult.insertedBars;
          errors += aggResult.errors;
        }

        console.log(`Processed ${symbol}: ${insertedBars} bars inserted`);
      } catch (error) {
        console.error(`Error collecting ${symbol}:`, error);
        errors++;
      }
    }

    // Update last ingest time
    repo.setMetadata('last_ingest', new Date().toISOString());

    this.stats = {
      totalBars: this.stats.totalBars + totalBars,
      insertedBars: this.stats.insertedBars + insertedBars,
      errors: this.stats.errors + errors,
      lastSymbol,
      lastUpdate: new Date(),
    };

    return this.stats;
  }

  private async processBars(bars: Bar[], repo: any): Promise<{
    totalBars: number;
    insertedBars: number;
    errors: number;
  }> {
    let insertedBars = 0;
    let errors = 0;

    if (bars.length === 0) {
      return { totalBars: 0, insertedBars: 0, errors: 0 };
    }

    // Sort by time
    bars.sort((a, b) => a.open_time - b.open_time);

    // Pre-compute volatilities and volume changes
    const volatilityMap = computeVolatility(bars);
    const volumeChangeMap = computeVolumeChange(bars);

    // Process each bar
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const prevBar = i > 0 ? bars[i - 1] : null;

      try {
        // Insert bar
        const barId = repo.insertBar(bar);

        // Compute features
        const feature = computeFeatures(bar, bars, volatilityMap, volumeChangeMap, prevBar);

        // Store feature
        repo.insertFeature(barId, feature);

        // Classify regime
        const isConsecutiveLowVol = checkConsecutiveLowVol(bar.symbol, feature.vol_regime);
        const regime = classifyRegime(bar.symbol, feature, isConsecutiveLowVol);
        const confidence = calculateConfidence(regime, feature);

        // Store regime
        const regimeId = repo.insertRegime(
          barId,
          bar.symbol,
          bar.exchange,
          bar.timeframe,
          bar.open_time,
          regime,
          confidence
        );

        // Compute and store risk profile
        const riskProfile = getRiskProfile(bar.symbol, bar.open_time, regime);
        repo.insertRiskProfile(regimeId, riskProfile);

        insertedBars++;
      } catch (error) {
        console.error(`Error processing bar ${bar.open_time}:`, error);
        errors++;
      }
    }

    return { totalBars: bars.length, insertedBars, errors };
  }

  async backfill(days: number): Promise<void> {
    const config = getConfig();
    const exchange = createHyperliquidClient();
    const db = getDatabase();
    const repo = createRepository(db);

    const endTime = Date.now();
    const startTime = endTime - days * 86400000;

    const symbols = config.SYMBOLS;
    const baseTimeframe = config.BASE_TIMEFRAME;

    console.log(`Backfilling ${days} days of data for ${symbols.join(', ')}...`);

    for (const symbol of symbols) {
      try {
        const candles = await exchange.getCandles(symbol, baseTimeframe, 100000, startTime, endTime);

        if (candles.length === 0) {
          console.log(`No candles for ${symbol} in backfill range`);
          continue;
        }

        const bars = candles.map((c) => ({
          symbol,
          exchange: exchange.name,
          timeframe: baseTimeframe,
          open_time: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          oi: c.oi ?? null,
          funding_rate: c.funding_rate ?? null,
        } as Bar));

        const result = await this.processBars(bars, repo);
        console.log(`Backfilled ${symbol}: ${result.insertedBars} bars`);
      } catch (error) {
        console.error(`Error backfilling ${symbol}:`, error);
      }
    }

    repo.setMetadata('last_ingest', new Date().toISOString());
  }

  getStats(): CollectorStats {
    return { ...this.stats };
  }
}

// Singleton instance for the server
let collectorInstance: DataCollector | null = null;
let intervalId: NodeJS.Timeout | null = null;

export function getCollector(): DataCollector {
  if (!collectorInstance) {
    collectorInstance = new DataCollector();
  }
  return collectorInstance;
}

export function startIngestionLoop(): void {
  if (intervalId) {
    console.log('Ingestion loop already running');
    return;
  }

  const config = getConfig();
  const intervalMs = config.INGEST_INTERVAL_SECONDS * 1000;

  console.log(`Starting ingestion loop (interval: ${config.INGEST_INTERVAL_SECONDS}s)`);

  // Run immediately
  getCollector().collectOnce().catch((error) => {
    console.error('Error in initial collection:', error);
  });

  // Then run on interval
  intervalId = setInterval(() => {
    getCollector()
      .collectOnce()
      .catch((error) => {
        console.error('Error in scheduled collection:', error);
      });
  }, intervalMs);
}

export function stopIngestionLoop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Ingestion loop stopped');
  }
}

export function isIngestionRunning(): boolean {
  return intervalId !== null;
}
