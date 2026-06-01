import { Bar } from '../types';

export interface Candle {
  timestamp: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
  funding_rate?: number;
}

export interface ExchangeClient {
  readonly name: string;

  // Fetch candles for a symbol and timeframe
  getCandles(
    symbol: string,
    timeframe: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<Candle[]>;

  // Get list of available symbols
  getAvailableSymbols(): Promise<string[]>;

  // Test connection
  testConnection(): Promise<boolean>;
}

export function candleToBar(
  candle: Candle,
  symbol: string,
  exchangeName: string,
  timeframe: string
): Bar {
  return {
    symbol,
    exchange: exchangeName,
    timeframe,
    open_time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    oi: candle.oi ?? null,
    funding_rate: candle.funding_rate ?? null,
  };
}
