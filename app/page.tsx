'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { SymbolSelector } from './components/SymbolSelector';
import { RegimeCard } from './components/RegimeCard';
import { RiskBadge } from './components/RiskBadge';
import { RegimeTimeline } from './components/RegimeTimeline';
import { BacktestPanel } from './components/BacktestPanel';
import { Activity } from 'lucide-react';
import { StateResponse, HistoryResponse, RegimeType } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HomePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark, mounted]);

  // Fetch symbols
  const { data: symbols, isLoading: symbolsLoading } = useSWR<string[]>(
    '/api/symbols',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch current state
  const { data: state, isLoading: stateLoading } = useSWR<StateResponse>(
    selectedSymbol ? `/api/state/${selectedSymbol}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch history
  const { data: history, isLoading: historyLoading } = useSWR<HistoryResponse[]>(
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

  const isStale = state
    ? Date.now() - new Date(state.updatedAt).getTime() > 120000
    : false;

  if (!mounted) {
    return null;
  }

  const displaySymbols = symbols ?? [];

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Regime Engine</h1>
          </div>
          <div className="flex items-center gap-4">
            {isStale && (
              <span className="text-xs text-warning">Data stale</span>
            )}
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

            {state && (
              <>
                <RegimeCard
                  regime={state.regime.regime}
                  confidence={state.regime.confidence}
                  isLoading={stateLoading}
                />
                <RiskBadge
                  riskProfile={state.riskProfile}
                  isLoading={stateLoading}
                />

                <div className="bg-surface rounded-lg p-4 border border-border space-y-3">
                  <h3 className="text-sm font-semibold text-text-muted">
                    Current Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-text-muted block">Close</span>
                      <span className="font-mono tabular-nums">
                        ${state.bar.close.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Volume</span>
                      <span className="font-mono tabular-nums">
                        {state.bar.volume.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">OI</span>
                      <span className="font-mono tabular-nums">
                        {state.bar.oi
                          ? state.bar.oi.toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Funding</span>
                      <span className="font-mono tabular-nums">
                        {state.bar.funding_rate !== null
                          ? `${(state.bar.funding_rate * 100).toFixed(4)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            <RegimeTimeline
              data={
                history?.map((h) => ({
                  open_time: h.open_time,
                  regime: h.regime,
                  close: h.close,
                })) ?? []
              }
              isLoading={historyLoading}
            />

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
