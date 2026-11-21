import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  BarChart2,
  Cpu,
  Building,
  Newspaper,
  Briefcase,
  Bell,
  Search,
  Globe,
  Calculator,
  FlaskConical,
  FileText,
  Rocket,
  Layers,
  Settings,
  User,
  RefreshCw,
  History,
  Trash2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Coins,
  Star,
  ArrowLeftRight,
  MessageSquare,
  BookOpen,
  Award,
  Landmark,
  Wallet,
  FileSpreadsheet,
  LayoutGrid,
  Menu,
  Compass,
} from 'lucide-react';
import { MarketType, RecentSearchItem } from '../types';
import { StockSearchResult, getNseStockUrl } from '../utils/marketData';
import { searchStocksApi } from '../utils/stockApi';
import { PredictXLogo } from './PredictXLogo';

export type PageId =
  | 'home'
  | 'ask'
  | 'charts'
  | 'compare'
  | 'journal'
  | 'trackrecord'
  | 'ai'
  | 'company'
  | 'quarterly'
  | 'dividends'
  | 'news'
  | 'portfolio'
  | 'alerts'
  | 'scanners'
  | 'global'
  | 'tools'
  | 'strategy'
  | 'report'
  | 'ipo'
  | 'watchlist'
  | 'options'
  | 'advanced'
  | 'account'
  | 'smartmoney'
  | 'paper'
  | 'heatmap';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  market: MarketType;
  onChangeMarket: (m: MarketType) => void;
  symbol: string;
  onSymbolChange: (s: string) => void;
  onLoadStock: (sym?: string, m?: MarketType) => void;
  isLoading: boolean;
  recentlySearched?: RecentSearchItem[];
  recentlyViewed?: (string | RecentSearchItem)[];
  onSelectRecent?: (s: string, m?: MarketType) => void;
  onRemoveRecent?: (s: string) => void;
  onClearRecent?: () => void;
  theme: 'Light' | 'Dark';
  onToggleTheme: () => void;
  onCloseSidebar?: () => void;
}

