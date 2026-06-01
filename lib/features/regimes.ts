import { RegimeType, Feature } from '../types';
import {
  TREND_RETURN_THRESHOLD,
  LOW_VOL_THRESHOLD,
  LOW_VOL_CONSECUTIVE_BARS,
  LIQCASCADE_RETURN_THRESHOLD,
  LIQCASCADE_VOLUME_MULT,
  LIQCASCADE_OI_CHANGE_THRESHOLD,
} from '../config';

// Squeeze tracking: consecutive low volatility bars per symbol
const squeezeCounters = new Map<string, number>();

export function classifyRegime(
  symbol: string,
  feature: Feature,
  isConsecutiveLowVol: boolean
): RegimeType {
  const { returns, vol_regime, volume_change, oi_change } = feature;

  // LIQUIDATION_CASCADE: extreme move with high volume and OI change
  if (
    Math.abs(returns) > LIQCASCADE_RETURN_THRESHOLD &&
    volume_change > LIQCASCADE_VOLUME_MULT &&
    Math.abs(oi_change) > LIQCASCADE_OI_CHANGE_THRESHOLD
  ) {
    resetSqueezeCounter(symbol);
    return 'LIQUIDATION_CASCADE';
  }

  // SQUEEZE_INCOMING: consecutive low volatility bars
  if (vol_regime === 'low' && isConsecutiveLowVol) {
    return 'SQUEEZE_INCOMING';
  }

  // Check if we're in a squeeze breakout (reset counter on high vol)
  if (vol_regime === 'high' || vol_regime === 'normal') {
    resetSqueezeCounter(symbol);
  }

  // TREND_UP: positive returns with normal/high vol and volume confirmation
  if (
    returns > TREND_RETURN_THRESHOLD &&
    (vol_regime === 'normal' || vol_regime === 'high') &&
    volume_change > 0
  ) {
    return 'TREND_UP';
  }

  // TREND_DOWN: negative returns with normal/high vol and volume confirmation
  if (
    returns < -TREND_RETURN_THRESHOLD &&
    (vol_regime === 'normal' || vol_regime === 'high') &&
    volume_change > 0
  ) {
    return 'TREND_DOWN';
  }

  // CHOP_RANGE: everything else with low absolute return
  if (Math.abs(returns) < TREND_RETURN_THRESHOLD) {
    return 'CHOP_RANGE';
  }

  // UNKNOWN: edge cases
  return 'UNKNOWN';
}

// Check if this bar continues a low volatility streak
export function checkConsecutiveLowVol(
  symbol: string,
  volRegime: 'low' | 'normal' | 'high',
  lowThreshold: number = LOW_VOL_THRESHOLD
): boolean {
  const currentCount = squeezeCounters.get(symbol) ?? 0;

  if (volRegime === 'low') {
    const newCount = currentCount + 1;
    squeezeCounters.set(symbol, newCount);
    return newCount >= LOW_VOL_CONSECUTIVE_BARS;
  } else {
    squeezeCounters.set(symbol, 0);
    return false;
  }
}

export function resetSqueezeCounter(symbol: string): void {
  squeezeCounters.set(symbol, 0);
}

// Calculate confidence score for regime classification
export function calculateConfidence(
  regime: RegimeType,
  feature: Feature
): number {
  const { returns, volatility, volume_change, oi_change } = feature;

  switch (regime) {
    case 'LIQUIDATION_CASCADE':
      // High confidence when all conditions are strong
      const liqStrength =
        Math.min(Math.abs(returns) / LIQCASCADE_RETURN_THRESHOLD, 2) / 2 +
        Math.min(volume_change / LIQCASCADE_VOLUME_MULT, 2) / 2 +
        Math.min(Math.abs(oi_change) / LIQCASCADE_OI_CHANGE_THRESHOLD, 2) / 2;
      return Math.min(liqStrength / 3, 1);

    case 'TREND_UP':
    case 'TREND_DOWN':
      // Confidence based on return strength and volume confirmation
      const trendStrength = Math.abs(returns) / TREND_RETURN_THRESHOLD;
      const volConfirm = volume_change > 0 ? 1 : 0.5;
      return Math.min((trendStrength / 2 + volConfirm) / 2, 1);

    case 'SQUEEZE_INCOMING':
      // Based on how low volatility is
      const squeezeStrength = Math.max(0, 1 - volatility / (LOW_VOL_THRESHOLD * 2));
      return Math.min(squeezeStrength, 1);

    case 'CHOP_RANGE':
      // High confidence when returns are very small
      const chopStrength = 1 - Math.abs(returns) / TREND_RETURN_THRESHOLD;
      return Math.min(chopStrength, 1);

    default:
      return 0.5;
  }
}

// Get regime color for UI
export function getRegimeColor(regime: RegimeType): string {
  switch (regime) {
    case 'TREND_UP':
      return '#6daa45'; // success/green
    case 'TREND_DOWN':
      return '#dd6974'; // error/red
    case 'CHOP_RANGE':
      return '#fdab43'; // warning/yellow
    case 'SQUEEZE_INCOMING':
      return '#fdab43'; // warning/orange
    case 'LIQUIDATION_CASCADE':
      return '#dd6974'; // error/red pulsing
    default:
      return '#797876'; // gray
  }
}

// Get regime display name
export function getRegimeDisplayName(regime: RegimeType): string {
  return regime
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
