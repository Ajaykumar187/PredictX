import React, { useState, useMemo } from 'react';
import { OptionChainRow } from '../utils/greeks';
import { ChartTab, OverviewTab, CompositionTab, ChainSummary } from './option/OptionTabs';
import { WatchlistPanel, PositionsPanel, OrdersPanel, DepthPanel } from './option/OptionDrawers';
import { placeOrders } from '../utils/paperTrades';
import {
  Search,
  ChevronDown,
  Layers,
  Plus,
  Check,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Bookmark,
  Briefcase,
  ShoppingCart,
  Activity,
  MoreHorizontal,
  X,
  SlidersHorizontal,
  Zap,
  Info,
} from 'lucide-react';

export interface NseOptionChainTableProps {
  symbol: string;
  exchange?: string;
  spotPrice: number;
  dayChange: number;
  dayChangePerc: number;
  chain: OptionChainRow[];
  atmStrike: number;
  expiries?: string[];
  currentExpiry?: string;
  onSelectExpiry?: (exp: string) => void;
  onSelectSymbol?: (sym: string) => void;
  availableSymbols?: Array<{ symbol: string; name: string }>;
  isLiveFeed?: boolean;
  lotSize?: number;
  pcr?: number;
  maxPain?: number;
  summary?: ChainSummary;
  strikes?: number;
  onChangeStrikes?: (n: number) => void;
}

export function formatExpiry(exp: string): string {
  if (!exp) return '—';
  const d = /^\d{4}-\d{2}-\d{2}/.test(exp) ? new Date(`${exp.slice(0, 10)}T00:00:00`) : new Date(exp);
  if (isNaN(d.getTime())) return exp;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const fmtPrice = (v: number) => (v > 0 ? `₹${v.toFixed(2)}` : '—');
const fmtPct = (v?: number) => (typeof v === 'number' && v !== 0 ? `(${v > 0 ? '+' : ''}${v.toFixed(2)}%)` : '');

export function formatIndianOI(val: number): string {
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if (abs >= 1e7) {
    return `${(val / 1e7).toFixed(2)} Cr`;
  }
  if (abs >= 1e5) {
    return `${(val / 1e5).toFixed(2)} L`;
  }
  if (abs >= 1e3) {
    return `${(val / 1e3).toFixed(1)}K`;
  }
  return val.toLocaleString('en-IN');
}

export function formatIndianVolume(val: number): string {
  if (val === 0) return '0Cr';
  const abs = Math.abs(val);
  if (abs >= 1e7) {
    return `${(val / 1e7).toFixed(2)}Cr`;
  }
  if (abs >= 1e5) {
    return `${(val / 1e5).toFixed(2)}L`;
  }
  if (abs >= 1e3) {
    return `${(val / 1e3).toFixed(1)}K`;
  }
  return val.toLocaleString('en-IN');
}

export function formatIndianChangeOI(val: number, pct?: number): string {
  if (val === 0 && (!pct || pct === 0)) return '0 (0.00%)';
  const sign = val > 0 ? '+' : '';
  const pctSign = pct !== undefined && pct > 0 ? '+' : '';
  const pctStr = pct !== undefined ? ` (${pctSign}${pct.toFixed(2)}%)` : '';
  const abs = Math.abs(val);

  if (abs >= 1e7) {
    return `${sign}${(val / 1e7).toFixed(2)} Cr${pctStr}`;
  }
  if (abs >= 1e5) {
    return `${sign}${val.toLocaleString('en-IN')}${pctStr}`;
  }
  if (abs >= 1e3) {
    return `${sign}${(val / 1e3).toFixed(1)}K${pctStr}`;
  }
  return `${sign}${val.toLocaleString('en-IN')}${pctStr}`;
}

const RAIL = [
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'positions', label: 'Positions', icon: Briefcase },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'depth', label: 'Depth', icon: Activity },
] as const;

interface StrategyLeg {
  id: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  price: number;
  qty: number;
}