const PRESET_SYMBOLS: Record<MarketType, string[]> = {
  NSE: [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC',
    'BEL', 'HAL', 'SUZLON', 'IRFC', 'TATAPOWER', 'ZOMATO', 'BAJFINANCE', 'MARUTI',
  ],
  BSE: ['SENSEX', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC', 'TATAMOTORS', 'LT'],
  US: ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX'],
  INDEX: ['NIFTY 50', 'BANK NIFTY', 'FIN NIFTY', 'SENSEX', 'MIDCAP NIFTY'],
};

interface NavItemDef {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  category: 'core' | 'trading' | 'tools';
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Dashboard & Forecast', shortLabel: 'Dashboard', icon: Home, category: 'core' },
  { id: 'ask', label: 'Ask PredictX AI', shortLabel: 'Ask AI', icon: MessageSquare, category: 'core' },
  { id: 'heatmap', label: 'NSE 500 Heatmap', shortLabel: 'Heatmap', icon: LayoutGrid, category: 'trading' },
  { id: 'charts', label: 'Charts & Analysis', shortLabel: 'Charts', icon: BarChart2, category: 'core' },
  { id: 'compare', label: 'Split-View Compare', shortLabel: 'Compare', icon: ArrowLeftRight, category: 'core' },
  { id: 'ai', label: 'AI Signals & Risk', shortLabel: 'AI Signals', icon: Cpu, category: 'core' },
  { id: 'options', label: 'AI Option Chain', shortLabel: 'Option Chain', icon: Layers, category: 'trading' },
  { id: 'scanners', label: 'Market Scanners', shortLabel: 'Scanners', icon: Search, category: 'trading' },
  { id: 'smartmoney', label: 'Smart Money (FII/DII)', shortLabel: 'Smart Money', icon: Landmark, category: 'core' },
  { id: 'quarterly', label: 'Quarterly Results', shortLabel: 'Quarterly', icon: FileSpreadsheet, category: 'core' },
  { id: 'company', label: 'Company Info', shortLabel: 'Company Info', icon: Building, category: 'core' },
  { id: 'news', label: 'News & Sentiment', shortLabel: 'News & Sent.', icon: Newspaper, category: 'core' },
  { id: 'dividends', label: 'Dividends & Calendar', shortLabel: 'Dividends', icon: Coins, category: 'core' },
  { id: 'watchlist', label: 'Watchlist', shortLabel: 'Watchlist', icon: Star, category: 'trading' },
  { id: 'portfolio', label: 'Portfolio Tracker', shortLabel: 'Portfolio', icon: Briefcase, category: 'trading' },
  { id: 'paper', label: 'Paper Trading', shortLabel: 'Paper Trade', icon: Wallet, category: 'trading' },
  { id: 'alerts', label: 'Smart Alerts', shortLabel: 'Alerts', icon: Bell, category: 'trading' },
  { id: 'ipo', label: 'IPO Predictor', shortLabel: 'IPO Predict', icon: Rocket, category: 'trading' },
  { id: 'global', label: 'Global Markets', shortLabel: 'Global Mkts', icon: Globe, category: 'trading' },
  { id: 'journal', label: 'Trade Journal', shortLabel: 'Journal', icon: BookOpen, category: 'trading' },
  { id: 'trackrecord', label: 'Model Accuracy', shortLabel: 'Accuracy', icon: Award, category: 'trading' },
  { id: 'tools', label: 'Investment Tools', shortLabel: 'Tools & Calc', icon: Calculator, category: 'tools' },
  { id: 'strategy', label: 'Strategy Lab', shortLabel: 'Strategy Lab', icon: FlaskConical, category: 'tools' },
  { id: 'report', label: 'Report Analyzer', shortLabel: 'Report AI', icon: FileText, category: 'tools' },
  { id: 'advanced', label: 'Advanced Assistant', shortLabel: 'Advanced', icon: Settings, category: 'tools' },
  { id: 'account', label: 'User Account', shortLabel: 'Account', icon: User, category: 'tools' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  market,
  onChangeMarket,
  symbol,
  onSymbolChange,
  onLoadStock,
  isLoading,
  recentlySearched = [],
  recentlyViewed = [],
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
  theme: _theme,
  onToggleTheme: _onToggleTheme,
  onCloseSidebar,
}) => {
  const safeRecentList: RecentSearchItem[] = React.useMemo(() => {
    if (Array.isArray(recentlySearched) && recentlySearched.length > 0) {
      return recentlySearched;
    }
    if (Array.isArray(recentlyViewed) && recentlyViewed.length > 0) {
      return recentlyViewed
        .map((item) =>
          typeof item === 'string'
            ? { symbol: item.toUpperCase(), market }
            : item
        )
        .filter(Boolean);
    }
    return [];
  }, [recentlySearched, recentlyViewed, market]);

  const [inputVal, setInputVal] = useState(symbol);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);
  const [universeCategory, setUniverseCategory] = useState<'ALL' | 'LARGE' | 'GROWTH' | 'DEFENSE' | 'US' | 'INDEX'>('ALL');
  const [showQuickExtras, setShowQuickExtras] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<any>(null);

  useEffect(() => {
    setInputVal(symbol);
  }, [symbol]);

  const handleInputChange = (val: string) => {
    setInputVal(val);
    if (val.trim().length > 0) {
      setIsDropdownOpen(true);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const apiResults = await searchStocksApi(val);
          if (apiResults && apiResults.length > 0) {
            setSearchResults(apiResults);
          }
        } catch {
        }
      }, 150);
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (res: StockSearchResult) => {
    const target = res.symbol || res.displaySymbol;
    setInputVal(res.displaySymbol);
    setIsDropdownOpen(false);
    onSymbolChange(res.displaySymbol);
    if (res.market !== market) {
      onChangeMarket(res.market);
    }
    onLoadStock(target, res.market);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSym = inputVal.trim();
    if (!cleanSym) return;

    const matches = searchResults.filter(
      (r) =>
        r.displaySymbol.toUpperCase() === cleanSym.toUpperCase() ||
        r.symbol.toUpperCase() === cleanSym.toUpperCase()
    );
    if (matches.length > 0) {
      const best = matches[0];
      setInputVal(best.displaySymbol);
      setIsDropdownOpen(false);
      onSymbolChange(best.displaySymbol);
      if (best.market !== market) {
        onChangeMarket(best.market);
      }
      onLoadStock(best.symbol || best.displaySymbol, best.market);
    } else {
      setIsDropdownOpen(false);
      onSymbolChange(cleanSym.toUpperCase());
      onLoadStock(cleanSym, market);
    }
  };

  const handleSelectMarket = (newMarket: MarketType) => {
    onChangeMarket(newMarket);
    const defaultSym = PRESET_SYMBOLS[newMarket][0];
    setInputVal(defaultSym);
    onSymbolChange(defaultSym);
    onLoadStock(defaultSym, newMarket);
  };

  const handleSelectPreset = (s: string) => {
    setInputVal(s);
    setIsDropdownOpen(false);
    onSymbolChange(s);
    onLoadStock(s, market);
  };

  const UNIVERSE_TICKERS: Array<{ symbol: string; name: string; market: MarketType; sector: string }> = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', market: 'NSE', sector: 'Energy & Conglomerate' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'NSE', sector: 'Technology' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', market: 'NSE', sector: 'Banking' },
    { symbol: 'INFY', name: 'Infosys Limited', market: 'NSE', sector: 'Technology' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', market: 'NSE', sector: 'Banking' },
    { symbol: 'SBIN', name: 'State Bank of India', market: 'NSE', sector: 'Banking' },
    { symbol: 'ITC', name: 'ITC Limited', market: 'NSE', sector: 'FMCG' },
    { symbol: 'LT', name: 'Larsen & Toubro Ltd', market: 'NSE', sector: 'Infrastructure' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', market: 'NSE', sector: 'Telecom' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', market: 'NSE', sector: 'Automotive' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', market: 'NSE', sector: 'FMCG' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Passenger Vehicles', market: 'NSE', sector: 'Automotive' },
    { symbol: 'SUZLON', name: 'Suzlon Energy Ltd', market: 'NSE', sector: 'Clean Energy' },
    { symbol: 'TATAPOWER', name: 'Tata Power Company Ltd', market: 'NSE', sector: 'Power' },
    { symbol: 'ADANIPOWER', name: 'Adani Power Ltd', market: 'NSE', sector: 'Power' },
    { symbol: 'ZOMATO', name: 'Eternal / Zomato Ltd', market: 'NSE', sector: 'Consumer Tech' },
    { symbol: 'TRENT', name: 'Trent Limited', market: 'NSE', sector: 'Retail' },
    { symbol: 'DMART', name: 'Avenue Supermarts (DMart)', market: 'NSE', sector: 'Retail' },
    { symbol: 'VEDL', name: 'Vedanta Limited', market: 'NSE', sector: 'Metals & Mining' },
    { symbol: 'COALINDIA', name: 'Coal India Limited', market: 'NSE', sector: 'Energy' },
    { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', market: 'NSE', sector: 'Oil & Gas' },
    { symbol: 'POWERGRID', name: 'Power Grid Corp of India', market: 'NSE', sector: 'Power' },
    { symbol: 'NTPC', name: 'NTPC Limited', market: 'NSE', sector: 'Power' },
    { symbol: 'BPCL', name: 'Bharat Petroleum Corp', market: 'NSE', sector: 'Energy' },
    { symbol: 'BEL', name: 'Bharat Electronics Ltd', market: 'NSE', sector: 'Defense' },
    { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd', market: 'NSE', sector: 'Defense' },
    { symbol: 'IRFC', name: 'Indian Railway Finance Corp', market: 'NSE', sector: 'Railways' },
    { symbol: 'RVNL', name: 'Rail Vikas Nigam Ltd', market: 'NSE', sector: 'Railways' },
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', sector: 'Semiconductors' },
    { symbol: 'TSLA', name: 'Tesla, Inc.', market: 'US', sector: 'Automotive' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', market: 'US', sector: 'Consumer Cyclical' },
    { symbol: 'NIFTY', name: 'Nifty 50 Index', market: 'INDEX', sector: 'Benchmark Index' },
    { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', market: 'INDEX', sector: 'Banking Index' },
    { symbol: 'SENSEX', name: 'BSE SENSEX Index', market: 'INDEX', sector: 'Benchmark Index' },
  ];

  const allStockEntries = UNIVERSE_TICKERS.map((stk) => ({
    ...stk,
    price: 0,
    currencySymbol: stk.market === 'US' ? '$' : '₹',
  }));

  const filteredUniverse = allStockEntries.filter((item) => {
    if (universeCategory === 'ALL') return true;
    if (universeCategory === 'LARGE') {
      return ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'ITC', 'LT', 'BHARTIARTL', 'MARUTI', 'HINDUNILVR'].includes(item.symbol);
    }
    if (universeCategory === 'GROWTH') {
      return ['SUZLON', 'TATAPOWER', 'ADANIPOWER', 'ZOMATO', 'TRENT', 'DMART', 'PAYTM', 'JIOFIN', 'VEDL'].includes(item.symbol);
    }
    if (universeCategory === 'DEFENSE') {
      return ['IRFC', 'RVNL', 'BEL', 'HAL', 'BHEL', 'COALINDIA', 'NTPC', 'ONGC', 'POWERGRID'].includes(item.symbol);
    }
    if (universeCategory === 'US') return item.market === 'US';
    if (universeCategory === 'INDEX') return item.market === 'INDEX';
    return true;
  });

  return (
    <aside className="w-full h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800/90 shadow-xl md:shadow-none select-none">
      <div className="h-14 px-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2.5 shrink-0">
        {onCloseSidebar && (
          <button
            type="button"
            onClick={onCloseSidebar}
            aria-label="Slide menu left"
            title="Slide menu left"
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectPage('home')}
          className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity cursor-pointer text-left"
          title="Go to PredictX Home"
        >
          <PredictXLogo size={32} className="shrink-0" />
          <div className="min-w-0">
            <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate">
              PredictX
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Market Intelligence
            </div>
          </div>
        </button>
      </div>

      <div
        className="px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80 space-y-2 shrink-0 relative"
        ref={dropdownRef}
      >
        <form onSubmit={handleSubmit} className="relative flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (inputVal.trim().length > 0) setIsDropdownOpen(true);
              }}
              placeholder="Search ticker (RELIANCE, TCS, NVDA)"
              className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium pl-8 pr-7 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700/90 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder-slate-400"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            title="Load Stock"
            className="h-8 px-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isDropdownOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex justify-between items-center">
                <span>Matches · {searchResults.length}</span>
                <span>Select</span>
              </div>
              {searchResults.map((res, idx) => (
                <button
                  key={`${res.market}-${res.symbol || res.displaySymbol}-${idx}`}
                  type="button"
                  onClick={() => handleSelectResult(res)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {res.displaySymbol}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        · {res.market}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {res.longName}
                    </span>
                  </div>
                  {res.price > 0 && (
                    <span className="text-xs font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                      {res.currencySymbol}
                      {res.price.toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-1.5">
          <div className="grid grid-cols-4 gap-1 flex-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
            {(['NSE', 'BSE', 'US', 'INDEX'] as MarketType[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectMarket(m)}
                className={`py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  market === m
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m === 'INDEX' ? 'IDX' : m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowQuickExtras((v) => !v)}
            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
            title="Show quick presets, catalog and recent searches"
          >
            <span>More</span>
            {showQuickExtras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showQuickExtras && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
            <div className="flex flex-wrap gap-1">
              {PRESET_SYMBOLS[market].slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectPreset(s)}
                  className={`text-[11px] px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    symbol === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsUniverseModalOpen(true)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Stock Catalog</span>
              </button>

              <a
                href={getNseStockUrl(inputVal || symbol, market)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Direct NSE</span>
              </a>
            </div>

            {safeRecentList.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <History className="w-3 h-3" />
                    Recent · {safeRecentList.length}
                  </span>
                  {onClearRecent && (
                    <button
                      type="button"
                      onClick={onClearRecent}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {safeRecentList.slice(0, 5).map((item) => (
                    <div
                      key={`${item.market}-${item.symbol}`}
                      className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectRecent) onSelectRecent(item.symbol, item.market);
                          else onLoadStock(item.symbol, item.market);
                        }}
                        className="px-2 py-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      >
                        {item.symbol}
                      </button>
                      {onRemoveRecent && (
                        <button
                          type="button"
                          onClick={() => onRemoveRecent(item.symbol)}
                          aria-label={`Remove ${item.symbol}`}
                          className="pr-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 pt-2.5 pb-4 space-y-0.5 custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPage(item.id)}
              title={item.label}
              className={`w-full group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
        <span>NSE · BSE · US</span>
        <span className="font-mono">Live Quotes</span>
      </div>

      {isUniverseModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsUniverseModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Stock Catalog & Benchmarks
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select any ticker to load live technical analysis and price forecasting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUniverseModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-950/40">
              {[
                { id: 'ALL', label: 'All Catalog' },
                { id: 'LARGE', label: 'Nifty 50 Bluechips' },
                { id: 'GROWTH', label: 'High Momentum' },
                { id: 'DEFENSE', label: 'Railways & Defense' },
                { id: 'US', label: 'US Tech' },
                { id: 'INDEX', label: 'Indices' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setUniverseCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    universeCategory === cat.id
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredUniverse.map((stk) => (
                <button
                  key={`${stk.market}-${stk.symbol}`}
                  type="button"
                  onClick={() => {
                    setInputVal(stk.symbol);
                    onSymbolChange(stk.symbol);
                    if (stk.market !== market) {
                      onChangeMarket(stk.market);
                    }
                    onLoadStock(stk.symbol, stk.market);
                    setIsUniverseModalOpen(false);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left flex items-start justify-between group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {stk.symbol}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        · {stk.market}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300 block truncate">
                      {stk.name}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                      {stk.sector}
                    </span>
                  </div>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Open →
                  </span>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Showing {filteredUniverse.length} securities</span>
              <span>Search any NSE, BSE, or US ticker from the sidebar</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
