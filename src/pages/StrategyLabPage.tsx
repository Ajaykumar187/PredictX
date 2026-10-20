import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { backtestSMACrossover, backtestRSIStrategy } from '../utils/backtester';
import { storage } from '../utils/storage';
import { formatCurrencyValue } from '../utils/marketData';
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
import { FlaskConical, DollarSign, TrendingUp, History, RefreshCw } from 'lucide-react';

interface StrategyLabPageProps {
  data: AnalysisResult;
  theme: 'Light' | 'Dark';
}

export const StrategyLabPage: React.FC<StrategyLabPageProps> = ({ data, theme }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const [tab, setTab] = useState<'Backtester' | 'PaperTrading'>('Backtester');
  const isDark = theme === 'Dark';

  const [strategyType, setStrategyType] = useState<'SMA' | 'RSI'>('SMA');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [fastPeriod, setFastPeriod] = useState(20);
  const [slowPeriod, setSlowPeriod] = useState(50);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  const [paperAcc, setPaperAcc] = useState(storage.getPaperAccount());
  const [orderQty, setOrderQty] = useState(10);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  const backtestResult =
    strategyType === 'SMA'
      ? backtestSMACrossover(data.df, fastPeriod, slowPeriod, initialCapital)
      : backtestRSIStrategy(data.df, rsiOversold, rsiOverbought, initialCapital);

  const handlePaperBuy = () => {
    const cost = orderQty * data.latestPrice;
    if (paperAcc.cash < cost) {
      setOrderMsg('Insufficient virtual cash balance for this order.');
      return;
    }
    const currentPos = paperAcc.positions[data.displaySymbol] || { quantity: 0, avgPrice: 0, market: data.market };
    const newQty = currentPos.quantity + orderQty;
    const newAvg = (currentPos.quantity * currentPos.avgPrice + cost) / newQty;

    const nextAcc = {
      ...paperAcc,
      cash: paperAcc.cash - cost,
      positions: {
        ...paperAcc.positions,
        [data.displaySymbol]: { quantity: newQty, avgPrice: newAvg, market: data.market },
      },
      history: [
        {
          id: `tx-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'BUY' as const,
          symbol: data.displaySymbol,
          shares: orderQty,
          price: data.latestPrice,
          total: cost,
        },
        ...paperAcc.history,
      ],
    };

    setPaperAcc(nextAcc);
    storage.savePaperAccount(nextAcc);
    setOrderMsg(`Successfully bought ${orderQty} shares of ${data.displaySymbol} at ${data.currencyFmt(data.latestPrice)}.`);
  };

  const handlePaperSell = () => {
    const currentPos = paperAcc.positions[data.displaySymbol];
    if (!currentPos || currentPos.quantity < orderQty) {
      setOrderMsg(`Insufficient position in ${data.displaySymbol} to sell ${orderQty} shares.`);
      return;
    }
    const proceed = orderQty * data.latestPrice;
    const remaining = currentPos.quantity - orderQty;
    const nextPositions = { ...paperAcc.positions };
    if (remaining === 0) delete nextPositions[data.displaySymbol];
    else nextPositions[data.displaySymbol] = { ...currentPos, quantity: remaining };

    const nextAcc = {
      ...paperAcc,
      cash: paperAcc.cash + proceed,
      positions: nextPositions,
      history: [
        {
          id: `tx-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'SELL' as const,
          symbol: data.displaySymbol,
          shares: orderQty,
          price: data.latestPrice,
          total: proceed,
        },
        ...paperAcc.history,
      ],
    };

    setPaperAcc(nextAcc);
    storage.savePaperAccount(nextAcc);
    setOrderMsg(`Successfully sold ${orderQty} shares of ${data.displaySymbol} at ${data.currencyFmt(data.latestPrice)}.`);
  };

  const handleResetPaper = () => {
    const fresh = {
      cash: 1000000,
      initialCash: 1000000,
      positions: {},
      history: [],
    };
    setPaperAcc(fresh);
    storage.savePaperAccount(fresh);
    setOrderMsg('Virtual paper account balance reset to ₹10,00,000.');
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setTab('Backtester')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'Backtester'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          🧪 Quantitative Backtester
        </button>
        <button
          onClick={() => setTab('PaperTrading')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'PaperTrading'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          💼 Paper Trading Simulator
        </button>
      </div>

      {tab === 'Backtester' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Strategy Configuration ({data.displaySymbol})
                </h3>
                <p className="text-xs text-slate-500">Backtested over loaded historical data with cash equity reinvestment</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStrategyType('SMA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    strategyType === 'SMA' ? 'bg-cyan-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  SMA Crossover
                </button>
                <button
                  onClick={() => setStrategyType('RSI')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    strategyType === 'RSI' ? 'bg-cyan-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  RSI Mean-Reversion
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Starting Capital (₹/$)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              {strategyType === 'SMA' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Fast SMA Period</label>
                    <input
                      type="number"
                      value={fastPeriod}
                      onChange={(e) => setFastPeriod(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Slow SMA Period</label>
                    <input
                      type="number"
                      value={slowPeriod}
                      onChange={(e) => setSlowPeriod(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Buy Below (RSI)</label>
                    <input
                      type="number"
                      value={rsiOversold}
                      onChange={(e) => setRsiOversold(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Sell Above (RSI)</label>
                    <input
                      type="number"
                      value={rsiOverbought}
                      onChange={(e) => setRsiOverbought(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Total Strategy Return</span>
              <span className={`text-xl font-black ${backtestResult.totalReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {backtestResult.totalReturnPct >= 0 ? '+' : ''}{backtestResult.totalReturnPct}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Buy & Hold Return</span>
              <span className={`text-xl font-black ${backtestResult.buyHoldReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {backtestResult.buyHoldReturnPct >= 0 ? '+' : ''}{backtestResult.buyHoldReturnPct}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Max Drawdown</span>
              <span className="text-xl font-black text-rose-500">-{backtestResult.maxDrawdownPct}%</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Executed Trades</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{backtestResult.numTrades}</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Win Rate</span>
              <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">{backtestResult.winRatePct}%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Equity Curve vs Buy & Hold</h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtestResult.equityCurve}>
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
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line type="monotone" dataKey="equity" stroke="#2563eb" name="Strategy Equity" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="buyHold" stroke="#94a3b8" name="Buy & Hold" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Trade Execution Log</h4>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Entry Date</th>
                  <th className="py-2 px-3">Exit Date</th>
                  <th className="py-2 px-3">Entry Price</th>
                  <th className="py-2 px-3">Exit Price</th>
                  <th className="py-2 px-3 text-right">Return %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backtestResult.trades.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold">{t.entryDate}</td>
                    <td className="py-2 px-3 font-semibold">{t.exitDate}</td>
                    <td className="py-2 px-3">{t.entryPrice}</td>
                    <td className="py-2 px-3">{t.exitPrice}</td>
                    <td className={`py-2 px-3 text-right font-bold ${t.returnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {t.returnPct >= 0 ? '+' : ''}{t.returnPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'PaperTrading' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 block font-semibold">Virtual Cash Available</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{paperAcc.cash.toLocaleString()}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 block font-semibold">Current Stock Selected</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {data.displaySymbol} ({data.currencyFmt(data.latestPrice)})
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block font-semibold">Holdings in {data.displaySymbol}</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {paperAcc.positions[data.displaySymbol]?.quantity || 0} shares
                </span>
              </div>
              <button
                onClick={handleResetPaper}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                title="Reset virtual balance"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {orderMsg && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
              {orderMsg}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Place Virtual Market Order</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Number of Shares</label>
                <input
                  type="number"
                  min="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Estimated Total</label>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                  {data.currencyFmt(orderQty * data.latestPrice)}
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto pt-4 sm:pt-0">
                <button
                  onClick={handlePaperBuy}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  BUY (Market)
                </button>
                <button
                  onClick={handlePaperSell}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  SELL (Market)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Paper Trading Transactions History</h4>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Shares</th>
                  <th className="py-2 px-3">Executed Price</th>
                  <th className="py-2 px-3 text-right">Total (₹/$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paperAcc.history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3">{tx.date}</td>
                    <td className="py-2 px-3 font-bold">
                      <span className={tx.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold">{tx.symbol}</td>
                    <td className="py-2 px-3">{tx.shares}</td>
                    <td className="py-2 px-3">₹/{tx.price.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">₹/{tx.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyLabPage;
