import type { ExchangeClient, Candle } from './base';
import { getConfig } from '../config';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';
const HYPERLIANG_WS = 'wss://api.hyperliquid.xyz/ws';

// Hyperliquid timeframe mapping
const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1d',
};

export class HyperliquidClient implements ExchangeClient {
  readonly name = 'hyperliquid';
  private readonly symbols: Set<string>;

  constructor() {
    const config = getConfig();
    this.symbols = new Set(config.SYMBOLS);
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 1000,
    startTime?: number,
    endTime?: number
  ): Promise<Candle[]> {
    const hlTimeframe = TIMEFRAME_MAP[timeframe] || timeframe;

    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: {
          coin: symbol.toLowerCase(),
          interval: hlTimeframe,
          startTime: startTime ? Math.floor(startTime / 1000) : undefined,
          endTime: endTime ? Math.floor(endTime / 1000) : undefined,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Hyperliquid API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Hyperliquid returns: [timestamp, open, high, low, close, volume]
    const candles: Candle[] = data.map((candle: any[]) => ({
      timestamp: candle[0] * 1000, // Convert s to ms
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));

    // Apply limit and sort (newest first)
    let result = candles.sort((a, b) => b.timestamp - a.timestamp);

    if (limit && limit < result.length) {
      result = result.slice(0, limit);
    }

    return result;
  }

  async getAvailableSymbols(): Promise<string[]> {
    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'meta',
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Hyperliquid meta error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data)) {
      return Array.from(this.symbols);
    }

    // Extract symbol names from meta
    const symbols = data
      .map((m: any) => m?.name?.toUpperCase())
      .filter(Boolean);

    // Filter to configured symbols if any are configured
    const configSymbols = Array.from(this.symbols);
    if (configSymbols.length > 0) {
      return symbols.filter((s) => configSymbols.includes(s));
    }

    return symbols;
  }

  async testConnection(): Promise<boolean> {
    try {
      const symbols = await this.getAvailableSymbols();
      return symbols.length > 0;
    } catch {
      return false;
    }
  }

  // Get current funding rate for a symbol
  async getFundingRate(symbol: string): Promise<number | null> {
    try {
      const response = await fetch(`${HYPERLIQUID_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'metaAndAssetCtx',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const ctx = data?.[1];

      if (!Array.isArray(ctx)) {
        return null;
      }

      const assetCtx = ctx.find((a: any) =>
        a?.asset?.toLowerCase() === symbol.toLowerCase()
      );

      return assetCtx?.funding?.filtered?.fundingRate ?? null;
    } catch {
      return null;
    }
  }

  // Get open interest for a symbol
  async getOpenInterest(symbol: string): Promise<number | null> {
    try {
      const response = await fetch(`${HYPERLIQUID_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'metaAndAssetCtx',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const ctx = data?.[1];

      if (!Array.isArray(ctx)) {
        return null;
      }

      const assetCtx = ctx.find((a: any) =>
        a?.asset?.toLowerCase() === symbol.toLowerCase()
      );

      return assetCtx?.openInterest ?? null;
    } catch {
      return null;
    }
  }
}

export function createHyperliquidClient(): HyperliquidClient {
  return new HyperliquidClient();
}
