import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    });

    if (!response.ok) {
      throw new Error('Hyperliquid meta error');
    }

    const metaData = await response.json();

    // Extract top symbols by volume
    const symbols = (metaData as any[])
      .filter((c: any) => c.asset && !c.asset.includes('-'))
      .sort((a: any, b: any) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 20)
      .map((c: any) => c.asset);

    return NextResponse.json(symbols);
  } catch (error) {
    console.error('Symbols error:', error);
    return NextResponse.json(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE']);
  }
}
