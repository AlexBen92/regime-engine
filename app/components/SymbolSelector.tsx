'use client';

import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface SymbolSelectorProps {
  symbols: string[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  isLoading?: boolean;
}

export function SymbolSelector({
  symbols,
  selectedSymbol,
  onSymbolChange,
  isLoading = false,
}: SymbolSelectorProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <label className="text-sm font-medium text-text-muted mb-2 block">
        Select Asset
      </label>
      <Select value={selectedSymbol} onValueChange={onSymbolChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a symbol" />
        </SelectTrigger>
        <SelectContent>
          {symbols.map((symbol) => (
            <SelectItem key={symbol} value={symbol}>
              {symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
}
