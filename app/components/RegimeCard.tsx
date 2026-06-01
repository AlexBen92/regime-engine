'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getRegimeColor, getRegimeDisplayName } from '@/lib/features/regimes';
import { RegimeType } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface RegimeCardProps {
  regime: RegimeType;
  confidence: number;
  isLoading?: boolean;
}

export function RegimeCard({ regime, confidence, isLoading = false }: RegimeCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-4 w-24" />
      </Card>
    );
  }

  const color = getRegimeColor(regime);
  const displayName = getRegimeDisplayName(regime);
  const isCascade = regime === 'LIQUIDATION_CASCADE';

  return (
    <Card className="p-6 border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="p-0 mb-4">
        <div className="flex items-center gap-2">
          {isCascade && (
            <AlertTriangle className="h-5 w-5 text-error animate-pulse" />
          )}
          <h3 className="text-lg font-semibold">Market Regime</h3>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="inline-flex items-center px-4 py-2 rounded-md mb-3"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <span className="text-xl font-bold">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Confidence:</span>
          <span className="text-sm font-mono tabular-nums">
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
