import React, { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Bell,
  X,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Menu,
  User,
} from 'lucide-react';
import { MarketType, PriceAlert } from '../types';
import { AUTH_CHANGED_EVENT, storage } from '../utils/storage';
import { PageId } from './Sidebar';
import { PredictXLogo } from './PredictXLogo';
import { LanguageSelector } from './LanguageSelector';

interface NavbarProps {
  title?: string;
  theme: 'Light' | 'Dark';
  onToggleTheme: () => void;
  activeStock?: string;
  activeMarket?: MarketType;
  currentPrice?: number;
  change?: number;
  changePct?: number;
  currencySymbol?: string;
  onNavigate?: (page: PageId) => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title = 'PredictX',
  theme,
  onToggleTheme,
  activeStock = '',
  activeMarket = 'NSE',
  currentPrice,
  change,
  changePct = 0,
  currencySymbol = '₹',
  onNavigate,
  sidebarOpen = false,
  onToggleSidebar,
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

  const [userProfile, setUserProfile] = useState(() => storage.getUser());
  const [isSignedIn, setIsSignedIn] = useState(() => storage.isLoggedIn());

  useEffect(() => {
    const syncAuth = () => {
      setUserProfile(storage.getUser());
      setIsSignedIn(storage.isLoggedIn());
    };
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 h-14 px-3 sm:px-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 flex items-center justify-between gap-3">
        <div
          className={`flex items-center gap-2.5 min-w-0 transition-opacity duration-200 ${
            sidebarOpen ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100'
          }`}
        >
          {onToggleSidebar && (
            <button
              type="button"
              data-sidebar-toggle="true"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Slide menu left' : 'Open menu'}
              aria-expanded={sidebarOpen}
              title={sidebarOpen ? 'Hide menu' : 'Show menu'}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700/90 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none whitespace-nowrap shrink-0 text-left group"
          >
            <PredictXLogo size={32} className="shrink-0 group-hover:opacity-90 transition-opacity" />
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              {title}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasStock && currentPrice !== undefined && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('home')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={`Open ${activeStock} dashboard`}
            >
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {activeStock}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {currencySymbol}
                {currentPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className={`text-xs font-bold font-mono tabular-nums ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {changePct.toFixed(2)}%
              </span>
            </button>
          )}

          {hasStock && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={`Set price alert for ${activeStock}`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alert</span>
              {alertCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold font-mono tabular-nums rounded-md px-1.5 py-0.5 leading-none">
                  {alertCount}
                </span>
              )}
            </button>
          )}

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('account')}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSignedIn
                  ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/70'
                  : 'border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              title={isSignedIn ? `Signed in as ${userProfile.username}` : 'Register or sign in'}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {isSignedIn ? userProfile.username : 'Account'}
              </span>
            </button>
          )}

          <LanguageSelector variant="compact" align="right" />

          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title={`Switch to ${theme === 'Dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'Dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {isAlertModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Set Price Alert · {activeStock}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeMarket} Market · Threshold monitoring
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {currentPrice !== undefined && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                      Current Live Price
                    </span>
                    <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                      {currencySymbol}
                      {currentPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                      Today&apos;s Change
                    </span>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
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
                        Alert Activated
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {alertSuccess}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseModal();
                          onNavigate('alerts');
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>View All Alerts</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAlertSuccess(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveAlert} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Trigger Condition
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('above')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          alertDirection === 'above'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Rises Above (≥)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('below')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          alertDirection === 'below'
                            ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500/60 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Falls Below (≤)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Target Price
                      </label>
                      {diffFromCurrent !== null && (
                        <span
                          className={`text-xs font-mono tabular-nums font-semibold ${
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
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
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
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                      Quick Percentage Targets
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(alertDirection === 'above' ? [2, 5, 10, 15] : [-2, -5, -10, -15]).map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleApplyPreset(pct)}
                          className={`py-1.5 px-2 text-xs font-semibold font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer ${
                            pct > 0
                              ? 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-300'
                              : 'hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-700 dark:hover:text-rose-300'
                          }`}
                        >
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Notification channel</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {userProfile.email || 'Dashboard Alerts'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
