#!/usr/bin/env tsx

import { getDatabase } from '../lib/db';
import { createRepository } from '../lib/storage/repository';
import { getConfig } from '../lib/config';
import { RegimeType } from '../lib/types';

interface BacktestOptions {
  symbol: string;
  days: number;
  timeframe?: string;
}

function parseArgs(): BacktestOptions {
  const args = process.argv.slice(2);
  const options: BacktestOptions = {
    symbol: 'BTC',
    days: 90,
    timeframe: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[++i];
      if (key === 'symbol') options.symbol = value;
      if (key === 'days') options.days = parseInt(value, 10);
      if (key === 'timeframe') options.timeframe = value;
    }
  }

  return options;
}

function runBacktest(options: BacktestOptions): void {
  const config = getConfig();
  const db = getDatabase();
  const repo = createRepository(db);

  const symbol = options.symbol.toUpperCase();
  const timeframe = options.timeframe || config.AGGREGATION_TIMEFRAMES[0] || '15m';

  console.log(`\n=== Backtest Report ===`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Timeframe: ${timeframe}`);
  console.log(`Period: Last ${options.days} days\n`);

  const endTime = Date.now();
  const startTime = endTime - options.days * 86400000;

  const history = repo.getHistoryWithRisk(symbol, timeframe, startTime, endTime);

  if (history.length === 0) {
    console.log('No historical data found for the specified range.');
    console.log('Make sure data has been ingested. Try running the server first.');
    process.exit(1);
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

  // Calculate drawdown proxies (simplified simulation)
  let naiveMaxDD = 0;
  let filteredMaxDD = 0;
  let naiveCumulative = 0;
  let filteredCumulative = 0;

  for (const h of history) {
    // Simulate returns (random for demo)
    const simulatedReturn = (Math.random() - 0.45) * 0.02;

    naiveCumulative += simulatedReturn;
    if (naiveCumulative < naiveMaxDD) {
      naiveMaxDD = naiveCumulative;
    }

    if (h.trade_allowed) {
      filteredCumulative += simulatedReturn;
      if (filteredCumulative < filteredMaxDD) {
        filteredMaxDD = filteredCumulative;
      }
    }
  }

  const edgeImprovement = naiveMaxDD !== 0
    ? ((Math.abs(naiveMaxDD) - Math.abs(filteredMaxDD)) / Math.abs(naiveMaxDD)) * 100
    : 0;

  // Print report
  console.log(`Total Bars: ${totalBars}`);
  console.log(`Tradeable Bars (regime filter): ${goodBars} (${((goodBars / totalBars) * 100).toFixed(1)}%)`);
  console.log(`Filtered Bars (risk-off): ${filteredBars} (${((filteredBars / totalBars) * 100).toFixed(1)}%)\n`);

  console.log('Regime Distribution:');
  for (const [regime, pct] of Object.entries(regimePct).sort((a, b) => b[1] - a[1])) {
    const count = regimeCounts[regime];
    const barLength = Math.round(pct / 2);
    const bar = '█'.repeat(barLength);
    console.log(`  ${regime.padEnd(20)} ${bar} ${pct.toFixed(1)}% (${count} bars)`);
  }

  console.log('\nDrawdown Analysis (Simulated):');
  console.log(`  Naive Max DD:        ${(naiveMaxDD * 100).toFixed(2)}%`);
  console.log(`  Filtered Max DD:     ${(filteredMaxDD * 100).toFixed(2)}%`);
  console.log(`  Edge Improvement:    +${edgeImprovement.toFixed(1)}%\n`);

  console.log(`Risk Rules Applied:`);
  const rules = [
    { regime: 'TREND_UP', leverage: 5, risk: 1.0 },
    { regime: 'TREND_DOWN', leverage: 3, risk: 0.75 },
    { regime: 'CHOP_RANGE', leverage: 2, risk: 0.5 },
    { regime: 'SQUEEZE_INCOMING', leverage: 1, risk: 0.25 },
    { regime: 'LIQUIDATION_CASCADE', leverage: 0, risk: 0 },
  ];

  for (const rule of rules) {
    const count = regimeCounts[rule.regime] || 0;
    const allowed = rule.leverage > 0 ? '✓' : '✗';
    console.log(`  ${allowed} ${rule.regime.padEnd(20)} ${rule.leverage}x max, ${rule.risk}% risk (${count} occurrences)`);
  }

  console.log(`\n=== End of Report ===\n`);
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();
  runBacktest(options);
}

export { runBacktest };
