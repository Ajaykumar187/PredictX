import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { AnalysisResult } from '../types';
import { detectPatterns } from '../utils/patterns';
import { getNseStockUrl, formatCurrencyValue } from '../utils/marketData';
import { Sparkles, Eye, ExternalLink } from 'lucide-react';

interface ChartsPageProps {
  data: AnalysisResult;
  theme: 'Light' | 'Dark';
}

interface CandlestickShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    [key: string]: any;
  };
}

const CandlestickShape: React.FC<CandlestickShapeProps> = (props) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || payload.open === undefined || payload.close === undefined) {
    return null;
  }

  const { open, high, low, close } = payload;
  const isUp = close >= open;

  const fill = isUp ? '#10b981' : '#ef4444';
  const stroke = isUp ? '#059669' : '#dc2626';

  const range = high - low;
  const ratio = range > 0 ? height / range : 0;

  const yOpen = y + (high - open) * ratio;
  const yClose = y + (high - close) * ratio;

  const cx = x + width / 2;
  const candleWidth = Math.max(3, Math.min(width * 0.72, 14));
  const candleX = cx - candleWidth / 2;
  const bodyY = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

  return (
    <g className="recharts-candlestick-group">
      <line
        x1={cx}
        y1={y}
        x2={cx}
        y2={y + height}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Candle Body: Open to Close */}
      <rect
        x={candleX}
        y={bodyY}
        width={candleWidth}
        height={bodyHeight}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        rx={1}
      />
    </g>
  );
};

