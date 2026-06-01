import { describe, it, expect } from 'vitest';
import { getRiskProfile, getRiskLevelDisplay, getRiskColor, shouldAllowTrade } from '../lib/features/risk';
import { RiskProfile } from '../lib/types';

describe('Risk Profile Calculation', () => {
  describe('Risk rule mappings', () => {
    it('should assign high leverage and risk for TREND_UP', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'TREND_UP');

      expect(profile.max_leverage).toBe(5);
      expect(profile.max_risk_pct).toBe(1.0);
      expect(profile.trade_allowed).toBe(true);
      expect(profile.notes).toContain('maximum leverage');
    });

    it('should assign moderate leverage and risk for TREND_DOWN', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'TREND_DOWN');

      expect(profile.max_leverage).toBe(3);
      expect(profile.max_risk_pct).toBe(0.75);
      expect(profile.trade_allowed).toBe(true);
      expect(profile.notes).toContain('reduce leverage');
    });

    it('should assign conservative leverage and risk for CHOP_RANGE', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'CHOP_RANGE');

      expect(profile.max_leverage).toBe(2);
      expect(profile.max_risk_pct).toBe(0.5);
      expect(profile.trade_allowed).toBe(true);
      expect(profile.notes).toContain('conservative');
    });

    it('should assign minimal leverage and risk for SQUEEZE_INCOMING', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'SQUEEZE_INCOMING');

      expect(profile.max_leverage).toBe(1);
      expect(profile.max_risk_pct).toBe(0.25);
      expect(profile.trade_allowed).toBe(true);
      expect(profile.notes).toContain('minimum risk');
    });

    it('should assign zero leverage and block trading for LIQUIDATION_CASCADE', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'LIQUIDATION_CASCADE');

      expect(profile.max_leverage).toBe(0);
      expect(profile.max_risk_pct).toBe(0);
      expect(profile.trade_allowed).toBe(false);
      expect(profile.notes).toContain('CLOSE ALL POSITIONS');
    });

    it('should assign minimal leverage and block trading for UNKNOWN', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'UNKNOWN');

      expect(profile.max_leverage).toBe(1);
      expect(profile.max_risk_pct).toBe(0.25);
      expect(profile.trade_allowed).toBe(false);
      expect(profile.notes).toContain('wait for confirmation');
    });
  });

  describe('Trade filtering', () => {
    it('should allow trades for permitted regimes with positive leverage', () => {
      const trendUpProfile = getRiskProfile('BTC', Date.now(), 'TREND_UP');
      expect(shouldAllowTrade(trendUpProfile)).toBe(true);

      const trendDownProfile = getRiskProfile('BTC', Date.now(), 'TREND_DOWN');
      expect(shouldAllowTrade(trendDownProfile)).toBe(true);
    });

    it('should not allow trades for blocked regimes', () => {
      const cascadeProfile = getRiskProfile('BTC', Date.now(), 'LIQUIDATION_CASCADE');
      expect(shouldAllowTrade(cascadeProfile)).toBe(false);

      const unknownProfile = getRiskProfile('BTC', Date.now(), 'UNKNOWN');
      expect(shouldAllowTrade(unknownProfile)).toBe(false);
    });

    it('should not allow trades when leverage is zero', () => {
      const profile: RiskProfile = {
        symbol: 'BTC',
        open_time: Date.now(),
        max_leverage: 0,
        max_risk_pct: 0.5,
        trade_allowed: true,
        notes: 'Test',
      };

      expect(shouldAllowTrade(profile)).toBe(false);
    });

    it('should not allow trades when risk is zero', () => {
      const profile: RiskProfile = {
        symbol: 'BTC',
        open_time: Date.now(),
        max_leverage: 3,
        max_risk_pct: 0,
        trade_allowed: true,
        notes: 'Test',
      };

      expect(shouldAllowTrade(profile)).toBe(false);
    });
  });

  describe('Risk level display', () => {
    it('should return MODERATE for high leverage regimes', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'TREND_UP');
      expect(getRiskLevelDisplay(profile)).toBe('MODERATE');
    });

    it('should return CONSERVATIVE for medium leverage regimes', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'CHOP_RANGE');
      expect(getRiskLevelDisplay(profile)).toBe('CONSERVATIVE');
    });

    it('should return MINIMAL for low leverage regimes', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'SQUEEZE_INCOMING');
      expect(getRiskLevelDisplay(profile)).toBe('MINIMAL');
    });

    it('should return CRITICAL for blocked regimes', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'LIQUIDATION_CASCADE');
      expect(getRiskLevelDisplay(profile)).toBe('CRITICAL');
    });
  });

  describe('Risk colors', () => {
    it('should return success color for moderate risk', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'TREND_UP');
      expect(getRiskColor(profile)).toBe('#6daa45');
    });

    it('should return error color for critical risk', () => {
      const profile = getRiskProfile('BTC', Date.now(), 'LIQUIDATION_CASCADE');
      expect(getRiskColor(profile)).toBe('#dd6974');
    });
  });
});
