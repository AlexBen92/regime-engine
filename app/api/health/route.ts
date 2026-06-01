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
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        uptime: process.uptime(),
        lastIngest: null,
      },
      { status: 500 }
    );
  }
}
