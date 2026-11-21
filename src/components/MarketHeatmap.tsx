import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Crosshair,
  Filter,
  History,
  LayoutGrid,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type { MarketType, RecentSearchItem } from '../types';
import { storage } from '../utils/storage';
import {
  fetchNse500Heatmap,
  type HeatmapSectorSummary,
  type HeatmapStockItem,
  type Nse500HeatmapResponse,
} from '../utils/stockApi';

type ViewMode = 'stocks' | 'sectors';
type SizeMetric = 'marketCap' | 'turnover' | 'equal';
type UniverseSlice = 'all' | 'top150' | 'top50' | 'gainers' | 'losers';

interface MarketHeatmapProps {
  onSelectStock: (symbol: string, market: MarketType) => void;
  theme?: 'Light' | 'Dark';
  recentSearches?: RecentSearchItem[];
  onRemoveRecent?: (symbol: string) => void;
  onClearRecent?: () => void;
  activeSymbol?: string;
}

function getHeatmapColor(changePct: number): string {
  if (changePct >= 3) return '#047857';
  if (changePct >= 1.5) return '#15803d';
  if (changePct >= 0.25) return '#16a34a';
  if (changePct > -0.25) return '#475569';
  if (changePct > -1.5) return '#dc2626';
  if (changePct > -3) return '#b91c1c';
  return '#7f1d1d';
}

function formatInrCr(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const cr = value / 1e7;
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(2)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}

function formatVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '—';
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)} K`;
  return String(Math.round(vol));
}

function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '—';
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return 'Recent';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface CustomTileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  symbol?: string;
  changePct?: number;
  price?: number;
  count?: number;
  isDark?: boolean;
  viewMode: ViewMode;
  onTileClick: (payload: any) => void;
}

const CustomTreemapTile: React.FC<CustomTileProps & Record<string, any>> = (props) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    depth = 0,
    name = '',
    symbol,
    changePct = 0,
    price = 0,
    count,
    isDark = false,
    viewMode,
    onTileClick,
  } = props;

  if (depth === 0 || width <= 2 || height <= 2) return <g />;

  const fill = getHeatmapColor(Number(changePct) || 0);
  const stroke = isDark ? '#090d16' : '#f8fafc';
  const sign = changePct > 0 ? '+' : '';
  const pctStr = `${sign}${Number(changePct).toFixed(2)}%`;

  const displayTitle = viewMode === 'sectors' ? String(name) : String(symbol || name);
  const canShowTitle = width >= 38 && height >= 20;
  const canShowPct = width >= 46 && height >= 32;
  const canShowSub = width >= 78 && height >= 50;

  const titleFontSize = width > 140 && height > 70 ? 13 : width > 80 && height > 44 ? 11 : 9.5;
  const pctFontSize = width > 140 && height > 70 ? 12 : width > 80 && height > 44 ? 10 : 9;

  const maxChars = Math.max(4, Math.floor((width - 10) / (titleFontSize * 0.62)));
  const clippedTitle =
    displayTitle.length > maxChars ? `${displayTitle.slice(0, Math.max(3, maxChars - 1))}…` : displayTitle;

  const subText =
    viewMode === 'sectors'
      ? `${count || 0} stocks`
      : price > 0
        ? `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
        : '';

  return (
    <g
      onClick={() => onTileClick(props)}
      style={{ cursor: 'pointer' }}
      className="transition-opacity duration-150 hover:opacity-90"
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={width > 20 ? 1.5 : 0.75}
        rx={width > 24 && height > 24 ? 3 : 1}
      />
      {canShowTitle && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (canShowPct ? (canShowSub ? 10 : 5) : -3)}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={titleFontSize}
          fontWeight={700}
          fontFamily="Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {clippedTitle}
        </text>
      )}
      {canShowPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (canShowSub ? 5 : 9)}
          textAnchor="middle"
          fill="rgba(255,255,255,0.95)"
          fontSize={pctFontSize}
          fontWeight={600}
          fontFamily="JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {pctStr}
        </text>
      )}
      {canShowSub && subText && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 19}
          textAnchor="middle"
          fill="rgba(255,255,255,0.78)"
          fontSize={9.5}
          fontWeight={500}
          fontFamily="JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {subText}
        </text>
      )}
    </g>
  );
};

