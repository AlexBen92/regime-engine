import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });

    if (!response.ok) {
      throw new Error('Hyperliquid meta error');
    }

    const metaData = await response.json();

    // Extract universe from metaAndAssetCtxs response
    // Response is an array: [metaResponse, assetCtxResponse]
    const metaArray = Array.isArray(metaData) ? metaData[0] : metaData;
    const ctxArray = Array.isArray(metaData) ? metaData[1] : [];

    const universe = metaArray?.universe || [];
    const assetCtx = Array.isArray(ctxArray) ? ctxArray : [];

    // Combine universe with volume data and filter out delisted coins
    const symbols = universe
      .filter((c: any) => !c.isDelisted)
      .map((c: any) => c.name)
      .slice(0, 20);

    return NextResponse.json(symbols);
  } catch (error) {
    console.error('Symbols error:', error);
    return NextResponse.json(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE']);
  }
}
