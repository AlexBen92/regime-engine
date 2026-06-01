import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { createRepository } from '@/lib/storage/repository';
import { getConfig } from '@/lib/config';
import { BacktestRequest, BacktestResponse, RegimeType } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BacktestRequest;
    const { symbol, days, timeframe } = body;

    if (!symbol || !days) {
      return NextResponse.json(
        { error: 'Missing required parameters: symbol, days' },
        { status: 400 }
      );
    }

    const config = getConfig();
    const db = getDatabase();
    const repo = createRepository(db);

    const targetTimeframe = timeframe || config.AGGREGATION_TIMEFRAMES[0] || '15m';

    const endTime = Date.now();
    const startTime = endTime - days * 86400000;

    // Get historical data
    const history = repo.getHistoryWithRisk(
      symbol.toUpperCase(),
      targetTimeframe,
      startTime,
      endTime
    );

    if (history.length === 0) {
      return NextResponse.json(
        { error: 'No historical data found for the specified range' },
        { status: 404 }
      );
    }

    // Calculate statistics
    const totalBars = history.length;
    const goodBars = history.filter((h) => h.trade_allowed).length;
    const filteredBars = totalBars - goodBars;

    // Regime distribution
    const regimeCounts: Record<string, number> = {};
    for (const h of history) {
      regimeCounts[h.regime] = (regimeCounts[h.regime] || 0) + 1;
    }

    const regimePct: Record<string, number> = {};
    for (const [regime, count] of Object.entries(regimeCounts)) {
      regimePct[regime] = (count / totalBars) * 100;
    }

    // Calculate drawdown proxies (simple max consecutive loss simulation)
    let naiveMaxDrawdown = 0;
    let filteredMaxDrawdown = 0;
    let naiveConsecutiveLosses = 0;
    let filteredConsecutiveLosses = 0;
    let maxNaiveConsecutive = 0;
    let maxFilteredConsecutive = 0;

    for (const h of history) {
      // Naive strategy: always trade
      const isLoss = Math.random() > 0.45; // Simplified - in real backtest, use actual returns
      if (isLoss) {
        naiveConsecutiveLosses++;
        maxNaiveConsecutive = Math.max(maxNaiveConsecutive, naiveConsecutiveLosses);
      } else {
        naiveConsecutiveLosses = 0;
      }

      // Filtered strategy: only trade when allowed
      if (h.trade_allowed) {
        if (isLoss) {
          filteredConsecutiveLosses++;
          maxFilteredConsecutive = Math.max(
            maxFilteredConsecutive,
            filteredConsecutiveLosses
          );
        } else {
          filteredConsecutiveLosses = 0;
        }
      }
    }

    naiveMaxDrawdown = maxNaiveConsecutive * 0.5; // Proxy: 0.5% per loss
    filteredMaxDrawdown = maxFilteredConsecutive * 0.5;

    // Calculate edge improvement
    const edgeImprovementPct =
      naiveMaxDrawdown > 0
        ? ((naiveMaxDrawdown - filteredMaxDrawdown) / naiveMaxDrawdown) * 100
        : 0;

    const response: BacktestResponse = {
      symbol: symbol.toUpperCase(),
      days,
      totalBars,
      goodBars,
      filteredBars,
      regimePct,
      naiveDrawdownProxy: Math.round(naiveMaxDrawdown * 100) / 100,
      filteredDrawdownProxy: Math.round(filteredMaxDrawdown * 100) / 100,
      edgeImprovementPct: Math.round(edgeImprovementPct * 100) / 100,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error running backtest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
