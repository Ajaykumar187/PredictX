import React from 'react';
import { Globe, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import { MarketType } from '../types';

interface GlobalMarketsPageProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

export const GlobalMarketsPage: React.FC<GlobalMarketsPageProps> = ({ onSelectStock }) => {
  const worldIndices = [
    { name: 'S&P 500', region: 'US', price: 5864.67, pct: 0.82 },
    { name: 'NASDAQ 100', region: 'US', price: 20380.12, pct: 1.25 },
    { name: 'Dow Jones', region: 'US', price: 42863.86, pct: 0.52 },
    { name: 'NIFTY 50', region: 'India', price: 22363.35, pct: -0.70 },
    { name: 'BANK NIFTY', region: 'India', price: 54918.00, pct: -0.61 },
    { name: 'FTSE 100', region: 'UK', price: 8253.65, pct: 0.19 },
    { name: 'Nikkei 225', region: 'Japan', price: 39605.80, pct: 0.57 },
    { name: 'Hang Seng', region: 'Hong Kong', price: 20638.70, pct: -1.38 },
    { name: 'Dollar Index (DXY)', region: 'Currency', price: 102.94, pct: 0.12 },
    { name: 'Brent Crude Oil', region: 'Commodity', price: 78.29, pct: -1.45 },
    { name: 'Gold (USD/oz)', region: 'Commodity', price: 2657.40, pct: 0.62 },
    { name: 'Natural Gas', region: 'Commodity', price: 2.63, pct: 2.33 },
  ];

  const topMovers = [
    { symbol: 'NVDA', name: 'Nvidia Corp', market: 'US' as MarketType, change: 4.85, volume: '48M' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors', market: 'NSE' as MarketType, change: 3.42, volume: '12M' },
    { symbol: 'RELIANCE', name: 'Reliance Ind', market: 'NSE' as MarketType, change: 2.15, volume: '8.4M' },
    { symbol: 'AAPL', name: 'Apple Inc', market: 'US' as MarketType, change: 1.82, volume: '34M' },
    { symbol: 'TCS', name: 'Tata Consultancy', market: 'NSE' as MarketType, change: 1.45, volume: '2.1M' },
    { symbol: 'MSFT', name: 'Microsoft', market: 'US' as MarketType, change: 0.94, volume: '18M' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', market: 'NSE' as MarketType, change: -0.65, volume: '9.2M' },
    { symbol: 'TSLA', name: 'Tesla Inc', market: 'US' as MarketType, change: -1.45, volume: '29M' },
    { symbol: 'INFY', name: 'Infosys Ltd', market: 'NSE' as MarketType, change: -1.82, volume: '4.6M' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', market: 'NSE' as MarketType, change: -2.35, volume: '7.8M' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" /> World Indices & Commodities Snapshot
          </h3>
          <p className="text-xs text-slate-500">Live global benchmark index levels and energy/precious metal commodities</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {worldIndices.map((idx) => {
            const isPos = idx.pct >= 0;
            return (
              <div
                key={idx.name}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold uppercase">
                  <span>{idx.region}</span>
                  <span className={isPos ? 'text-emerald-500' : 'text-rose-500'}>
                    {isPos ? '+' : ''}{idx.pct}%
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{idx.name}</h4>
                <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {idx.price.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Market Breadth & Sentiment Mood
          </span>
          <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-500" /> 68% Bullish Breadth (Positive Bias)
          </h4>
          <p className="text-xs text-slate-500">
            Advances leading Declines: 1,420 Advances vs 710 Declines across major liquid equities.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-xs text-emerald-600 font-bold block">Advances</span>
            <span className="text-lg font-black text-emerald-600">66.7%</span>
          </div>
          <div className="text-center">
            <span className="text-xs text-rose-600 font-bold block">Declines</span>
            <span className="text-lg font-black text-rose-600">33.3%</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Movers Heatmap</h3>
          <p className="text-xs text-slate-500">Color-scaled performance across curated active universe</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {topMovers.map((m) => {
            const isPos = m.change >= 0;
            return (
              <button
                key={m.symbol}
                onClick={() => onSelectStock(m.symbol, m.market)}
                className={`p-4 rounded-xl text-left transition-transform hover:scale-105 shadow-sm border ${
                  isPos
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-black text-sm text-slate-900 dark:text-white">{m.symbol}</span>
                  <span className={`text-xs font-bold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isPos ? '+' : ''}{m.change}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1 truncate">{m.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block mt-2">Vol: {m.volume}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
