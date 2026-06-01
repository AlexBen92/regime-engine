.PHONY: install dev build start test backtest clean

install:
	pnpm install
	@echo "Creating data directory..."
	@mkdir -p data

dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm start

test:
	pnpm test

backtest:
	@echo "Running backtest with default settings (BTC, 90 days)..."
	pnpm backtest

clean:
	@echo "Cleaning build artifacts..."
	rm -rf .next
	rm -rf data/*.db
