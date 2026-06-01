import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { createRepository } from '@/lib/storage/repository';
import { getConfig } from '@/lib/config';
import { RegimeType } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const config = getConfig();
    const db = getDatabase();
    const repo = createRepository(db);

    // Default to first aggregation timeframe
    const timeframe = config.AGGREGATION_TIMEFRAMES[0] || '15m';

    const state = repo.getFullState(symbol.toUpperCase(), timeframe);

    if (!state) {
      return NextResponse.json(
        { error: 'No data found for symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      symbol: state.symbol,
      exchange: state.exchange,
      regime: {
        id: state.id,
        symbol: state.symbol,
        exchange: state.exchange,
        timeframe: state.timeframe,
        open_time: state.open_time,
        regime: state.regime,
        confidence: state.confidence,
      },
      riskProfile: {
        symbol: state.symbol,
        open_time: state.open_time,
        max_leverage: state.max_leverage,
        max_risk_pct: state.max_risk_pct,
        trade_allowed: state.trade_allowed === 1,
        notes: state.risk_notes,
      },
      bar: {
        close: state.close,
        volume: state.volume,
        oi: state.oi,
        funding_rate: state.funding_rate,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching state:', error);
    // Return demo data for platforms without SQLite support
    const demoPrices: Record<string, number> = {
      BTC: 67500,
      ETH: 3450,
      SOL: 145,
    };

    return NextResponse.json({
      symbol: (await params).symbol.toUpperCase(),
      exchange: 'hyperliquid',
      regime: {
        id: 1,
        symbol: (await params).symbol.toUpperCase(),
        exchange: 'hyperliquid',
        timeframe: '15m',
        open_time: Date.now(),
        regime: 'TREND_UP' as RegimeType,
        confidence: 0.75,
      },
      riskProfile: {
        symbol: (await params).symbol.toUpperCase(),
        open_time: Date.now(),
        max_leverage: 5,
        max_risk_pct: 1.0,
        trade_allowed: true,
        notes: 'Demo mode - connect local instance for real data',
      },
      bar: {
        close: demoPrices[(await params).symbol.toUpperCase()] || 100,
        volume: 1000000,
        oi: 500000,
        funding_rate: 0.0001,
      },
      updatedAt: new Date().toISOString(),
    });
  }
}
