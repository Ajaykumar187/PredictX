import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Star,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Download,
  Pause,
  Play,
  FolderPlus,
  X,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { MarketType, WatchlistItem } from '../types';
import { storage, userKey } from '../utils/storage';
import {
  fetchBatchQuotes,
  fetchLiveQuote,
  fetchStockNews,
  searchStocksApi,
  BatchQuote,
} from '../utils/stockApi';
import { calculateIndicators } from '../utils/indicators';
import { analyzeHeadline } from '../utils/sentiment';
import type { StockSearchResult } from '../utils/marketData';

interface Props {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

interface NamedList { id: string; name: string; items: WatchlistItem[] }
const EXTRA_BASE = 'predictx_watchlists_extra';
const DEFAULT_ID = 'default';

function loadLists(): NamedList[] {
  let extra: NamedList[] = [];
  try {
    extra = JSON.parse(localStorage.getItem(userKey(EXTRA_BASE)) || '[]');
  } catch {}
  return [{ id: DEFAULT_ID, name: 'My Watchlist', items: storage.getWatchlist() }, ...extra];
}
function saveLists(lists: NamedList[]) {
  const def = lists.find((l) => l.id === DEFAULT_ID);
  if (def) {
    storage.saveWatchlist(def.items);
    window.dispatchEvent(new Event('predictx_watchlist_updated'));
  }
  try {
    localStorage.setItem(userKey(EXTRA_BASE), JSON.stringify(lists.filter((l) => l.id !== DEFAULT_ID)));
  } catch {  }
}

type SortKey = 'symbol' | 'price' | 'changePct' | 'volume' | 'rsi' | 'sentiment';
type SmartZone = 'overbought' | 'oversold' | 'neutral' | 'pending';
type SmartFilter = 'all' | 'overbought' | 'oversold' | 'neutral';
type ThresholdPreset = 'standard' | 'sensitive';
type SentimentBias = 'Bullish' | 'Neutral' | 'Bearish';

interface SmartMetrics {
  rsi: number | null;
  sentimentScore: number;
  sentimentLabel: SentimentBias;
  newsScore: number | null;
  newsCount: number;
  posHeadlines: number;
  negHeadlines: number;
  topHeadline?: string;
  aboveUpperBB: boolean;
  belowLowerBB: boolean;
  macdBullish: boolean | null;
  fetchedAt: number;
}

interface SmartClassification {
  zone: SmartZone;
  label: string;
  note: string;
  confluence: 'strong' | 'moderate' | 'none';
}

const SMART_PREF_KEY = 'predictx_smart_watchlist_enabled';
const SMART_CACHE_TTL_MS = 5 * 60 * 1000;
const smartMetricsCache = new Map<string, SmartMetrics>();

function loadSmartPref(): boolean {
  try {
    return localStorage.getItem(SMART_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function sentimentBiasOf(score: number): SentimentBias {
  if (score >= 0.15) return 'Bullish';
  if (score <= -0.15) return 'Bearish';
  return 'Neutral';
}

function classifySmartStock(
  metrics: SmartMetrics | undefined,
  marketScore: number,
  preset: ThresholdPreset
): SmartClassification {
  if (!metrics || metrics.rsi === null) {
    return { zone: 'pending', label: 'Pending', note: 'Awaiting RSI', confluence: 'none' };
  }

  const obCut = preset === 'standard' ? 70 : 65;
  const osCut = preset === 'standard' ? 30 : 35;
  const { rsi, sentimentScore, aboveUpperBB, belowLowerBB } = metrics;

  const nearOB = rsi >= obCut - 4 && (aboveUpperBB || (sentimentScore >= 0.35 && marketScore <= -0.1));
  const nearOS = rsi <= osCut + 4 && (belowLowerBB || (sentimentScore <= -0.35 && marketScore >= 0.1));

  if (rsi >= obCut || nearOB) {
    const bearishBackdrop = marketScore <= -0.15 || sentimentScore <= -0.15;
    return {
      zone: 'overbought',
      label: 'Overbought',
      note: bearishBackdrop ? 'Pullback risk' : aboveUpperBB ? 'Upper BB stretch' : 'Stretched rally',
      confluence: rsi >= obCut && bearishBackdrop ? 'strong' : 'moderate',
    };
  }

  if (rsi <= osCut || nearOS) {
    const bullishBackdrop = marketScore >= 0.15 || sentimentScore >= 0.15;
    return {
      zone: 'oversold',
      label: 'Oversold',
      note: bullishBackdrop ? 'Rebound setup' : belowLowerBB ? 'Lower BB bounce' : 'Weak momentum',
      confluence: rsi <= osCut && bullishBackdrop ? 'strong' : 'moderate',
    };
  }

  const note =
    rsi >= 58 && sentimentScore >= 0.15
      ? 'Positive momentum'
      : rsi <= 42 && sentimentScore <= -0.15
        ? 'Softening trend'
        : 'In range';

  return { zone: 'neutral', label: 'Neutral', note, confluence: 'none' };
}

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cur = (m: string) => (m === 'US' ? '$' : '₹');
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');
const vol = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : n ? n.toLocaleString('en-IN') : '—');

export const WatchlistPage: React.FC<Props> = ({ onSelectStock }) => {
  const [lists, setLists] = useState<NamedList[]>(() => loadLists());
  const [activeId, setActiveId] = useState(DEFAULT_ID);
  const [quotes, setQuotes] = useState<Record<string, BatchQuote>>({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState('');
  const [auto, setAuto] = useState(true);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'symbol', dir: 1 });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [smartMode, setSmartMode] = useState<boolean>(() => loadSmartPref());
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('all');
  const [thresholdPreset, setThresholdPreset] = useState<ThresholdPreset>('standard');
  const [smartData, setSmartData] = useState<Record<string, SmartMetrics>>({});
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartProgress, setSmartProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [benchmarkQuote, setBenchmarkQuote] = useState<BatchQuote | null>(null);
  const timer = useRef<any>(null);
  const smartRunId = useRef(0);

  const active = lists.find((l) => l.id === activeId) || lists[0];
  const key = (w: WatchlistItem) => `${w.symbol}|${w.market}`;

  const update = (next: NamedList[]) => {
    setLists(next);
    saveLists(next);
  };

  const toggleSmartMode = () => {
    setSmartMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SMART_PREF_KEY, String(next));
      } catch {}
      if (!next) {
        setSmartFilter('all');
        setSort((s) => (s.k === 'rsi' || s.k === 'sentiment' ? { k: 'symbol', dir: 1 } : s));
      }
      return next;
    });
  };

  const refreshSmart = useCallback(async (force = false) => {
    const items = active.items;
    if (!items.length) {
      setSmartData({});
      setSmartProgress({ done: 0, total: 0 });
      return;
    }

    const runId = ++smartRunId.current;
    setSmartLoading(true);
    setSmartProgress({ done: 0, total: items.length });

    // Fetch live benchmark index pulse for broader market sentiment
    const hasUsOnly = items.every((i) => i.market === 'US');
    const benchReq = hasUsOnly
      ? [{ symbol: 'SPY', market: 'US' }]
      : [{ symbol: 'NIFTY', market: 'NSE' }];
    fetchBatchQuotes(benchReq)
      .then((res) => {
        if (runId === smartRunId.current && res[0]) {
          setBenchmarkQuote(res[0]);
        }
      })
      .catch(() => {});

    const now = Date.now();
    const initialMap: Record<string, SmartMetrics> = {};
    const toFetch: WatchlistItem[] = [];

    for (const item of items) {
      const k = `${item.symbol}|${item.market}`;
      const cached = smartMetricsCache.get(k);
      if (!force && cached && now - cached.fetchedAt < SMART_CACHE_TTL_MS) {
        initialMap[k] = cached;
      } else {
        toFetch.push(item);
      }
    }

    let completed = items.length - toFetch.length;
    if (Object.keys(initialMap).length > 0) {
      setSmartData((prev) => ({ ...prev, ...initialMap }));
      setSmartProgress({ done: completed, total: items.length });
    }

    if (toFetch.length === 0) {
      setSmartLoading(false);
      return;
    }

    const CONCURRENCY = 4;
    let cursor = 0;

    const worker = async () => {
      while (cursor < toFetch.length) {
        if (runId !== smartRunId.current) return;
        const idx = cursor++;
        const item = toFetch[idx];
        const k = `${item.symbol}|${item.market}`;

        try {
          const [liveQuote, newsRes] = await Promise.all([
            fetchLiveQuote(item.symbol, item.market).catch(() => null),
            fetchStockNews(item.symbol, item.market).catch(() => ({ success: false, items: [] })),
          ]);

          let rsi: number | null = null;
          let aboveUpperBB = false;
          let belowLowerBB = false;
          let macdBullish: boolean | null = null;
          let priceChangePct = quotes[k]?.changePct ?? liveQuote?.changePct ?? 0;

          if (liveQuote && Array.isArray(liveQuote.bars) && liveQuote.bars.length >= 15) {
            const ind = calculateIndicators(liveQuote.bars);
            const latest = ind[ind.length - 1];
            const px = liveQuote.latestPrice || latest.close;
            if (typeof latest.rsi14 === 'number' && !Number.isNaN(latest.rsi14)) {
              rsi = latest.rsi14;
            }
            if (typeof latest.bbUpper === 'number' && px >= latest.bbUpper) aboveUpperBB = true;
            if (typeof latest.bbLower === 'number' && px <= latest.bbLower) belowLowerBB = true;
            if (typeof latest.macd === 'number' && typeof latest.macdSignal === 'number') {
              macdBullish = latest.macd > latest.macdSignal;
            }
            priceChangePct = liveQuote.changePct ?? priceChangePct;
          }

          const headlines = Array.isArray(newsRes?.items) ? newsRes.items.slice(0, 8) : [];
          let newsScore: number | null = null;
          let posHeadlines = 0;
          let negHeadlines = 0;
          if (headlines.length > 0) {
            let sum = 0;
            for (const h of headlines) {
              const a = analyzeHeadline(h.title);
              sum += a.score;
              if (a.mood === 'positive') posHeadlines++;
              else if (a.mood === 'negative') negHeadlines++;
            }
            newsScore = Number((sum / headlines.length).toFixed(2));
          }

          const priceComponent = clamp(priceChangePct / 3.5, -1, 1);
          const macdComponent = macdBullish === null ? 0 : macdBullish ? 0.25 : -0.25;
          const combinedScore =
            newsScore !== null
              ? Number(clamp(newsScore * 0.6 + priceComponent * 0.3 + macdComponent * 0.4, -1, 1).toFixed(2))
              : Number(clamp(priceComponent * 0.7 + macdComponent, -1, 1).toFixed(2));

          const metric: SmartMetrics = {
            rsi,
            sentimentScore: combinedScore,
            sentimentLabel: sentimentBiasOf(combinedScore),
            newsScore,
            newsCount: headlines.length,
            posHeadlines,
            negHeadlines,
            topHeadline: headlines[0]?.title,
            aboveUpperBB,
            belowLowerBB,
            macdBullish,
            fetchedAt: Date.now(),
          };

          smartMetricsCache.set(k, metric);
          if (runId === smartRunId.current) {
            setSmartData((prev) => ({ ...prev, [k]: metric }));
          }
        } catch {
          // Leave row as pending/unavailable if network fails
        } finally {
          completed += 1;
          if (runId === smartRunId.current) {
            setSmartProgress({ done: completed, total: items.length });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () => worker()));
    if (runId === smartRunId.current) {
      setSmartLoading(false);
    }
  }, [active, quotes]);

  const refresh = useCallback(async () => {
    const items = active.items;
    if (!items.length) { setQuotes({}); return; }
    setLoading(true);
    const q = await fetchBatchQuotes(items.map((w) => ({ symbol: w.symbol, market: w.market })));
    const m: Record<string, BatchQuote> = {};
    q.forEach((x) => (m[`${x.symbol}|${x.market}`] = x));
    setQuotes(m);
    setUpdated(new Date().toLocaleTimeString('en-IN'));
    setLoading(false);
  }, [active]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeSignature = useMemo(
    () => active.items.map((w) => `${w.symbol}|${w.market}`).join(','),
    [active.items]
  );

  useEffect(() => {
    if (smartMode) {
      refreshSmart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartMode, active.id, activeSignature]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [auto, refresh]);

  useEffect(() => {
    const h = () => setLists((prev) => prev.map((l) => (l.id === DEFAULT_ID ? { ...l, items: storage.getWatchlist() } : l)));
    window.addEventListener('predictx_watchlist_updated', h);
    return () => window.removeEventListener('predictx_watchlist_updated', h);
  }, []);

  const onQuery = (v: string) => {
    setQuery(v);
    clearTimeout(timer.current);
    if (!v.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => setResults((await searchStocksApi(v)).slice(0, 8)), 250);
  };

  const add = (r: StockSearchResult) => {
    const item: WatchlistItem = { symbol: r.displaySymbol, market: r.market };
    if (active.items.some((w) => key(w) === key(item))) return;
    update(lists.map((l) => (l.id === active.id ? { ...l, items: [...l.items, item] } : l)));
    setQuery(''); setResults([]);
  };
  const remove = (w: WatchlistItem) => update(lists.map((l) => (l.id === active.id ? { ...l, items: l.items.filter((x) => x !== w) } : l)));

  const createList = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `wl_${Date.now()}`;
    update([...lists, { id, name, items: [] }]);
    setActiveId(id); setNewName(''); setShowNew(false);
  };
  const deleteList = () => {
    if (active.id === DEFAULT_ID) return;
    update(lists.filter((l) => l.id !== active.id));
    setActiveId(DEFAULT_ID);
  };

  // Market-level sentiment derived from live benchmark + watchlist breadth + aggregate headlines
  const marketSentiment = useMemo(() => {
    const loadedQuotes = active.items.map((w) => quotes[key(w)]).filter((x): x is BatchQuote => Boolean(x));
    const advCount = loadedQuotes.filter((x) => x.changePct > 0).length;
    const decCount = loadedQuotes.filter((x) => x.changePct < 0).length;
    const breadthScore = loadedQuotes.length > 0 ? (advCount - decCount) / loadedQuotes.length : 0;

    const newsScores = active.items
      .map((w) => smartData[key(w)]?.newsScore)
      .filter((s): s is number => typeof s === 'number');
    const avgNews = newsScores.length > 0 ? newsScores.reduce((a, b) => a + b, 0) / newsScores.length : null;

    const benchPct = benchmarkQuote?.changePct ?? null;
    const benchScore = benchPct !== null ? clamp(benchPct / 1.5, -1, 1) : null;

    let score = 0;
    let totalWeight = 0;
    if (benchScore !== null) {
      score += benchScore * 0.45;
      totalWeight += 0.45;
    }
    if (loadedQuotes.length > 0) {
      score += breadthScore * 0.35;
      totalWeight += 0.35;
    }
    if (avgNews !== null) {
      score += avgNews * 0.2;
      totalWeight += 0.2;
    }
    const finalScore = totalWeight > 0 ? Number((score / totalWeight).toFixed(2)) : 0;
    const label = sentimentBiasOf(finalScore);
    const guidance =
      label === 'Bullish'
        ? 'Broad market tailwind favors oversold rebounds; overbought leaders may stay extended.'
        : label === 'Bearish'
          ? 'Cautious market tape heightens pullback risk on overbought names; verify support on oversold dips.'
          : 'Balanced market regime — classic RSI mean-reversion levels carry higher weight.';

    return {
      score: finalScore,
      label,
      guidance,
      benchSymbol: benchmarkQuote?.symbol || (active.items.every((i) => i.market === 'US') ? 'SPY' : 'NIFTY'),
      benchPct,
      advCount,
      decCount,
      avgNews,
      newsSampleSize: newsScores.length,
    };
  }, [active.items, quotes, smartData, benchmarkQuote]);

  const rows = useMemo(() => {
    const r = active.items.map((w) => {
      const k = key(w);
      const q = quotes[k];
      const sm = smartData[k];
      const cls = classifySmartStock(sm, marketSentiment.score, thresholdPreset);
      return { w, q, sm, cls };
    });
    return r.sort((a, b) => {
      let x = 0;
      if (sort.k === 'symbol') x = a.w.symbol.localeCompare(b.w.symbol);
      else if (sort.k === 'rsi') x = (a.sm?.rsi ?? -Infinity) - (b.sm?.rsi ?? -Infinity);
      else if (sort.k === 'sentiment') x = (a.sm?.sentimentScore ?? -Infinity) - (b.sm?.sentimentScore ?? -Infinity);
      else x = (a.q?.[sort.k] ?? -Infinity) - (b.q?.[sort.k] ?? -Infinity);
      return (Number.isNaN(x) ? 0 : x) * sort.dir;
    });
  }, [active, quotes, smartData, marketSentiment.score, thresholdPreset, sort]);

  const visibleRows = useMemo(() => {
    if (!smartMode || smartFilter === 'all') return rows;
    return rows.filter((r) => r.cls.zone === smartFilter);
  }, [rows, smartMode, smartFilter]);

  const loaded = rows.filter((r) => r.q);
  const adv = loaded.filter((r) => r.q!.changePct > 0).length;
  const dec = loaded.filter((r) => r.q!.changePct < 0).length;
  const best = loaded.reduce<typeof loaded[0] | null>((b, r) => (!b || r.q!.changePct > b.q!.changePct ? r : b), null);
  const worst = loaded.reduce<typeof loaded[0] | null>((b, r) => (!b || r.q!.changePct < b.q!.changePct ? r : b), null);

  const overboughtRows = useMemo(() => rows.filter((r) => r.cls.zone === 'overbought'), [rows]);
  const oversoldRows = useMemo(() => rows.filter((r) => r.cls.zone === 'oversold'), [rows]);
  const neutralRows = useMemo(() => rows.filter((r) => r.cls.zone === 'neutral'), [rows]);
  const highestRsiRow = useMemo(
    () =>
      overboughtRows.reduce<typeof rows[0] | null>(
        (top, r) => (!top || (r.sm?.rsi ?? -1) > (top.sm?.rsi ?? -1) ? r : top),
        null
      ),
    [overboughtRows]
  );
  const lowestRsiRow = useMemo(
    () =>
      oversoldRows.reduce<typeof rows[0] | null>(
        (low, r) => (!low || (r.sm?.rsi ?? 101) < (low.sm?.rsi ?? 101) ? r : low),
        null
      ),
    [oversoldRows]
  );

  const handleManualRefresh = () => {
    refresh();
    if (smartMode) {
      refreshSmart(true);
    }
  };

  const exportCsv = () => {
    const header = smartMode
      ? 'Symbol,Market,LTP,Change,Change %,RSI(14),Sentiment,Sentiment Score,Smart Status,Day Low,Day High,52W Low,52W High,Volume'
      : 'Symbol,Market,LTP,Change,Change %,Day Low,Day High,52W Low,52W High,Volume';
    const lines = [header];
    visibleRows.forEach(({ w, q, sm, cls }) => {
      const base = [w.symbol, w.market, q?.price ?? '', q?.change ?? '', q?.changePct ?? ''];
      const smartCols = smartMode
        ? [sm?.rsi ?? '', sm?.sentimentLabel ?? '', sm?.sentimentScore ?? '', cls.label]
        : [];
      const tail = [q?.low ?? '', q?.high ?? '', q?.low52 ?? '', q?.high52 ?? '', q?.volume ?? ''];
      lines.push([...base, ...smartCols, ...tail].join(','));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `${active.name.replace(/\s+/g, '_')}${smartMode ? '_Smart' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const th = (k: SortKey, label: string, right = false) => (
    <th
      className={`py-2.5 px-3 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
      onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : k === 'symbol' ? 1 : -1 }))}
    >
      {label}
      {sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const obThreshold = thresholdPreset === 'standard' ? 70 : 65;
  const osThreshold = thresholdPreset === 'standard' ? 30 : 35;
  const sentimentColor = (bias: SentimentBias) =>
    bias === 'Bullish'
      ? 'text-emerald-600 dark:text-emerald-400'
      : bias === 'Bearish'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-600 dark:text-slate-400';

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600"><Star className="w-5 h-5" /></div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Watchlist</h2>
              <p className="text-xs text-slate-500">Live prices — Angel One + Yahoo{updated ? ` · updated ${updated}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={smartMode}
              onClick={toggleSmartMode}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                smartMode
                  ? 'bg-blue-600/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Highlight overbought and oversold stocks using live RSI(14) and market sentiment"
            >
              <Activity className={`w-4 h-4 ${smartMode ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Smart Watchlist</span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  smartMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    smartMode ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
            <button onClick={() => setAuto((a) => !a)} title={auto ? 'Pause auto-refresh' : 'Resume auto-refresh'} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              {auto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={handleManualRefresh} title="Refresh quotes & RSI" className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className={`w-4 h-4 ${loading || smartLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button onClick={exportCsv} title="Export CSV" className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lists.map((l) => (
            <button key={l.id} onClick={() => setActiveId(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${l.id === active.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
              {l.name} <span className="opacity-70">({l.items.length})</span>
            </button>
          ))}
          {showNew ? (
            <span className="flex items-center gap-1">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createList()} placeholder="List name"
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 w-32" />
              <button onClick={createList} className="text-xs font-bold text-blue-600">Add</button>
              <button onClick={() => setShowNew(false)} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </span>
          ) : (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-600">
              <FolderPlus className="w-3.5 h-3.5" /> New list
            </button>
          )}
          {active.id !== DEFAULT_ID && (
            <button onClick={deleteList} className="ml-auto text-[11px] font-bold text-rose-500">Delete this list</button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search stock or index to add (e.g. SUZLON, NVDA)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
              {results.map((r) => (
                <li key={`${r.symbol}|${r.market}`}>
                  <button onClick={() => add(r)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span><b className="text-slate-900 dark:text-white">{r.displaySymbol}</b> <span className="text-slate-400">{r.longName}</span></span>
                    <span className="flex items-center gap-1 text-blue-600 font-bold"><Plus className="w-3 h-3" />{r.market}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {smartMode && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Market Sentiment</span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <span className={`font-bold inline-flex items-center gap-1 ${sentimentColor(marketSentiment.label)}`}>
                  {marketSentiment.label === 'Bullish' ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : marketSentiment.label === 'Bearish' ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  {marketSentiment.label}
                  <span className="font-mono tabular-nums">
                    ({marketSentiment.score >= 0 ? '+' : ''}{marketSentiment.score.toFixed(2)})
                  </span>
                </span>
                {marketSentiment.benchPct !== null && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {marketSentiment.benchSymbol}{' '}
                      <span className={tone(marketSentiment.benchPct)}>
                        {marketSentiment.benchPct >= 0 ? '+' : ''}{marketSentiment.benchPct.toFixed(2)}%
                      </span>
                    </span>
                  </>
                )}
                {loaded.length > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Breadth {marketSentiment.advCount} Adv / {marketSentiment.decCount} Dec
                    </span>
                  </>
                )}
                {smartLoading && smartProgress.total > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                      Scanning {smartProgress.done}/{smartProgress.total}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {marketSentiment.guidance}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setThresholdPreset('standard')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    thresholdPreset === 'standard'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Classic Wilder RSI zones: Oversold ≤ 30, Overbought ≥ 70"
                >
                  RSI 30/70
                </button>
                <button
                  type="button"
                  onClick={() => setThresholdPreset('sensitive')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    thresholdPreset === 'sensitive'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Swing sensitivity: Oversold ≤ 35, Overbought ≥ 65"
                >
                  RSI 35/65
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
              {(
                [
                  { id: 'all', label: 'All', count: rows.length },
                  { id: 'overbought', label: 'Overbought', count: overboughtRows.length },
                  { id: 'oversold', label: 'Oversold', count: oversoldRows.length },
                  { id: 'neutral', label: 'Neutral', count: neutralRows.length },
                ] as Array<{ id: SmartFilter; label: string; count: number }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSmartFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    smartFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}{' '}
                  <span className="font-mono tabular-nums opacity-70">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Oversold ≤ {osThreshold} · Overbought ≥ {obThreshold}
            </div>
          </div>
        </div>
      )}

      {loaded.length > 0 && !smartMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[11px] font-semibold text-slate-500">Advancing</div><div className="text-lg font-black font-mono tabular-nums text-emerald-600">{adv}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[11px] font-semibold text-slate-500">Declining</div><div className="text-lg font-black font-mono tabular-nums text-rose-600">{dec}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[11px] font-semibold text-slate-500">Top gainer</div><div className="font-black text-slate-900 dark:text-white">{best?.w.symbol}</div><div className="text-emerald-600 font-mono tabular-nums">{best && `${best.q!.changePct >= 0 ? '+' : ''}${best.q!.changePct.toFixed(2)}%`}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[11px] font-semibold text-slate-500">Top loser</div><div className="font-black text-slate-900 dark:text-white">{worst?.w.symbol}</div><div className="text-rose-600 font-mono tabular-nums">{worst && `${worst.q!.changePct.toFixed(2)}%`}</div></div>
        </div>
      )}

      {smartMode && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => setSmartFilter((f) => (f === 'overbought' ? 'all' : 'overbought'))}
            className={`text-left rounded-xl bg-white dark:bg-slate-900 border p-3 transition-colors cursor-pointer ${
              smartFilter === 'overbought'
                ? 'border-rose-400 dark:border-rose-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Overbought (RSI ≥ {obThreshold})</div>
            <div className="text-lg font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {overboughtRows.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
              {highestRsiRow?.sm?.rsi != null ? `Peak: ${highestRsiRow.w.symbol} (${highestRsiRow.sm.rsi.toFixed(1)})` : 'None currently stretched'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSmartFilter((f) => (f === 'oversold' ? 'all' : 'oversold'))}
            className={`text-left rounded-xl bg-white dark:bg-slate-900 border p-3 transition-colors cursor-pointer ${
              smartFilter === 'oversold'
                ? 'border-emerald-400 dark:border-emerald-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">Oversold (RSI ≤ {osThreshold})</div>
            <div className="text-lg font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {oversoldRows.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
              {lowestRsiRow?.sm?.rsi != null ? `Lowest: ${lowestRsiRow.w.symbol} (${lowestRsiRow.sm.rsi.toFixed(1)})` : 'None currently oversold'}
            </div>
          </button>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Watchlist Breadth</div>
            <div className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">
              <span className="text-emerald-600 dark:text-emerald-400">{adv}</span>
              <span className="text-slate-300 dark:text-slate-700 mx-1">/</span>
              <span className="text-rose-600 dark:text-rose-400">{dec}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Advancing vs Declining
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-[11px] font-semibold text-slate-500">Top Mover</div>
            <div className="font-black text-slate-900 dark:text-white truncate">
              {best ? best.w.symbol : '—'}
            </div>
            <div className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-[11px]">
              {best ? `${best.q!.changePct >= 0 ? '+' : ''}${best.q!.changePct.toFixed(2)}%` : 'Awaiting quotes'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 font-bold">
            <tr>
              {th('symbol', 'Symbol')}
              {th('price', 'LTP', true)}
              <th className="py-2.5 px-3 text-right">Change</th>
              {th('changePct', 'Chg %', true)}
              {smartMode && th('rsi', 'RSI (14)', true)}
              {smartMode && th('sentiment', 'Sentiment')}
              {smartMode && <th className="py-2.5 px-3 text-left">Smart Signal</th>}
              <th className="py-2.5 px-3 hidden md:table-cell">Day Range</th>
              <th className="py-2.5 px-3 hidden lg:table-cell">52W Range</th>
              {th('volume', 'Volume', true)}
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleRows.map(({ w, q, sm, cls }) => {
              const dayPos = q && q.high > q.low ? ((q.price - q.low) / (q.high - q.low)) * 100 : null;
              const yrPos = q && q.high52 > q.low52 ? ((q.price - q.low52) / (q.high52 - q.low52)) * 100 : null;
              const rowHighlight =
                smartMode && cls.zone === 'overbought'
                  ? 'bg-rose-50/75 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/35'
                  : smartMode && cls.zone === 'oversold'
                    ? 'bg-emerald-50/75 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/35'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40';
              const rsiVal = sm?.rsi ?? null;
              const rsiClamped = rsiVal !== null ? clamp(rsiVal, 0, 100) : null;
              const rsiTone =
                cls.zone === 'overbought'
                  ? 'text-rose-600 dark:text-rose-400'
                  : cls.zone === 'oversold'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200';
              const rsiDotTone =
                cls.zone === 'overbought'
                  ? 'bg-rose-600 dark:bg-rose-400'
                  : cls.zone === 'oversold'
                    ? 'bg-emerald-600 dark:bg-emerald-400'
                    : 'bg-slate-500 dark:bg-slate-300';

              return (
                <tr key={key(w)} className={`transition-colors ${rowHighlight}`}>
                  <td className="py-2.5 px-3">
                    <div className="font-black text-slate-900 dark:text-white">{w.symbol}</div>
                    <div className="text-[11px] text-slate-400">{w.market}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">{q ? `${cur(w.market)}${fmt(q.price)}` : '—'}</td>
                  <td className={`py-2.5 px-3 text-right font-mono tabular-nums ${tone(q?.change ?? 0)}`}>{q ? `${q.change >= 0 ? '+' : ''}${fmt(q.change)}` : '—'}</td>
                  <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${tone(q?.changePct ?? 0)}`}>{q ? `${q.changePct >= 0 ? '+' : ''}${fmt(q.changePct)}%` : '—'}</td>

                  {smartMode && (
                    <td className="py-2.5 px-3 text-right">
                      {rsiVal !== null && rsiClamped !== null ? (
                        <div className="inline-flex flex-col items-end gap-1 min-w-[78px]" title={`14-day Wilder RSI: ${rsiVal.toFixed(1)} (OS ≤ ${osThreshold}, OB ≥ ${obThreshold})`}>
                          <span className={`font-mono tabular-nums font-bold ${rsiTone}`}>
                            {rsiVal.toFixed(1)}
                          </span>
                          <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 relative overflow-visible">
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/30"
                              style={{ width: `${osThreshold}%` }}
                            />
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-0 right-0 rounded-r-full bg-rose-500/30"
                              style={{ width: `${100 - obThreshold}%` }}
                            />
                            <span
                              aria-hidden="true"
                              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${rsiDotTone}`}
                              style={{ left: `calc(${rsiClamped}% - 4px)` }}
                            />
                          </div>
                        </div>
                      ) : smartLoading ? (
                        <span className="inline-block h-3.5 w-12 rounded bg-slate-200 dark:bg-slate-800" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  {smartMode && (
                    <td className="py-2.5 px-3">
                      {sm ? (
                        <div
                          className="space-y-0.5"
                          title={
                            sm.topHeadline
                              ? `Latest headline: ${sm.topHeadline} (${sm.posHeadlines} positive / ${sm.negHeadlines} negative of ${sm.newsCount})`
                              : 'Derived from intraday price momentum & MACD alignment'
                          }
                        >
                          <div className={`font-bold inline-flex items-center gap-1 ${sentimentColor(sm.sentimentLabel)}`}>
                            {sm.sentimentLabel === 'Bullish' ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : sm.sentimentLabel === 'Bearish' ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                            <span>{sm.sentimentLabel}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {sm.sentimentScore >= 0 ? '+' : ''}{sm.sentimentScore.toFixed(2)}
                            {sm.newsCount > 0 ? ` · ${sm.newsCount} news` : ' · price'}
                          </div>
                        </div>
                      ) : smartLoading ? (
                        <span className="inline-block h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  {smartMode && (
                    <td className="py-2.5 px-3">
                      {cls.zone === 'overbought' ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Overbought</span>
                          </div>
                          <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80">{cls.note}</div>
                        </div>
                      ) : cls.zone === 'oversold' ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>Oversold</span>
                          </div>
                          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">{cls.note}</div>
                        </div>
                      ) : cls.zone === 'neutral' ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-600 dark:text-slate-300">Neutral</div>
                          <div className="text-[11px] text-slate-400">{cls.note}</div>
                        </div>
                      ) : smartLoading ? (
                        <span className="inline-block h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  <td className="py-2.5 px-3 hidden md:table-cell w-40">
                    {dayPos !== null ? (
                      <div title={`${fmt(q!.low)} – ${fmt(q!.high)}`} className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 relative"><span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600" style={{ left: `calc(${dayPos}% - 4px)` }} /></div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 hidden lg:table-cell w-40">
                    {yrPos !== null ? (
                      <div title={`${fmt(q!.low52)} – ${fmt(q!.high52)}`} className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 relative"><span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500" style={{ left: `calc(${yrPos}% - 4px)` }} /></div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">{q ? vol(q.volume) : '—'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => onSelectStock(w.symbol, w.market)} className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[11px] mr-2 cursor-pointer">Analyze</button>
                    <button onClick={() => remove(w)} aria-label={`Remove ${w.symbol}`} className="text-slate-300 hover:text-rose-500 align-middle cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={smartMode ? 11 : 8} className="py-10 text-center text-slate-400">This list is empty — search above to add a stock.</td></tr>
            )}
            {rows.length > 0 && visibleRows.length === 0 && (
              <tr>
                <td colSpan={smartMode ? 11 : 8} className="py-10 text-center space-y-2">
                  <div className="text-slate-500 dark:text-slate-400 font-medium">
                    No {smartFilter} stocks right now at RSI {osThreshold}/{obThreshold}.
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSmartFilter('all')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Show all stocks
                    </button>
                    {thresholdPreset === 'standard' && (
                      <button
                        type="button"
                        onClick={() => setThresholdPreset('sensitive')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Try RSI 35/65 sensitivity
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && loaded.length < rows.length && !loading && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Live data unavailable for {rows.length - loaded.length} symbol(s).</p>
      )}
    </div>
  );
};
