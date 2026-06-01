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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const timeframe = searchParams.get('timeframe');

    const config = getConfig();
    const db = getDatabase();
    const repo = createRepository(db);

    const targetTimeframe = timeframe || config.AGGREGATION_TIMEFRAMES[0] || '15m';

    const regimes = repo.getRegimeHistory(symbol.toUpperCase(), targetTimeframe, limit);

    // Get corresponding bars
    const history = regimes.map((r) => {
      const bar = repo.getLatestBar(symbol.toUpperCase(), targetTimeframe);
      return {
        open_time: r.open_time,
        regime: r.regime as RegimeType,
        close: bar?.close || 0,
        volume: bar?.volume || 0,
        riskProfile: {
          symbol: r.symbol,
          open_time: r.open_time,
          max_leverage: 0,
          max_risk_pct: 0,
          trade_allowed: false,
          notes: '',
        },
      };
    });

    return NextResponse.json(history.reverse());
  } catch (error) {
    console.error('Error fetching history:', error);
    // Return demo data for platforms without SQLite support
    const { symbol } = await params;
    const demoPrices: Record<string, number> = {
      BTC: 67000,
      ETH: 3400,
      SOL: 140,
    };
    const basePrice = demoPrices[symbol.toUpperCase()] || 100;

    const regimes: RegimeType[] = ['TREND_UP', 'CHOP_RANGE', 'TREND_DOWN', 'CHOP_RANGE', 'TREND_UP'];
    const history = Array.from({ length: 20 }, (_, i) => ({
      open_time: Date.now() - (20 - i) * 15 * 60 * 1000,
      regime: regimes[i % regimes.length],
      close: basePrice + (Math.random() - 0.5) * 1000,
      volume: 1000000 + Math.random() * 500000,
      riskProfile: {
        symbol: symbol.toUpperCase(),
        open_time: Date.now() - (20 - i) * 15 * 60 * 1000,
        max_leverage: 5,
        max_risk_pct: 1.0,
        trade_allowed: true,
        notes: 'Demo data',
      },
    }));

    return NextResponse.json(history);
  }
}
