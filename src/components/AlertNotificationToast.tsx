import React, { useState, useEffect } from 'react';
import { Bell, X, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { TriggeredAlertEvent } from '../services/alertService';
import { PageId } from './Sidebar';

interface AlertNotificationToastProps {
  onNavigate?: (page: PageId) => void;
}

export const AlertNotificationToast: React.FC<AlertNotificationToastProps> = ({ onNavigate }) => {
  const [activeToasts, setActiveToasts] = useState<TriggeredAlertEvent[]>([]);

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<TriggeredAlertEvent>;
      if (customEvent.detail) {
        const item = customEvent.detail;
        setActiveToasts((prev) => [item, ...prev].slice(0, 5));

        setTimeout(() => {
          setActiveToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, 9000);
      }
    };

    window.addEventListener('predictx_alert_triggered', handleTrigger);
    return () => window.removeEventListener('predictx_alert_triggered', handleTrigger);
  }, []);

  const handleDismiss = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleViewAlerts = (id: string) => {
    handleDismiss(id);
    if (onNavigate) {
      onNavigate('alerts');
    } else {
      window.location.hash = '#alerts';
    }
  };

  if (activeToasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Stock Price Alerts"
    >
      {activeToasts.map((toast) => {
        const isAbove = toast.direction === 'above';
        const isDividend = toast.alertType === 'dividend_yield';
        const formattedTarget = isDividend
          ? `${toast.targetValue}%`
          : `${toast.currencySymbol}${toast.targetValue.toLocaleString()}`;
        const formattedCurrent = isDividend
          ? `${toast.currentValue}%`
          : `${toast.currencySymbol}${toast.currentValue.toLocaleString()}`;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-blue-500/80 dark:border-cyan-500/80 rounded-2xl p-4 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 text-slate-900 dark:text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${
                    isAbove ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {isAbove ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm tracking-tight">{toast.symbol}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {toast.market}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isAbove
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {isAbove ? '≥ Above Target' : '≤ Below Target'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    {toast.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Current / Target</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formattedCurrent}{' '}
                  <span className="text-slate-400 font-normal">vs target {formattedTarget}</span>
                </span>
              </div>

              <button
                onClick={() => handleViewAlerts(toast.id)}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
              >
                <span>View Alert</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
