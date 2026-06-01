import { NextResponse } from 'next/server';
import { RegimeType } from '@/lib/types';
import { TREND_RETURN_THRESHOLD, LOW_VOL_THRESHOLD } from '@/lib/config';

interface HyperliquidMeta {
  asset: string;
  markPx: string;
  volume24h: number;
  openInterest: number;
  funding: number;
}

interface HyperliquidCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Simple regime classification (pure function)
function classifyRegime(
  returns: number,
  volatility: number,
  volumeChange: number
): RegimeType {
  const absReturn = Math.abs(returns);

  // LIQUIDATION_CASCADE: extreme move
  if (absReturn > 0.015 && volumeChange > 2.0) {
    return 'LIQUIDATION_CASCADE';
  }

  // SQUEEZE: low volatility
  if (volatility < LOW_VOL_THRESHOLD) {
    return 'SQUEEZE_INCOMING';
  }

  // TREND_UP
  if (returns > TREND_RETURN_THRESHOLD && volumeChange > 0) {
    return 'TREND_UP';
  }

  // TREND_DOWN
  if (returns < -TREND_RETURN_THRESHOLD && volumeChange > 0) {
    return 'TREND_DOWN';
  }

  // CHOP_RANGE
  return 'CHOP_RANGE';
}

// Calculate risk profile
function getRiskProfile(regime: RegimeType) {
  const rules: Record<RegimeType, { max_leverage: number; max_risk_pct: number; trade_allowed: boolean; notes: string }> = {
    TREND_UP: { max_leverage: 5, max_risk_pct: 1.0, trade_allowed: true, notes: 'Strong uptrend - maximum leverage allowed' },
    TREND_DOWN: { max_leverage: 3, max_risk_pct: 0.75, trade_allowed: true, notes: 'Downtrend - reduce leverage' },
    CHOP_RANGE: { max_leverage: 2, max_risk_pct: 0.5, trade_allowed: true, notes: 'Ranging market - conservative sizing' },
    SQUEEZE_INCOMING: { max_leverage: 1, max_risk_pct: 0.25, trade_allowed: true, notes: 'Low vol squeeze building' },
    LIQUIDATION_CASCADE: { max_leverage: 0, max_risk_pct: 0, trade_allowed: false, notes: 'Extreme volatility - CLOSE ALL POSITIONS' },
    UNKNOWN: { max_leverage: 1, max_risk_pct: 0.25, trade_allowed: false, notes: 'Uncertain regime' },
  };
  return rules[regime] ?? rules.UNKNOWN;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const symbolUpper = symbol.toUpperCase();

    // Fetch current market data from Hyperliquid
    const metaResponse = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    });

    if (!metaResponse.ok) {
      throw new Error('Hyperliquid meta error');
    }

    const metaData = await metaResponse.json();
    const coinData = (metaData as any[]).find((c: any) =>
      c.asset?.toLowerCase() === symbolUpper.toLowerCase()
    );

    if (!coinData) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    // Fetch recent candles for regime calculation
    const candlesResponse = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin: symbolUpper.toLowerCase(), interval: '15m' },
      }),
    });

    let returns = 0;
    let volatility = 0;
    let volumeChange = 0;

    if (candlesResponse.ok) {
      const candles = await candlesResponse.json();
      if (Array.isArray(candles) && candles.length >= 2) {
        const latest = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        // Calculate returns
        returns = (latest[4] - previous[4]) / previous[4];

        // Calculate simple volatility (std of last 20 closes)
        const closes = candles.slice(-20).map((c: any[]) => c[4]);
        const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
        const variance = closes.reduce((sum, val) => sum + (val - mean) ** 2, 0) / closes.length;
        volatility = Math.sqrt(variance);

        // Volume change
        const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c[5], 0) / 20;
        volumeChange = (candles[candles.length - 1][5] - avgVolume) / avgVolume;
      }
    }

    // Classify regime
    const regime = classifyRegime(returns, volatility, volumeChange);
    const riskProfile = getRiskProfile(regime);

    // Calculate confidence
    const confidence = regime === 'LIQUIDATION_CASCADE'
      ? Math.min(1, Math.abs(returns) / 0.02 + volumeChange / 3)
      : regime === 'TREND_UP' || regime === 'TREND_DOWN'
      ? Math.min(1, Math.abs(returns) / TREND_RETURN_THRESHOLD / 2 + (volumeChange > 0 ? 0.5 : 0))
      : 0.6;

    return NextResponse.json({
      symbol: symbolUpper,
      exchange: 'hyperliquid',
      regime: {
        regime,
        confidence: Math.min(0.95, Math.max(0.4, confidence)),
      },
      riskProfile,
      market: {
        price: parseFloat(coinData.markPx || '0'),
        volume24h: coinData.volume24h || 0,
        openInterest: coinData.openInterest || 0,
        fundingRate: coinData.funding || 0,
      },
      metrics: {
        returns: (returns * 100).toFixed(3) + '%',
        volatility: (volatility * 100).toFixed(4) + '%',
        volumeChange: (volumeChange * 100).toFixed(1) + '%',
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Live data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live data' },
      { status: 500 }
    );
  }
}
