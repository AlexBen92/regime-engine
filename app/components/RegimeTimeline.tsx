'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getRegimeColor } from '@/lib/features/regimes';
import { RegimeType } from '@/lib/types';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TimelineData {
  open_time: number;
  regime: RegimeType;
  close: number;
}

interface RegimeTimelineProps {
  data: TimelineData[];
  isLoading?: boolean;
}

export function RegimeTimeline({ data, isLoading = false }: RegimeTimelineProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <CardHeader>
          <h3 className="text-lg font-semibold">Regime Timeline</h3>
        </CardHeader>
        <CardContent>
          <p className="text-text-muted">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    time: new Date(d.open_time).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    close: d.close,
    regime: d.regime,
  }));

  return (
    <Card className="p-6">
      <CardHeader className="p-0 mb-4">
        <h3 className="text-lg font-semibold">Regime Timeline</h3>
        <p className="text-sm text-text-muted">
          Last {data.length} bars
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barCategoryGap={0}>
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              hide
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'var(--text)' }}
              cursor={{ fill: 'var(--border)' }}
            />
            <Bar dataKey="close" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getRegimeColor(entry.regime)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
