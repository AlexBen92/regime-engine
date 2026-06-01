import { NextResponse } from 'next/server';
import { RegimeType } from '@/lib/types';
import { TREND_RETURN_THRESHOLD, LOW_VOL_THRESHOLD } from '@/lib/config';

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

    // Fetch all market data from Hyperliquid
    const [metaResponse, allMidsResponse, candlesResponse] = await Promise.all([
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      }),
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      }),
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin: symbolUpper.toLowerCase(), interval: '15m' },
        }),
      }),
    ]);

    if (!metaResponse.ok || !allMidsResponse.ok) {
      throw new Error('Hyperliquid API error');
    }

    const [metaData, allMidsData] = await Promise.all([
      metaResponse.json(),
      allMidsResponse.json(),
    ]);

    // Extract universe and asset contexts from metaAndAssetCtxs response
    // Response is an array: [metaResponse, assetCtxResponse]
    const metaArray = Array.isArray(metaData) ? metaData[0] : metaData;
    const ctxArray = Array.isArray(metaData) ? metaData[1] : [];

    const universe = metaArray?.universe || [];
    const assetCtx = Array.isArray(ctxArray) ? ctxArray : [];

    // Find the coin in universe
    const coinInfo = universe.find((c: any) => c.name === symbolUpper);
    if (!coinInfo) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    // Find the asset context for price/volume data
    const coinData = assetCtx.find((c: any) =>
      c?.asset?.toLowerCase() === symbolUpper.toLowerCase()
    );

    // Parse allMids for current price
    const price = parseFloat(allMidsData[`${symbolUpper}-USDT`] || allMidsData[symbolUpper] || '0');

    let returns = 0;
    let volatility = 0;
    let volumeChange = 0;

    // Parse candle data for regime calculation
    if (candlesResponse.ok) {
      const candles = await candlesResponse.json();
      if (Array.isArray(candles) && candles.length >= 2) {
        const latest = candles[candles.length - 1]; // [time, open, high, low, close, volume]
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
        volumeChange = avgVolume > 0 ? (candles[candles.length - 1][5] - avgVolume) / avgVolume : 0;
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
        price: price || parseFloat(coinData?.markPx || '0'),
        volume24h: coinData?.volume24h || 0,
        openInterest: coinData?.openInterest || 0,
        fundingRate: coinData?.funding || 0,
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