export const NseOptionChainTable: React.FC<NseOptionChainTableProps> = ({
  symbol = 'NIFTY',
  exchange = 'NSE',
  spotPrice,
  dayChange = 0,
  dayChangePerc = 0,
  chain = [],
  atmStrike,
  expiries = [],
  currentExpiry = '',
  onSelectExpiry,
  onSelectSymbol,
  availableSymbols = [
    { symbol: 'NIFTY', name: 'NIFTY 50' },
    { symbol: 'BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy' },
    { symbol: 'INFY', name: 'Infosys' },
  ],
  isLiveFeed = true,
  lotSize = 25,
  pcr,
  maxPain,
  summary,
  strikes = 10,
  onChangeStrikes,
}) => {
  const [activeTab, setActiveTab] = useState<'Chart' | 'Overview' | 'Option Chain' | 'Stock Composition'>('Option Chain');
  const [basketMode, setBasketMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const selectedExpiry = currentExpiry;
  const [isExpiryDropdownOpen, setIsExpiryDropdownOpen] = useState<boolean>(false);
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState<boolean>(false);
  const [viewGreeks, setViewGreeks] = useState<boolean>(false);
  const [activeRightDrawer, setActiveRightDrawer] = useState<'none' | 'watchlist' | 'positions' | 'orders' | 'depth'>('none');
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);
  const [selectedLegs, setSelectedLegs] = useState<StrategyLeg[]>([]);
  const [depthTarget, setDepthTarget] = useState<{ strike: number; side: 'CE' | 'PE' } | null>(null);

  const chainSummary: ChainSummary = summary ?? {
    pcr: pcr ?? 0, maxPain: maxPain ?? 0,
    totalCallOI: chain.reduce((a, r) => a + r.callOI, 0), totalPutOI: chain.reduce((a, r) => a + r.putOI, 0),
    totalCallChangeOI: chain.reduce((a, r) => a + r.callChangeOI, 0), totalPutChangeOI: chain.reduce((a, r) => a + r.putChangeOI, 0),
  };
  const openDepth = (strike: number, side: 'CE' | 'PE') => {
    setDepthTarget({ strike, side });
    setActiveRightDrawer('depth');
  };

  const filteredChain = useMemo(() => {
    if (!searchQuery.trim()) return chain;
    const queryNum = parseInt(searchQuery.trim().replace(/,/g, ''), 10);
    if (!isNaN(queryNum)) {
      return chain.filter((row) => Math.abs(row.strike - queryNum) <= 400 || row.strike.toString().includes(searchQuery.trim()));
    }
    return chain;
  }, [chain, searchQuery]);

  const spotIndex = useMemo(() => {
    for (let i = 0; i < filteredChain.length; i++) {
      if (filteredChain[i].strike >= spotPrice) {
        return i;
      }
    }
    return -1;
  }, [filteredChain, spotPrice]);

  const handleExpiryChange = (exp: string) => {
    setIsExpiryDropdownOpen(false);
    if (onSelectExpiry) onSelectExpiry(exp);
  };

  const handleSymbolChange = (sym: string) => {
    setIsSymbolDropdownOpen(false);
    if (onSelectSymbol) onSelectSymbol(sym);
  };

  const toggleLeg = (strike: number, type: 'CE' | 'PE', action: 'BUY' | 'SELL', price: number) => {
    const id = `${strike}_${type}_${action}`;
    const exists = selectedLegs.find((leg) => leg.id === id);
    if (exists) {
      setSelectedLegs(selectedLegs.filter((leg) => leg.id !== id));
    } else {
      setSelectedLegs([...selectedLegs, { id, strike, type, action, price, qty: lotSize }]);
    }
  };

  const isLegSelected = (strike: number, type: 'CE' | 'PE', action: 'BUY' | 'SELL') => {
    return selectedLegs.some((leg) => leg.strike === strike && leg.type === type && leg.action === action);
  };

  const isPositiveChange = dayChange >= 0;

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col font-sans">
      <div className="border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 flex flex-wrap items-center justify-between bg-white dark:bg-slate-900 text-xs select-none">
        <div className="flex items-center space-x-4 sm:space-x-6 overflow-x-auto max-w-full">
          {(['Chart', 'Overview', 'Option Chain', 'Stock Composition'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 font-semibold transition-colors relative whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 sm:gap-4 py-2">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Basket mode</span>
            </span>
            <div
              onClick={() => setBasketMode(!basketMode)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                basketMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  basketMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </label>

          <button
            onClick={() => setViewGreeks(!viewGreeks)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors flex items-center gap-1 ${
              viewGreeks
                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{viewGreeks ? 'Greeks Active' : 'Show Greeks'}</span>
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="relative">
            <button
              onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-colors"
            >
              <span className="font-black text-slate-900 dark:text-white tracking-wide">{symbol}</span>
              <span className="text-[10px] font-bold px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {exchange}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {isSymbolDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 py-1">
                {availableSymbols.map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => handleSymbolChange(item.symbol)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                      item.symbol === symbol ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{item.symbol}</span>
                    <span className="text-[10px] text-slate-400">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <span className={`text-base font-black ${isPositiveChange ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[11px] font-bold flex items-center ${isPositiveChange ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isPositiveChange ? '▲' : '▼'} {isPositiveChange ? '+' : ''}{dayChange.toFixed(2)} ({isPositiveChange ? '+' : ''}{dayChangePerc.toFixed(2)}%)
            </span>
          </div>

          <div className="relative sm:ml-2">
            <button
              onClick={() => expiries.length > 0 && setIsExpiryDropdownOpen(!isExpiryDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <span>{formatExpiry(selectedExpiry)}</span>
              <span className="text-[9px] font-black px-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                W
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExpiryDropdownOpen && expiries.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 py-1">
                {expiries.map((exp, idx) => {
                  const ed = new Date(/^\d{4}-/.test(exp) ? exp.slice(0, 10) : exp);
                  const isWeekly = expiries.some((o, j) => {
                    if (j <= idx) return false;
                    const od = new Date(/^\d{4}-/.test(o) ? o.slice(0, 10) : o);
                    return od.getMonth() === ed.getMonth() && od.getFullYear() === ed.getFullYear();
                  });
                  return (
                    <button
                      key={exp}
                      onClick={() => handleExpiryChange(exp)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                        exp === selectedExpiry ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{formatExpiry(exp)}</span>
                      <span className={`text-[9px] font-bold px-1 rounded ${
                        isWeekly
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      }`}>
                        {isWeekly ? 'W' : 'M'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className="hidden sm:inline">Strikes</span>
          <select
            value={strikes}
            onChange={(e) => onChangeStrikes?.(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-1.5 py-1"
          >
            {[5, 8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>±{n}</option>
            ))}
          </select>
        </label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Strike"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-36 sm:w-44 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {typeof pcr === 'number' && <span>PCR: <b className="text-slate-800 dark:text-slate-200 font-mono">{pcr > 0 ? pcr.toFixed(2) : '—'}</b></span>}
        {typeof maxPain === 'number' && maxPain > 0 && <span>Max Pain: <b className="text-slate-800 dark:text-slate-200 font-mono">{maxPain.toLocaleString('en-IN')}</b></span>}
        <span>Lot size: <b className="text-slate-800 dark:text-slate-200 font-mono">{lotSize}</b></span>
      </div>

      <div className="md:hidden flex items-center justify-around border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 py-1.5">
        {RAIL.map((r) => (
          <button key={r.id} onClick={() => setActiveRightDrawer(activeRightDrawer === r.id ? 'none' : r.id)}
            className={`flex flex-col items-center gap-0.5 text-[10px] ${activeRightDrawer === r.id ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500'}`}>
            <r.icon className="w-4 h-4" /><span>{r.label}</span>
          </button>
        ))}
      </div>

      <div className={`flex-1 flex overflow-hidden relative ${activeRightDrawer !== 'none' ? 'min-h-[460px]' : ''}`}>
        <div className="flex-1 min-w-0 overflow-x-auto">
          {activeTab === 'Chart' && <ChartTab symbol={symbol} spotPrice={spotPrice} chain={chain} atmStrike={atmStrike} />}
          {activeTab === 'Overview' && (
            <OverviewTab symbol={symbol} spotPrice={spotPrice} dayChange={dayChange} dayChangePerc={dayChangePerc} chain={chain}
              atmStrike={atmStrike} summary={chainSummary} expiry={formatExpiry(selectedExpiry)} lotSize={lotSize} isLiveFeed={isLiveFeed} />
          )}
          {activeTab === 'Stock Composition' && <CompositionTab symbol={symbol} />}
          {activeTab === 'Option Chain' && (
          <table className="w-full text-[11px] sm:text-xs border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
              <tr className="hidden md:table-row border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider">
                <th
                  colSpan={viewGreeks ? 7 : 4}
                  className="py-2.5 text-center text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60"
                >
                  CALL
                </th>
                <th
                  className="py-2.5 text-center text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-black min-w-[90px]"
                >
                  STRIKE
                </th>
                <th
                  colSpan={viewGreeks ? 7 : 4}
                  className="py-2.5 text-center text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60"
                >
                  PUT
                </th>
              </tr>

              <tr className="text-[10px] text-slate-500 font-bold uppercase tracking-tight bg-slate-50/40 dark:bg-slate-900/40">
                <th className="hidden md:table-cell py-2 px-2.5 text-right font-medium">Volume</th>
                <th className="hidden md:table-cell py-2 px-2.5 text-right font-medium">OI Change (Change%)</th>
                {viewGreeks && (
                  <>
                    <th className="py-2 px-1 text-center font-medium">IV%</th>
                    <th className="py-2 px-1 text-center font-medium">Delta</th>
                    <th className="py-2 px-1 text-center font-medium">Theta</th>
                  </>
                )}
                <th className="py-2 px-2.5 text-right font-medium text-rose-600 dark:text-rose-400">OI</th>
                <th className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                  <span className="md:hidden">CE </span>LTP<span className="hidden md:inline"> (LTP Change%)</span>
                </th>

                <th className="py-2 px-3 text-center font-black bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-white">
                  Strike
                </th>

                <th className="py-2 px-3 text-left font-bold text-slate-800 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800">
                  <span className="md:hidden">PE </span>LTP<span className="hidden md:inline"> (LTP Change%)</span>
                </th>
                <th className="py-2 px-2.5 text-left font-medium text-teal-600 dark:text-teal-400">OI</th>
                {viewGreeks && (
                  <>
                    <th className="py-2 px-1 text-center font-medium">Theta</th>
                    <th className="py-2 px-1 text-center font-medium">Delta</th>
                    <th className="py-2 px-1 text-center font-medium">IV%</th>
                  </>
                )}
                <th className="hidden md:table-cell py-2 px-2.5 text-left font-medium">OI Change (Change%)</th>
                <th className="hidden md:table-cell py-2 px-2.5 text-left font-medium">Volume</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
              {filteredChain.map((row, idx) => {
                const isCallITM = row.strike < spotPrice;
                const isPutITM = row.strike > spotPrice;
                const isPrevRowBeforeSpot = idx > 0 && filteredChain[idx - 1].strike < spotPrice && row.strike >= spotPrice;

                const callLTPPositive = (row.callLTPChange ?? 0) >= 0;
                const callLTPFlat = (row.callLTPChange ?? 0) === 0 && !row.callLTPChangePct;
                const callLTPChangePctStr = fmtPct(row.callLTPChangePct);

                const putLTPPositive = (row.putLTPChange ?? 0) >= 0;
                const putLTPFlat = (row.putLTPChange ?? 0) === 0 && !row.putLTPChangePct;
                const putLTPChangePctStr = fmtPct(row.putLTPChangePct);

                const callBg = isCallITM
                  ? 'bg-[#fffbf0] dark:bg-amber-950/20'
                  : 'bg-white dark:bg-slate-900';

                const putBg = isPutITM
                  ? 'bg-[#fffbf0] dark:bg-amber-950/20'
                  : 'bg-white dark:bg-slate-900';

                const strikeBg = 'bg-[#f8f9fa] dark:bg-slate-800/60';

                return (
                  <React.Fragment key={row.strike}>
                    {isPrevRowBeforeSpot && (
                      <tr className="border-y-2 border-teal-500/80 bg-teal-50/40 dark:bg-teal-950/30">
                        <td colSpan={20} className="py-1 text-center text-[10px] font-sans font-bold text-teal-700 dark:text-teal-400">
                          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-[#e0f2f1] text-[#00695c] border border-[#80cbc4] dark:bg-teal-950 dark:text-teal-300 dark:border-teal-700">
                            Spot {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="ml-2">{isPositiveChange ? '▲' : '▼'} {isPositiveChange ? '+' : ''}{dayChange.toFixed(2)} ({isPositiveChange ? '+' : ''}{dayChangePerc.toFixed(2)}%)</span>
                        </td>
                      </tr>
                    )}

                    <tr className="hover:brightness-95 transition-all">
                      <td className={`hidden md:table-cell py-2 px-2.5 text-right text-slate-700 dark:text-slate-300 font-medium ${callBg}`}>
                        {formatIndianVolume(row.callVol)}
                      </td>

                      <td className={`hidden md:table-cell py-2 px-2.5 text-right font-medium ${
                        row.callChangeOI >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                      } ${callBg}`}>
                        {formatIndianChangeOI(row.callChangeOI, row.callChangeOIPct)}
                      </td>

                      {viewGreeks && (
                        <>
                          <td className={`py-2 px-1 text-center text-slate-500 ${callBg}`}>{row.callIV}%</td>
                          <td className={`py-2 px-1 text-center font-bold text-emerald-600 ${callBg}`}>
                            {row.callDelta.toFixed(2)}
                          </td>
                          <td className={`py-2 px-1 text-center text-slate-500 ${callBg}`}>
                            {row.callTheta.toFixed(1)}
                          </td>
                        </>
                      )}

                      <td className={`py-2 px-2.5 text-right font-semibold text-[#d9383a] dark:text-rose-400 ${callBg}`}>
                        {formatIndianOI(row.callOI)}
                      </td>

                      <td className={`py-2 px-3 text-right border-r border-slate-200 dark:border-slate-800 ${callBg}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          {basketMode && (
<>
<button
                              onClick={() => toggleLeg(row.strike, 'CE', 'BUY', row.callLTP)}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                isLegSelected(row.strike, 'CE', 'BUY')
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200'
                              }`}
                            >
                              B
                            </button>
<button
                              onClick={() => toggleLeg(row.strike, 'CE', 'SELL', row.callLTP)}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                isLegSelected(row.strike, 'CE', 'SELL')
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200'
                              }`}
                            >
                              S
                            </button>
</>
)}
                          <span onClick={() => !basketMode && isLiveFeed && openDepth(row.strike, 'CE')} title="Market depth" className={`font-bold ${!basketMode && isLiveFeed ? 'cursor-pointer hover:underline' : ''} ${
                            callLTPFlat ? 'text-slate-800 dark:text-slate-200' : callLTPPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {fmtPrice(row.callLTP)}
                          </span>
                          <span className={`text-[10px] ${
                            callLTPPositive ? 'text-emerald-600/90 dark:text-emerald-400/90' : 'text-rose-600/90 dark:text-rose-400/90'
                          }`}>
                            {callLTPChangePctStr}
                          </span>
                        </div>
                      </td>

                      <td className={`py-2 px-3 text-center font-black text-slate-900 dark:text-white ${strikeBg}`}>
                        <span>{row.strike.toLocaleString('en-IN')}</span>
                      </td>

                      <td className={`py-2 px-3 text-left border-l border-slate-200 dark:border-slate-800 ${putBg}`}>
                        <div className="flex items-center justify-start gap-1.5">
                          <span onClick={() => !basketMode && isLiveFeed && openDepth(row.strike, 'PE')} title="Market depth" className={`font-bold ${!basketMode && isLiveFeed ? 'cursor-pointer hover:underline' : ''} ${
                            putLTPFlat ? 'text-slate-800 dark:text-slate-200' : putLTPPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {fmtPrice(row.putLTP)}
                          </span>
                          <span className={`text-[10px] ${
                            putLTPPositive ? 'text-emerald-600/90 dark:text-emerald-400/90' : 'text-rose-600/90 dark:text-rose-400/90'
                          }`}>
                            {putLTPChangePctStr}
                          </span>
                          {basketMode && (
<>
<button
                              onClick={() => toggleLeg(row.strike, 'PE', 'BUY', row.putLTP)}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                isLegSelected(row.strike, 'PE', 'BUY')
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200'
                              }`}
                            >
                              B
                            </button>
<button
                              onClick={() => toggleLeg(row.strike, 'PE', 'SELL', row.putLTP)}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                isLegSelected(row.strike, 'PE', 'SELL')
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200'
                              }`}
                            >
                              S
                            </button>
</>
)}
                        </div>
                      </td>

                      <td className={`py-2 px-2.5 text-left font-semibold text-[#00897b] dark:text-teal-400 ${putBg}`}>
                        {formatIndianOI(row.putOI)}
                      </td>

                      {viewGreeks && (
                        <>
                          <td className={`py-2 px-1 text-center text-slate-500 ${putBg}`}>
                            {row.putTheta.toFixed(1)}
                          </td>
                          <td className={`py-2 px-1 text-center font-bold text-rose-600 ${putBg}`}>
                            {row.putDelta.toFixed(2)}
                          </td>
                          <td className={`py-2 px-1 text-center text-slate-500 ${putBg}`}>{row.putIV}%</td>
                        </>
                      )}

                      <td className={`hidden md:table-cell py-2 px-2.5 text-left font-medium ${
                        row.putChangeOI >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                      } ${putBg}`}>
                        {formatIndianChangeOI(row.putChangeOI, row.putChangeOIPct)}
                      </td>

                      <td className={`hidden md:table-cell py-2 px-2.5 text-left text-slate-700 dark:text-slate-300 font-medium ${putBg}`}>
                        {formatIndianVolume(row.putVol)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {activeRightDrawer !== 'none' && (
          <div className="absolute inset-y-0 right-0 md:right-14 z-30 w-[min(21rem,100%)] border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            {activeRightDrawer === 'watchlist' && (
              <WatchlistPanel currentSymbol={symbol} onClose={() => setActiveRightDrawer('none')}
                onPick={(sym) => { if (availableSymbols.some((a) => a.symbol === sym)) { handleSymbolChange(sym); } }} />
            )}
            {activeRightDrawer === 'positions' && (
              <PositionsPanel symbol={symbol} expiry={selectedExpiry} chain={chain} lotSize={lotSize} isLiveFeed={isLiveFeed} onClose={() => setActiveRightDrawer('none')} />
            )}
            {activeRightDrawer === 'orders' && <OrdersPanel onClose={() => setActiveRightDrawer('none')} />}
            {activeRightDrawer === 'depth' && (
              <DepthPanel chain={chain} atmStrike={atmStrike} isLiveFeed={isLiveFeed} target={depthTarget} onClose={() => setActiveRightDrawer('none')} />
            )}
          </div>
        )}

        <div className="hidden md:flex w-14 border-l border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex-col items-center py-3 gap-5 select-none text-[10px] text-slate-500 dark:text-slate-400">
          {RAIL.map((r) => (
            <button key={r.id} onClick={() => setActiveRightDrawer(activeRightDrawer === r.id ? 'none' : r.id)}
              className={`flex flex-col items-center gap-1 transition-colors ${activeRightDrawer === r.id ? 'text-blue-600 dark:text-blue-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
              <r.icon className="w-4 h-4" />
              <span className="scale-90 font-medium text-center leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#fffbf0] border border-amber-300 inline-block" />
            <span>In The Money (ITM)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />
            <span>Out The Money (OTM)</span>
          </span>
          <span className="text-[11px] text-slate-400">
            • Expiry: {formatExpiry(selectedExpiry)} • Data Feed: {isLiveFeed ? 'Live Derivatives Feed' : 'Estimated Model (not exchange prices)'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {basketMode && selectedLegs.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800">
              <span>{selectedLegs.length} Legs Selected</span>
              <button
                onClick={() => setSelectedLegs([])}
                className="text-blue-500 hover:text-blue-700 underline text-[11px]"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={() => setIsStrategyModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE STRATEGY</span>
          </button>
        </div>
      </div>

      {isStrategyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Strategy Builder & Payoff Simulator
                </h3>
              </div>
              <button
                onClick={() => setIsStrategyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Choose a pre-built options structure or combine selected legs for <strong>{symbol} ({selectedExpiry})</strong>:
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { name: 'Bull Call Spread', desc: 'Buy ATM Call + Sell OTM Call', bias: 'Bullish' },
                  { name: 'Bear Put Spread', desc: 'Buy ATM Put + Sell OTM Put', bias: 'Bearish' },
                  { name: 'Short Straddle', desc: 'Sell ATM Call + Sell ATM Put', bias: 'Neutral' },
                  { name: 'Iron Condor', desc: 'Sell OTM Strangle + Buy wings', bias: 'Rangebound' },
                ].map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      const strikes = chain.map((r) => r.strike);
                      const nearest = (t: number) => strikes.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), strikes[0]);
                      const gap = strikes.length > 1 ? (strikes[strikes.length - 1] - strikes[0]) / (strikes.length - 1) : 100;
                      const row = (k: number) => chain.find((r) => r.strike === k);
                      const leg = (k: number, type: 'CE' | 'PE', action: 'BUY' | 'SELL'): StrategyLeg => ({
                        id: `${k}_${type}_${action}`, strike: k, type, action,
                        price: type === 'CE' ? row(k)?.callLTP ?? 0 : row(k)?.putLTP ?? 0, qty: lotSize,
                      });
                      const atm = nearest(atmStrike);
                      const up = nearest(atm + gap * 2);
                      const dn = nearest(atm - gap * 2);
                      if (s.name === 'Bull Call Spread') setSelectedLegs([leg(atm, 'CE', 'BUY'), leg(up, 'CE', 'SELL')]);
                      else if (s.name === 'Bear Put Spread') setSelectedLegs([leg(atm, 'PE', 'BUY'), leg(dn, 'PE', 'SELL')]);
                      else if (s.name === 'Iron Condor') setSelectedLegs([leg(up, 'CE', 'SELL'), leg(nearest(up + gap * 2), 'CE', 'BUY'), leg(dn, 'PE', 'SELL'), leg(nearest(dn - gap * 2), 'PE', 'BUY')]);
                      else setSelectedLegs([leg(atm, 'CE', 'SELL'), leg(atm, 'PE', 'SELL')]);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-200">{s.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                    <div className="mt-1">
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {s.bias}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedLegs.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Active Legs ({selectedLegs.length}):</span>
                    <span className="text-blue-600 font-mono">Lot Size: {lotSize}</span>
                  </div>
                  <div className="space-y-1">
                    {selectedLegs.map((leg) => (
                      <div key={leg.id} className="flex items-center justify-between text-[11px] font-mono">
                        <span className={leg.action === 'BUY' ? 'text-blue-600 font-bold' : 'text-rose-600 font-bold'}>
                          {leg.action} {leg.strike} {leg.type}
                        </span>
                        <span>₹{leg.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Net premium (1 lot):</span>
                    <span className={selectedLegs.reduce((a, l) => a + (l.action === 'SELL' ? l.price : -l.price) * l.qty, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {(() => {
                        const v = selectedLegs.reduce((a, l) => a + (l.action === 'SELL' ? l.price : -l.price) * l.qty, 0);
                        return `${v >= 0 ? 'Credit' : 'Debit'} ₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsStrategyModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                disabled={!isLiveFeed || selectedLegs.length === 0}
                onClick={() => {
                  placeOrders(selectedLegs.map((l) => ({
                    underlying: symbol, expiry: selectedExpiry, strike: l.strike, type: l.type, action: l.action, qty: l.qty, price: l.price,
                  })));
                  setSelectedLegs([]);
                  setIsStrategyModalOpen(false);
                  setActiveRightDrawer('positions');
                }}
                title={!isLiveFeed ? 'Live feed chahiye' : selectedLegs.length === 0 ? 'Pehle legs chuno' : 'Paper trade lagao'}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Place Paper Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
