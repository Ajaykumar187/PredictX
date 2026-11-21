import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MarketType } from '../../types';

export type CandleInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1M';

export interface CandleBar {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlesResponse {
  success: boolean;
  symbol: string;
  interval: CandleInterval;
  source?: string;
  candles: CandleBar[];
  error?: string;
}

function resolveYahooTicker(raw: string, marketHint?: MarketType): string {
  const up = raw.trim().toUpperCase();
  if (up === 'NIFTY' || up === 'NIFTY 50' || up === 'NIFTY50') return '^NSEI';
  if (up === 'BANKNIFTY' || up === 'BANK NIFTY') return '^NSEBANK';
  if (up === 'FINNIFTY' || up === 'FIN NIFTY') return 'NIFTY_FIN_SERVICE.NS';
  if (up === 'MIDCPNIFTY') return 'NIFTY_MID_SELECT.NS';
  if (up === 'SENSEX' || up === 'BSE SENSEX') return '^BSESN';
  if (up === 'TATAMOTORS') return marketHint === 'BSE' ? 'TMPV.BO' : 'TMPV.NS';
  if (up === 'ZOMATO') return marketHint === 'BSE' ? 'ETERNAL.BO' : 'ETERNAL.NS';
  if (!up.includes('.') && !up.startsWith('^') && marketHint !== 'US') {
    return marketHint === 'BSE' ? `${up}.BO` : `${up}.NS`;
  }
  return up;
}

function resampleBars(bars: CandleBar[], mode: 'week' | 'month'): CandleBar[] {
  const buckets = new Map<string, CandleBar>();
  for (const b of bars) {
    const ist = new Date((b.time + 5.5 * 3600) * 1000);
    let key: string;
    if (mode === 'month') {
      key = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      const dow = ist.getUTCDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + diff));
      key = mon.toISOString().slice(0, 10);
    }
    const ex = buckets.get(key);
    if (!ex) buckets.set(key, { ...b });
    else {
      ex.high = Math.max(ex.high, b.high);
      ex.low = Math.min(ex.low, b.low);
      ex.close = b.close;
      ex.volume += b.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

async function fetchCandles(
  symbol: string,
  interval: CandleInterval = '5m',
  marketHint?: MarketType
): Promise<CandlesResponse> {
  const cleanSym = symbol.trim();
  if (!cleanSym) {
    return { success: false, symbol: '', interval, candles: [], error: 'Symbol is required' };
  }

  // 1. Primary: Backend multi-timeframe endpoint (Angel One SmartAPI + Yahoo Finance)
  try {
    const params = new URLSearchParams({ interval });
    if (marketHint) params.set('market', marketHint);
    const res = await fetch(`/api/stock/candles/${encodeURIComponent(cleanSym)}?${params.toString()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 0) {
        return data as CandlesResponse;
      }
    }
  } catch {
    // Fall through to client fallback
  }

  // 2. Fallback: Direct Yahoo Finance multi-timeframe chart via public CORS proxy
  try {
    const yahooMap: Record<CandleInterval, { yInterval: string; yRange: string; groupMin?: number }> = {
      '1m': { yInterval: '1m', yRange: '5d' },
      '3m': { yInterval: '1m', yRange: '5d', groupMin: 3 },
      '5m': { yInterval: '5m', yRange: '1mo' },
      '15m': { yInterval: '15m', yRange: '1mo' },
      '30m': { yInterval: '30m', yRange: '1mo' },
      '1h': { yInterval: '60m', yRange: '6mo' },
      '1d': { yInterval: '1d', yRange: '2y' },
      '1w': { yInterval: '1wk', yRange: '5y' },
      '1M': { yInterval: '1mo', yRange: 'max' },
    };
    const cfg = yahooMap[interval];
    const ticker = resolveYahooTicker(cleanSym, marketHint);
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${cfg.yRange}&interval=${cfg.yInterval}`;
    const pRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (pRes.ok) {
      const json = await pRes.json();
      const r = json?.chart?.result?.[0];
      const ts: number[] = r?.timestamp || [];
      const q = r?.indicators?.quote?.[0] || {};
      const byTime = new Map<number, CandleBar>();
      for (let i = 0; i < ts.length; i++) {
        const c = q.close?.[i];
        if (c === null || c === undefined || !Number.isFinite(c) || c <= 0) continue;
        const o = Number.isFinite(q.open?.[i]) && q.open[i] > 0 ? q.open[i] : c;
        const h = Number.isFinite(q.high?.[i]) && q.high[i] > 0 ? Math.max(q.high[i], o, c) : Math.max(o, c);
        const l = Number.isFinite(q.low?.[i]) && q.low[i] > 0 ? Math.min(q.low[i], o, c) : Math.min(o, c);
        const v = Number.isFinite(q.volume?.[i]) ? Math.round(q.volume[i]) : 0;
        const sec = Math.floor(ts[i]);
        byTime.set(sec, {
          time: sec,
          date: new Date(sec * 1000).toISOString(),
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: v,
        });
      }
      let candles = [...byTime.values()].sort((a, b) => a.time - b.time);
      if (cfg.groupMin && candles.length > 0) {
        const stepSec = cfg.groupMin * 60;
        const grouped = new Map<number, CandleBar>();
        for (const bar of candles) {
          const bucket = Math.floor(bar.time / stepSec) * stepSec;
          const ex = grouped.get(bucket);
          if (!ex) grouped.set(bucket, { ...bar, time: bucket, date: new Date(bucket * 1000).toISOString() });
          else {
            ex.high = Math.max(ex.high, bar.high);
            ex.low = Math.min(ex.low, bar.low);
            ex.close = bar.close;
            ex.volume += bar.volume;
          }
        }
        candles = [...grouped.values()].sort((a, b) => a.time - b.time);
      }
      if (candles.length > 0) {
        return { success: true, symbol: cleanSym.toUpperCase(), interval, source: 'Yahoo Finance', candles };
      }
    }
  } catch {
    // Fall through to daily quote fallback
  }

  // 3. Final fallback: Existing /api/stock/quote endpoint daily bars (for 1d / 1w / 1M)
  if (interval === '1d' || interval === '1w' || interval === '1M') {
    try {
      const qRes = await fetch(`/api/stock/quote/${encodeURIComponent(cleanSym)}?market=${marketHint || ''}`);
      if (qRes.ok) {
        const qData = await qRes.json();
        if (qData?.success && Array.isArray(qData.bars) && qData.bars.length > 0) {
          let daily: CandleBar[] = qData.bars
            .map((b: any) => {
              const ms = Date.parse(String(b.date));
              if (!Number.isFinite(ms)) return null;
              return {
                time: Math.floor(ms / 1000),
                date: String(b.date),
                open: Number(b.open),
                high: Number(b.high),
                low: Number(b.low),
                close: Number(b.close),
                volume: Math.round(Number(b.volume) || 0),
              };
            })
            .filter((x: CandleBar | null): x is CandleBar => x !== null && Number.isFinite(x.close) && x.close > 0);
          if (interval === '1w') daily = resampleBars(daily, 'week');
          if (interval === '1M') daily = resampleBars(daily, 'month');
          if (daily.length > 0) {
            return { success: true, symbol: cleanSym.toUpperCase(), interval, source: 'Live Quote', candles: daily };
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    success: false,
    symbol: cleanSym,
    interval,
    candles: [],
    error: `Unable to load ${interval} candles for ${cleanSym}.`,
  };
}

type ChartStyle = 'candles' | 'heikin' | 'area';

interface TimeframeOption {
  key: CandleInterval;
  label: string;
  group: 'min' | 'hour' | 'day';
}

const TIMEFRAMES: TimeframeOption[] = [
  { key: '1m', label: '1m', group: 'min' },
  { key: '3m', label: '3m', group: 'min' },
  { key: '5m', label: '5m', group: 'min' },
  { key: '15m', label: '15m', group: 'min' },
  { key: '30m', label: '30m', group: 'min' },
  { key: '1h', label: '1H', group: 'hour' },
  { key: '1d', label: '1D', group: 'day' },
  { key: '1w', label: '1W', group: 'day' },
  { key: '1M', label: '1M', group: 'day' },
];

const INTRADAY_SET = new Set<CandleInterval>(['1m', '3m', '5m', '15m', '30m', '1h']);

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';

const CandleGlyph: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4.5 2.5v2M4.5 10.5v3" />
    <rect x="3" y="4.5" width="3" height="6" rx="0.5" fill="currentColor" />
    <path d="M11.5 1.5v3M11.5 11.5v3" />
    <rect x="10" y="4.5" width="3" height="7" rx="0.5" />
  </svg>
);

const fmtNum = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

const fmtVol = (v: number) => {
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString('en-IN');
};

function formatIstDateTime(sec: number, tf: CandleInterval): string {
  if (!Number.isFinite(sec)) return '';
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return '';
  if (INTRADAY_SET.has(tf)) {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (tf === '1M') {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      year: 'numeric',
    });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatIstTick(sec: number, tf: CandleInterval): string {
  if (!Number.isFinite(sec)) return '';
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return '';
  if (tf === '1m' || tf === '3m' || tf === '5m' || tf === '15m') {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (tf === '30m' || tf === '1h') {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (tf === '1M') {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      year: '2-digit',
    });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
  });
}

function sanitizeCandles(raw: CandleBar[]): CandleBar[] {
  const byTime = new Map<number, CandleBar>();
  for (const b of raw) {
    const t = Math.floor(Number(b.time));
    const close = Number(b.close);
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(close) || close <= 0) continue;
    const open = Number.isFinite(b.open) && b.open > 0 ? Number(b.open) : close;
    const high = Math.max(Number.isFinite(b.high) && b.high > 0 ? Number(b.high) : close, open, close);
    const low = Math.min(Number.isFinite(b.low) && b.low > 0 ? Number(b.low) : close, open, close);
    const volume = Number.isFinite(b.volume) && b.volume > 0 ? Math.round(b.volume) : 0;
    byTime.set(t, {
      time: t,
      date: b.date || new Date(t * 1000).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function computeHeikinAshi(bars: CandleBar[]): CandleBar[] {
  const out: CandleBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);
    out.push({
      ...b,
      open: Number(haOpen.toFixed(2)),
      high: Number(haHigh.toFixed(2)),
      low: Number(haLow.toFixed(2)),
      close: Number(haClose.toFixed(2)),
    });
  }
  return out;
}

function computeEmaSeries(bars: CandleBar[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function nicePriceTicks(minVal: number, maxVal: number, targetCount = 6): number[] {
  const span = Math.max(maxVal - minVal, 0.05);
  const rawStep = span / Math.max(2, targetCount);
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / pow;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * pow;
  const first = Math.ceil(minVal / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= maxVal + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(2)));
    if (ticks.length > 20) break;
  }
  return ticks;
}

function useIsDarkMode(): boolean {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains('dark'));
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export interface TradingViewCandleChartProps {
  symbol: string;
  market: MarketType;
  spotPrice: number;
}

export const TradingViewCandleChart: React.FC<TradingViewCandleChartProps> = ({
  symbol,
  market,
  spotPrice,
}) => {
  const isDark = useIsDarkMode();
  const [timeframe, setTimeframe] = useState<CandleInterval>('5m');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [showEma9, setShowEma9] = useState<boolean>(true);
  const [showEma21, setShowEma21] = useState<boolean>(true);
  const [showEma50, setShowEma50] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport: [startIdx, endIdx] in bar index space (endIdx can extend slightly past bars.length for right padding)
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({ start: 0, end: 90 });
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; index: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 800, height: 450 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    origStart: number;
    origEnd: number;
  }>({ active: false, startX: 0, origStart: 0, origEnd: 0 });

  const applyInitialRange = useCallback((len: number, tf: CandleInterval) => {
    const windowSize = INTRADAY_SET.has(tf) ? 85 : 105;
    const rightPad = 4;
    if (len <= windowSize) {
      setViewRange({ start: 0, end: Math.max(10, len + rightPad) });
    } else {
      setViewRange({ start: len - windowSize, end: len + rightPad });
    }
  }, []);

  const loadCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchCandles(symbol, timeframe, market);
    const cleaned = res.success ? sanitizeCandles(res.candles) : [];
    if (cleaned.length > 0) {
      setCandles(cleaned);
      setSourceLabel(res.source || '');
      setError(null);
      applyInitialRange(cleaned.length, timeframe);
    } else {
      setCandles([]);
      setError(res.error || `No ${timeframe} candle data available for ${symbol}.`);
    }
    setLoading(false);
  }, [symbol, timeframe, market, applyInitialRange]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setCrosshair(null);
    fetchCandles(symbol, timeframe, market).then((res) => {
      if (!active) return;
      const cleaned = res.success ? sanitizeCandles(res.candles) : [];
      if (cleaned.length > 0) {
        setCandles(cleaned);
        setSourceLabel(res.source || '');
        setError(null);
        applyInitialRange(cleaned.length, timeframe);
      } else {
        setCandles([]);
        setError(res.error || `No ${timeframe} candle data available for ${symbol}.`);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [symbol, timeframe, market, applyInitialRange]);

  // Keep latest candle live with spotPrice ticks without losing viewport pan/zoom
  const displayBars = useMemo(() => {
    if (candles.length === 0) return [];
    const base = candles.map((c) => ({ ...c }));
    if (Number.isFinite(spotPrice) && spotPrice > 0) {
      const last = base[base.length - 1];
      const livePx = Number(spotPrice.toFixed(2));
      last.close = livePx;
      if (livePx > last.high) last.high = livePx;
      if (livePx < last.low) last.low = livePx;
    }
    return chartStyle === 'heikin' ? computeHeikinAshi(base) : base;
  }, [candles, spotPrice, chartStyle]);

  const ema9 = useMemo(() => (showEma9 ? computeEmaSeries(displayBars, 9) : []), [displayBars, showEma9]);
  const ema21 = useMemo(() => (showEma21 ? computeEmaSeries(displayBars, 21) : []), [displayBars, showEma21]);
  const ema50 = useMemo(() => (showEma50 ? computeEmaSeries(displayBars, 50) : []), [displayBars, showEma50]);
  const hasVolume = useMemo(() => displayBars.some((b) => b.volume > 0), [displayBars]);

  // Observe container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen, displayBars.length]);

  const RIGHT_AXIS_W = 72;
  const BOTTOM_AXIS_H = 26;
  const TOP_PAD = 14;

  const clampRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      const total = displayBars.length;
      if (total === 0) return { start: 0, end: 50 };
      const minSpan = Math.min(12, Math.max(5, total));
      const maxSpan = Math.max(total + 12, 30);
      let span = Math.max(minSpan, Math.min(maxSpan, nextEnd - nextStart));
      let s = nextStart;
      let e = s + span;
      const maxEnd = total + Math.max(6, Math.round(span * 0.2));
      const minStart = -Math.round(span * 0.05);
      if (e > maxEnd) {
        e = maxEnd;
        s = e - span;
      }
      if (s < minStart) {
        s = minStart;
        e = s + span;
      }
      return { start: s, end: e };
    },
    [displayBars.length]
  );

  const zoomBy = useCallback(
    (factor: number, anchorRatio = 0.8) => {
      setViewRange((prev) => {
        const span = prev.end - prev.start;
        const anchor = prev.start + span * anchorRatio;
        const nextSpan = span * factor;
        const nextStart = anchor - nextSpan * anchorRatio;
        const nextEnd = nextStart + nextSpan;
        return clampRange(nextStart, nextEnd);
      });
    },
    [clampRange]
  );

  const handleFit = useCallback(() => {
    if (displayBars.length === 0) return;
    setViewRange({ start: 0, end: displayBars.length + 3 });
  }, [displayBars.length]);

  // Wheel zoom listener (non-passive so scrolling inside the chart zooms candles cleanly)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const plotW = Math.max(1, rect.width - RIGHT_AXIS_W);
      const ratio = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / plotW));
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      zoomBy(factor, ratio);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Draw HiDPI Angel One / TradingView Candlestick Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || displayBars.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const plotW = Math.max(40, width - RIGHT_AXIS_W);
    const plotH = Math.max(80, height - BOTTOM_AXIS_H);
    const volZoneH = showVolume && hasVolume ? Math.floor(plotH * 0.18) : 0;
    const priceBottomY = plotH - volZoneH - 8;
    const priceTopY = TOP_PAD;
    const priceH = Math.max(40, priceBottomY - priceTopY);

    // Colors
    const bg = isDark ? '#0b1120' : '#ffffff';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.06)';
    const axisBorder = isDark ? '#1e293b' : '#e2e8f0';
    const axisText = isDark ? '#94a3b8' : '#475569';
    const crossColor = isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(51, 65, 85, 0.45)';
    const badgeBg = isDark ? '#1e293b' : '#0f172a';

    // Background fill
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const span = Math.max(1, viewRange.end - viewRange.start);
    const stepX = plotW / span;
    const idxToX = (i: number) => (i - viewRange.start + 0.5) * stepX;

    const visStart = Math.max(0, Math.floor(viewRange.start) - 1);
    const visEnd = Math.min(displayBars.length - 1, Math.ceil(viewRange.end) + 1);

    let minP = Infinity;
    let maxP = -Infinity;
    let maxVol = 0;

    for (let i = visStart; i <= visEnd; i++) {
      const b = displayBars[i];
      if (!b) continue;
      if (chartStyle === 'area') {
        if (b.close < minP) minP = b.close;
        if (b.close > maxP) maxP = b.close;
      } else {
        if (b.low < minP) minP = b.low;
        if (b.high > maxP) maxP = b.high;
      }
      if (showEma9 && ema9[i] !== null) {
        minP = Math.min(minP, ema9[i]!);
        maxP = Math.max(maxP, ema9[i]!);
      }
      if (showEma21 && ema21[i] !== null) {
        minP = Math.min(minP, ema21[i]!);
        maxP = Math.max(maxP, ema21[i]!);
      }
      if (showEma50 && ema50[i] !== null) {
        minP = Math.min(minP, ema50[i]!);
        maxP = Math.max(maxP, ema50[i]!);
      }
      if (b.volume > maxVol) maxVol = b.volume;
    }

    if (!Number.isFinite(minP) || !Number.isFinite(maxP)) {
      const last = displayBars[displayBars.length - 1];
      minP = last.low;
      maxP = last.high;
    }
    const rawPad = (maxP - minP) * 0.08 || Math.max(maxP * 0.005, 1);
    const yMin = minP - rawPad;
    const yMax = maxP + rawPad;
    const priceToY = (p: number) => priceTopY + ((yMax - p) / (yMax - yMin)) * priceH;
    const yToPrice = (y: number) => yMax - ((y - priceTopY) / priceH) * (yMax - yMin);

    // Horizontal gridlines & right price ticks
    const pTicks = nicePriceTicks(yMin, yMax, Math.max(4, Math.floor(priceH / 56)));
    ctx.font = '10.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const p of pTicks) {
      const y = Math.round(priceToY(p)) + 0.5;
      if (y < priceTopY - 4 || y > plotH) continue;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();

      ctx.fillStyle = axisText;
      ctx.fillText(fmtNum(p), plotW + 6, y);
    }

    // Vertical gridlines & bottom IST time ticks
    const minTickPx = INTRADAY_SET.has(timeframe) ? 88 : 96;
    const barStep = Math.max(1, Math.ceil(minTickPx / Math.max(stepX, 0.5)));
    const firstTickIdx = Math.max(0, Math.ceil(Math.max(0, viewRange.start) / barStep) * barStep);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = firstTickIdx; i <= visEnd; i += barStep) {
      const b = displayBars[i];
      if (!b) continue;
      const x = Math.round(idxToX(i)) + 0.5;
      if (x < 24 || x > plotW - 24) continue;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotH);
      ctx.stroke();

