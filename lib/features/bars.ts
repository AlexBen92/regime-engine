import { Bar, Feature } from '../types';
import { VOLATILITY_WINDOW, VOLUME_AVG_WINDOW } from '../config';

// Resample bars to a larger timeframe
export function resampleBars(
  bars: Bar[],
  targetTimeframe: string
): Bar[] {
  if (bars.length === 0) return [];

  const timeframeMs = timeframeToMs(targetTimeframe);
  const sourceTimeframeMs = timeframeToMs(bars[0].timeframe);

  if (sourceTimeframeMs >= timeframeMs) {
    return bars; // No resampling needed
  }

  const grouped = new Map<number, Bar[]>();

  for (const bar of bars) {
    const timestamp = Math.floor(bar.open_time / timeframeMs) * timeframeMs;
    if (!grouped.has(timestamp)) {
      grouped.set(timestamp, []);
    }
    grouped.get(timestamp)!.push(bar);
  }

  const resampled: Bar[] = [];

  for (const [timestamp, groupBars] of grouped.entries()) {
    groupBars.sort((a, b) => a.open_time - b.open_time);

    const first = groupBars[0];
    const last = groupBars[groupBars.length - 1];

    resampled.push({
      symbol: first.symbol,
      exchange: first.exchange,
      timeframe: targetTimeframe,
      open_time: timestamp,
      open: first.open,
      high: Math.max(...groupBars.map((b) => b.high)),
      low: Math.min(...groupBars.map((b) => b.low)),
      close: last.close,
      volume: groupBars.reduce((sum, b) => sum + b.volume, 0),
      oi: last.oi,
      funding_rate: last.funding_rate,
    });
  }

  return resampled.sort((a, b) => a.open_time - b.open_time);
}

export function timeframeToMs(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) return 60000; // Default 1m

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return value * 60000;
    case 'h':
      return value * 3600000;
    case 'd':
      return value * 86400000;
    default:
      return 60000;
  }
}

// Compute returns for a bar
export function computeReturns(bar: Bar, prevBar: Bar | null): number {
  if (!prevBar) return 0;
  return (bar.close - prevBar.close) / prevBar.close;
}

// Compute rolling volatility (standard deviation of returns)
export function computeVolatility(
  bars: Bar[],
  window: number = VOLATILITY_WINDOW
): Map<number, number> {
  const result = new Map<number, number>();

  if (bars.length < 2) return result;

  const returns: number[] = [];
  const timestamps: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    returns.push(computeReturns(bars[i], bars[i - 1]));
    timestamps.push(bars[i].open_time);
  }

  for (let i = window - 1; i < returns.length; i++) {
    const windowReturns = returns.slice(i - window + 1, i + 1);
    const mean = windowReturns.reduce((sum, r) => sum + r, 0) / windowReturns.length;
    const variance =
      windowReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / windowReturns.length;
    result.set(timestamps[i], Math.sqrt(variance));
  }

  return result;
}

// Determine volatility regime
export function getVolRegime(volatility: number, lowThreshold: number): 'low' | 'normal' | 'high' {
  if (volatility < lowThreshold) return 'low';
  if (volatility < lowThreshold * 2) return 'normal';
  return 'high';
}

// Compute volume change vs rolling average
export function computeVolumeChange(
  bars: Bar[],
  window: number = VOLUME_AVG_WINDOW
): Map<number, number> {
  const result = new Map<number, number>();

  if (bars.length < window) return result;

  for (let i = window - 1; i < bars.length; i++) {
    const windowBars = bars.slice(i - window + 1, i + 1);
    const avgVolume =
      windowBars.reduce((sum, b) => sum + b.volume, 0) / windowBars.length;
    const change = (bars[i].volume - avgVolume) / avgVolume;
    result.set(bars[i].open_time, change);
  }

  return result;
}

// Compute OI change vs previous bar
export function computeOIChange(bar: Bar, prevBar: Bar | null): number {
  if (!bar.oi || !prevBar?.oi) return 0;
  return (bar.oi - prevBar.oi) / prevBar.oi;
}

// Compute all features for a bar
export function computeFeatures(
  bar: Bar,
  allBars: Bar[],
  volatilityMap: Map<number, number>,
  volumeChangeMap: Map<number, number>,
  prevBar: Bar | null
): Feature {
  const volatility = volatilityMap.get(bar.open_time) ?? 0;
  const volRegime = getVolRegime(volatility, 0.0008); // Will use config threshold
  const volumeChange = volumeChangeMap.get(bar.open_time) ?? 0;
  const oiChange = computeOIChange(bar, prevBar);
  const returns = computeReturns(bar, prevBar);

  return {
    returns,
    volatility,
    vol_regime: volRegime,
    volume_change: volumeChange,
    oi_change: oiChange,
  };
}
