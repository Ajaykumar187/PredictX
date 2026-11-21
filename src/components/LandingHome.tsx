import React from 'react';
import {
  TrendingUp,
  MessageSquare,
  ArrowLeftRight,
  Layers,
  Rocket,
  Search,
  Wallet,
  Landmark,
  BookOpen,
  Award,
  Briefcase,
  Calculator,
  BarChart2,
  Cpu,
  Newspaper,
  Coins,
  Building,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import type { PageId } from './Sidebar';

interface Props {
  onNavigate: (page: PageId) => void;
  onOpenMenu: () => void;
}

interface Feature {
  id: PageId;
  title: string;
  text: string;
  icon: React.ElementType;
}

const NO_STOCK_NEEDED: Feature[] = [
  { id: 'ask', title: 'Ask PredictX AI', text: 'Ask via voice or text for support, resistance, buy/sell levels, and multi-year return estimates.', icon: MessageSquare },
  { id: 'heatmap', title: 'NSE 500 Heatmap', text: 'Visual treemap of real-time gains and losses across NIFTY 500 stocks and sectors.', icon: LayoutGrid },
  { id: 'options', title: 'Option Chain', text: 'Live NSE option chain, Greeks, PCR, and Max Pain levels.', icon: Layers },
  { id: 'compare', title: 'Stock Compare', text: 'Compare two equities side-by-side in real time.', icon: ArrowLeftRight },
  { id: 'scanners', title: 'Market Scanners', text: 'Track breakout, high-momentum, and high-volume stocks in one place.', icon: Search },
  { id: 'smartmoney', title: 'Smart Money', text: 'FII/DII institutional buying and selling plus ownership breakdown.', icon: Landmark },
  { id: 'ipo', title: 'IPO & GMP', text: 'Active IPOs, grey market premium, and listing gain estimates.', icon: Rocket },
  { id: 'paper', title: 'Paper Trading', text: 'Practice with ₹10,00,000 virtual capital at live market prices with leaderboard.', icon: Wallet },
  { id: 'portfolio', title: 'Portfolio Tracker', text: 'Track holdings P&L, risk exposure, and diversification score.', icon: Briefcase },
  { id: 'trackrecord', title: 'Model Accuracy', text: 'Inspect historical model performance with transparent backtests.', icon: Award },
  { id: 'journal', title: 'Trade Journal', text: 'Log trades and evaluate execution discipline and performance.', icon: BookOpen },
  { id: 'tools', title: 'Investment Tools', text: 'Position size, tax, brokerage, SIP, EMI, and investment calculators.', icon: Calculator },
];

const AFTER_SEARCH: Feature[] = [
  { id: 'home', title: '30-Day Forecast', text: 'Target price with confidence range and detailed signal reasoning.', icon: TrendingUp },
  { id: 'charts', title: 'Technical Charts', text: 'Interactive charts with multi-timeframe technical indicators.', icon: BarChart2 },
  { id: 'ai', title: 'AI Signals & Risk', text: 'BUY/SELL/HOLD signals, composite score, and risk radar.', icon: Cpu },
  { id: 'news', title: 'News & Sentiment', text: 'Latest market headlines and automated sentiment scoring.', icon: Newspaper },
  { id: 'dividends', title: 'Dividends', text: 'Dividend history, yield analysis, and upcoming ex-dividend dates.', icon: Coins },
  { id: 'company', title: 'Company Financials', text: 'Quarterly results, valuation metrics, and complete company profile.', icon: Building },
];

const Card: React.FC<{ f: Feature; onClick: () => void }> = ({ f, onClick }) => {
  const Icon = f.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/70 transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/15 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center transition-colors">
            <Icon className="w-4 h-4" />
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{f.title}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.text}</p>
      </div>
    </button>
  );
};

export const LandingHome: React.FC<Props> = ({ onNavigate }) => (
  <div className="space-y-8">
    <section className="rounded-2xl p-6 sm:p-8 bg-slate-900 dark:bg-slate-900 border border-slate-800 text-white relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-2xl">
        <p className="text-xs font-medium text-blue-300 mb-2">
          NSE · BSE · US Equities · Real-Time Analytics
        </p>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-balance">
          Institutional-grade market intelligence, built for clarity.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
          Search any ticker from the left sidebar to open live price forecasting, quarterly financials, option chains, and market-wide heatmaps.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('heatmap')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Open NSE 500 Heatmap</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ask')}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ask PredictX AI</span>
          </button>
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Market Modules</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Ready to explore</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {NO_STOCK_NEEDED.map((f) => (
          <Card key={f.id} f={f} onClick={() => onNavigate(f.id)} />
        ))}
      </div>
    </section>

    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Deep Stock Research</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Search any symbol in the sidebar to unlock ticker-specific forecasting, technicals, and financials.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AFTER_SEARCH.map((f) => (
          <div
            key={f.id}
            className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-3">
              <f.icon className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{f.title}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default LandingHome;
