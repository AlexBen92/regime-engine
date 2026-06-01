/**
 * Next.js Instrumentation Hook
 * Runs on server startup and initializes the ingestion loop
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startIngestionLoop, getCollector } = require('./lib/ingestion/collector');

    // Start ingestion loop
    startIngestionLoop();

    console.log('Regime Engine instrumentation initialized');

    // Optional: run initial backfill if database is empty
    const { getDatabase } = require('./lib/db');
    const db = getDatabase();
    const repo = new (require('./lib/storage/repository').Repository)(db);

    const symbols = repo.getSymbols();
    if (symbols.length === 0) {
      console.log('No data found, running initial backfill...');
      const collector = getCollector();
      const { BACKFILL_DAYS } = require('./lib/config').getConfig();
      await collector.backfill(BACKFILL_DAYS);
    }
  }
}
