'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { BacktestResponse } from '@/lib/types';

interface BacktestPanelProps {
  symbols: string[];
  selectedSymbol: string;
}

export function BacktestPanel({ symbols, selectedSymbol }: BacktestPanelProps) {
  const [days, setDays] = useState('30');
  const [timeframe, setTimeframe] = useState('15m');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  const runBacktest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          days: parseInt(days, 10),
          timeframe,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Backtest error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader className="p-0 mb-4">
        <h3 className="text-lg font-semibold">Backtest</h3>
        <p className="text-sm text-text-muted">
          Simulate historical performance with regime filtering
        </p>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="text-sm text-text-muted mb-1 block">Period</label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-sm text-text-muted mb-1 block">Timeframe</label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={runBacktest}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>Running...</>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Total Bars"
                value={result.totalBars.toString()}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label="Tradeable Bars"
                value={result.goodBars.toString()}
                color="success"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label="Filtered Bars"
                value={result.filteredBars.toString()}
                color="warning"
                icon={<AlertCircle className="h-4 w-4" />}
              />
              <StatCard
                label="Edge Improvement"
                value={`+${result.edgeImprovementPct.toFixed(1)}%`}
                color="success"
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Regime Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.regimePct).map(([regime, pct]) => (
                  <Badge key={regime} variant="outline">
                    {regime}: {pct.toFixed(1)}%
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Naive DD Proxy:</span>
                <span className="ml-2 font-mono tabular-nums">
                  {result.naiveDrawdownProxy.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-text-muted">Filtered DD Proxy:</span>
                <span className="ml-2 font-mono tabular-nums text-success">
                  {result.filteredDrawdownProxy.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  color = 'default',
  icon,
}: {
  label: string;
  value: string;
  color?: 'default' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
}) {
  const colorClasses = {
    default: 'bg-surface',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
  };

  return (
    <div
      className={`p-3 rounded-md ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}
