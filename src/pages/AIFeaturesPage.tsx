import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AnalysisResult } from '../types';
import { generateAIMarketSummary } from '../utils/aiEngine';
import { formatCurrencyValue } from '../utils/marketData';
import { ShieldAlert, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AIFeaturesPageProps {
  data: AnalysisResult;
  theme: 'Light' | 'Dark';
}

export const AIFeaturesPage: React.FC<AIFeaturesPageProps> = ({ data, theme }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const isDark = theme === 'Dark';
  const summaryText = generateAIMarketSummary(data);

  const forecastChartData = data.forecast30.map((price, idx) => ({
    day: `D+${idx + 1}`,
    forecast: price,
  }));

  const progressPercent = Math.round(((data.score + 100) / 200) * 100);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              PredictX Core Quantitative Signal
            </span>
            <div className="flex items-center gap-3">
              <span
                className={`text-2xl font-black px-4 py-1.5 rounded-xl uppercase tracking-wider ${
                  data.signal === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : data.signal === 'SELL'
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                }`}
              >
                {data.signal}
              </span>
              <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                Score: <strong className="text-slate-900 dark:text-white">{data.score > 0 ? '+' : ''}{data.score}</strong> / 100
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 block" title="Validation data par agle din ki direction kitni baar sahi nikli">Direction hit-rate</span>
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">{data.confidence}%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>Strong Bearish (-100)</span>
            <span>Neutral (0)</span>
            <span>Strong Bullish (+100)</span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                data.score >= 25
                  ? 'bg-emerald-500'
                  : data.score <= -25
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-500" /> Why this signal? (Explainable Rules Breakdown)
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {data.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-cyan-500 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Next-day Forecast</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {data.currencyFmt(data.forecastNextDay)}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">1 session statistical projection</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">7-Day Forecast</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {data.currencyFmt(data.forecast7d[data.forecast7d.length - 1])}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">1 week statistical projection</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Risk Profile</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-black ${
                data.risk.risk_label === 'Low'
                  ? 'text-emerald-500'
                  : data.risk.risk_label === 'Moderate'
                  ? 'text-amber-500'
                  : 'text-rose-500'
              }`}
            >
              {data.risk.risk_label}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">{data.risk.annual_volatility_pct}% Ann. Volatility</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              30-Day Price Forecast
            </h3>
            <p className="text-xs text-slate-500">Multivariate autoregressive projection with volatility band</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="day" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line type="monotone" dataKey="forecast" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="Forecast (₹/$)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-500" /> Quantitative Risk Metrics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] text-slate-500 font-semibold block">Risk Level</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{data.risk.risk_label}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] text-slate-500 font-semibold block">Annual Volatility</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{data.risk.annual_volatility_pct}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] text-slate-500 font-semibold block">Max Drawdown</span>
            <span className="text-base font-bold text-rose-600 dark:text-rose-400">-{data.risk.max_drawdown_pct}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[11px] text-slate-500 font-semibold block">Beta vs Benchmark</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{data.risk.beta}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" /> AI Market Summary
        </h3>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed border border-slate-200/60 dark:border-slate-700/60">
          {summaryText}
        </div>
      </div>
    </div>
  );
};

export default AIFeaturesPage;