export const ChartsPage: React.FC<ChartsPageProps> = ({ data, theme }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const [timeframe, setTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [chartType, setChartType] = useState<'Candlestick' | 'Line'>('Candlestick');
  const [overlays, setOverlays] = useState<string[]>(['SMA20', 'SMA50', 'Bollinger Bands']);
  const [oscillator, setOscillator] = useState<'RSI' | 'MACD'>('RSI');
  const [hoveredBar, setHoveredBar] = useState<any | null>(null);

  const isDark = theme === 'Dark';
  const patterns = detectPatterns(data.df);

  const toggleOverlay = (name: string) => {
    if (overlays.includes(name)) {
      setOverlays(overlays.filter((o) => o !== name));
    } else {
      setOverlays([...overlays, name]);
    }
  };

  const displayBars = useMemo(() => {
    if (timeframe === 'Daily') return data.df;
    const chunkSize = timeframe === 'Weekly' ? 5 : 21;
    const result: typeof data.df = [];
    for (let i = 0; i < data.df.length; i += chunkSize) {
      const chunk = data.df.slice(i, i + chunkSize);
      if (!chunk.length) continue;
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const high = Math.max(...chunk.map((c) => c.high));
      const low = Math.min(...chunk.map((c) => c.low));
      const volume = chunk.reduce((sum, c) => sum + (c.volume || 0), 0);
      result.push({
        ...last,
        open: first.open,
        high,
        low,
        close: last.close,
        volume,
      });
    }
    return result;
  }, [data.df, timeframe]);

  const chartData = useMemo(() => {
    return displayBars.map((b) => ({
      date: b.date.slice(5),
      fullDate: b.date,
      close: b.close,
      open: b.open,
      high: b.high,
      low: b.low,
      wickRange: [b.low, b.high],
      volume: b.volume,
      sma20: overlays.includes('SMA20') ? b.sma20 : undefined,
      sma50: overlays.includes('SMA50') ? b.sma50 : undefined,
      sma200: overlays.includes('SMA200') ? b.sma200 : undefined,
      ema20: overlays.includes('EMA20') ? b.ema20 : undefined,
      bbUpper: overlays.includes('Bollinger Bands') ? b.bbUpper : undefined,
      bbMiddle: overlays.includes('Bollinger Bands') ? b.bbMiddle : undefined,
      bbLower: overlays.includes('Bollinger Bands') ? b.bbLower : undefined,
      supertrend: overlays.includes('Supertrend') ? b.supertrend : undefined,
      fib382: overlays.includes('Fibonacci') ? b.fib382 : undefined,
      fib618: overlays.includes('Fibonacci') ? b.fib618 : undefined,
      pivotP: overlays.includes('Pivot Points') ? b.pivotP : undefined,
      rsi14: b.rsi14,
      macd: b.macd,
      macdSignal: b.macdSignal,
      macdHist: b.macdHist,
    }));
  }, [displayBars, overlays]);

  const activeCandle = hoveredBar || chartData[chartData.length - 1];
  const activeChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const activeChangePct = activeCandle && activeCandle.open > 0 ? (activeChange / activeCandle.open) * 100 : 0;
  const isUp = activeChange >= 0;

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;

    const candleUp = p.close >= p.open;
    const dayChg = p.close - p.open;
    const dayChgPct = p.open > 0 ? (dayChg / p.open) * 100 : 0;

    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[210px] pointer-events-none">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 font-bold">
          <span className="text-slate-300 font-mono">{p.fullDate || p.date}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
              candleUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {candleUp ? 'Bullish' : 'Bearish'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div>
            <span className="text-slate-400 font-medium">Open: </span>
            <strong className="text-slate-100 font-mono">{data.currencySymbol}{p.open?.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">High: </span>
            <strong className="text-emerald-400 font-mono">{data.currencySymbol}{p.high?.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Low: </span>
            <strong className="text-rose-400 font-mono">{data.currencySymbol}{p.low?.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Close: </span>
            <strong className="text-slate-100 font-mono">{data.currencySymbol}{p.close?.toFixed(2)}</strong>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Movement:</span>
          <strong className={`font-mono ${candleUp ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
            {dayChg >= 0 ? '+' : ''}{data.currencySymbol}{dayChg.toFixed(2)} ({dayChgPct >= 0 ? '+' : ''}{dayChgPct.toFixed(2)}%)
          </strong>
        </div>

        {p.volume !== undefined && (
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Volume:</span>
            <span className="font-mono text-slate-200">{Number(p.volume).toLocaleString()}</span>
          </div>
        )}

        {payload.some((item: any) => item.dataKey && item.dataKey !== 'wickRange' && item.dataKey !== 'close') && (
          <div className="pt-1 border-t border-slate-800/80 space-y-0.5 text-[10px]">
            {payload.map((item: any) => {
              if (item.dataKey === 'wickRange' || item.dataKey === 'close' || item.value === undefined) return null;
              return (
                <div key={item.dataKey} className="flex items-center justify-between">
                  <span style={{ color: item.color || item.stroke }}>{item.name}:</span>
                  <span className="font-mono text-slate-200">{data.currencySymbol}{Number(item.value).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Timeframe:</span>
          {(['Daily', 'Weekly', 'Monthly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                timeframe === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Type:</span>
          {(['Line', 'Candlestick'] as const).map((ct) => (
            <button
              key={ct}
              onClick={() => setChartType(ct)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                chartType === ct
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {ct}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Oscillator:</span>
          {(['RSI', 'MACD'] as const).map((osc) => (
            <button
              key={osc}
              onClick={() => setOscillator(osc)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                oscillator === osc
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {osc}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> Technical Overlays:
        </span>
        {['SMA20', 'SMA50', 'SMA200', 'EMA20', 'Bollinger Bands', 'Supertrend', 'Fibonacci', 'Pivot Points'].map((ov) => {
          const active = overlays.includes(ov);
          return (
            <button
              key={ov}
              onClick={() => toggleOverlay(ov)}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                active
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ov}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>{data.displaySymbol} Price Action ({timeframe})</span>
              {chartType === 'Candlestick' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Candlestick Active
                </span>
              )}
              <a
                href={getNseStockUrl(data.displaySymbol, data.market)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-colors"
                title={`Directly open ${data.displaySymbol} page on NSE India`}
              >
                <span>NSE Quote</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </h3>
            {activeCandle && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                <span>Date: <strong className="text-slate-800 dark:text-slate-200">{activeCandle.fullDate || activeCandle.date}</strong></span>
                <span>O: <strong className="text-slate-800 dark:text-slate-200">{data.currencySymbol}{activeCandle.open?.toFixed(2)}</strong></span>
                <span>H: <strong className="text-emerald-600 dark:text-emerald-400">{data.currencySymbol}{activeCandle.high?.toFixed(2)}</strong></span>
                <span>L: <strong className="text-rose-600 dark:text-rose-400">{data.currencySymbol}{activeCandle.low?.toFixed(2)}</strong></span>
                <span>C: <strong className="text-slate-800 dark:text-slate-200">{data.currencySymbol}{activeCandle.close?.toFixed(2)}</strong></span>
                <span className={isUp ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                  ({isUp ? '+' : ''}{data.currencySymbol}{activeChange.toFixed(2)} • {isUp ? '+' : ''}{activeChangePct.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-xs text-slate-400 block">Latest Price:</span>
            <div className="flex items-baseline justify-end gap-1.5">
              <strong className="text-base font-black text-slate-900 dark:text-white">
                {data.currencyFmt(data.latestPrice)}
              </strong>
              <span className={`text-xs font-bold ${data.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ({data.change >= 0 ? '+' : '-'}{data.currencySymbol}{Math.abs(data.change).toFixed(2)} • {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {chartType === 'Candlestick' && (
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-3.5 bg-emerald-500 rounded-sm inline-block border border-emerald-600" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Bullish Candle (Close ≥ Open)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-3.5 bg-rose-500 rounded-sm inline-block border border-rose-600" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Bearish Candle (Close &lt; Open)</span>
            </div>
          </div>
        )}

        <div className="h-84 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              onMouseMove={(state: any) => {
                if (state && state.activePayload && state.activePayload[0]) {
                  setHoveredBar(state.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setHoveredBar(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

              {chartType === 'Candlestick' ? (
                <Bar
                  dataKey="wickRange"
                  name="Candlestick (OHLC)"
                  shape={<CandlestickShape />}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#2563eb"
                  name="Close Price"
                  strokeWidth={2.5}
                  dot={false}
                />
              )}

              {overlays.includes('SMA20') && <Line type="monotone" dataKey="sma20" stroke="#f59e0b" name="SMA20" strokeWidth={1.5} dot={false} />}
              {overlays.includes('SMA50') && <Line type="monotone" dataKey="sma50" stroke="#10b981" name="SMA50" strokeWidth={1.5} dot={false} />}
              {overlays.includes('SMA200') && <Line type="monotone" dataKey="sma200" stroke="#ef4444" name="SMA200" strokeWidth={1.5} dot={false} />}
              {overlays.includes('EMA20') && <Line type="monotone" dataKey="ema20" stroke="#8b5cf6" name="EMA20" strokeWidth={1.5} dot={false} />}
              {overlays.includes('Bollinger Bands') && (
                <>
                  <Line type="monotone" dataKey="bbUpper" stroke="#06b6d4" name="BB Upper" strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="bbLower" stroke="#06b6d4" name="BB Lower" strokeDasharray="3 3" dot={false} />
                </>
              )}
              {overlays.includes('Supertrend') && <Line type="monotone" dataKey="supertrend" stroke="#ec4899" name="Supertrend" strokeWidth={1.8} dot={false} />}
              {overlays.includes('Fibonacci') && (
                <>
                  <Line type="monotone" dataKey="fib382" stroke="#d97706" name="Fib 38.2%" strokeDasharray="2 2" dot={false} />
                  <Line type="monotone" dataKey="fib618" stroke="#059669" name="Fib 61.8%" strokeDasharray="2 2" dot={false} />
                </>
              )}
              {overlays.includes('Pivot Points') && <Line type="monotone" dataKey="pivotP" stroke="#6366f1" name="Pivot (P)" strokeDasharray="4 4" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {oscillator === 'RSI' ? 'Relative Strength Index (RSI 14)' : 'MACD (12, 26, 9)'}
            </h4>
            <span className="text-xs text-slate-500 font-mono">
              {oscillator === 'RSI' ? `Current: ${data.df[data.df.length - 1]?.rsi14 || 50}` : `Hist: ${data.df[data.df.length - 1]?.macdHist || 0}`}
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {oscillator === 'RSI' ? (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                  <YAxis domain={[0, 100]} stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Line type="monotone" dataKey="rsi14" stroke="#8b5cf6" name="RSI14" strokeWidth={2} dot={false} />
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                  <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Line type="monotone" dataKey="macd" stroke="#2563eb" name="MACD" dot={false} />
                  <Line type="monotone" dataKey="macdSignal" stroke="#ef4444" name="Signal" dot={false} />
                  <Bar dataKey="macdHist" fill="#10b981" name="Histogram" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Trading Volume</h4>
            <span className="text-xs text-slate-500 font-mono">
              Latest: {data.df[data.df.length - 1]?.volume.toLocaleString()} shares
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 9 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="volume" fill="#0284c7" name="Volume" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-cyan-500" />
          Detected Candlestick & Chart Patterns (Last 15 Sessions)
        </h4>

        {patterns.length === 0 ? (
          <p className="text-xs text-slate-400">No classic reversal or continuation patterns detected in recent sessions.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {patterns.map((pat, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{pat.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      pat.type === 'bullish'
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : pat.type === 'bearish'
                        ? 'bg-rose-500/20 text-rose-500'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {pat.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{pat.description}</p>
                <span className="text-[10px] text-slate-400 font-mono block pt-1">Observed on: {pat.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartsPage;
