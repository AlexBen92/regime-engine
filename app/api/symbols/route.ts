import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { createRepository } from '@/lib/storage/repository';

export async function GET() {
  try {
    const db = getDatabase();
    const repo = createRepository(db);
    const symbols = repo.getSymbols();

    return NextResponse.json(symbols);
  } catch (error) {
    console.error('Symbols API error:', error);
    // Return empty array for demo mode on platforms without SQLite support
    return NextResponse.json(['BTC', 'ETH', 'SOL']);
  }
}
