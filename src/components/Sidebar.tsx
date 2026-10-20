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
  Clock,
  Sparkles,
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
} from 'lucide-react';
import { MarketType } from '../types';
import { StockSearchResult, getNseStockUrl } from '../utils/marketData';
import { searchStocksApi } from '../utils/stockApi';

export type PageId =
  | 'home'
  | 'ask'
  | 'charts'
  | 'compare'
  | 'journal'
  | 'trackrecord'
  | 'ai'
  | 'company'
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
  | 'paper';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  market: MarketType;
  onChangeMarket: (m: MarketType) => void;
  symbol: string;
  onSymbolChange: (s: string) => void;
  onLoadStock: (sym?: string, m?: MarketType) => void;
  isLoading: boolean;
  recentlyViewed: string[];
  onSelectRecent: (s: string, m?: MarketType) => void;
  theme: 'Light' | 'Dark';
  onToggleTheme: () => void;
}

const PRESET_SYMBOLS: Record<MarketType, string[]> = {
  NSE: [
    'RELIANCE', 'IOC', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'SUZLON',
    'IRFC', 'TATAPOWER', 'BEL', 'HAL', 'ZOMATO', 'ITC', 'BAJFINANCE', 'MARUTI', 'TATASTEEL'
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
  badge?: string;
  category: 'core' | 'trading' | 'tools';
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Dashboard & Forecast', shortLabel: 'Dashboard', icon: Home, category: 'core' },
  { id: 'ask', label: 'Ask PredictX (Hinglish)', shortLabel: 'Ask AI', icon: MessageSquare, badge: 'AI', category: 'core' },
  { id: 'compare', label: 'Split-View Compare', shortLabel: 'Compare', icon: ArrowLeftRight, badge: 'SPLIT', category: 'core' },
  { id: 'charts', label: 'Charts & Analysis', shortLabel: 'Charts', icon: BarChart2, category: 'core' },
  { id: 'ai', label: 'AI Signals & Risk', shortLabel: 'AI Signals', icon: Cpu, badge: 'AI', category: 'core' },
  { id: 'journal', label: 'Trade Journal & Audit', shortLabel: 'Journal', icon: BookOpen, badge: 'NEW', category: 'trading' },
  { id: 'trackrecord', label: 'Accuracy (Model kitna sahi)', shortLabel: 'Accuracy', icon: Award, category: 'trading' },
  { id: 'company', label: 'Company Info', shortLabel: 'Company Info', icon: Building, category: 'core' },
  { id: 'dividends', label: 'Dividend Radar & Calendar', shortLabel: 'Dividends', icon: Coins, badge: 'LIVE', category: 'core' },
  { id: 'news', label: 'News & Sentiment', shortLabel: 'News & Sent.', icon: Newspaper, category: 'core' },
  { id: 'smartmoney', label: 'Smart Money (FII/DII)', shortLabel: 'Smart Money', icon: Landmark, badge: 'NEW', category: 'core' },
  { id: 'paper', label: 'Paper Trading', shortLabel: 'Paper Trade', icon: Wallet, badge: 'NEW', category: 'trading' },
  { id: 'portfolio', label: 'Portfolio Tracker', shortLabel: 'Portfolio', icon: Briefcase, category: 'trading' },
  { id: 'watchlist', label: 'Watchlist (Live)', shortLabel: 'Watchlist', icon: Star, badge: 'NEW', category: 'trading' },
  { id: 'alerts', label: 'Smart Alerts', shortLabel: 'Smart Alerts', icon: Bell, badge: 'LIVE', category: 'trading' },
  { id: 'scanners', label: 'Market Scanners', shortLabel: 'Scanners', icon: Search, category: 'trading' },
  { id: 'global', label: 'Global Markets', shortLabel: 'Global Mkts', icon: Globe, category: 'trading' },
  { id: 'ipo', label: 'IPO Predictor', shortLabel: 'IPO Predict', icon: Rocket, badge: 'HOT', category: 'trading' },
  { id: 'options', label: 'AI Option Chain', shortLabel: 'Option Chain', icon: Layers, badge: 'PRO', category: 'trading' },
  { id: 'tools', label: 'Investment Tools', shortLabel: 'Tools & Calc', icon: Calculator, category: 'tools' },
  { id: 'strategy', label: 'Strategy Lab', shortLabel: 'Strategy Lab', icon: FlaskConical, category: 'tools' },
  { id: 'report', label: 'Report Analyzer', shortLabel: 'Report AI', icon: FileText, category: 'tools' },
  { id: 'advanced', label: 'Advanced & Assistant', shortLabel: 'Advanced', icon: Settings, category: 'tools' },
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
  recentlyViewed,
  theme: _theme,
  onToggleTheme: _onToggleTheme,
}) => {
  const [inputVal, setInputVal] = useState(symbol);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);
  const [universeCategory, setUniverseCategory] = useState<'ALL' | 'LARGE' | 'GROWTH' | 'DEFENSE' | 'US' | 'INDEX'>('ALL');
  const [isStockBoxCollapsed, setIsStockBoxCollapsed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'core' | 'trading' | 'tools'>('all');

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

    const matches = searchResults.filter((r) =>
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
    symbol: stk.symbol,
    name: stk.name,
    market: stk.market,
    sector: stk.sector,
    price: 0,
    currencySymbol: stk.market === 'US' ? '$' : '₹',
  }));

  const filteredUniverse = allStockEntries.filter((item) => {
    if (universeCategory === 'ALL') return true;
    if (universeCategory === 'LARGE') return ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'ITC', 'LT', 'BHARTIARTL', 'MARUTI', 'HINDUNILVR'].includes(item.symbol);
    if (universeCategory === 'GROWTH') return ['SUZLON', 'TATAPOWER', 'ADANIPOWER', 'ZOMATO', 'TRENT', 'DMART', 'PAYTM', 'JIOFIN', 'VEDL'].includes(item.symbol);
    if (universeCategory === 'DEFENSE') return ['IRFC', 'RVNL', 'BEL', 'HAL', 'BHEL', 'COALINDIA', 'NTPC', 'ONGC', 'POWERGRID'].includes(item.symbol);
    if (universeCategory === 'US') return item.market === 'US';
    if (universeCategory === 'INDEX') return item.market === 'INDEX';
    return true;
  });

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  return (
    <aside
      className="w-full lg:w-[320px] flex-shrink-0 flex flex-col rounded-2xl bg-[#0a2540] text-white p-3.5 md:p-4 border border-[#163f73] shadow-xl relative h-full max-h-full overflow-y-auto custom-scrollbar"
    >
      <div className="bg-[#0a2540] pt-0.5 pb-2.5 border-b border-blue-900/60 mb-2.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => onSelectPage('home')}
          className="flex items-center space-x-2.5 hover:opacity-90 transition-opacity cursor-pointer text-left"
          title="PredictX Home Dashboard par jayein"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400/30 to-blue-600/40 border border-cyan-400 flex items-center justify-center text-cyan-300 font-black shadow-sm text-sm">
            PX
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-sm tracking-wide text-white">PredictX Suite</h2>
              <span className="text-[9px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono font-bold border border-cyan-400/30">
                v2.5
              </span>
            </div>
            <p className="text-[10px] text-blue-200/70">16 Quant & AI Features</p>
          </div>
        </button>
      </div>

      <div
        className="bg-[#132942] p-2.5 md:p-3 rounded-xl border border-cyan-500/30 mb-2.5 shadow-inner relative flex-shrink-0"
        ref={dropdownRef}
      >
        {isStockBoxCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-xs text-white bg-cyan-500/25 px-2 py-0.5 rounded border border-cyan-400/40 font-mono truncate">
                {symbol}
              </span>
              <span className="text-[10px] font-bold text-cyan-300">{market}</span>
              <a
                href={getNseStockUrl(symbol, market)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded bg-blue-900/70 hover:bg-blue-800 text-cyan-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 border border-cyan-500/30 transition-colors"
                title={`Direct official NSE page for ${symbol}`}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                <span>NSE Page</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setIsStockBoxCollapsed(false)}
              className="text-[10px] font-bold text-cyan-300 hover:text-white px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 flex items-center gap-1 cursor-pointer transition-colors border border-cyan-500/30"
              title="Expand stock search, market presets & catalog"
            >
              <span>Change Stock</span>
              <ChevronDown className="w-3 h-3 text-cyan-400" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  Active Market
                </label>
                <button
                  type="button"
                  onClick={() => setIsUniverseModalOpen(true)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  100+ Catalog
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsStockBoxCollapsed(true)}
                className="text-[10px] text-blue-200 hover:text-white font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer border border-blue-900"
                title="Collapse to compact view to maximize all features visibility"
              >
                <span>Minimize</span>
                <ChevronUp className="w-3 h-3 text-cyan-400" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 mb-2.5">
              {(['NSE', 'BSE', 'US', 'INDEX'] as MarketType[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMarket(m)}
                  className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    market === m
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-2 relative">
              <div className="relative">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (inputVal.trim().length > 0) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  placeholder="Search Ticker (e.g. SUZLON, IOC, NVDA)"
                  className="w-full bg-white text-slate-950 font-bold px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder-slate-400 pr-7"
                />
                {inputVal && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputVal('');
                      setSearchResults([]);
                      setIsDropdownOpen(false);
                    }}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {isDropdownOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-cyan-500/50 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800">
                    <div className="p-2 bg-slate-950/90 text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Matches ({searchResults.length})</span>
                      <span className="text-slate-400">Click to Select</span>
                    </div>
                    {searchResults.map((res, idx) => (
                      <button
                        key={`${res.market}-${res.symbol || res.displaySymbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectResult(res)}
                        className="w-full px-2.5 py-1.5 text-left hover:bg-slate-800 flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-xs text-white group-hover:text-cyan-400">
                              {res.displaySymbol}
                            </span>
                            <span className="text-[8px] px-1 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {res.market}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                            {res.longName}
                          </span>
                        </div>
                        <div className="text-right">
                          {res.price > 0 ? (
                            <span className="text-xs font-bold text-emerald-400 block">
                              {res.currencySymbol}{res.price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-1 py-0.5 rounded block">
                              Live
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {PRESET_SYMBOLS[market].slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectPreset(s)}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      symbol === s
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-1.5 px-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-md transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Loading...' : 'Load Stock'}</span>
                </button>

                <a
                  href={getNseStockUrl(inputVal || symbol, market)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-cyan-200 hover:text-white font-bold text-[11px] flex items-center justify-center gap-1 border border-cyan-500/40 transition-all cursor-pointer shadow-sm hover:border-cyan-300"
                  title={`Directly open official quote page on NSE India for ${inputVal || symbol}`}
                >
                  <ExternalLink className="w-3 h-3 text-cyan-400" />
                  <span>Direct NSE</span>
                </a>
              </div>
            </form>

            {recentlyViewed.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center gap-1.5">
                <span className="text-[9px] text-blue-200/60 flex items-center gap-0.5 font-medium flex-shrink-0">
                  <Clock className="w-2.5 h-2.5" /> Recent:
                </span>
                <div className="flex flex-wrap gap-1 overflow-x-auto">
                  {recentlyViewed.slice(0, 4).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSelectPreset(r)}
                      className="text-[9px] px-1 py-0.2 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-200 hover:text-white transition-colors cursor-pointer"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pb-2 flex flex-col gap-1.5 flex-shrink-0">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-cyan-300">
              Features ({filteredNavItems.length})
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <span className="text-[10px] text-blue-200/60 font-medium">
            {categoryFilter === 'all' ? '16 Modules' : `${categoryFilter.toUpperCase()}`}
          </span>
        </div>

        <div className="flex items-center gap-1 px-1 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'core', label: 'Core' },
            { id: 'trading', label: 'Trading' },
            { id: 'tools', label: 'Tools' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                categoryFilter === cat.id
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 pb-3">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPage(item.id)}
              title={item.label}
              className={`w-full group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md ring-1 ring-cyan-400 shadow-blue-900/40'
                  : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-transparent hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive
                      ? 'bg-white/20 text-cyan-200'
                      : 'bg-slate-800/80 text-slate-400 group-hover:text-cyan-300 group-hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold flex-shrink-0 ml-1.5 leading-none ${
                    item.badge === 'AI'
                      ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
                      : item.badge === 'HOT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : item.badge === 'LIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-2.5 mt-auto border-t border-blue-900/60 text-[10px] text-blue-200/50 flex items-center justify-between flex-shrink-0 bg-[#0a2540]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px]">PredictX</span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400/80">NSE & Global Real-time</span>
      </div>

      {isUniverseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Stock Universe & Multi-Asset Directory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any stock or index to instantly load technical analysis, AI forecast & signals.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUniverseModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 bg-slate-100/50 dark:bg-slate-950/40">
              {[
                { id: 'ALL', label: 'All Catalog' },
                { id: 'LARGE', label: 'Nifty 50 Bluechips' },
                { id: 'GROWTH', label: 'High Momentum & Green Energy' },
                { id: 'DEFENSE', label: 'Railways & Defense PSUs' },
                { id: 'US', label: 'US Tech & Giants' },
                { id: 'INDEX', label: 'Benchmark Indices' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setUniverseCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    universeCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500 bg-white dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-all text-left flex items-start justify-between group cursor-pointer shadow-sm hover:shadow"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-cyan-500">
                        {stk.symbol}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        {stk.market}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block line-clamp-1 font-medium">
                      {stk.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                      {stk.sector}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800/60 block">
                      Live Yahoo
                    </span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold mt-1 inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Analyze →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredUniverse.length} stocks & benchmarks</span>
              <span>Tip: You can also search ANY unlisted ticker in the search bar.</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
