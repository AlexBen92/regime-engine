'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getRiskColor, getRiskLevelDisplay } from '@/lib/features/risk';
import { RiskProfile } from '@/lib/types';
import { Shield, ShieldAlert } from 'lucide-react';

interface RiskBadgeProps {
  riskProfile: RiskProfile;
  isLoading?: boolean;
}

export function RiskBadge({ riskProfile, isLoading = false }: RiskBadgeProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-4 w-20" />
      </Card>
    );
  }

  const color = getRiskColor(riskProfile);
  const riskLevel = getRiskLevelDisplay(riskProfile);

  return (
    <Card className="p-6 border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="p-0 mb-4">
        <div className="flex items-center gap-2">
          {riskProfile.trade_allowed ? (
            <Shield className="h-5 w-5" style={{ color }} />
          ) : (
            <ShieldAlert className="h-5 w-5 text-error" />
          )}
          <h3 className="text-lg font-semibold">Risk Profile</h3>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Level:</span>
          <Badge
            variant="outline"
            className="font-semibold"
            style={{
              borderColor: color,
              color,
              backgroundColor: `${color}15`,
            }}
          >
            {riskLevel}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Max Leverage:</span>
          <span className="font-mono tabular-nums text-lg font-bold">
            {riskProfile.max_leverage}x
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Max Risk:</span>
          <span className="font-mono tabular-nums">
            {riskProfile.max_risk_pct}%
          </span>
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-text-muted">{riskProfile.notes}</p>
        </div>
      </CardContent>
    </Card>
  );
}
