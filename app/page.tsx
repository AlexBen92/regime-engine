'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { SymbolSelector } from './components/SymbolSelector';
import { RegimeCard } from './components/RegimeCard';
import { RiskBadge } from './components/RiskBadge';
import { RegimeTimeline } from './components/RegimeTimeline';
import { BacktestPanel } from './components/BacktestPanel';
import { Activity } from 'lucide-react';
import { RegimeType } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HomePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark, mounted]);

  // Fetch symbols from live API
  const { data: symbols, isLoading: symbolsLoading } = useSWR<string[]>(
    '/api/live/symbols',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch live regime data
  const { data: liveState, isLoading: liveLoading } = useSWR(
    selectedSymbol ? `/api/live/${selectedSymbol}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch history (still uses database API)
  const { data: history, isLoading: historyLoading } = useSWR(
    selectedSymbol ? `/api/history/${selectedSymbol}?limit=100` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Auto-select first symbol if available
  useEffect(() => {
    if (symbols && symbols.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  if (!mounted) {
    return null;
  }

  const displaySymbols = symbols ?? [];
  const currentRegime = liveState?.regime?.regime as RegimeType;
  const confidence = liveState?.regime?.confidence ?? 0.75;
  const isStale = false; // Live data is always fresh

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Regime Engine</h1>
            <span className="text-xs text-text-muted px-2 py-1 bg-primary/20 rounded">
              Live Data
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isStale && <span className="text-xs text-warning">Data stale</span>}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-md hover:bg-border transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="space-y-6">
            <SymbolSelector
              symbols={displaySymbols}
              selectedSymbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
              isLoading={symbolsLoading}
            />

            {liveState && (
              <>
                <RegimeCard
                  regime={currentRegime}
                  confidence={confidence}
                  isLoading={liveLoading}
                />
                <RiskBadge
                  riskProfile={liveState.riskProfile}
                  isLoading={liveLoading}
                />

                <div className="bg-surface rounded-lg p-4 border border-border space-y-3">
                  <h3 className="text-sm font-semibold text-text-muted">
                    Market Data
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-text-muted block">Price</span>
                      <span className="font-mono tabular-nums">
                        ${liveState.market.price.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Volume 24h</span>
                      <span className="font-mono tabular-nums">
                        {liveState.market.volume24h.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Open Interest</span>
                      <span className="font-mono tabular-nums">
                        {liveState.market.openInterest.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Funding</span>
                      <span className="font-mono tabular-nums">
                        {(liveState.market.fundingRate * 100).toFixed(4)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface rounded-lg p-4 border border-border space-y-2">
                  <h3 className="text-sm font-semibold text-text-muted">
                    Metrics
                  </h3>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Returns:</span>
                      <span className="font-mono tabular-nums">{liveState.metrics.returns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volatility:</span>
                      <span className="font-mono tabular-nums">{liveState.metrics.volatility}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume Change:</span>
                      <span className="font-mono tabular-nums">{liveState.metrics.volumeChange}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            {liveState && (
              <RegimeTimeline
                data={
                  history?.map((h: any) => ({
                    open_time: h.open_time,
                    regime: h.regime,
                    close: h.close,
                  })) ?? []
                }
                isLoading={historyLoading}
              />
            )}

            <BacktestPanel
              symbols={displaySymbols}
              selectedSymbol={selectedSymbol}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
