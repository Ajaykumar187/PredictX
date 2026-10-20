import React from 'react';
import {
  ArrowLeft,
  Home,
  MessageSquare,
  ArrowLeftRight,
  Layers,
  BookOpen,
  Award,
  Rocket,
  BarChart2,
  Cpu,
  Search,
  Coins,
  Building,
  Briefcase,
  FlaskConical,
  FileText,
  Newspaper,
} from 'lucide-react';
import { PageId } from './Sidebar';

interface QuickNavHeaderProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onGoBack: () => void;
  canGoBack: boolean;
}

const PAGE_META: Record<
  PageId,
  { label: string; shortLabel: string; icon: React.ElementType; badge?: string }
> = {
  home: { label: 'Home', shortLabel: 'Home', icon: Home },
  ask: { label: 'Ask PredictX (Hinglish AI)', shortLabel: 'Ask AI (Hinglish)', icon: MessageSquare, badge: 'AI' },
  compare: { label: 'Split-View Stock Compare', shortLabel: 'Split Compare', icon: ArrowLeftRight, badge: 'SPLIT' },
  options: { label: 'Live NSE Option Chain & Greeks', shortLabel: 'Option Chain', icon: Layers, badge: 'PRO' },
  journal: { label: 'Trade Journal & Audit', shortLabel: 'Trade Journal', icon: BookOpen, badge: 'NEW' },
  trackrecord: { label: 'Accuracy Track Record', shortLabel: 'Track Record', icon: Award },
  ipo: { label: 'IPO Predictor & Live GMP', shortLabel: 'IPO & GMP', icon: Rocket, badge: 'HOT' },
  charts: { label: 'Charts & Deep Analysis', shortLabel: 'Charts', icon: BarChart2 },
  ai: { label: 'AI Signals & Risk Radar', shortLabel: 'AI Signals', icon: Cpu, badge: 'AI' },
  news: { label: 'Live Financial News & Sentiment', shortLabel: 'News', icon: Newspaper },
  scanners: { label: 'Market Scanners & Breakouts', shortLabel: 'Scanners', icon: Search },
  dividends: { label: 'Dividend Radar & Yield Calendar', shortLabel: 'Dividends', icon: Coins },
  company: { label: 'Company Financials & Deep Dive', shortLabel: 'Company Info', icon: Building },
  portfolio: { label: 'Portfolio Tracker', shortLabel: 'Portfolio', icon: Briefcase },
  strategy: { label: 'Strategy Lab Backtesting', shortLabel: 'Strategy Lab', icon: FlaskConical },
  report: { label: 'Financial Report Analyzer', shortLabel: 'Report AI', icon: FileText },
  watchlist: { label: 'Live Watchlist', shortLabel: 'Watchlist', icon: Search },
  alerts: { label: 'Smart Price Alerts', shortLabel: 'Alerts', icon: Search },
  global: { label: 'Global Markets', shortLabel: 'Global Mkts', icon: Search },
  tools: { label: 'Investment Tools & Calculators', shortLabel: 'Tools', icon: Search },
  advanced: { label: 'Advanced Assistant', shortLabel: 'Advanced', icon: Search },
  smartmoney: { label: 'Smart Money (FII/DII)', shortLabel: 'Smart Money', icon: Search },
  paper: { label: 'Paper Trading', shortLabel: 'Paper Trade', icon: Search },
  account: { label: 'User Account & Profile', shortLabel: 'Account', icon: Search },
};

export const QuickNavHeader: React.FC<QuickNavHeaderProps> = ({
  activePage,
  onNavigate,
  onGoBack,
  canGoBack,
}) => {
  const current = PAGE_META[activePage] || PAGE_META['home'];
  const CurrentIcon = current.icon;

  return (
    <div className="w-full mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        {activePage !== 'home' && (
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 transition-all shadow-sm active:scale-95"
            title="Pehle step / page par wapas jayein"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Peeche (Back)</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <button
            onClick={() => onNavigate('home')}
            className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors flex items-center gap-1"
            title="Home dashboard par jayein"
          >
            <Home className="w-3.5 h-3.5 text-blue-500" />
            <span>Home</span>
          </button>
          {activePage !== 'home' && (
            <>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CurrentIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{current.label}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {activePage !== 'home' && (
        <button
          onClick={() => onNavigate('home')}
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          <span>Home par jayein &rarr;</span>
        </button>
      )}
    </div>
  );
};

export default QuickNavHeader;
