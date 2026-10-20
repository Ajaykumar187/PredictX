import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Moon,
  Sun,
  Bell,
  X,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { MarketType, PriceAlert } from '../types';
import { storage } from '../utils/storage';
import { PageId } from './Sidebar';

interface NavbarProps {
  title?: string;
  subtitle?: string;
  theme: 'Light' | 'Dark';
  onToggleTheme: () => void;
  activeStock?: string;
  activeMarket?: MarketType;
  currentPrice?: number;
  change?: number;
  changePct?: number;
  currencySymbol?: string;
  onNavigate?: (page: PageId) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title = 'PredictX',
  subtitle = 'Stock analysis & prediction',
  theme,
  onToggleTheme,
  activeStock = '',
  activeMarket = 'NSE',
  currentPrice,
  change,
  changePct = 0,
  currencySymbol = '₹',
  onNavigate,
}) => {
  const hasStock = !!activeStock;
  const isPositive = change !== undefined ? change >= 0 : changePct >= 0;

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState<number>(0);

  const updateAlertCount = () => {
    const all = storage.getAlerts();
    const forCurrent = all.filter(
      (a) => a.symbol.toUpperCase() === activeStock.toUpperCase() && a.market === activeMarket
    );
    setAlertCount(forCurrent.length);
  };

  useEffect(() => {
    updateAlertCount();
    const handleUpdate = () => updateAlertCount();
    window.addEventListener('predictx_alerts_updated', handleUpdate);
    return () => window.removeEventListener('predictx_alerts_updated', handleUpdate);
  }, [activeStock, activeMarket]);

  useEffect(() => {
    if (currentPrice !== undefined && currentPrice > 0) {
      const defaultMultiplier = alertDirection === 'above' ? 1.05 : 0.95;
      const initialVal = (currentPrice * defaultMultiplier).toFixed(2);
      setTargetPrice(initialVal);
    }
  }, [currentPrice, isAlertModalOpen]);

  const handleOpenModal = () => {
    if (currentPrice !== undefined && currentPrice > 0) {
      const initialVal = (currentPrice * 1.05).toFixed(2);
      setTargetPrice(initialVal);
      setAlertDirection('above');
    }
    setAlertSuccess(null);
    setIsAlertModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAlertModalOpen(false);
    setAlertSuccess(null);
  };

  const handleDirectionChange = (newDir: 'above' | 'below') => {
    setAlertDirection(newDir);
    if (currentPrice !== undefined && currentPrice > 0) {
      const mult = newDir === 'above' ? 1.05 : 0.95;
      setTargetPrice((currentPrice * mult).toFixed(2));
    }
  };

  const handleApplyPreset = (pct: number) => {
    if (currentPrice !== undefined && currentPrice > 0) {
      const calculated = currentPrice * (1 + pct / 100);
      setTargetPrice(calculated.toFixed(2));
      setAlertDirection(pct >= 0 ? 'above' : 'below');
    }
  };

  const handleSaveAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = parseFloat(targetPrice);
    if (isNaN(parsedTarget) || parsedTarget <= 0) return;

    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      market: activeMarket,
      symbol: activeStock.toUpperCase().trim(),
      targetPrice: parsedTarget,
      direction: alertDirection,
      createdAt: new Date().toISOString().split('T')[0],
      triggered: false,
    };

    const existingAlerts = storage.getAlerts();
    const updated = [newAlert, ...existingAlerts];
    storage.saveAlerts(updated);

    window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));
    setAlertSuccess(
      `Price alert created! You'll be notified when ${activeStock} reaches ${alertDirection === 'above' ? '≥' : '≤'} ${currencySymbol}${parsedTarget.toLocaleString()}`
    );
    updateAlertCount();
  };

  const numericTarget = parseFloat(targetPrice);
  const diffFromCurrent =
    currentPrice && !isNaN(numericTarget) && numericTarget > 0
      ? ((numericTarget - currentPrice) / currentPrice) * 100
      : null;

  const userProfile = storage.getUser();

  return (
    <>
      <div className="rounded-2xl px-4 py-3 mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            onClick={() => onNavigate && onNavigate('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onNavigate && onNavigate('home');
            }}
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">{title}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasStock && currentPrice !== undefined && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{activeStock}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {currencySymbol}
                  {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {changePct.toFixed(2)}%
                </span>
              </div>
            )}

            {hasStock && (
              <button
                onClick={handleOpenModal}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                title={`${activeStock} ke liye price alert`}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Alert</span>
                {alertCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-black rounded-full px-1.5 leading-tight">
                    {alertCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              title={`Switch to ${theme === 'Dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'Dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {isAlertModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Set Price Alert
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {activeStock}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {activeMarket} Market · Real-time threshold monitoring
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {currentPrice !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Current Live Price
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {currencySymbol}
                      {currentPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Today's Change
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {change !== undefined && (change >= 0 ? '+' : '-')}
                      {changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {alertSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Alert Successfully Activated!
                      </h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {alertSuccess}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    {onNavigate && (
                      <button
                        onClick={() => {
                          handleCloseModal();
                          onNavigate('alerts');
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>View All Alerts</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setAlertSuccess(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveAlert} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                      Trigger Condition
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('above')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          alertDirection === 'above'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Price Rises Above (≥)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('below')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          alertDirection === 'below'
                            ? 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Price Falls Below (≤)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Custom Target Price
                      </label>
                      {diffFromCurrent !== null && (
                        <span
                          className={`text-[10px] font-bold ${
                            diffFromCurrent >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {diffFromCurrent >= 0 ? '+' : ''}
                          {diffFromCurrent.toFixed(2)}% vs current
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                        {currencySymbol}
                      </div>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="Enter target price"
                        required
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Quick Percentage Targets
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {alertDirection === 'above' ? (
                        <>
                          {[2, 5, 10, 15].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleApplyPreset(pct)}
                              className="py-1 px-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              +{pct}%
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {[-2, -5, -10, -15].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleApplyPreset(pct)}
                              className="py-1 px-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            >
                              {pct}%
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Notification dispatch:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {userProfile.email || 'Dashboard Alerts'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Save Alert</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
