import React from 'react';
import { MarketType, RecentSearchItem } from '../types';
import { MarketHeatmap } from '../components/MarketHeatmap';

interface MarketHeatmapPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
  theme?: 'Light' | 'Dark';
  recentSearches?: RecentSearchItem[];
  onRemoveRecent?: (symbol: string) => void;
  onClearRecent?: () => void;
  activeSymbol?: string;
}

export const MarketHeatmapPage: React.FC<MarketHeatmapPageProps> = ({
  onSelectStock,
  theme = 'Light',
  recentSearches,
  onRemoveRecent,
  onClearRecent,
  activeSymbol,
}) => {
  return (
    <div className="w-full">
      <MarketHeatmap
        onSelectStock={onSelectStock}
        theme={theme}
        recentSearches={recentSearches}
        onRemoveRecent={onRemoveRecent}
        onClearRecent={onClearRecent}
        activeSymbol={activeSymbol}
      />
    </div>
  );
};

export default MarketHeatmapPage;
