import React, { useState } from 'react';
import { PredictionTrustCard } from '../components/PredictionTrustCard';
import {
  TrendingUp,
  Award,
  Layers,
  Palette,
  Download,
  CheckCircle,
  HelpCircle,
  BarChart,
  ArrowRight,
  Sparkles,
  Activity,
  Calendar,
  Compass,
  Sliders,
  TrendingDown,
  Flame,
  Zap,
  Gauge,
  AlertTriangle,
  Info,
  Clock,
  BarChart2,
  Filter,
  MessageSquare,
  ArrowLeftRight,
  BookOpen,
  Rocket,
  Search,
  Building,
  Coins,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Heart,
  Cpu,
  Bot,
  Mic,
  Volume2,
  Globe,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { AnalysisResult } from '../types';
import { PageId } from '../components/Sidebar';
import { formatCurrencyValue } from '../utils/marketData';
import { StockChatbot } from '../components/StockChatbot';

interface HomePageProps {
  data: AnalysisResult;
  onNavigate: (page: PageId) => void;
  theme: 'Light' | 'Dark';
}

export const HomePage: React.FC<HomePageProps> = ({ data, onNavigate, theme }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }

  const [showCards, setShowCards] = useState(true);
  const [isChatbotFloatingOpen, setIsChatbotFloatingOpen] = useState(false);
  const [featuresFilter, setFeaturesFilter] = useState<'all' | 'ai' | 'trading' | 'tools'>('all');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<7 | 14 | 30>(30);
  const [showMA50Overlay, setShowMA50Overlay] = useState(true);
  const [showValidationMA50, setShowValidationMA50] = useState(true);

  const [volatilityMetric, setVolatilityMetric] = useState<'range' | 'return'>('range');
  const [selectedVolIndex, setSelectedVolIndex] = useState<number | null>(null);

  const isDark = theme === 'Dark';

  const validationChartData = data.df.map((bar, idx) => {
    const isTrain = idx < data.trainLen;
    const testIdx = idx - data.trainLen;
    return {
      date: bar.date.slice(5),
      training: isTrain ? bar.close : null,
      actual: !isTrain ? bar.close : null,
      predicted: !isTrain && testIdx >= 0 && testIdx < data.predictions.length ? data.predictions[testIdx] : null,
      ma50: bar.sma50 ?? null,
    };
  });

  const lastBar = data.df[data.df.length - 1];
  const baseDate = lastBar ? new Date(lastBar.date) : new Date();
  const historicalCloses = data.df.map((b) => b.close);
  const rollingCloses = [...historicalCloses];

  const fallbackMA50 = rollingCloses.length > 0
    ? rollingCloses.slice(-50).reduce((sum, p) => sum + p, 0) / Math.max(1, Math.min(rollingCloses.length, 50))
    : (data.latestPrice || 100);
  const initialMA50 = Number.isFinite(lastBar?.sma50) && (lastBar?.sma50 as number) > 0
    ? (lastBar?.sma50 as number)
    : fallbackMA50;

  const baseDivergence = initialMA50 > 0 ? (((data.latestPrice - initialMA50) / initialMA50) * 100) : 0;

  const allForecastPoints = [
    {
      day: 'Today',
      label: 'Today',
      date: lastBar ? lastBar.date.slice(5) : 'Today',
      fullDate: lastBar ? lastBar.date : 'Today',
      predicted: data.latestPrice,
      ma50: Number(initialMA50.toFixed(2)),
      divergence: Number.isFinite(baseDivergence) ? Number(baseDivergence.toFixed(2)) : 0,
    },
    ...(data.forecast30 || []).map((price, idx) => {
      rollingCloses.push(price);
      const currentWindow = rollingCloses.slice(-50);
      const currentMA50 = currentWindow.length > 0 ? currentWindow.reduce((sum, p) => sum + p, 0) / currentWindow.length : initialMA50;
      const divergencePct = currentMA50 > 0 ? ((price - currentMA50) / currentMA50) * 100 : 0;

      const fDate = new Date(baseDate);
      fDate.setDate(fDate.getDate() + (idx + 1));
      const fullDate = fDate.toISOString().split('T')[0];

      return {
        day: `D+${idx + 1}`,
        label: `D+${idx + 1}`,
        date: fullDate.slice(5),
        fullDate,
        predicted: price,
        ma50: Number(currentMA50.toFixed(2)),
        divergence: Number(divergencePct.toFixed(2)),
      };
    }),
  ];

  const displayedForecastData = allForecastPoints.slice(0, forecastHorizon + 1);

  const targetPrice = (data.forecast30 && data.forecast30[forecastHorizon - 1]) || data.latestPrice;
  const expectedChange = targetPrice - data.latestPrice;
  const expectedChangePct = data.latestPrice > 0 ? (expectedChange / data.latestPrice) * 100 : 0;

  const horizonPredictions = (data.forecast30 || []).slice(0, forecastHorizon);
  const minForecast = horizonPredictions.length ? Math.min(...horizonPredictions) : data.latestPrice;
  const maxForecast = horizonPredictions.length ? Math.max(...horizonPredictions) : data.latestPrice;

  const finalPoint = displayedForecastData[displayedForecastData.length - 1];
  const finalMA50 = finalPoint?.ma50 || initialMA50;
  const isAboveMA50 = targetPrice >= finalMA50;
  const finalSpread = finalMA50 > 0 ? (((targetPrice - finalMA50) / finalMA50) * 100) : 0;
  const finalSpreadPct = finalSpread.toFixed(2);
  const finalSpreadNum = Number(finalSpreadPct);

  const last30Bars = data.df.slice(-30);
  const volatilityBars = last30Bars.map((bar, idx) => {
    const prevBar = idx > 0 ? last30Bars[idx - 1] : bar;
    const isCurrent = idx === last30Bars.length - 1;

    const high = isCurrent && bar.high ? Math.max(bar.high, data.latestPrice) : bar.high;
    const low = isCurrent && bar.low ? Math.min(bar.low, data.latestPrice) : bar.low;
    const close = isCurrent ? data.latestPrice : bar.close;

    const rangePct = low > 0 ? ((high - low) / low) * 100 : 0;
    const returnPct = prevBar.close > 0 ? ((close - prevBar.close) / prevBar.close) * 100 : 0;
    const absReturn = Math.abs(returnPct);

    return {
      index: idx,
      dayNum: idx + 1,
      dayOffset: last30Bars.length - idx - 1,
      date: bar.date,
      shortDate: bar.date.slice(5),
      open: bar.open,
      high,
      low,
      close,
      volume: bar.volume,
      rangePct: parseFloat(rangePct.toFixed(2)),
      returnPct: parseFloat(returnPct.toFixed(2)),
      absReturn: parseFloat(absReturn.toFixed(2)),
      isCurrent,
    };
  });

  const avg30Range = volatilityBars.length > 0
    ? parseFloat((volatilityBars.reduce((sum, b) => sum + b.rangePct, 0) / volatilityBars.length).toFixed(2))
    : 1.5;

  const avg30Return = volatilityBars.length > 0
    ? parseFloat((volatilityBars.reduce((sum, b) => sum + b.absReturn, 0) / volatilityBars.length).toFixed(2))
    : 1.0;

  const returnsList = volatilityBars.slice(1).map((b) => b.returnPct / 100);
  const meanRet = returnsList.length ? returnsList.reduce((a, b) => a + b, 0) / returnsList.length : 0;
  const variance = returnsList.length
    ? returnsList.reduce((acc, r) => acc + Math.pow(r - meanRet, 2), 0) / returnsList.length
    : 0;
  const realizedVol30 = parseFloat((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));

  const currentVolBar = volatilityBars[volatilityBars.length - 1] || {
    rangePct: Math.abs(data.changePct),
    absReturn: Math.abs(data.changePct),
    returnPct: data.changePct,
    date: 'Today',
    high: data.latestPrice,
    low: data.latestPrice,
    open: data.latestPrice,
    close: data.latestPrice,
    volume: 0,
    isCurrent: true,
  };

  const currentFluctuation =
    volatilityMetric === 'range' ? currentVolBar.rangePct : currentVolBar.absReturn;
  const benchmarkAvg = volatilityMetric === 'range' ? avg30Range : avg30Return;

  const volRatio = benchmarkAvg > 0 ? parseFloat((currentFluctuation / benchmarkAvg).toFixed(2)) : 1;
  const volDiffPct =
    benchmarkAvg > 0
      ? parseFloat((((currentFluctuation - benchmarkAvg) / benchmarkAvg) * 100).toFixed(1))
      : 0;

  const minRange30 = volatilityBars.length > 0
    ? Math.min(...volatilityBars.map((b) => (volatilityMetric === 'range' ? b.rangePct : b.absReturn)))
    : 0;
  const maxRange30 = volatilityBars.length > 0
    ? Math.max(...volatilityBars.map((b) => (volatilityMetric === 'range' ? b.rangePct : b.absReturn)))
    : 3;

  const inspectedBar =
    selectedVolIndex !== null && volatilityBars[selectedVolIndex]
      ? volatilityBars[selectedVolIndex]
      : currentVolBar;

  const getHeatmapStyle = (val: number) => {
    if (val < 1.0) {
      return {
        bg: isDark ? 'bg-emerald-950/60' : 'bg-emerald-50',
        border: isDark ? 'border-emerald-800/60' : 'border-emerald-200',
        text: isDark ? 'text-emerald-300' : 'text-emerald-800',
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        level: 'Calm (< 1.0%)',
      };
    }
    if (val < 1.8) {
      return {
        bg: isDark ? 'bg-cyan-950/60' : 'bg-cyan-50',
        border: isDark ? 'border-cyan-800/60' : 'border-cyan-200',
        text: isDark ? 'text-cyan-300' : 'text-cyan-800',
        badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        level: 'Typical (1.0%–1.8%)',
      };
    }
    if (val < 2.8) {
      return {
        bg: isDark ? 'bg-amber-950/60' : 'bg-amber-50',
        border: isDark ? 'border-amber-800/60' : 'border-amber-200',
        text: isDark ? 'text-amber-300' : 'text-amber-800',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        level: 'Moderate (1.8%–2.8%)',
      };
    }
    if (val < 4.0) {
      return {
        bg: isDark ? 'bg-orange-950/60' : 'bg-orange-50',
        border: isDark ? 'border-orange-800/60' : 'border-orange-200',
        text: isDark ? 'text-orange-300' : 'text-orange-800',
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        level: 'Elevated (2.8%–4.0%)',
      };
    }
    return {
      bg: isDark ? 'bg-rose-950/70' : 'bg-rose-50',
      border: isDark ? 'border-rose-800/70' : 'border-rose-200',
      text: isDark ? 'text-rose-300' : 'text-rose-800',
      badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      level: 'Extreme Spike (≥ 4.0%)',
    };
  };

  let regimeDetails = {
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    title: 'Normal Market Equilibrium',
    desc: 'Current price fluctuations match typical 30-day baseline dispersion.',
  };
  if (volRatio < 0.75) {
    regimeDetails = {
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      title: 'Subdued / Low Volatility Compression',
      desc: 'Current intraday fluctuation is calm and compressed relative to historical 30-day swings.',
    };
  } else if (volRatio > 1.75) {
    regimeDetails = {
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      title: 'High Volatility Spike Alert',
      desc: 'Current swings exceed 1.75x historical levels, signaling heavy institutional momentum or catalyst-driven flow.',
    };
  } else if (volRatio > 1.25) {
    regimeDetails = {
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      title: 'Elevated Fluctuation',
      desc: 'Intraday swings are moderately higher than average, indicating expanding trading ranges.',
    };
  }

  const handleDownloadCSV = () => {
    const headers = 'Date,Open,High,Low,Close,Volume\n';
    const rows = data.df
      .map((b) => `${b.date},${b.open},${b.high},${b.low},${b.close},${b.volume}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.displaySymbol}_historical_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* About PredictX Platform & Feature Hub Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2540] via-[#10325c] to-[#18427a] p-6 sm:p-8 text-white shadow-xl border border-cyan-500/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Stock Intelligence & F&O Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              PredictX — AI Stock Prediction & Quantitative Suite
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-medium">
              A comprehensive quantitative platform built for Indian (NSE / BSE) and US Equities. Features multi-horizon 30-day neural projections, authentic Hinglish conversational AI, live Black-Scholes option chain Greeks, side-by-side stock comparison, and real-time IPO Grey Market Premium (GMP).
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <span className="font-extrabold text-cyan-300">
                Engineered with Pride by Ajay
              </span>
              <span className="text-blue-300">•</span>
              <span className="text-blue-200/80">
                © 2026 PredictX. All Rights Reserved.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 flex-shrink-0">
            <button
              onClick={() => onNavigate('ask')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask PredictX (Hinglish AI)</span>
            </button>
            <button
              onClick={() => onNavigate('compare')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 text-cyan-300" />
              <span>Split-View Compare Stocks</span>
            </button>
            <button
              onClick={() => setShowCards(!showCards)}
              className="px-4 py-2 rounded-xl bg-blue-900/40 hover:bg-blue-900/60 border border-blue-400/30 text-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {showCards ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showCards ? 'Features Hub Chhupayein' : 'All 12 Features Dekhein'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 12 Interactive Feature Hub Cards */}
      {showCards && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>PredictX Feature Directory</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  12 Key Modules
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Directly kisi bhi feature par click karein aur instantly use explore karein.
              </p>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFeaturesFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  featuresFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                All (12)
              </button>
              <button
                onClick={() => setFeaturesFilter('ai')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  featuresFilter === 'ai'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                AI & Forecasting
              </button>
              <button
                onClick={() => setFeaturesFilter('trading')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  featuresFilter === 'trading'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                F&O & Trading
              </button>
              <button
                onClick={() => setFeaturesFilter('tools')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  featuresFilter === 'tools'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Technical & Research
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {[
              {
                id: 'ask' as PageId,
                title: 'Ask PredictX (Hinglish)',
                category: 'ai' as const,
                description: 'Conversational financial assistant answering Buy/Sell, Target, Stop Loss & setups in Hinglish.',
                icon: MessageSquare,
                badge: 'DESI AI',
                badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
                highlights: ['Hinglish queries', 'Target/SL setups', 'RSI & trend advice'],
              },
              {
                id: 'compare' as PageId,
                title: 'Split-View Stock Compare',
                category: 'trading' as const,
                description: 'Side-by-side simultaneous real-time comparison with dual normalized return charts and AI scorecard.',
                icon: ArrowLeftRight,
                badge: 'SPLIT-VIEW',
                badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
                highlights: ['Simultaneous dual fetch', 'Normalized % charts', 'Winner verdict AI'],
              },
              {
                id: 'options' as PageId,
                title: 'Live Option Chain (NSE F&O)',
                category: 'trading' as const,
                description: 'Fast derivatives desk for NIFTY, BANK NIFTY with real-time Black-Scholes Greeks, PCR & Max Pain.',
                icon: Layers,
                badge: 'FAST GREEKS',
                badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
                highlights: ['Delta, Gamma, Theta, IV', 'Put-Call Ratio (PCR)', 'Max Pain pegging'],
              },
              {
                id: 'journal' as PageId,
                title: 'Trade Journal & Audit',
                category: 'trading' as const,
                description: 'Log Buy/Sell trades with entry, exit, stop loss, trading emotion tag, strategy, and net equity curve.',
                icon: BookOpen,
                badge: 'LEDGER',
                badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                highlights: ['Automatic P&L', 'Discipline & emotions', 'Cumulative return curve'],
              },
              {
                id: 'trackrecord' as PageId,
                title: 'Track Record (Accuracy)',
                category: 'ai' as const,
                description: 'Model ka asli test: purane data par backtest aur aapki saved predictions ka 7-din baad ka result.',
                icon: Award,
                badge: 'LIVE TEST',
                badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                highlights: ['Walk-forward backtest', 'Saved prediction log', 'Range hit rate'],
              },
              {
                id: 'ipo' as PageId,
                title: 'IPO Predictor & Live GMP',
                category: 'trading' as const,
                description: 'Live Grey Market Premium scraped from InvestorGain & IPOWatch with listing gain scoring model.',
                icon: Rocket,
                badge: 'LIVE GMP',
                badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                highlights: ['InvestorGain + IPOWatch', 'Live ₹ & % GMP', 'Subscription evaluator'],
              },
              {
                id: 'charts' as PageId,
                title: 'Technical Charts & Deep Dive',
                category: 'tools' as const,
                description: 'Interactive candlesticks, OHLC volume, 20+ technical indicators across Daily, Weekly, and Monthly.',
                icon: BarChart2,
                badge: 'MULTI-TIMEFRAME',
                badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
                highlights: ['EMA, SMA & Bollinger', 'RSI & MACD oscillators', 'Official NSE links'],
              },
              {
                id: 'ai' as PageId,
                title: 'AI Signals & Risk Radar',
                category: 'ai' as const,
                description: 'Composite quantitative signal score (-100 to +100), Value at Risk, and maximum historical drawdown.',
                icon: Cpu,
                badge: 'QUANT SCORE',
                badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
                highlights: ['Composite AI scoring', 'Annualized volatility', 'Downside risk levels'],
              },
              {
                id: 'scanners' as PageId,
                title: 'Intraday & Swing Scanners',
                category: 'trading' as const,
                description: 'Real-time market scanner tracking 52-week high breakouts, unusual volume surges, and momentum movers.',
                icon: Search,
                badge: 'SCANNER',
                badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
                highlights: ['Breakout detection', 'Volume surge alerts', 'Momentum rankings'],
              },
              {
                id: 'dividends' as PageId,
                title: 'Dividend Radar & Yield Calendar',
                category: 'tools' as const,
                description: 'High-yield radar across Indian & US equities, ex-dividend payment schedules, and portfolio payout projections.',
                icon: Coins,
                badge: 'INCOME',
                badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
                highlights: ['Yield rankings', 'Ex-date calendar', 'Passive income calc'],
              },
              {
                id: 'company' as PageId,
                title: 'Company Financials & Deep Dive',
                category: 'tools' as const,
                description: 'Fundamentals breakdown: P/E, P/B, EPS, Return on Equity, Debt-to-Equity, quarterly balance sheet.',
                icon: Building,
                badge: 'FUNDAMENTALS',
                badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
                highlights: ['Balance sheet & P&L', 'Valuation multiples', 'Sector peers benchmark'],
              },
              {
                id: 'strategy' as PageId,
                title: 'Strategy Lab (Backtesting)',
                category: 'tools' as const,
                description: 'Simulate quantitative trading rules (SMA crossover, RSI mean reversion) on historical data with Sharpe ratio.',
                icon: ShieldCheck,
                badge: 'BACKTEST',
                badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                highlights: ['Strategy simulation', 'Paper trade execution', 'Sharpe & win rate'],
              },
            ]
              .filter((card) => featuresFilter === 'all' || card.category === featuresFilter)
              .map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.id}
                    onClick={() => onNavigate(card.id)}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-cyan-500/50 dark:hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/10 group-hover:text-cyan-500 transition-all">
                          <Icon className="w-4 h-4" />
                        </div>
                        {card.badge && (
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${card.badgeColor}`}
                          >
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {card.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {card.description}
                      </p>
                      <ul className="mt-2.5 space-y-1">
                        {card.highlights.map((h, i) => (
                          <li
                            key={i}
                            className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium"
                          >
                            <span className="w-1 h-1 rounded-full bg-cyan-500 flex-shrink-0"></span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Launch Module</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {data.displaySymbol} <span className="text-sm font-normal text-slate-500">· {data.market}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{data.info.longName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                data.signal === 'BUY'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : data.signal === 'SELL'
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              Signal: {data.signal} ({data.score > 0 ? '+' : ''}{data.score})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Current Price</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {data.currencyFmt(data.latestPrice)}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Change (1D)</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold ${
                  data.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {data.change >= 0 ? '+' : '-'}
                {data.currencySymbol}
                {Math.abs(data.change).toFixed(2)}
              </span>
              <span
                className={`text-xs font-semibold ${
                  data.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ({data.changePct >= 0 ? '+' : ''}
                {data.changePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Data Points</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{data.df.length} bars</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block" title="Validation data par agle din ki direction kitni baar sahi nikli">Direction hit-rate</span>
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{data.confidence}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                AI 30-Day Price Forecast & Trend Projection
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/25">
                  Multi-Day AI
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Forward projection modeled on quantitative drift, cyclicality, and mean-reversion, benchmarked against the 50-day moving average (MA-50).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                onClick={() => setForecastHorizon(7)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  forecastHorizon === 7
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setForecastHorizon(14)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  forecastHorizon === 14
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                14 Days
              </button>
              <button
                onClick={() => setForecastHorizon(30)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  forecastHorizon === 30
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30 Days
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300 select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={showMA50Overlay}
                onChange={(e) => setShowMA50Overlay(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-amber-500 rounded-full"></span>
                MA-50 Overlay
              </span>
            </label>

            <button
              onClick={() => onNavigate('ai')}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              Full AI Module <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {forecastHorizon}-Day Expected Target
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {data.currencyFmt(targetPrice)}
              </span>
              <span
                className={`text-xs font-bold ${
                  expectedChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {expectedChange >= 0 ? '+' : ''}
                {expectedChangePct.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Projected Price Range
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-slate-500">Low:</span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{data.currencyFmt(minForecast)}</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-xs font-semibold text-slate-500">High:</span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{data.currencyFmt(maxForecast)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              MA-50 Benchmark
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                {data.currencyFmt(finalMA50)}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                (Baseline)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              MA-50 Trend Alignment
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  isAboveMA50
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                {isAboveMA50 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isAboveMA50 ? `Bullish (${finalSpreadPct > '0' ? '+' : ''}${finalSpreadPct}%)` : `Below MA-50 (${finalSpreadPct}%)`}
              </span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayedForecastData}
              margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="label"
                stroke={isDark ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke={isDark ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${data.currencySymbol}${Number(v).toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-2 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-4 font-bold border-b border-slate-800 pb-1.5">
                          <span className="text-cyan-300">
                            {item.day === 'Today' ? 'Today (Current Base)' : `Day ${item.day.replace('D+', '')}`}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{item.fullDate}</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> AI Predicted Price:
                            </span>
                            <span className="font-extrabold text-sm text-white">
                              {data.currencyFmt(item.predicted)}
                            </span>
                          </div>

                          {showMA50Overlay && item.ma50 !== undefined && (
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span> 50-Day Moving Avg:
                              </span>
                              <span className="font-bold text-amber-200">
                                {data.currencyFmt(item.ma50)}
                              </span>
                            </div>
                          )}

                          {showMA50Overlay && item.divergence !== undefined && (
                            <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400">Spread vs MA-50:</span>
                              <span
                                className={`font-bold ${
                                  item.divergence >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {item.divergence >= 0 ? '+' : ''}
                                {item.divergence}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey="predicted"
                name="AI Predicted Price (Trajectory)"
                stroke="#00bcd4"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#00bcd4' }}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
              />
              {showMA50Overlay && (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  name="50-Day Moving Average (MA-50 Overlay)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 1.5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-300">
              {isAboveMA50
                ? `Bullish Structural Continuation: The AI model projects ${data.displaySymbol} sustaining prices above its rolling 50-day moving average (${data.currencyFmt(finalMA50)}), validating positive upward bias.`
                : `Defensive Pullback Warning: The neural projection expects ${data.displaySymbol} trading below its 50-day moving average (${data.currencyFmt(finalMA50)}), cautioning against immediate aggressive breakouts.`}
            </span>
          </div>
          <span className="text-slate-400 dark:text-slate-500 text-[11px] flex-shrink-0 font-medium">
            Forecast Horizon: Next {forecastHorizon} trading days
          </span>
        </div>
      </div>

      <PredictionTrustCard data={data} onNavigate={onNavigate} />

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Market Volatility & Price Fluctuation Heat Map
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-500/25">
                  Historical 30D vs Current
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparing live stock price dispersion against the 30-day baseline trading range across individual market sessions.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setVolatilityMetric('range')}
              className={`px-3 py-1 rounded-lg transition-all ${
                volatilityMetric === 'range'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Intraday Range (H-L %)
            </button>
            <button
              onClick={() => setVolatilityMetric('return')}
              className={`px-3 py-1 rounded-lg transition-all ${
                volatilityMetric === 'return'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Net Movement (|Return| %)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Current Live Fluctuation
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {currentFluctuation.toFixed(2)}%
              </span>
              <span
                className={`text-xs font-bold ${
                  volDiffPct >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {volDiffPct >= 0 ? '+' : ''}
                {volDiffPct}% vs 30D
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              High-Low spread for {data.displaySymbol} today
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              30-Day Historical Avg
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                {benchmarkAvg.toFixed(2)}%
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                / session
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Normal daily swing baseline
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              30D Realized Volatility
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {realizedVol30}%
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                (Annualized)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Calculated standard deviation of returns
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Volatility Regime
            </span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${regimeDetails.badge}`}
              >
                <Zap className="w-3.5 h-3.5" />
                {volRatio}x · {regimeDetails.title}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Ratio of current to 30D average
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-500" />
              <span>Current Fluctuation Position in 30-Day Range:</span>
            </span>
            <span className="text-slate-800 dark:text-slate-200">
              Low: <strong className="text-emerald-500">{minRange30}%</strong> · Avg:{' '}
              <strong className="text-cyan-500">{benchmarkAvg}%</strong> · High:{' '}
              <strong className="text-rose-500">{maxRange30}%</strong>
            </span>
          </div>

          <div className="relative w-full h-3.5 rounded-full overflow-hidden bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 shadow-inner">
            {maxRange30 > minRange30 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-10"
                style={{
                  left: `${Math.min(98, Math.max(2, ((benchmarkAvg - minRange30) / (maxRange30 - minRange30)) * 100))}%`,
                }}
                title={`30-Day Average: ${benchmarkAvg}%`}
              />
            )}
            {maxRange30 > minRange30 && (
              <div
                className="absolute top-0 bottom-0 w-2.5 -ml-1 bg-slate-950 dark:bg-white rounded-full ring-2 ring-cyan-400 z-20 transition-all duration-500"
                style={{
                  left: `${Math.min(98, Math.max(2, ((currentFluctuation - minRange30) / (maxRange30 - minRange30)) * 100))}%`,
                }}
                title={`Current Session: ${currentFluctuation.toFixed(2)}%`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-0.5">
            <span>Calm Consolidation</span>
            <span>Historical Baseline ({benchmarkAvg}%)</span>
            <span>Extreme Volatility Spike</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-500" />
                30-Day Trading Session Heat Map Grid
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Click any trading session cell to inspect detailed pricing, range, and spread.
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="text-slate-400 font-semibold mr-1">Intensity:</span>
              <span className="px-2 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                &lt; 1% Calm
              </span>
              <span className="px-2 py-0.5 rounded border bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                1–1.8% Normal
              </span>
              <span className="px-2 py-0.5 rounded border bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400">
                1.8–2.8% Moderate
              </span>
              <span className="px-2 py-0.5 rounded border bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400">
                2.8–4% Elevated
              </span>
              <span className="px-2 py-0.5 rounded border bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400">
                ≥ 4% Spike
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-10 gap-2">
            {volatilityBars.map((item, idx) => {
              const val = volatilityMetric === 'range' ? item.rangePct : item.absReturn;
              const style = getHeatmapStyle(val);
              const isSelected = inspectedBar?.index === item.index;

              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedVolIndex(item.index)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                    style.bg
                  } ${style.border} ${
                    isSelected ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900 shadow-md scale-102 z-10' : ''
                  } ${
                    item.isCurrent
                      ? 'border-cyan-400/80 shadow-md ring-1 ring-cyan-400/50'
                      : 'hover:scale-[1.03] hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {item.shortDate}
                    </span>
                    {item.isCurrent && (
                      <span className="inline-flex items-center px-1 py-0.2 rounded text-[8px] font-black bg-cyan-500 text-slate-950 uppercase tracking-tighter animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="my-0.5">
                    <span className={`text-sm font-black block leading-none ${style.text}`}>
                      {val.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-black/5 dark:border-white/5 text-[9px] font-semibold">
                    <span className={item.returnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {item.returnPct >= 0 ? '+' : ''}
                      {item.returnPct}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {item.isCurrent ? 'Today' : `D-${item.dayOffset}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {inspectedBar && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-500" />
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Session Deep-Dive: {inspectedBar.date}</span>
                  {inspectedBar.isCurrent ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                      CURRENT SESSION (TODAY)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {inspectedBar.dayOffset} sessions ago
                    </span>
                  )}
                </h4>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Classification:</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                    getHeatmapStyle(
                      volatilityMetric === 'range' ? inspectedBar.rangePct : inspectedBar.absReturn
                    ).badge
                  }`}
                >
                  {
                    getHeatmapStyle(
                      volatilityMetric === 'range' ? inspectedBar.rangePct : inspectedBar.absReturn
                    ).level
                  }
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Open / Close</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {data.currencyFmt(inspectedBar.open)} → {data.currencyFmt(inspectedBar.close)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Day's High / Low</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {data.currencyFmt(inspectedBar.high)} / {data.currencyFmt(inspectedBar.low)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Intraday Swing (H-L)</span>
                <span className="font-black text-orange-600 dark:text-orange-400">
                  {inspectedBar.rangePct}%{' '}
                  <span className="text-[10px] font-normal text-slate-400">
                    ({data.currencySymbol}{(inspectedBar.high - inspectedBar.low).toFixed(2)})
                  </span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Session Return</span>
                <span
                  className={`font-black ${
                    inspectedBar.returnPct >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {inspectedBar.returnPct >= 0 ? '+' : ''}
                  {inspectedBar.returnPct}%
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">vs 30D Average</span>
                <span
                  className={`font-extrabold ${
                    inspectedBar.rangePct >= avg30Range
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {inspectedBar.rangePct >= avg30Range ? '+' : ''}
                  {(((inspectedBar.rangePct - avg30Range) / avg30Range) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>LSTM Price Prediction (Validation & Backtest)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated on 80% train / 20% test slice: Training (navy), Actual (amber), Predicted (emerald), overlaid with MA-50
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={showValidationMA50}
                onChange={(e) => setShowValidationMA50(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>MA-50 Overlay</span>
            </label>

            <button
              onClick={() => onNavigate('ai')}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              Full AI Forecast <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={validationChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="training" stroke="#0a2540" name="Training" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" stroke="#f59e0b" name="Actual" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="predicted" stroke="#10b981" name="Predicted" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              {showValidationMA50 && (
                <Line type="monotone" dataKey="ma50" stroke="#8b5cf6" name="MA-50 Overlay" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Historical Data</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest 10 daily trading sessions</p>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download full history (CSV)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Open</th>
                <th className="py-2.5 px-3">High</th>
                <th className="py-2.5 px-3">Low</th>
                <th className="py-2.5 px-3">Close</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {data.df
                .slice(-10)
                .reverse()
                .map((bar) => (
                  <tr key={bar.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold">{bar.date}</td>
                    <td className="py-2 px-3">{data.currencyFmt(bar.open)}</td>
                    <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400">{data.currencyFmt(bar.high)}</td>
                    <td className="py-2 px-3 text-rose-600 dark:text-rose-400">{data.currencyFmt(bar.low)}</td>
                    <td className="py-2 px-3 font-bold">{data.currencyFmt(bar.close)}</td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono">{bar.volume.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Ask PredictX AI Chatbot
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  Hinglish + Voice AI
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active on {data.displaySymbol}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type karein ya <strong>Mic (Voice AI)</strong> se bol kar poochhein — Buy/Sell view, Target, Stop Loss, RSI, aur technical breakdown!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('ask')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>Full Screen AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
          <StockChatbot
            data={data}
            onNavigate={onNavigate}
            theme={theme}
            mode="embedded"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Platform Overview & Architecture</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            PredictX — Complete Feature Ecosystem
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            PredictX is an all-in-one quantitative research and forecasting suite engineered specifically for Indian (NSE, BSE) & US equity and derivatives markets. Har module ko directly explore karein:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigate('ask')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-cyan-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mic className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                Voice AI + Hinglish
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
              Ask PredictX (Hinglish Voice AI)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mic se bol kar ya type karke target, stop loss, trading setups aur technical levels real-time Hinglish me jaanein.
            </p>
          </div>

          <div
            onClick={() => onNavigate('compare')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Split-View
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Split-View Stock Compare
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Do stocks ko ek sath side-by-side compare karein normalized ROI %, valuation metrics aur AI scorecard ke sath.
            </p>
          </div>

          <div
            onClick={() => onNavigate('options')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Instant Greeks
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Live Option Chain & Greeks Desk
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              NIFTY, BANK NIFTY ke Call/Put strikes, real-time Black-Scholes Greeks (Delta, Gamma, Theta, Vega), IV aur PCR.
            </p>
          </div>

          <div
            onClick={() => onNavigate('journal')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Audit Ledger
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Trade Journal & Discipline Log
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Trading entries/exits log karein, emotions (FOMO, Revenge, Calm) track karein aur cumulative P&L equity curve dekhein.
            </p>
          </div>

          <div
            onClick={() => onNavigate('trackrecord')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-amber-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Live test
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
              Verified Track Record
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PredictX ke historical calls ka transparent audit: Target hit vs Stop-loss hit ratio, win rate aur profit factor.
            </p>
          </div>

          <div
            onClick={() => onNavigate('ipo')}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-rose-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Rocket className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Live GMP
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
              IPO Predictor & Grey Market
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              InvestorGain aur IPOWatch se live Grey Market Premium (GMP), expected listing price aur AI Apply/Avoid verdict.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-base shadow-md">
                PX
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>PredictX Dashboard</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                    PRO v2.5
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Built for smart retail investors and algorithmic traders across NSE, BSE & US markets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700/80 p-3.5 sm:p-4 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-md">
              AK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Lead Developer & Creator
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified
                </span>
              </div>
              <h4 className="text-base font-black text-white">
                Ajay Kumar
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                Full Stack & Quant Engineer • <a href="https://github.com/Ajaykumar187" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@Ajaykumar187</a>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px] font-bold mr-1">Direct Jump:</span>
            <button
              onClick={() => onNavigate('home')}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate('ask')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Ask AI (Voice)
            </button>
            <button
              onClick={() => onNavigate('compare')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Compare
            </button>
            <button
              onClick={() => onNavigate('options')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Option Chain
            </button>
            <button
              onClick={() => onNavigate('journal')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Trade Journal
            </button>
            <button
              onClick={() => onNavigate('trackrecord')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Track Record
            </button>
            <button
              onClick={() => onNavigate('ipo')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              IPO GMP
            </button>
          </div>

          <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
            <span>© 2026 PredictX. Crafted by</span>
            <span className="text-cyan-400 underline">Ajay Kumar</span>.
            <span className="text-white ml-1">All Rights Reserved.</span>
          </p>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        {!isChatbotFloatingOpen ? (
          <button
            onClick={() => setIsChatbotFloatingOpen(true)}
            className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-2xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-400/40"
            title="PredictX Voice AI Chatbot kholein"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-white" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse"></span>
            </div>
            <span className="tracking-wide">Ask Voice AI</span>
            <Mic className="w-3.5 h-3.5 text-cyan-200 group-hover:animate-bounce" />
          </button>
        ) : (
          <div className="relative">
            <StockChatbot
              data={data}
              onNavigate={onNavigate}
              theme={theme}
              mode="floating"
              onClose={() => setIsChatbotFloatingOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
