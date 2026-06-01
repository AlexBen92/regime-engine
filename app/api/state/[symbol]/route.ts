import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { createRepository } from '@/lib/storage/repository';
import { getConfig } from '@/lib/config';

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
