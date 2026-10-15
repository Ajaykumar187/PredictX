import React from 'react';
import {
  TrendingUp, MessageSquare, ArrowLeftRight, Layers, Rocket, Search, Wallet, Landmark, BookOpen, Award, Briefcase, Calculator,
  BarChart2, Cpu, Newspaper, Coins, Building, Menu as MenuIcon,
} from 'lucide-react';
import type { PageId } from './Sidebar';

interface Props {
  onNavigate: (page: PageId) => void;
  onOpenMenu: () => void;
}

interface Feature { id: PageId; title: string; text: string; icon: React.ElementType }

const NO_STOCK_NEEDED: Feature[] = [
  { id: 'ask', title: 'Ask PredictX', text: 'Hinglish mein bol ke ya likh ke poochho. Stock ka naam bolo, wo khud load ho jata hai.', icon: MessageSquare },
  { id: 'options', title: 'Option Chain', text: 'Live NSE option chain, Greeks, PCR aur Max Pain.', icon: Layers },
  { id: 'compare', title: 'Stock Compare', text: 'Do stocks ko side-by-side compare karo.', icon: ArrowLeftRight },
  { id: 'ipo', title: 'IPO & GMP', text: 'Chal rahe IPO, grey market premium aur listing ka andaza.', icon: Rocket },
  { id: 'scanners', title: 'Market Scanners', text: 'Breakout, momentum aur volume wale stocks ek jagah.', icon: Search },
  { id: 'smartmoney', title: 'Smart Money', text: 'FII/DII ki kharidari-bikri aur kis stock mein kiska hissa.', icon: Landmark },
  { id: 'paper', title: 'Paper Trading', text: 'Nakli ₹10 lakh se asli prices par practice, leaderboard ke saath.', icon: Wallet },
  { id: 'trackrecord', title: 'Model Accuracy', text: 'Model ne pehle kitna sahi bataya. Asli backtest, koi dikhawa nahi.', icon: Award },
  { id: 'journal', title: 'Trade Journal', text: 'Apne trades likho aur dekho kahan galti hoti hai.', icon: BookOpen },
  { id: 'portfolio', title: 'Portfolio', text: 'Holdings ka P&L aur risk, diversification score ke saath.', icon: Briefcase },
  { id: 'tools', title: 'Calculators', text: 'Position size, tax, brokerage, SIP, EMI aur aur bhi.', icon: Calculator },
];

const AFTER_SEARCH: Feature[] = [
  { id: 'home', title: '30-Day Forecast', text: 'Target price ek range ke saath, aur signal kyun aaya uski wajah.', icon: TrendingUp },
  { id: 'charts', title: 'Charts', text: 'Technical indicators ke saath interactive charts.', icon: BarChart2 },
  { id: 'ai', title: 'AI Signals & Risk', text: 'BUY/SELL/HOLD signal aur risk radar.', icon: Cpu },
  { id: 'news', title: 'News & Mood', text: 'Asli headlines aur unka mood.', icon: Newspaper },
  { id: 'dividends', title: 'Dividends', text: 'Dividend history, yield aur agli ex-date.', icon: Coins },
  { id: 'company', title: 'Company Info', text: 'Financials aur company ka poora profile.', icon: Building },
];

const Card: React.FC<{ f: Feature; onClick: () => void }> = ({ f, onClick }) => {
  const Icon = f.icon;
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-sm font-extrabold text-slate-900 dark:text-white">{f.title}</div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.text}</p>
    </button>
  );
};

export const LandingHome: React.FC<Props> = ({ onNavigate, onOpenMenu }) => (
  <div className="space-y-8">
    <section className="rounded-3xl p-6 sm:p-8 text-white" style={{ background: 'linear-gradient(135deg, #0a2540 0%, #163f73 100%)' }}>
      <h1 className="text-2xl sm:text-4xl font-black tracking-tight">PredictX mein aapka swagat hai</h1>
      <p className="mt-3 max-w-2xl text-sm sm:text-base text-blue-100/90 leading-relaxed">
        NSE, BSE aur US stocks ka analysis, forecast aur practice, sab ek jagah. Sab kuch Hinglish mein, aur model kitna sahi hai yeh bhi seedha dikhaya jata hai.
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          onClick={() => onNavigate('ask')}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" /> Ask PredictX se shuru karein
        </button>
        <button
          onClick={onOpenMenu}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 font-bold text-sm transition-colors cursor-pointer flex items-center gap-2"
        >
          <MenuIcon className="w-4 h-4" /> Menu kholein
        </button>
      </div>
    </section>

    <section className="space-y-3">
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Abhi use karein</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {NO_STOCK_NEEDED.map((f) => (
          <Card key={f.id} f={f} onClick={() => onNavigate(f.id)} />
        ))}
      </div>
    </section>

    <section className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Kisi stock ko analyze karne par</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Menu se stock search karein (ya Ask PredictX mein naam bolein), phir yeh sab us stock ke liye khul jata hai.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AFTER_SEARCH.map((f) => (
          <div key={f.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mb-2.5">
              <f.icon className="w-4 h-4" />
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{f.title}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default LandingHome;