interface TooltipContentProps {
  active?: boolean;
  payload?: Array<{ payload?: any }>;
  viewMode: ViewMode;
}

const HeatmapTooltip: React.FC<TooltipContentProps> = ({ active, payload, viewMode }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const pct = Number(item.changePct) || 0;
  const isPos = pct >= 0;

  if (viewMode === 'sectors') {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-3.5 min-w-[230px] text-xs">
        <div className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {item.count} NSE 500 constituents
        </div>
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 font-mono tabular-nums">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-sans">Weighted Return</span>
            <span className={isPos ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
              {pct > 0 ? '+' : ''}
              {pct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-sans">Equal-Weight Avg</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              {item.avgChangePct > 0 ? '+' : ''}
              {Number(item.avgChangePct || 0).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-sans">Breadth (Adv / Dec)</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">{item.advances}</span>
              {' / '}
              <span className="text-rose-600 dark:text-rose-400">{item.declines}</span>
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-sans">Combined M-Cap</span>
            <span className="text-slate-800 dark:text-slate-200">{formatInrCr(item.totalMarketCap)}</span>
          </div>
        </div>
        <div className="mt-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
          Click sector tile to inspect stocks
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-3.5 min-w-[245px] text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-sm">{item.symbol}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[180px]">{item.companyName || item.name}</div>
        </div>
        <span
          className={`font-mono tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
            isPos
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
          }`}
        >
          {pct > 0 ? '+' : ''}
          {pct.toFixed(2)}%
        </span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{item.sector}</div>
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 font-sans">LTP / Change</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {formatPrice(item.price)} ({item.change > 0 ? '+' : ''}
            {Number(item.change || 0).toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 font-sans">Day Range</span>
          <span className="text-slate-700 dark:text-slate-300">
            {formatPrice(item.dayLow)} – {formatPrice(item.dayHigh)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 font-sans">Volume</span>
          <span className="text-slate-700 dark:text-slate-300">{formatVolume(item.volume)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 font-sans">Turnover</span>
          <span className="text-slate-700 dark:text-slate-300">{formatInrCr(item.turnover)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 font-sans">Market Cap</span>
          <span className="text-slate-700 dark:text-slate-300">{formatInrCr(item.marketCap)}</span>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
        Click tile to open full PredictX analysis
      </div>
    </div>
  );
};

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({
  onSelectStock,
  theme = 'Light',
  recentSearches,
  onRemoveRecent,
  onClearRecent,
  activeSymbol = '',
}) => {
  const [data, setData] = useState<Nse500HeatmapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('stocks');
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('marketCap');
  const [universeSlice, setUniverseSlice] = useState<UniverseSlice>('all');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
  const [localHistory, setLocalHistory] = useState<RecentSearchItem[]>(() => storage.getRecentSearches());

  const isDark = theme === 'Dark';

  const historyItems = useMemo<RecentSearchItem[]>(() => {
    if (Array.isArray(recentSearches)) return recentSearches;
    return localHistory;
  }, [recentSearches, localHistory]);

  const stockLookup = useMemo(() => {
    const map = new Map<string, HeatmapStockItem>();
    for (const s of data?.stocks || []) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [data]);

  const handleOpenStock = useCallback(
    (sym: string, mkt: MarketType = 'NSE') => {
      const updated = storage.addRecentSearch(sym, mkt);
      setLocalHistory(updated);
      onSelectStock(sym, mkt);
    },
    [onSelectStock]
  );

  const handleRemoveHistoryItem = (sym: string) => {
    if (onRemoveRecent) {
      onRemoveRecent(sym);
    } else {
      setLocalHistory(storage.removeRecentSearch(sym));
    }
  };

  const handleClearHistory = () => {
    if (onClearRecent) {
      onClearRecent();
    } else {
      storage.clearRecentSearches();
      setLocalHistory([]);
    }
  };

  const handleLocateInHeatmap = (sym: string) => {
    setViewMode('stocks');
    setSelectedSector('ALL');
    setUniverseSlice('all');
    setSearchQuery(sym);
  };

  const loadHeatmap = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading((prev) => prev && !data);
    setError(null);

    const res = await fetchNse500Heatmap(forceRefresh);
    if (res.success && res.stocks.length > 0) {
      setData(res);
    } else {
      setError(res.error || 'Unable to load real-time NSE 500 market prices.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHeatmap(false);
  }, [loadHeatmap]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      loadHeatmap(true);
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadHeatmap]);

  const filteredStocks = useMemo<HeatmapStockItem[]>(() => {
    if (!data?.stocks?.length) return [];
    const q = searchQuery.trim().toLowerCase();

    let list = data.stocks.filter((s) => {
      if (selectedSector !== 'ALL' && s.sector !== selectedSector) return false;
      if (q && !s.symbol.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (universeSlice === 'top50') {
      list = list.slice(0, 50);
    } else if (universeSlice === 'top150') {
      list = list.slice(0, 150);
    } else if (universeSlice === 'gainers') {
      list = [...list].filter((s) => s.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    } else if (universeSlice === 'losers') {
      list = [...list].filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct);
    }

    return list;
  }, [data, selectedSector, searchQuery, universeSlice]);

  const treemapData = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'sectors') {
      return data.sectors.map((sec) => ({
        name: sec.sector,
        size: sizeMetric === 'equal' ? 100 : Math.max(1, sec.totalMarketCap),
        changePct: sec.weightedChangePct,
        avgChangePct: sec.avgChangePct,
        count: sec.count,
        advances: sec.advances,
        declines: sec.declines,
        totalMarketCap: sec.totalMarketCap,
      }));
    }

    return filteredStocks.map((stock) => {
      let rawSize = stock.marketCap;
      if (sizeMetric === 'turnover') rawSize = Math.max(stock.turnover, 1_000_000);
      else if (sizeMetric === 'equal') rawSize = 100;
      return {
        ...stock,
        companyName: stock.name,
        name: stock.symbol,
        size: Math.max(1, rawSize),
      };
    });
  }, [data, viewMode, filteredStocks, sizeMetric]);

  const topGainers = useMemo(() => {
    return [...filteredStocks].filter((s) => s.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 8);
  }, [filteredStocks]);

  const topLosers = useMemo(() => {
    return [...filteredStocks].filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 8);
  }, [filteredStocks]);

  const quickJumpLeaders = useMemo(() => {
    return (data?.stocks || []).slice(0, 5);
  }, [data]);

  const breadth = useMemo(() => {
    const base = filteredStocks.length > 0 ? filteredStocks : data?.stocks || [];
    let adv = 0;
    let dec = 0;
    let unch = 0;
    for (const s of base) {
      if (s.changePct > 0.01) adv++;
      else if (s.changePct < -0.01) dec++;
      else unch++;
    }
    const total = Math.max(1, adv + dec + unch);
    return {
      adv,
      dec,
      unch,
      total: adv + dec + unch,
      advPct: (adv / total) * 100,
      decPct: (dec / total) * 100,
    };
  }, [filteredStocks, data]);

  const handleTileClick = (payload: any) => {
    if (viewMode === 'sectors') {
      if (payload?.name) {
        setSelectedSector(String(payload.name));
        setViewMode('stocks');
      }
      return;
    }
    if (payload?.symbol) {
      handleOpenStock(String(payload.symbol), 'NSE');
    }
  };

  const formattedUpdated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                NSE 500 Market Heatmap
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time treemap of NIFTY 500 performance · {data ? `${data.loadedStocks} of ${data.totalConstituents} stocks loaded` : 'Loading live quotes'} · {data?.source || 'NSE Feed'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mr-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Updated {formattedUpdated}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryPanel((v) => !v)}
              className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showHistoryPanel
                  ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({historyItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                autoRefresh
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Auto-Refresh: {autoRefresh ? '60s ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => loadHeatmap(true)}
              disabled={refreshing || loading}
              className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh Live'}</span>
            </button>
          </div>
        </div>

        {data && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Advancing: {breadth.adv} ({breadth.advPct.toFixed(1)}%)
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  Declining: {breadth.dec} ({breadth.decPct.toFixed(1)}%)
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Unchanged: {breadth.unch}
                </span>
              </div>
              <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                Avg Return:{' '}
                <span className={data.avgChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                  {data.avgChangePct > 0 ? '+' : ''}
                  {data.avgChangePct.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${breadth.advPct}%` }} />
              <div className="bg-slate-400 dark:bg-slate-600 h-full transition-all" style={{ width: `${Math.max(0, 100 - breadth.advPct - breadth.decPct)}%` }} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${breadth.decPct}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/70">
              <button
                type="button"
                onClick={() => setViewMode('stocks')}
                className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'stocks'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Stocks
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sectors')}
                className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'sectors'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                By Sector
              </button>
            </div>

            {viewMode === 'stocks' && (
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/70">
                {(
                  [
                    ['all', 'All 500'],
                    ['top150', 'Top 150'],
                    ['top50', 'Top 50'],
                    ['gainers', 'Gainers'],
                    ['losers', 'Losers'],
                  ] as Array<[UniverseSlice, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setUniverseSlice(key)}
                    className={`whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      universeSlice === key
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'stocks' && (
              <>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter symbol or name..."
                    className="pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-52"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear filter"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    aria-label="Filter by sector"
                    className="pl-8 pr-7 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Sectors ({data?.sectors.length || 0})</option>
                    {data?.sectors.map((sec) => (
                      <option key={sec.sector} value={sec.sector}>
                        {sec.sector} ({sec.count})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/70">
              <BarChart3 className="w-3.5 h-3.5 text-slate-400 ml-2 mr-0.5" />
              {(
                [
                  ['marketCap', 'Market Cap'],
                  ...(viewMode === 'stocks' ? ([['turnover', 'Turnover']] as Array<[SizeMetric, string]>) : []),
                  ['equal', 'Equal Size'],
                ] as Array<[SizeMetric, string]>
              ).map(([metric, label]) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setSizeMetric(metric)}
                  className={`whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    sizeMetric === metric
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {viewMode === 'stocks'
              ? `Showing ${treemapData.length} stocks${selectedSector !== 'ALL' ? ` in ${selectedSector}` : ''}. Click any tile to analyze.`
              : `Showing ${treemapData.length} NSE sectors weighted by ${sizeMetric === 'equal' ? 'equal size' : 'market cap'}. Click any sector to drill down.`}
          </span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            {[
              { label: '≤ -3%', color: '#7f1d1d' },
              { label: '-1.5%', color: '#b91c1c' },
              { label: '-0.25%', color: '#dc2626' },
              { label: '0%', color: '#475569' },
              { label: '+0.25%', color: '#16a34a' },
              { label: '+1.5%', color: '#15803d' },
              { label: '≥ +3%', color: '#047857' },
            ].map((step) => (
              <span key={step.label} className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: step.color }} />
                <span>{step.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div
        className={`grid grid-cols-1 gap-4 items-stretch ${
          showHistoryPanel ? 'xl:grid-cols-[minmax(0,1fr)_292px]' : ''
        }`}
      >
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 min-w-0">
          {loading ? (
            <div className="h-[540px] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="text-sm font-semibold">Fetching real-time NSE 500 market quotes...</div>
              <div className="text-xs text-slate-400">Loading constituents, market capitalization, and intraday change</div>
            </div>
          ) : error && !data ? (
            <div className="h-[360px] flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</div>
              <button
                type="button"
                onClick={() => loadHeatmap(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Retry Live Feed
              </button>
            </div>
          ) : treemapData.length === 0 ? (
            <div className="h-[340px] flex flex-col items-center justify-center gap-2 text-center px-4 text-slate-500 dark:text-slate-400">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No stocks match your current filters</div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSector('ALL');
                  setSearchQuery('');
                  setUniverseSlice('all');
                }}
                className="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="w-full h-[540px] sm:h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  isAnimationActive={false}
                  content={
                    <CustomTreemapTile
                      isDark={isDark}
                      viewMode={viewMode}
                      onTileClick={handleTileClick}
                    />
                  }
                >
                  <Tooltip content={<HeatmapTooltip viewMode={viewMode} />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {showHistoryPanel && (
          <aside
            aria-label="Search History"
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col xl:max-h-[632px]"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Search History
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  · {historyItems.length}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {historyItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    title="Clear all search history"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHistoryPanel(false)}
                  aria-label="Hide Search History"
                  title="Hide Search History"
                  className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 mb-2 shrink-0">
              Jump back to recently viewed stocks or locate them inside the NSE 500 map.
            </p>

            {historyItems.length === 0 ? (
              <div className="flex-1 flex flex-col justify-between gap-4 py-4">
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center">
                  <History className="w-5 h-5 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No recently viewed stocks yet
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Click any tile on the heatmap or search a ticker to save it here for quick switching.
                  </p>
                </div>

                {quickJumpLeaders.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Quick Jump Heavyweights
                    </div>
                    <div className="space-y-1">
                      {quickJumpLeaders.map((stk) => {
                        const isPos = stk.changePct >= 0;
                        return (
                          <button
                            key={stk.symbol}
                            type="button"
                            onClick={() => handleOpenStock(stk.symbol, 'NSE')}
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {stk.symbol}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {stk.sector}
                              </div>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                {formatPrice(stk.price)}
                              </div>
                              <div
                                className={`text-[11px] font-bold ${
                                  isPos
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isPos ? '+' : ''}
                                {stk.changePct.toFixed(2)}%
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                {historyItems.map((item) => {
                  const live = stockLookup.get(item.symbol.toUpperCase());
                  const isCurrent = activeSymbol.toUpperCase() === item.symbol.toUpperCase();
                  const isPos = (live?.changePct ?? 0) >= 0;

                  return (
                    <div
                      key={`${item.market}-${item.symbol}`}
                      className={`group rounded-xl border p-2.5 transition-colors ${
                        isCurrent
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/35 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenStock(item.symbol, item.market)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                          title={`Jump to ${item.symbol} (${item.market}) analysis`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                              · {item.market}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {live ? live.name : formatRelativeTime(item.timestamp)}
                          </div>
                        </button>

                        {live ? (
                          <div className="text-right font-mono tabular-nums shrink-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {formatPrice(live.price)}
                            </div>
                            <div
                              className={`text-[11px] font-bold ${
                                isPos
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isPos ? '+' : ''}
                              {live.changePct.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenStock(item.symbol, item.market)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open Analysis</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>

                        <div className="flex items-center gap-1">
                          {live && (
                            <button
                              type="button"
                              onClick={() => handleLocateInHeatmap(item.symbol)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={`Filter ${item.symbol} on the heatmap`}
                            >
                              <Crosshair className="w-3 h-3" />
                              <span>Locate</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveHistoryItem(item.symbol)}
                            aria-label={`Remove ${item.symbol} from history`}
                            title={`Remove ${item.symbol}`}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {data && data.sectors.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Sector Performance Breakdown</h2>
            {selectedSector !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedSector('ALL')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Show All Sectors
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {data.sectors.map((sec: HeatmapSectorSummary) => {
              const active = selectedSector === sec.sector;
              const isPos = sec.weightedChangePct >= 0;
              return (
                <button
                  key={sec.sector}
                  type="button"
                  onClick={() => {
                    setSelectedSector(active ? 'ALL' : sec.sector);
                    setViewMode('stocks');
                  }}
                  className={`text-left rounded-xl border p-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={sec.sector}>
                      {sec.sector}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums font-bold shrink-0 ${
                        isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {sec.weightedChangePct > 0 ? '+' : ''}
                      {sec.weightedChangePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{sec.count} stocks</span>
                    <span>
                      <span className="text-emerald-600 dark:text-emerald-400">{sec.advances}▲</span>{' '}
                      <span className="text-rose-600 dark:text-rose-400">{sec.declines}▼</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(topGainers.length > 0 || topLosers.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Top NSE 500 Gainers</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topGainers.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => handleOpenStock(s.symbol, 'NSE')}
                  className="w-full py-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 px-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{s.symbol}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.name} · {s.sector}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{formatPrice(s.price)}</div>
                    <div className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <ArrowUpRight className="w-3 h-3" />+{s.changePct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              ))}
              {topGainers.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">No advancing stocks in this filter.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Top NSE 500 Losers</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topLosers.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => handleOpenStock(s.symbol, 'NSE')}
                  className="w-full py-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 px-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{s.symbol}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.name} · {s.sector}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{formatPrice(s.price)}</div>
                    <div className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      <ArrowDownRight className="w-3 h-3" />
                      {s.changePct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              ))}
              {topLosers.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">No declining stocks in this filter.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default MarketHeatmap;
