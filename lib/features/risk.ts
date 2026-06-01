import { RiskProfile, RegimeType } from '../types';

export interface RiskRule {
  max_leverage: number;
  max_risk_pct: number;
  trade_allowed: boolean;
  notes: string;
}

// Risk rules per regime
const RISK_RULES: Record<RegimeType, RiskRule> = {
  TREND_UP: {
    max_leverage: 5,
    max_risk_pct: 1.0,
    trade_allowed: true,
    notes: 'Strong uptrend - maximum leverage allowed',
  },
  TREND_DOWN: {
    max_leverage: 3,
    max_risk_pct: 0.75,
    trade_allowed: true,
    notes: 'Downtrend - reduce leverage and position size',
  },
  CHOP_RANGE: {
    max_leverage: 2,
    max_risk_pct: 0.5,
    trade_allowed: true,
    notes: 'Ranging market - conservative sizing recommended',
  },
  SQUEEZE_INCOMING: {
    max_leverage: 1,
    max_risk_pct: 0.25,
    trade_allowed: true,
    notes: 'Low volatility squeeze building - minimum risk',
  },
  LIQUIDATION_CASCADE: {
    max_leverage: 0,
    max_risk_pct: 0,
    trade_allowed: false,
    notes: 'Extreme volatility - CLOSE ALL POSITIONS, no new entries',
  },
  UNKNOWN: {
    max_leverage: 1,
    max_risk_pct: 0.25,
    trade_allowed: false,
    notes: 'Uncertain regime - wait for confirmation',
  },
};

export function getRiskProfile(
  symbol: string,
  openTime: number,
  regime: RegimeType
): RiskProfile {
  const rule = RISK_RULES[regime] ?? RISK_RULES.UNKNOWN;

  return {
    symbol,
    open_time: openTime,
    max_leverage: rule.max_leverage,
    max_risk_pct: rule.max_risk_pct,
    trade_allowed: rule.trade_allowed,
    notes: rule.notes,
  };
}

// Check if a trade should be filtered out based on risk profile
export function shouldAllowTrade(riskProfile: RiskProfile): boolean {
  return (
    riskProfile.trade_allowed &&
    riskProfile.max_leverage > 0 &&
    riskProfile.max_risk_pct > 0
  );
}

// Get risk level display string
export function getRiskLevelDisplay(riskProfile: RiskProfile): string {
  if (!riskProfile.trade_allowed) return 'CRITICAL';
  if (riskProfile.max_leverage >= 5) return 'MODERATE';
  if (riskProfile.max_leverage >= 2) return 'CONSERVATIVE';
  return 'MINIMAL';
}

// Get risk color for UI
export function getRiskColor(riskProfile: RiskProfile): string {
  if (!riskProfile.trade_allowed) return '#dd6974'; // error/red
  if (riskProfile.max_leverage >= 5) return '#6daa45'; // success/green
  if (riskProfile.max_leverage >= 2) return '#fdab43'; // warning/yellow
  return '#4f98a3'; // primary/cyan
}
