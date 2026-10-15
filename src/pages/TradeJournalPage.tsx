import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  CheckCircle2,
  Trash2,
  Download,
  Filter,
  Edit2,
  Calendar,
  Zap,
  Tag,
  Smile,
  X,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AnalysisResult, JournalTrade, MarketType } from '../types';
import { storage } from '../utils/storage';
import { formatCurrencyValue } from '../utils/marketData';

interface TradeJournalPageProps {
  currentAnalysis?: AnalysisResult | null;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

// Sample trades (no longer auto-loaded for new users)
export const SAMPLE_TRADES: JournalTrade[] = [
  {
    id: 'tj-1',
    symbol: 'RELIANCE',
    market: 'NSE',
    type: 'BUY',
    category: 'Swing',
    entryDate: '2026-09-28',
    entryPrice: 1140.0,
    quantity: 50,
    exitDate: '2026-10-04',
    exitPrice: 1195.0,
    stopLoss: 1115.0,
    target: 1200.0,
    status: 'CLOSED',
    pnl: 2750.0,
    pnlPercent: 4.82,
    strategyTag: 'Breakout Above 50 EMA',
    emotionTag: 'Disciplined 🧘',
    notes: 'Clean daily resistance breakout with 2.5x average delivery volume. Exited near target.',
    createdAt: '2026-09-28T10:00:00Z',
  },
  {
    id: 'tj-2',
    symbol: 'TCS',
    market: 'NSE',
    type: 'BUY',
    category: 'Swing',
    entryDate: '2026-10-01',
    entryPrice: 3820.0,
    quantity: 15,
    exitDate: '2026-10-08',
    exitPrice: 3980.0,
    stopLoss: 3750.0,
    target: 4000.0,
    status: 'CLOSED',
    pnl: 2400.0,
    pnlPercent: 4.19,
    strategyTag: 'RSI Bullish Divergence',
    emotionTag: 'Confident 🚀',
    notes: 'Bought at double bottom support. Trailed stoploss to cost after +2%.',
    createdAt: '2026-10-01T11:30:00Z',
  },
  {
    id: 'tj-3',
    symbol: 'TATASTEEL',
    market: 'NSE',
    type: 'BUY',
    category: 'Intraday',
    entryDate: '2026-10-05',
    entryPrice: 158.5,
    quantity: 400,
    exitDate: '2026-10-05',
    exitPrice: 154.0,
    stopLoss: 154.0,
    target: 165.0,
    status: 'CLOSED',
    pnl: -1800.0,
    pnlPercent: -2.84,
    strategyTag: 'Momentum Scalp',
    emotionTag: 'FOMO 🏃',
    notes: 'Entered late after a gap-up. Market reversed, hit stoploss strictly. Good risk discipline.',
    createdAt: '2026-10-05T09:45:00Z',
  },
  {
    id: 'tj-4',
    symbol: 'NVDA',
    market: 'US',
    type: 'BUY',
    category: 'Positional',
    entryDate: '2026-10-02',
    entryPrice: 133.0,
    quantity: 30,
    exitDate: '2026-10-10',
    exitPrice: 144.5,
    stopLoss: 127.0,
    target: 148.0,
    status: 'CLOSED',
    pnl: 345.0,
    pnlPercent: 8.65,
    strategyTag: 'Earnings Drift',
    emotionTag: 'Disciplined 🧘',
    notes: 'Rode semiconductor rally. Booked 70% quantity at target 1.',
    createdAt: '2026-10-02T14:30:00Z',
  },
  {
    id: 'tj-5',
    symbol: 'HDFCBANK',
    market: 'NSE',
    type: 'BUY',
    category: 'Swing',
    entryDate: '2026-10-10',
    entryPrice: 1665.0,
    quantity: 40,
    stopLoss: 1625.0,
    target: 1730.0,
    status: 'OPEN',
    strategyTag: 'Support Reversal',
    emotionTag: 'Disciplined 🧘',
    notes: 'Banking sector rotation. PCR crossed 1.25 defending 1650 strike. Active open trade.',
    createdAt: '2026-10-10T10:15:00Z',
  },
];

export const TradeJournalPage: React.FC<TradeJournalPageProps> = ({
  currentAnalysis,
  theme = 'Dark',
  onSelectStock,
}) => {
  const isDark = theme === 'Dark';

  const [trades, setTrades] = useState<JournalTrade[]>(() => {
    const saved = storage.getJournalTrades();
    return saved && saved.length > 0 ? saved : [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [closeExitPrice, setCloseExitPrice] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [fSymbol, setFSymbol] = useState(currentAnalysis?.displaySymbol || '');
  const [fMarket, setFMarket] = useState<MarketType>(currentAnalysis?.market || 'NSE');
  const [fType, setFType] = useState<'BUY' | 'SELL'>('BUY');
  const [fCategory, setFCategory] = useState<JournalTrade['category']>('Swing');
  const [fEntryPrice, setFEntryPrice] = useState<string>(currentAnalysis ? String(currentAnalysis.latestPrice) : '1000');
  const [fQuantity, setFQuantity] = useState<string>('25');
  const [fStopLoss, setFStopLoss] = useState<string>(currentAnalysis ? String(Number((currentAnalysis.latestPrice * 0.965).toFixed(2))) : '965');
  const [fTarget, setFTarget] = useState<string>(currentAnalysis ? String(Number((currentAnalysis.latestPrice * 1.055).toFixed(2))) : '1055');
  const [fStrategy, setFStrategy] = useState('Breakout Above 50 EMA');
  const [fEmotion, setFEmotion] = useState('Disciplined 🧘');
  const [fNotes, setFNotes] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const persistTrades = (newTrades: JournalTrade[]) => {
    setTrades(newTrades);
    storage.saveJournalTrades(newTrades);
  };

  const STRATEGY_PRESETS = [
    'Breakout Above 50 EMA',
    'RSI Bullish Divergence',
    'Support Reversal',
    'Pullback Retest',
    'Volume Expansion Surge',
    'Earnings Momentum',
    'Gap & Go',
  ];

  const EMOTION_PRESETS = [
    'Disciplined 🧘',
    'Confident 🚀',
    'Patient ⏳',
    'FOMO 🏃',
    'Revenge 😡',
    'Hesitant 😟',
  ];

  const handlePrefillCurrentStock = () => {
    if (!currentAnalysis) return;
    setFSymbol(currentAnalysis.displaySymbol);
    setFMarket(currentAnalysis.market);
    setFEntryPrice(String(currentAnalysis.latestPrice));
    setFStopLoss(String(Number((currentAnalysis.latestPrice * 0.965).toFixed(2))));
    setFTarget(String(Number((currentAnalysis.latestPrice * 1.055).toFixed(2))));
    setIsModalOpen(true);
  };

  const handleSaveTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const entryP = parseFloat(fEntryPrice);
    const qty = parseInt(fQuantity, 10);
    if (!fSymbol.trim() || isNaN(entryP) || entryP <= 0 || isNaN(qty) || qty <= 0) return;

    const newTrade: JournalTrade = {
      id: `trade-${Date.now()}`,
      symbol: fSymbol.trim().toUpperCase(),
      market: fMarket,
      type: fType,
      category: fCategory,
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice: entryP,
      quantity: qty,
      stopLoss: fStopLoss ? parseFloat(fStopLoss) : undefined,
      target: fTarget ? parseFloat(fTarget) : undefined,
      status: 'OPEN',
      strategyTag: fStrategy,
      emotionTag: fEmotion,
      notes: fNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    persistTrades([newTrade, ...trades]);
    setIsModalOpen(false);
    setFNotes('');
    showToast(`Logged trade for ${newTrade.symbol}!`);
  };

  const handleConfirmCloseTrade = (tradeId: string) => {
    const exitP = parseFloat(closeExitPrice);
    if (isNaN(exitP) || exitP <= 0) return;

    const updated = trades.map((t) => {
      if (t.id !== tradeId) return t;
      const mult = t.type === 'BUY' ? 1 : -1;
      const pnl = Number(((exitP - t.entryPrice) * t.quantity * mult).toFixed(2));
      const pnlPercent = Number((((exitP - t.entryPrice) / t.entryPrice) * 100 * mult).toFixed(2));
      return {
        ...t,
        status: 'CLOSED' as const,
        exitDate: new Date().toISOString().slice(0, 10),
        exitPrice: exitP,
        pnl,
        pnlPercent,
      };
    });

    persistTrades(updated);
    setClosingTradeId(null);
    setCloseExitPrice('');
    showToast('Trade successfully closed and P&L calculated!');
  };

  const handleDeleteTrade = (id: string) => {
    const updated = trades.filter((t) => t.id !== id);
    persistTrades(updated);
    showToast('Trade removed from journal.');
  };

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === 'CLOSED');
    const open = trades.filter((t) => t.status === 'OPEN');
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let grossWin = 0;
    let grossLoss = 0;

    closed.forEach((t) => {
      const p = t.pnl || 0;
      totalPnl += p;
      if (p > 0) {
        wins++;
        grossWin += p;
      } else if (p < 0) {
        losses++;
        grossLoss += Math.abs(p);
      }
    });

    const winRate = closed.length > 0 ? Number(((wins / closed.length) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 5.0 : 0;
    const avgTrade = closed.length > 0 ? Number((totalPnl / closed.length).toFixed(1)) : 0;

    return {
      total: trades.length,
      closedCount: closed.length,
      openCount: open.length,
      totalPnl,
      wins,
      losses,
      winRate,
      profitFactor,
      avgTrade,
    };
  }, [trades]);

  const cumulativeChartData = useMemo(() => {
    const closedReversed = [...trades.filter((t) => t.status === 'CLOSED')].reverse();
    let running = 0;
    return closedReversed.map((t, idx) => {
      running += t.pnl || 0;
      return {
        date: t.exitDate || `T#${idx + 1}`,
        symbol: t.symbol,
        pnl: t.pnl || 0,
        cumulativePnl: running,
      };
    });
  }, [trades]);

  const strategyStats = useMemo(() => {
    const map: Record<string, { count: number; pnl: number }> = {};
    trades.forEach((t) => {
      const tag = t.strategyTag || 'Other';
      if (!map[tag]) map[tag] = { count: 0, pnl: 0 };
      map[tag].count++;
      map[tag].pnl += t.pnl || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl);
  }, [trades]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchStrategy = strategyFilter === 'ALL' || t.strategyTag === strategyFilter;
      return matchStatus && matchStrategy;
    });
  }, [trades, statusFilter, strategyFilter]);

  const handleExportCSV = () => {
    const headers = ['Symbol', 'Market', 'Type', 'Category', 'EntryDate', 'EntryPrice', 'Qty', 'ExitDate', 'ExitPrice', 'Status', 'P&L', 'P&L%', 'Strategy', 'Emotion', 'Notes'];
    const rows = trades.map((t) => [
      t.symbol,
      t.market,
      t.type,
      t.category,
      t.entryDate,
      t.entryPrice,
      t.quantity,
      t.exitDate || '',
      t.exitPrice || '',
      t.status,
      t.pnl || 0,
      t.pnlPercent || 0,
      `"${t.strategyTag}"`,
      `"${t.emotionTag || ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `predictx_trade_journal_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Trade Journal CSV');
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce border border-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                PredictX Trading Journal & Psychology Audit
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  {stats.total} Trades Logged
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Log execution entries, track setup performance, audit emotions/psychology, and compound discipline.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Log New Trade</span>
          </button>

          {currentAnalysis && (
            <button
              onClick={handlePrefillCurrentStock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer"
              title="Log currently viewed stock into journal"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Log {currentAnalysis.displaySymbol}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Net P&L
          </span>
          <div className={`text-2xl font-black tracking-tight ${stats.totalPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.totalPnl >= 0 ? '+' : ''}₹{stats.totalPnl.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">
            Across {stats.closedCount} closed trades
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Win Rate
          </span>
          <div className="text-2xl font-black text-cyan-500 tracking-tight">
            {stats.winRate}%
          </div>
          <span className="text-[10px] text-slate-500">
            {stats.wins} Wins / {stats.losses} Losses
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Profit Factor
          </span>
          <div className="text-2xl font-black text-indigo-500 tracking-tight">
            {stats.profitFactor}x
          </div>
          <span className="text-[10px] text-slate-500">
            Gross gains vs losses
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Avg Trade P&L
          </span>
          <div className={`text-2xl font-black tracking-tight ${stats.avgTrade >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.avgTrade >= 0 ? '+' : ''}₹{stats.avgTrade.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">
            Per completed execution
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Open Trades
          </span>
          <div className="text-2xl font-black text-amber-500 tracking-tight">
            {stats.openCount}
          </div>
          <span className="text-[10px] text-slate-500">
            Currently running
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Top Strategy Setup
          </span>
          <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate pt-1">
            {strategyStats[0]?.[0] || 'Breakout'}
          </div>
          <span className="text-[10px] text-emerald-500 font-bold">
            +₹{strategyStats[0]?.[1]?.pnl.toLocaleString() || '0'}
          </span>
        </div>
      </div>

      {cumulativeChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Cumulative Realized Equity Curve
              </h3>
              <p className="text-xs text-slate-500">Net capital growth progression over closed trades.</p>
            </div>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
                <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                  formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Cumulative P&L']}
                />
                <Area type="monotone" dataKey="cumulativePnl" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#pnlGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Trade Logs & Execution Notes ({filteredTrades.length})
            </h3>
            <p className="text-xs text-slate-500">Complete diary of entries, exits, strategies, and psychology.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {(['ALL', 'OPEN', 'CLOSED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    statusFilter === s
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s === 'OPEN' ? 'Open' : 'Closed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Entry</th>
                <th className="py-2.5 px-3">Exit</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">P&L</th>
                <th className="py-2.5 px-3">Strategy</th>
                <th className="py-2.5 px-3">Psychology</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTrades.map((trade) => {
                const prefix = trade.market === 'US' ? '$' : '₹';
                return (
                  <tr key={trade.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">{trade.symbol}</span>
                        <span className="text-[9px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {trade.market}
                        </span>
                        <span className="text-[9px] text-slate-400">({trade.category})</span>
                      </div>
                      {trade.notes && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate" title={trade.notes}>
                          "{trade.notes}"
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          trade.type === 'BUY'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {trade.type}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                      <div>{prefix}{trade.entryPrice.toLocaleString()}</div>
                      <span className="text-[10px] text-slate-400">{trade.entryDate}</span>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                      {trade.exitPrice ? (
                        <div>
                          <div>{prefix}{trade.exitPrice.toLocaleString()}</div>
                          <span className="text-[10px] text-slate-400">{trade.exitDate}</span>
                        </div>
                      ) : (
                        <span className="text-amber-500 font-bold">Open</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {trade.quantity}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {trade.status === 'CLOSED' ? (
                        <div className={(trade.pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          <div>{(trade.pnl || 0) >= 0 ? '+' : ''}{prefix}{trade.pnl?.toLocaleString()}</div>
                          <span className="text-[10px] font-normal">
                            {(trade.pnlPercent || 0) >= 0 ? '+' : ''}{trade.pnlPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Tag className="w-2.5 h-2.5 text-cyan-500" />
                        {trade.strategyTag}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {trade.emotionTag || '—'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          trade.status === 'CLOSED'
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {trade.status === 'OPEN' ? <Clock className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {trade.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {trade.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => {
                              setClosingTradeId(trade.id);
                              setCloseExitPrice(String(trade.entryPrice));
                            }}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Close Trade
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteTrade(trade.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete trade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Log Trade to Journal
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrade} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stock Ticker</label>
                  <input
                    type="text"
                    required
                    value={fSymbol}
                    onChange={(e) => setFSymbol(e.target.value)}
                    placeholder="e.g. RELIANCE, TCS"
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Exchange Market</label>
                  <select
                    value={fMarket}
                    onChange={(e) => setFMarket(e.target.value as MarketType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="NSE">NSE (India)</option>
                    <option value="BSE">BSE (India)</option>
                    <option value="US">US Market (NYSE/NASDAQ)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Order Type</label>
                  <select
                    value={fType}
                    onChange={(e) => setFType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="BUY">BUY (Long)</option>
                    <option value="SELL">SELL (Short)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Trading Horizon</label>
                  <select
                    value={fCategory}
                    onChange={(e) => setFCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="Swing">Swing Trade</option>
                    <option value="Intraday">Intraday</option>
                    <option value="Positional">Positional / Delivery</option>
                    <option value="Options/F&O">Options / F&O</option>
                    <option value="Scalp">Scalp</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Entry Price</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={fEntryPrice}
                    onChange={(e) => setFEntryPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Quantity (Shares)</label>
                  <input
                    type="number"
                    required
                    value={fQuantity}
                    onChange={(e) => setFQuantity(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stop Loss (Optional)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={fStopLoss}
                    onChange={(e) => setFStopLoss(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Profit Target (Optional)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={fTarget}
                    onChange={(e) => setFTarget(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Setup / Strategy</label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {STRATEGY_PRESETS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFStrategy(s)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        fStrategy === s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={fStrategy}
                  onChange={(e) => setFStrategy(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Psychological State</label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMOTION_PRESETS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setFEmotion(em)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        fEmotion === em ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Trade Notes & Learnings</label>
                <textarea
                  rows={2}
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Kyun trade liya? Chart pattern kya tha? Exit plan kya hai?..."
                  className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Save to Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {closingTradeId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Close Trade & Lock P&L
              </h3>
              <button
                type="button"
                onClick={() => setClosingTradeId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Actual Exit Price
                </label>
                <input
                  type="number"
                  step="0.05"
                  autoFocus
                  required
                  value={closeExitPrice}
                  onChange={(e) => setCloseExitPrice(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingTradeId(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmCloseTrade(closingTradeId)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeJournalPage;
