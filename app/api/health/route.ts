import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { createRepository } from '@/lib/storage/repository';

export async function GET() {
  try {
    const db = getDatabase();
    const repo = createRepository(db);

    const lastIngest = repo.getMetadata('last_ingest');
    const uptime = process.uptime();

    return NextResponse.json({
      status: 'ok',
      uptime: Math.floor(uptime),
      lastIngest,
      mode: 'sqlite',
    });
  } catch (error) {
    // Return demo mode status for platforms without SQLite support
    return NextResponse.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      lastIngest: null,
      mode: 'demo',
    });
  }
}
