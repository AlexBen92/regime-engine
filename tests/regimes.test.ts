import { describe, it, expect } from 'vitest';
import {
  classifyRegime,
  checkConsecutiveLowVol,
  calculateConfidence,
  getRegimeColor,
  getRegimeDisplayName,
} from '../lib/features/regimes';
import { RegimeType } from '../lib/types';
import { Feature } from '../lib/types';

describe('Regime Classification', () => {
  beforeEach(() => {
    // Reset counters before each test
    const counters = (classifyRegime as any).squeezeCounters =
      (classifyRegime as any).squeezeCounters || new Map();
    counters.clear();
  });

  describe('TREND_UP', () => {
    it('should classify TREND_UP with positive returns and volume confirmation', () => {
      const feature: Feature = {
        returns: 0.005,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: 0.5,
        oi_change: 0.01,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).toBe('TREND_UP');
    });

    it('should not classify TREND_UP with negative returns', () => {
      const feature: Feature = {
        returns: -0.005,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: 0.5,
        oi_change: 0.01,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).not.toBe('TREND_UP');
    });

    it('should not classify TREND_UP without volume confirmation', () => {
      const feature: Feature = {
        returns: 0.005,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: -0.5,
        oi_change: 0.01,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).not.toBe('TREND_UP');
    });
  });

  describe('TREND_DOWN', () => {
    it('should classify TREND_DOWN with negative returns and volume confirmation', () => {
      const feature: Feature = {
        returns: -0.005,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: 0.5,
        oi_change: 0.01,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).toBe('TREND_DOWN');
    });

    it('should not classify TREND_DOWN with positive returns', () => {
      const feature: Feature = {
        returns: 0.005,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: 0.5,
        oi_change: 0.01,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).not.toBe('TREND_DOWN');
    });
  });

  describe('CHOP_RANGE', () => {
    it('should classify CHOP_RANGE with low absolute returns', () => {
      const feature: Feature = {
        returns: 0.001,
        volatility: 0.001,
        vol_regime: 'low',
        volume_change: 0.1,
        oi_change: 0.005,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).toBe('CHOP_RANGE');
    });
  });

  describe('SQUEEZE_INCOMING', () => {
    it('should classify SQUEEZE_INCOMING after consecutive low volatility bars', () => {
      const feature: Feature = {
        returns: 0.001,
        volatility: 0.0005,
        vol_regime: 'low',
        volume_change: 0.1,
        oi_change: 0.005,
      };

      // Simulate consecutive low vol
      for (let i = 0; i < 25; i++) {
        checkConsecutiveLowVol('BTC', 'low');
      }

      const isConsecutive = checkConsecutiveLowVol('BTC', 'low');
      const regime = classifyRegime('BTC', feature, isConsecutive);

      expect(regime).toBe('SQUEEZE_INCOMING');
    });
  });

  describe('LIQUIDATION_CASCADE', () => {
    it('should classify LIQUIDATION_CASCADE with extreme move, high volume, and OI change', () => {
      const feature: Feature = {
        returns: 0.02,
        volatility: 0.01,
        vol_regime: 'high',
        volume_change: 3.0,
        oi_change: 0.1,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).toBe('LIQUIDATION_CASCADE');
    });

    it('should classify LIQUIDATION_CASCADE with negative extreme move', () => {
      const feature: Feature = {
        returns: -0.02,
        volatility: 0.01,
        vol_regime: 'high',
        volume_change: 3.0,
        oi_change: 0.1,
      };

      const regime = classifyRegime('BTC', feature, false);
      expect(regime).toBe('LIQUIDATION_CASCADE');
    });
  });

  describe('Confidence calculation', () => {
    it('should calculate high confidence for strong LIQUIDATION_CASCADE', () => {
      const feature: Feature = {
        returns: 0.03,
        volatility: 0.01,
        vol_regime: 'high',
        volume_change: 5.0,
        oi_change: 0.15,
      };

      const confidence = calculateConfidence('LIQUIDATION_CASCADE', feature);
      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should calculate moderate confidence for weak TREND_UP', () => {
      const feature: Feature = {
        returns: 0.0035,
        volatility: 0.002,
        vol_regime: 'normal',
        volume_change: 0.3,
        oi_change: 0.01,
      };

      const confidence = calculateConfidence('TREND_UP', feature);
      expect(confidence).toBeGreaterThan(0.3);
      expect(confidence).toBeLessThan(0.8);
    });
  });

  describe('UI helpers', () => {
    it('should return correct colors for each regime', () => {
      expect(getRegimeColor('TREND_UP')).toBe('#6daa45');
      expect(getRegimeColor('TREND_DOWN')).toBe('#dd6974');
      expect(getRegimeColor('CHOP_RANGE')).toBe('#fdab43');
      expect(getRegimeColor('SQUEEZE_INCOMING')).toBe('#fdab43');
      expect(getRegimeColor('LIQUIDATION_CASCADE')).toBe('#dd6974');
      expect(getRegimeColor('UNKNOWN')).toBe('#797876');
    });

    it('should return correct display names', () => {
      expect(getRegimeDisplayName('TREND_UP')).toBe('Trend Up');
      expect(getRegimeDisplayName('TREND_DOWN')).toBe('Trend Down');
      expect(getRegimeDisplayName('CHOP_RANGE')).toBe('Chop Range');
      expect(getRegimeDisplayName('SQUEEZE_INCOMING')).toBe('Squeeze Incoming');
      expect(getRegimeDisplayName('LIQUIDATION_CASCADE')).toBe('Liquidation Cascade');
      expect(getRegimeDisplayName('UNKNOWN')).toBe('Unknown');
    });
  });
});
