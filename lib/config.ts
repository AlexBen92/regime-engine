import { z } from 'zod';

// Environment variable schema with validation
const ConfigSchema = z.object({
  // Exchange configuration
  EXCHANGE: z.enum(['hyperliquid']).default('hyperliquid'),
  SYMBOLS: z
    .string()
    .default('BTC,ETH,SOL')
    .transform((val) => val.split(',').map((s) => s.trim().toUpperCase())),
  BASE_TIMEFRAME: z.string().default('1m'),
  AGGREGATION_TIMEFRAMES: z
    .string()
    .default('15m,1h')
    .transform((val) => val.split(',').map((s) => s.trim())),
  INGEST_INTERVAL_SECONDS: z
    .string()
    .default('60')
    .transform((val) => parseInt(val, 10)),
  BACKFILL_DAYS: z
    .string()
    .default('90')
    .transform((val) => parseInt(val, 10)),
  DB_PATH: z.string().default('./data/regime.db'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),

  // Thresholds for regime classification
  TREND_RETURN_THRESHOLD: z
    .string()
    .default('0.003')
    .transform((val) => parseFloat(val)),
  LOW_VOL_THRESHOLD: z
    .string()
    .default('0.0008')
    .transform((val) => parseFloat(val)),
  LOW_VOL_CONSECUTIVE_BARS: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
  LIQCASCADE_RETURN_THRESHOLD: z
    .string()
    .default('0.015')
    .transform((val) => parseFloat(val)),
  LIQCASCADE_VOLUME_MULT: z
    .string()
    .default('2.0')
    .transform((val) => parseFloat(val)),
  LIQCASCADE_OI_CHANGE_THRESHOLD: z
    .string()
    .default('0.05')
    .transform((val) => parseFloat(val)),
  VOLATILITY_WINDOW: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
  VOLUME_AVG_WINDOW: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
});

export type Config = z.infer<typeof ConfigSchema>;

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    // Parse all environment variables
    const rawEnv: Record<string, string> = {};

    for (const key of Object.keys(process.env)) {
      const value = process.env[key];
      if (value !== undefined) {
        rawEnv[key] = value;
      }
    }

    configInstance = ConfigSchema.parse(rawEnv);
  }
  return configInstance;
}

// Export constants for easy access
export const { TREND_RETURN_THRESHOLD, LOW_VOL_THRESHOLD, LOW_VOL_CONSECUTIVE_BARS, LIQCASCADE_RETURN_THRESHOLD, LIQCASCADE_VOLUME_MULT, LIQCASCADE_OI_CHANGE_THRESHOLD, VOLATILITY_WINDOW, VOLUME_AVG_WINDOW } = getConfig();
