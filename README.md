# Regime & Risk Engine

A production-grade MVP for crypto perpetuals market regime classification and risk management. Built with Next.js 14, TypeScript, and SQLite.

## Features

- **Real-time Market Regime Classification**: Automatically classifies markets into 6 regimes (Trend Up/Down, Chop Range, Squeeze, Liquidation Cascade, Unknown)
- **Dynamic Risk Profiles**: Per-regime leverage and position sizing recommendations
- **Hyperliquid Integration**: Real-time data ingestion from Hyperliquid exchange
- **Historical Backtesting**: CLI tool to simulate strategy performance with regime filtering
- **Dark Mode Dashboard**: Real-time UI with auto-refresh every 30 seconds

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Recharts
- **Backend**: Next.js API Routes, better-sqlite3
- **Data Source**: Hyperliquid REST API
- **Testing**: Vitest
- **Language**: TypeScript (strict mode)

## Quick Start

```bash
# Install dependencies
make install

# Run development server
make dev

# Run tests
make test

# Build for production
make build

# Run backtest CLI
make backtest
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Exchange Configuration
EXCHANGE=hyperliquid
SYMBOLS=BTC,ETH,SOL
BASE_TIMEFRAME=1m
AGGREGATION_TIMEFRAMES=15m,1h
INGEST_INTERVAL_SECONDS=60
BACKFILL_DAYS=90
DB_PATH=./data/regime.db

# Thresholds (optional)
TREND_RETURN_THRESHOLD=0.003
LOW_VOL_THRESHOLD=0.0008
```

## Project Structure

```
regime-engine/
├── app/
│   ├── api/           # Next.js API routes
│   ├── components/    # React UI components
│   └── page.tsx       # Main dashboard
├── lib/
│   ├── exchanges/     # Exchange client implementations
│   ├── features/      # Regime classification & risk logic
│   ├── ingestion/     # Data collection loop
│   └── storage/      # Database repository
├── db/               # SQLite schema & migrations
├── scripts/          # CLI tools (backtest)
└── tests/            # Unit tests
```

## Regime Types

| Regime | Description | Max Leverage | Max Risk |
|--------|-------------|--------------|----------|
| TREND_UP | Strong uptrend with volume | 5x | 1.0% |
| TREND_DOWN | Downtrend with volume | 3x | 0.75% |
| CHOP_RANGE | Low volatility ranging | 2x | 0.5% |
| SQUEEZE_INCOMING | Low vol squeeze building | 1x | 0.25% |
| LIQUIDATION_CASCADE | Extreme volatility event | 0x | 0% (close all) |
| UNKNOWN | Uncertain regime | 1x | 0.25% |

## API Endpoints

- `GET /api/health` - Health check and uptime
- `GET /api/symbols` - List of available symbols
- `GET /api/state/[symbol]` - Current regime and risk for a symbol
- `GET /api/history/[symbol]?limit=100` - Historical regime data
- `POST /api/backtest` - Run historical backtest simulation

## Development

```bash
# Run with hot reload
pnpm dev

# Type check
tsc --noEmit

# Run tests in watch mode
pnpm test:watch
```

## Deployment

Built for Ubuntu VPS deployment:

```bash
# Build standalone output
pnpm build

# Start production server
pnpm start

# Or with PM2
pm2 start npm --name "regime-engine" -- start
```

## License

MIT
