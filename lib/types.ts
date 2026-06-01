// Shared TypeScript types for the Regime & Risk Engine

export type RegimeType =
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'CHOP_RANGE'
  | 'SQUEEZE_INCOMING'
  | 'LIQUIDATION_CASCADE'
  | 'UNKNOWN';

export const REGIME_TYPES: readonly RegimeType[] = [
  'TREND_UP',
  'TREND_DOWN',
  'CHOP_RANGE',
  'SQUEEZE_INCOMING',
  'LIQUIDATION_CASCADE',
  'UNKNOWN',
] as const;

export type VolRegime = 'low' | 'normal' | 'high';

export interface Bar {
  id?: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  open_time: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number | null;
  funding_rate?: number | null;
}

export interface Feature {
  id?: number;
  bar_id?: number;
  returns: number;
  volatility: number;
  vol_regime: VolRegime;
  volume_change: number;
  oi_change: number;
}

export interface Regime {
  id?: number;
  bar_id?: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  open_time: number;
  regime: RegimeType;
  confidence: number;
}

export interface RiskProfile {
  id?: number;
  regime_id?: number;
  symbol: string;
  open_time: number;
  max_leverage: number;
  max_risk_pct: number;
  trade_allowed: boolean;
  notes: string;
}

export interface StateResponse {
  symbol: string;
  exchange: string;
  regime: Regime;
  riskProfile: RiskProfile;
  bar: {
    close: number;
    volume: number;
    oi: number | null;
    funding_rate: number | null;
  };
  updatedAt: string;
}

export interface HistoryResponse {
  open_time: number;
  regime: RegimeType;
  close: number;
  volume: number;
  riskProfile: RiskProfile;
}

export interface BacktestRequest {
  symbol: string;
  days: number;
  timeframe?: string;
}

export interface BacktestResponse {
  symbol: string;
  days: number;
  totalBars: number;
  goodBars: number;
  filteredBars: number;
  regimePct: Record<string, number>;
  naiveDrawdownProxy: number;
  filteredDrawdownProxy: number;
  edgeImprovementPct: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  lastIngest: string | null;
}
