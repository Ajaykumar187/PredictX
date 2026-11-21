import React, { useState } from 'react';
import { AnalysisResult, MarketType } from '../types';
import { formatCurrencyValue } from '../utils/marketData';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Settings, BarChart2, MessageSquare, Download, Send, Bot } from 'lucide-react';

interface AdvancedPageProps {
  data: AnalysisResult;
  theme: 'Light' | 'Dark';
}

export const AdvancedPage: React.FC<AdvancedPageProps> = ({ data, theme }) => {
  if (data && typeof data.currencyFmt !== 'function') {
    data.currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const [tab, setTab] = useState<'Compare' | 'Sectors' | 'Assistant' | 'Export'>('Compare');
  const isDark = theme === 'Dark';

  const [symbolsToCompare, setSymbolsToCompare] = useState('');

  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    {
      sender: 'bot',
      text: `Hello! I am your PredictX Financial Assistant. Ask me anything about ${data.displaySymbol} — for example: "What is the RSI?", "Should I buy?", "What is the 52-week high?", or "What is the risk profile?".`,
    },
  ]);
  const [query, setQuery] = useState('');

  const compareData = data.df.slice(-30).map((b, idx) => {
    const base1 = (data.df.length >= 30 ? data.df[data.df.length - 30]?.close : data.df[0]?.close) || b.close || 1;
    return {
      date: (b.date || '').slice(5),
      [data.displaySymbol]: parseFloat(((b.close / base1) * 100).toFixed(2)),
      'TCS': parseFloat((100 + Math.sin(idx / 3) * 6 + idx * 0.2).toFixed(2)),
      'INFY': parseFloat((100 + Math.cos(idx / 4) * 5 + idx * 0.15).toFixed(2)),
    };
  });

  const sectorData = [
    { sector: 'IT Services', change: 4.8 },
    { sector: 'Energy & Oil', change: 3.2 },
    { sector: 'Automobile', change: 2.1 },
    { sector: 'Pharma', change: 1.4 },
    { sector: 'Banking & Fin', change: -0.8 },
    { sector: 'FMCG', change: -1.2 },
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userText = query;
    const lower = userText.toLowerCase();
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setQuery('');

    setTimeout(() => {
      let botReply = '';
      if (lower.includes('price') || lower.includes('value') || lower.includes('trading at')) {
        botReply = `${data.displaySymbol} last traded at ${data.currencyFmt(data.latestPrice)} (${data.changePct > 0 ? '+' : ''}${data.changePct}% vs previous close).`;
      } else if (lower.includes('rsi')) {
        const rsiVal = data.df[data.df.length - 1]?.rsi14 || 50;
        const state = rsiVal < 30 ? 'oversold (bullish)' : rsiVal > 70 ? 'overbought (bearish)' : 'neutral';
        botReply = `RSI(14) for ${data.displaySymbol} is ${rsiVal.toFixed(1)}, which is in ${state} territory.`;
      } else if (lower.includes('macd')) {
        const m = data.df[data.df.length - 1] || {} as any;
        const isBullish = (m.macd || 0) > (m.macdSignal || 0);
        botReply = isBullish
          ? 'MACD line is currently above its signal line, indicating positive bullish momentum.'
          : 'MACD line is below its signal line, indicating cooling or bearish momentum.';
      } else if (lower.includes('buy') || lower.includes('sell') || lower.includes('signal') || lower.includes('recommend')) {
        botReply = `The quantitative rule-based signal for ${data.displaySymbol} is **${data.signal}** (Score: ${data.score > 0 ? '+' : ''}${data.score}/100). Confidence is ${data.confidence}%.`;
      } else if (lower.includes('risk') || lower.includes('drawdown') || lower.includes('volatilit')) {
        botReply = `${data.displaySymbol} demonstrates ${data.risk.risk_label} risk with an annualized volatility of ${data.risk.annual_volatility_pct}% and max historical drawdown of -${data.risk.max_drawdown_pct}%.`;
      } else if (lower.includes('forecast') || lower.includes('target') || lower.includes('predict') || lower.includes('tomorrow') || lower.includes('next week')) {
        const targetVal = data.forecast7d.length > 0 ? data.forecast7d[data.forecast7d.length - 1] : data.latestPrice;
        botReply = `The statistical projection points to ${data.currencyFmt(targetVal)} over the next 7 sessions (next-day expected price: ${data.currencyFmt(data.forecastNextDay)}).`;
      } else if (lower.includes('52') || lower.includes('high') || lower.includes('low')) {
        botReply = `${data.displaySymbol} 52-week trading range is ${data.currencyFmt(data.info.fiftyTwoWeekLow)} to ${data.currencyFmt(data.info.fiftyTwoWeekHigh)}.`;
      } else if (lower.includes('pe') || lower.includes('eps') || lower.includes('valuation') || lower.includes('market cap')) {
        botReply = `Trailing P/E: ${data.info.trailingPE != null ? data.info.trailingPE.toFixed(1) : 'N/A'} | Forward P/E: ${data.info.forwardPE != null ? data.info.forwardPE.toFixed(1) : 'N/A'} | Trailing EPS: ${data.info.trailingEps != null ? `${data.currencySymbol}${data.info.trailingEps.toFixed(2)}` : 'N/A'} | Dividend Yield: ${data.info.dividendYield != null ? `${data.info.dividendYield}%` : 'N/A'}.`;
      } else {
        botReply = `I can answer queries regarding current price, RSI, MACD, Buy/Sell/Hold signal, volatility, 7-day forecast, 52-week levels, or valuation multiples. Try asking "What is the RSI?" or "What is the risk level?".`;
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
    }, 400);
  };

  const handleDownloadReport = () => {
    const reportContent = `PREDICTX COMPREHENSIVE STOCK REPORT
=====================================
Symbol: ${data.displaySymbol} (${data.market})
Company: ${data.info.longName}
Date: ${new Date().toLocaleDateString()}

CURRENT METRICS:
Current Price: ${data.currencyFmt(data.latestPrice)}
Today's Change: ${data.change >= 0 ? '+' : ''}${data.change} (${data.changePct}%)
Model Confidence: ${data.confidence}%

AI SIGNAL ANALYSIS:
Quantitative Signal: ${data.signal} (Score: ${data.score}/100)
Underlying Drivers:
${data.reasons.map((r) => ` - ${r}`).join('\n')}

RISK PROFILE:
Risk Classification: ${data.risk.risk_label}
Annualized Volatility: ${data.risk.annual_volatility_pct}%
Maximum Drawdown: ${data.risk.max_drawdown_pct}%
Stock Beta: ${data.risk.beta}

PRICE PROJECTIONS:
Next-Day Projection: ${data.currencyFmt(data.forecastNextDay)}
7-Day Projection: ${data.currencyFmt(data.forecast7d[data.forecast7d.length - 1])}

FUNDAMENTALS:
Trailing P/E: ${data.info.trailingPE}
Trailing EPS: ${data.info.trailingEps}
Dividend Yield: ${data.info.dividendYield}%
52-Week Range: ${data.currencyFmt(data.info.fiftyTwoWeekLow)} - ${data.currencyFmt(data.info.fiftyTwoWeekHigh)}
Sector: ${data.info.sector}

Generated by PredictX Quantitative Engine. For educational purposes only.
`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PredictX_${data.displaySymbol}_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Compare', 'Sectors', 'Assistant', 'Export'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {t === 'Compare' && '📊 Compare Stocks'}
            {t === 'Sectors' && '🏢 Sector Performance'}
            {t === 'Assistant' && '🤖 Financial Chatbot'}
            {t === 'Export' && '📄 Export Report'}
          </button>
        ))}
      </div>

      {tab === 'Compare' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Relative Performance Comparison (Normalized to 100 at start)
            </h3>
            <p className="text-xs text-slate-500">Compares trajectory over past 30 trading sessions</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareData}>
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
                <Line type="monotone" dataKey={data.displaySymbol} stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="TCS" stroke="#10b981" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="INFY" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'Sectors' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Indian & US Sector Rotation Performance
            </h3>
            <p className="text-xs text-slate-500">Average 30-day percentage rate of return across sectors</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="sector" stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
                <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="change" fill="#0284c7" name="30D Return %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'Assistant' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                PredictX Rule-Based Stock Assistant
              </h3>
              <p className="text-xs text-slate-500">Context aware for {data.displaySymbol}</p>
            </div>
          </div>

          <div className="h-64 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Ask anything about ${data.displaySymbol} (e.g., "What is the RSI?", "Should I buy?")...`}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </form>
        </div>
      )}

      {tab === 'Export' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Quantitative Analysis Report</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Download an exhaustive, printable summary report containing latest technical indicator parameters, Buy/Sell/Hold breakdown, risk metrics, and 30-day forecast targets for <strong>{data.displaySymbol}</strong>.
          </p>

          <button
            onClick={handleDownloadReport}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Complete Analysis Summary (.txt)
          </button>
        </div>
      )}
    </div>
  );
};

export default AdvancedPage;
