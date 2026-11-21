import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { MarketType } from '../types';

export interface SectorHoldingItem {
  id: string;
  symbol: string;
  market: MarketType;
  currentValue: number;
  investedValue: number;
  pnl: number;
  sector?: string;
}

interface PortfolioSectorDonutProps {
  holdings: SectorHoldingItem[];
  isLoadingSectors?: boolean;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

interface SectorSlice {
  sector: string;
  value: number;
  invested: number;
  pnl: number;
  weight: number;
  count: number;
  symbols: Array<{ symbol: string; market: MarketType }>;
  color: string;
}

const SECTOR_PALETTE = [
  '#2563eb', // Blue
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#64748b', // Slate
];

const FALLBACK_SECTORS: Record<string, string> = {
  RELIANCE: 'Energy',
  ONGC: 'Energy',
  BPCL: 'Energy',
  IOC: 'Energy',
  COALINDIA: 'Energy',
  TCS: 'Technology',
  INFY: 'Technology',
  WIPRO: 'Technology',
  HCLTECH: 'Technology',
  TECHM: 'Technology',
  LTIM: 'Technology',
  PERSISTENT: 'Technology',
  COFORGE: 'Technology',
  KPITTECH: 'Technology',
  HDFCBANK: 'Financial Services',
  ICICIBANK: 'Financial Services',
  SBIN: 'Financial Services',
  KOTAKBANK: 'Financial Services',
  AXISBANK: 'Financial Services',
  INDUSINDBK: 'Financial Services',
  BAJFINANCE: 'Financial Services',
  BAJAJFINSV: 'Financial Services',
  JIOFIN: 'Financial Services',
  SBILIFE: 'Financial Services',
  HDFCLIFE: 'Financial Services',
  SHRIRAMFIN: 'Financial Services',
  IRFC: 'Financial Services',
  PFC: 'Financial Services',
  RECLTD: 'Financial Services',
  PAYTM: 'Financial Services',
  ITC: 'Consumer Defensive',
  HINDUNILVR: 'Consumer Defensive',
  NESTLEIND: 'Consumer Defensive',
  BRITANNIA: 'Consumer Defensive',
  TATACONSUM: 'Consumer Defensive',
  DABUR: 'Consumer Defensive',
  MARICO: 'Consumer Defensive',
  VARUNBEV: 'Consumer Defensive',
  VBL: 'Consumer Defensive',
  TATAMOTORS: 'Consumer Cyclical',
  TMPV: 'Consumer Cyclical',
  MARUTI: 'Consumer Cyclical',
  'M&M': 'Consumer Cyclical',
  'BAJAJ-AUTO': 'Consumer Cyclical',
  EICHERMOT: 'Consumer Cyclical',
  HEROMOTOCO: 'Consumer Cyclical',
  TITAN: 'Consumer Cyclical',
  TRENT: 'Consumer Cyclical',
  DMART: 'Consumer Cyclical',
  ZOMATO: 'Consumer Cyclical',
  ETERNAL: 'Consumer Cyclical',
  ASIANPAINT: 'Basic Materials',
  ULTRACEMCO: 'Basic Materials',
  GRASIM: 'Basic Materials',
  TATASTEEL: 'Basic Materials',
  JSWSTEEL: 'Basic Materials',
  HINDALCO: 'Basic Materials',
  VEDL: 'Basic Materials',
  PIDILITIND: 'Basic Materials',
  SUNPHARMA: 'Healthcare',
  DRREDDY: 'Healthcare',
  CIPLA: 'Healthcare',
  DIVISLAB: 'Healthcare',
  APOLLOHOSP: 'Healthcare',
  LUPIN: 'Healthcare',
  AUROPHARMA: 'Healthcare',
  BHARTIARTL: 'Communication Services',
  IDEA: 'Communication Services',
  LT: 'Industrials',
  BEL: 'Industrials',
  HAL: 'Industrials',
  RVNL: 'Industrials',
  BHEL: 'Industrials',
  SIEMENS: 'Industrials',
  ABB: 'Industrials',
  ADANIENT: 'Industrials',
  ADANIPORTS: 'Industrials',
  INDIGO: 'Industrials',
  SUZLON: 'Industrials',
  NTPC: 'Utilities',
  POWERGRID: 'Utilities',
  TATAPOWER: 'Utilities',
  ADANIPOWER: 'Utilities',
  ADANIGREEN: 'Utilities',
  DLF: 'Real Estate',
  GODREJPROP: 'Real Estate',
  LODHA: 'Real Estate',
  AAPL: 'Technology',
  MSFT: 'Technology',
  NVDA: 'Technology',
  AMD: 'Technology',
  INTC: 'Technology',
  ORCL: 'Technology',
  CRM: 'Technology',
  AVGO: 'Technology',
  GOOGL: 'Communication Services',
  GOOG: 'Communication Services',
  META: 'Communication Services',
  NFLX: 'Communication Services',
  AMZN: 'Consumer Cyclical',
  TSLA: 'Consumer Cyclical',
  JPM: 'Financial Services',
  BAC: 'Financial Services',
  V: 'Financial Services',
  MA: 'Financial Services',
  JNJ: 'Healthcare',
  UNH: 'Healthcare',
  LLY: 'Healthcare',
  XOM: 'Energy',
  CVX: 'Energy',
  NIFTY: 'Index & ETF',
  'NIFTY 50': 'Index & ETF',
  BANKNIFTY: 'Index & ETF',
  'BANK NIFTY': 'Index & ETF',
  FINNIFTY: 'Index & ETF',
  SENSEX: 'Index & ETF',
  NIFTYBEES: 'Index & ETF',
  BANKBEES: 'Index & ETF',
};

export const resolveHoldingSector = (
  symbol: string,
  market: MarketType,
  liveSector?: string
): string => {
  const cleanedLive = (liveSector || '').trim();
  if (
    cleanedLive &&
    cleanedLive.toLowerCase() !== 'unknown' &&
    cleanedLive.toLowerCase() !== 'n/a' &&
    cleanedLive.toLowerCase() !== 'other'
  ) {
    return cleanedLive;
  }
  if (market === 'INDEX') return 'Index & ETF';
  const norm = symbol
    .toUpperCase()
    .replace('.NS', '')
    .replace('.BO', '')
    .replace('^', '')
    .trim();
  return FALLBACK_SECTORS[norm] || 'Other';
};

const formatRupeesCompact = (val: number): string => {
  const abs = Math.abs(val);
  if (abs >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`;
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatSignedRupees = (val: number): string => {
  const abs = Math.abs(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${val >= 0 ? '+' : '-'}₹${abs}`;
};

export const PortfolioSectorDonut: React.FC<PortfolioSectorDonutProps> = ({
  holdings,
  isLoadingSectors = false,
  theme,
  onSelectStock,
}) => {
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const isDark =
    theme === 'Dark' ||
    (theme === undefined &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const { slices, totalValue, diversificationStatus } = useMemo(() => {
    if (holdings.length === 0) {
      return {
        slices: [] as SectorSlice[],
        totalValue: 0,
        diversificationStatus: null as {
          label: string;
          tone: 'emerald' | 'amber' | 'rose';
        } | null,
      };
    }

    const total = holdings.reduce(
      (sum, h) => sum + (Number.isFinite(h.currentValue) && h.currentValue > 0 ? h.currentValue : 0),
      0
    );

    const grouped = new Map<
      string,
      {
        value: number;
        invested: number;
        pnl: number;
        symbols: Array<{ symbol: string; market: MarketType }>;
      }
    >();

    for (const h of holdings) {
      const sectorName = resolveHoldingSector(h.symbol, h.market, h.sector);
      const val = Number.isFinite(h.currentValue) && h.currentValue > 0 ? h.currentValue : 0;
      const inv = Number.isFinite(h.investedValue) && h.investedValue > 0 ? h.investedValue : 0;
      const existing = grouped.get(sectorName);
      if (existing) {
        existing.value += val;
        existing.invested += inv;
        existing.pnl += h.pnl;
        if (!existing.symbols.some((s) => s.symbol === h.symbol)) {
          existing.symbols.push({ symbol: h.symbol, market: h.market });
        }
      } else {
        grouped.set(sectorName, {
          value: val,
          invested: inv,
          pnl: h.pnl,
          symbols: [{ symbol: h.symbol, market: h.market }],
        });
      }
    }

    const sorted = Array.from(grouped.entries())
      .map(([sector, data]) => ({
        sector,
        value: Number(data.value.toFixed(2)),
        invested: Number(data.invested.toFixed(2)),
        pnl: Number(data.pnl.toFixed(2)),
        weight: total > 0 ? (data.value / total) * 100 : 0,
        count: data.symbols.length,
        symbols: data.symbols,
        color: '#64748b',
      }))
      .sort((a, b) => b.value - a.value);

    sorted.forEach((item, idx) => {
      item.color =
        item.sector === 'Other'
          ? '#64748b'
          : SECTOR_PALETTE[idx % (SECTOR_PALETTE.length - 1)];
    });

    const topWeight = sorted[0]?.weight ?? 0;
    const sectorCount = sorted.length;
    let status: { label: string; tone: 'emerald' | 'amber' | 'rose' };
    if (sectorCount >= 3 && topWeight <= 40) {
      status = { label: 'Well Diversified', tone: 'emerald' };
    } else if (sectorCount >= 2 && topWeight <= 65) {
      status = { label: 'Moderate Balance', tone: 'amber' };
    } else {
      status = { label: 'Concentrated', tone: 'rose' };
    }

    return {
      slices: sorted,
      totalValue: total,
      diversificationStatus: status,
    };
  }, [holdings]);

  const activeSlice = useMemo(
    () => (hoveredSector ? slices.find((s) => s.sector === hoveredSector) ?? null : null),
    [hoveredSector, slices]
  );

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1.5">
          <PieChartIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Sector Diversification
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add stocks to your portfolio to view your sector allocation breakdown and concentration balance.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Sector Diversification
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isLoadingSectors
              ? 'Resolving live sector classifications...'
              : `${slices.length} ${slices.length === 1 ? 'sector' : 'sectors'} across ${holdings.length} ${holdings.length === 1 ? 'holding' : 'holdings'}`}
          </p>
        </div>

        {diversificationStatus && (
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap shrink-0 ${
              diversificationStatus.tone === 'emerald'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : diversificationStatus.tone === 'amber'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                  : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
            }`}
          >
            {diversificationStatus.label}
          </span>
        )}
      </div>

      <div className="relative h-[210px] w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="sector"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={slices.length > 1 ? 2.5 : 0}
              cornerRadius={4}
              stroke={isDark ? '#0f172a' : '#ffffff'}
              strokeWidth={1.5}
              isAnimationActive={false}
              onMouseEnter={(_, idx) => {
                if (slices[idx]) setHoveredSector(slices[idx].sector);
              }}
              onMouseLeave={() => setHoveredSector(null)}
            >
              {slices.map((entry) => (
                <Cell
                  key={entry.sector}
                  fill={entry.color}
                  fillOpacity={
                    hoveredSector && hoveredSector !== entry.sector ? 0.3 : 1
                  }
                  style={{ transition: 'fill-opacity 150ms ease' }}
                />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const item = payload[0].payload as SectorSlice;
                const pnlPos = item.pnl >= 0;
                return (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 shadow-lg text-xs space-y-1.5 min-w-[190px]">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.sector}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Allocation</span>
                      <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {item.weight.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Current Value</span>
                      <span className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                        ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Sector P/L</span>
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          pnlPos
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedRupees(item.pnl)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 truncate">
                      {item.symbols.map((s) => s.symbol).join(', ')}
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          {activeSlice ? (
            <>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[115px] truncate">
                {activeSlice.sector}
              </span>
              <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-tight">
                {activeSlice.weight.toFixed(1)}%
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {formatRupeesCompact(activeSlice.value)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Top Sector
              </span>
              <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-tight">
                {slices[0] ? `${slices[0].weight.toFixed(1)}%` : '0%'}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[115px] truncate">
                {slices[0]?.sector || '—'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5 max-h-[195px] overflow-y-auto pr-1 custom-scrollbar">
        {slices.map((slice) => {
          const isHovered = hoveredSector === slice.sector;
          return (
            <div
              key={slice.sector}
              onMouseEnter={() => setHoveredSector(slice.sector)}
              onMouseLeave={() => setHoveredSector(null)}
              className={`px-2.5 py-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                isHovered
                  ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700'
                  : 'bg-transparent border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {slice.sector}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {slice.symbols.slice(0, 3).map((s) => (
                      <button
                        key={s.symbol}
                        type="button"
                        onClick={() => onSelectStock?.(s.symbol, s.market)}
                        className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      >
                        {s.symbol}
                      </button>
                    ))}
                    {slice.symbols.length > 3 && (
                      <span className="text-[10px] text-slate-400">
                        +{slice.symbols.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 font-mono tabular-nums">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {slice.weight.toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {totalValue > 0 ? formatRupeesCompact(slice.value) : '₹0'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortfolioSectorDonut;
