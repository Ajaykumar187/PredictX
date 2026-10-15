import React from 'react';
import { AnalysisResult, MarketType } from '../types';
import { StockSplitView } from '../components/StockSplitView';

interface StockComparePageProps {
  data?: AnalysisResult;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

export const StockComparePage: React.FC<StockComparePageProps> = ({
  data,
  theme = 'Dark',
  onSelectStock,
}) => {
  const initialA = data
    ? { symbol: data.displaySymbol, market: data.market }
    : { symbol: 'TCS', market: 'NSE' as MarketType };

  const initialB =
    data?.displaySymbol === 'INFY'
      ? { symbol: 'TCS', market: 'NSE' as MarketType }
      : { symbol: 'INFY', market: 'NSE' as MarketType };

  return (
    <div className="space-y-6">
      <StockSplitView
        initialStockA={initialA}
        initialStockB={initialB}
        theme={theme}
        onSelectStock={onSelectStock}
      />
    </div>
  );
};

export default StockComparePage;