      ctx.fillStyle = axisText;
      ctx.fillText(formatIstTick(b.time, timeframe), x, plotH + BOTTOM_AXIS_H / 2 + 1);
    }

    // Clip to main plot region
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, plotH);
    ctx.clip();

    // Volume Histogram (bottom 18%)
    if (showVolume && hasVolume && maxVol > 0 && volZoneH > 8) {
      const barW = Math.max(1, Math.min(stepX * 0.72, 18));
      for (let i = visStart; i <= visEnd; i++) {
        const b = displayBars[i];
        if (!b || b.volume <= 0) continue;
        const x = idxToX(i);
        const h = Math.max(1, (b.volume / maxVol) * (volZoneH - 4));
        const up = b.close >= b.open;
        ctx.fillStyle = up
          ? isDark
            ? 'rgba(8, 153, 129, 0.35)'
            : 'rgba(8, 153, 129, 0.28)'
          : isDark
            ? 'rgba(242, 54, 69, 0.35)'
            : 'rgba(242, 54, 69, 0.28)';
        ctx.fillRect(x - barW / 2, plotH - h, barW, h);
      }
    }

    // Main Price Series: Area or Candlesticks / Heikin Ashi
    if (chartStyle === 'area') {
      const firstVis = displayBars[Math.max(0, visStart)];
      const lastVis = displayBars[Math.min(displayBars.length - 1, visEnd)];
      const isUp = lastVis.close >= firstVis.close;
      const strokeCol = isUp ? BULL_COLOR : BEAR_COLOR;

      ctx.beginPath();
      let started = false;
      let firstX = 0;
      let lastX = 0;
      for (let i = visStart; i <= visEnd; i++) {
        const b = displayBars[i];
        if (!b) continue;
        const x = idxToX(i);
        const y = priceToY(b.close);
        if (!started) {
          ctx.moveTo(x, y);
          firstX = x;
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
      }

      if (started) {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.lineTo(lastX, priceBottomY);
        ctx.lineTo(firstX, priceBottomY);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, priceTopY, 0, priceBottomY);
        grad.addColorStop(0, isUp ? 'rgba(8, 153, 129, 0.28)' : 'rgba(242, 54, 69, 0.24)');
        grad.addColorStop(1, isUp ? 'rgba(8, 153, 129, 0.0)' : 'rgba(242, 54, 69, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    } else {
      const bodyW = Math.max(1.5, Math.min(stepX * 0.72, 20));
      const wickW = stepX >= 6 ? 1.25 : 1;

      for (let i = visStart; i <= visEnd; i++) {
        const b = displayBars[i];
        if (!b) continue;
        const x = idxToX(i);
        const yOpen = priceToY(b.open);
        const yClose = priceToY(b.close);
        const yHigh = priceToY(b.high);
        const yLow = priceToY(b.low);
        const isUp = b.close >= b.open;
        const col = isUp ? BULL_COLOR : BEAR_COLOR;

        // Wick
        ctx.strokeStyle = col;
        ctx.lineWidth = wickW;
        const wx = Math.round(x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(wx, yHigh);
        ctx.lineTo(wx, yLow);
        ctx.stroke();

        // Body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.2, Math.abs(yClose - yOpen));
        ctx.fillStyle = col;
        ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
      }
    }

    // EMA Overlay Lines
    const drawEma = (series: Array<number | null>, color: string) => {
      if (series.length === 0) return;
      ctx.beginPath();
      let started = false;
      for (let i = visStart; i <= visEnd; i++) {
        const v = series[i];
        if (v === null || v === undefined) continue;
        const x = idxToX(i);
        const y = priceToY(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      if (started) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.35;
        ctx.stroke();
      }
    };

    if (showEma9) drawEma(ema9, '#f59e0b');
    if (showEma21) drawEma(ema21, '#2563eb');
    if (showEma50) drawEma(ema50, '#7c3aed');

    // Live Latest Price Dashed Line
    const latest = displayBars[displayBars.length - 1];
    const latestY = priceToY(latest.close);
    const latestUp = latest.close >= latest.open;
    const latestCol = latestUp ? BULL_COLOR : BEAR_COLOR;

    if (latestY >= 0 && latestY <= plotH) {
      ctx.save();
      ctx.strokeStyle = latestCol;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(latestY) + 0.5);
      ctx.lineTo(plotW, Math.round(latestY) + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Crosshair lines inside plot
    if (crosshair && crosshair.x >= 0 && crosshair.x <= plotW && crosshair.y >= 0 && crosshair.y <= plotH) {
      const snappedX =
        crosshair.index >= 0 && crosshair.index < displayBars.length
          ? Math.round(idxToX(crosshair.index)) + 0.5
          : Math.round(crosshair.x) + 0.5;
      const cy = Math.round(crosshair.y) + 0.5;

      ctx.save();
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(snappedX, 0);
      ctx.lineTo(snappedX, plotH);
      ctx.moveTo(0, cy);
      ctx.lineTo(plotW, cy);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Axis Hairline Borders
    ctx.strokeStyle = axisBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, plotH);
    ctx.moveTo(0, plotH + 0.5);
    ctx.lineTo(width, plotH + 0.5);
    ctx.stroke();

    // Right Axis Latest Price Pill
    if (latestY >= 8 && latestY <= plotH - 8) {
      const tagH = 18;
      ctx.fillStyle = latestCol;
      ctx.fillRect(plotW + 1, latestY - tagH / 2, RIGHT_AXIS_W - 2, tagH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtNum(latest.close), plotW + 6, latestY);
    }

    // Crosshair Axis Labels (Price on right, IST Time on bottom)
    if (crosshair && crosshair.x >= 0 && crosshair.x <= plotW && crosshair.y >= 0 && crosshair.y <= plotH) {
      // Price badge
      if (crosshair.y >= priceTopY - 8 && crosshair.y <= priceBottomY + 8) {
        const hoverPrice = yToPrice(crosshair.y);
        const tagH = 18;
        ctx.fillStyle = badgeBg;
        ctx.fillRect(plotW + 1, crosshair.y - tagH / 2, RIGHT_AXIS_W - 2, tagH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fmtNum(hoverPrice), plotW + 6, crosshair.y);
      }

      // Time badge
      const hoverBar = displayBars[crosshair.index];
      if (hoverBar) {
        const label = formatIstDateTime(hoverBar.time, timeframe);
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        const tw = ctx.measureText(label).width + 14;
        const snappedX = idxToX(crosshair.index);
        const bx = Math.max(2, Math.min(plotW - tw - 2, snappedX - tw / 2));
        ctx.fillStyle = badgeBg;
        ctx.fillRect(bx, plotH + 3, tw, BOTTOM_AXIS_H - 6);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + tw / 2, plotH + BOTTOM_AXIS_H / 2);
      }
    }
  }, [
    displayBars,
    canvasSize,
    viewRange,
    crosshair,
    chartStyle,
    showEma9,
    showEma21,
    showEma50,
    showVolume,
    hasVolume,
    ema9,
    ema21,
    ema50,
    timeframe,
    isDark,
  ]);

  // Mouse & Touch Handlers for Pan + Crosshair
  const updateCrosshairFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || displayBars.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const plotW = Math.max(40, rect.width - RIGHT_AXIS_W);
    const plotH = Math.max(80, rect.height - BOTTOM_AXIS_H);
    if (x < 0 || x > plotW || y < 0 || y > plotH) {
      setCrosshair(null);
      return;
    }
    const span = Math.max(1, viewRange.end - viewRange.start);
    const rawIdx = viewRange.start + (x / plotW) * span - 0.5;
    const idx = Math.max(0, Math.min(displayBars.length - 1, Math.round(rawIdx)));
    setCrosshair({ x, y, index: idx });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      origStart: viewRange.start,
      origEnd: viewRange.end,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const plotW = Math.max(40, canvas.getBoundingClientRect().width - RIGHT_AXIS_W);
      const span = dragRef.current.origEnd - dragRef.current.origStart;
      const dx = e.clientX - dragRef.current.startX;
      const deltaBars = -(dx / plotW) * span;
      setViewRange(clampRange(dragRef.current.origStart + deltaBars, dragRef.current.origEnd + deltaBars));
    }
    updateCrosshairFromClient(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    dragRef.current.active = false;
  };

  const handleMouseLeave = () => {
    dragRef.current.active = false;
    setCrosshair(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = {
        active: true,
        startX: t.clientX,
        origStart: viewRange.start,
        origEnd: viewRange.end,
      };
      updateCrosshairFromClient(t.clientX, t.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && dragRef.current.active) {
      const t = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const plotW = Math.max(40, canvas.getBoundingClientRect().width - RIGHT_AXIS_W);
      const span = dragRef.current.origEnd - dragRef.current.origStart;
      const dx = t.clientX - dragRef.current.startX;
      const deltaBars = -(dx / plotW) * span;
      setViewRange(clampRange(dragRef.current.origStart + deltaBars, dragRef.current.origEnd + deltaBars));
      updateCrosshairFromClient(t.clientX, t.clientY);
    }
  };

  const handleTouchEnd = () => {
    dragRef.current.active = false;
  };

  const activeBar =
    crosshair && displayBars[crosshair.index]
      ? displayBars[crosshair.index]
      : displayBars.length > 0
        ? displayBars[displayBars.length - 1]
        : null;
  const barDiff = activeBar ? activeBar.close - activeBar.open : 0;
  const barDiffPct = activeBar && activeBar.open > 0 ? (barDiff / activeBar.open) * 100 : 0;
  const barUp = barDiff >= 0;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col'
          : 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden'
      }
    >
      {/* Top TradingView / Angel One Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        {/* Timeframe Selector (Minutes · Hours · Days / Weeks / Months) */}
        <div className="flex items-center flex-wrap gap-1">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
            {TIMEFRAMES.map((tf, idx) => {
              const prevGroup = idx > 0 ? TIMEFRAMES[idx - 1].group : tf.group;
              const showSep = idx > 0 && prevGroup !== tf.group;
              const active = timeframe === tf.key;
              return (
                <React.Fragment key={tf.key}>
                  {showSep && <span className="w-px h-3.5 bg-slate-300 dark:bg-slate-700 mx-0.5" />}
                  <button
                    type="button"
                    onClick={() => setTimeframe(tf.key)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/70'
                    }`}
                  >
                    {tf.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <span className="hidden sm:inline-block w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Chart Type Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
            {(
              [
                { id: 'candles', label: 'Candles' },
                { id: 'heikin', label: 'HA' },
                { id: 'area', label: 'Area' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setChartStyle(m.id)}
                title={
                  m.id === 'candles'
                    ? 'Japanese Candlesticks'
                    : m.id === 'heikin'
                      ? 'Heikin Ashi Candles'
                      : 'Area Line Chart'
                }
                className={`px-2 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartStyle === m.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.id === 'area' ? <TrendingUp className="w-3 h-3" /> : <CandleGlyph className="w-3 h-3" />}
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Indicator Toggles & Chart Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEma9((v) => !v)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showEma9
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            EMA 9
          </button>
          <button
            type="button"
            onClick={() => setShowEma21((v) => !v)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showEma21
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            EMA 21
          </button>
          <button
            type="button"
            onClick={() => setShowEma50((v) => !v)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showEma50
                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            EMA 50
          </button>
          <button
            type="button"
            onClick={() => setShowVolume((v) => !v)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showVolume
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            Vol
          </button>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={() => zoomBy(0.75)}
            title="Zoom in"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.33)}
            title="Zoom out"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            title="Fit all candles to screen"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadCandles}
            title="Reload candles"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive OHLCV HUD Strip */}
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono tabular-nums">
          <span className="font-sans font-extrabold text-slate-900 dark:text-white">
            {symbol} · {TIMEFRAMES.find((t) => t.key === timeframe)?.label || timeframe}
          </span>
          {activeBar && (
            <>
              <span className="text-slate-400">
                O <b className={barUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{fmtNum(activeBar.open)}</b>
              </span>
              <span className="text-slate-400">
                H <b className={barUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{fmtNum(activeBar.high)}</b>
              </span>
              <span className="text-slate-400">
                L <b className={barUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{fmtNum(activeBar.low)}</b>
              </span>
              <span className="text-slate-400">
                C <b className={barUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{fmtNum(activeBar.close)}</b>
              </span>
              <span className={`font-bold ${barUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {barDiff >= 0 ? '+' : ''}
                {fmtNum(barDiff)} ({barDiffPct >= 0 ? '+' : ''}
                {barDiffPct.toFixed(2)}%)
              </span>
              {activeBar.volume > 0 && (
                <span className="text-slate-400">
                  Vol <b className="text-slate-700 dark:text-slate-200">{fmtVol(activeBar.volume)}</b>
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono tabular-nums">
          {activeBar && <span>{formatIstDateTime(activeBar.time, timeframe)} IST</span>}
          {sourceLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{sourceLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Candlestick Chart Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full select-none ${isFullscreen ? 'flex-1 min-h-0' : 'h-[430px] sm:h-[470px]'}`}
      >
        {loading && displayBars.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Loading {symbol} {timeframe} candles…
          </div>
        ) : error && displayBars.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
            <button
              type="button"
              onClick={loadCandles}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="block w-full h-full cursor-crosshair touch-none"
          />
        )}

        {loading && displayBars.length > 0 && (
          <div className="absolute top-2 right-20 px-2 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-semibold pointer-events-none">
            Updating…
          </div>
        )}
      </div>
    </div>
  );
};
