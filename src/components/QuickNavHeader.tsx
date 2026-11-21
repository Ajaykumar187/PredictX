import React from 'react';
import {
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
  FileSpreadsheet,
  LayoutGrid,
  Star,
  Bell,
  Globe,
  Calculator,
  Settings,
  Landmark,
  Wallet,
  User,
  ChevronRight,
} from 'lucide-react';
import { PageId } from './Sidebar';

interface QuickNavHeaderProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

const PAGE_META: Record<
  PageId,
  { label: string; shortLabel: string; icon: React.ElementType }
> = {
  home: { label: 'Dashboard', shortLabel: 'Home', icon: Home },
  ask: { label: 'Ask PredictX AI', shortLabel: 'Ask AI', icon: MessageSquare },
  compare: { label: 'Split-View Stock Compare', shortLabel: 'Compare', icon: ArrowLeftRight },
  options: { label: 'Live NSE Option Chain & Greeks', shortLabel: 'Option Chain', icon: Layers },
  journal: { label: 'Trade Journal & Audit', shortLabel: 'Journal', icon: BookOpen },
  trackrecord: { label: 'Model Accuracy Track Record', shortLabel: 'Accuracy', icon: Award },
  ipo: { label: 'IPO Predictor & Live GMP', shortLabel: 'IPO & GMP', icon: Rocket },
  charts: { label: 'Charts & Technical Analysis', shortLabel: 'Charts', icon: BarChart2 },
  ai: { label: 'AI Signals & Risk Radar', shortLabel: 'AI Signals', icon: Cpu },
  news: { label: 'Live Financial News & Sentiment', shortLabel: 'News', icon: Newspaper },
  scanners: { label: 'Market Scanners & Breakouts', shortLabel: 'Scanners', icon: Search },
  heatmap: { label: 'NSE 500 Market Heatmap', shortLabel: 'Heatmap', icon: LayoutGrid },
  dividends: { label: 'Dividend Radar & Calendar', shortLabel: 'Dividends', icon: Coins },
  company: { label: 'Company Financials & Profile', shortLabel: 'Company Info', icon: Building },
  quarterly: { label: 'Quarterly Financial Results', shortLabel: 'Quarterly', icon: FileSpreadsheet },
  portfolio: { label: 'Portfolio Tracker', shortLabel: 'Portfolio', icon: Briefcase },
  strategy: { label: 'Strategy Lab Backtesting', shortLabel: 'Strategy Lab', icon: FlaskConical },
  report: { label: 'Financial Report Analyzer', shortLabel: 'Report AI', icon: FileText },
  watchlist: { label: 'Live Watchlist', shortLabel: 'Watchlist', icon: Star },
  alerts: { label: 'Smart Price Alerts', shortLabel: 'Alerts', icon: Bell },
  global: { label: 'Global Markets', shortLabel: 'Global Mkts', icon: Globe },
  tools: { label: 'Investment Tools & Calculators', shortLabel: 'Tools', icon: Calculator },
  advanced: { label: 'Advanced Assistant', shortLabel: 'Advanced', icon: Settings },
  smartmoney: { label: 'Smart Money (FII/DII)', shortLabel: 'Smart Money', icon: Landmark },
  paper: { label: 'Paper Trading', shortLabel: 'Paper Trade', icon: Wallet },
  account: { label: 'User Account & Profile', shortLabel: 'Account', icon: User },
};

export const QuickNavHeader: React.FC<QuickNavHeaderProps> = ({
  activePage,
  onNavigate,
}) => {
  if (activePage === 'home') return null;

  const current = PAGE_META[activePage] || PAGE_META['home'];
  const CurrentIcon = current.icon;

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full mb-4 flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 font-medium hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Go to Home dashboard"
        >
          <Home className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>Home</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
        <span className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
          <CurrentIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{current.label}</span>
        </span>
      </div>
    </nav>
  );
};

export default QuickNavHeader;
