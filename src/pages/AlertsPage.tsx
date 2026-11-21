import React, { useState, useEffect } from 'react';
import { PriceAlert, MarketType } from '../types';
import { storage } from '../utils/storage';
import { getStockInfo } from '../utils/marketData';
import { fetchStockInfo, fetchBatchStockQuotes } from '../utils/stockApi';
import type { StockInfo } from '../types';
import {
  Bell,
  PlusCircle,
  Trash2,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Coins,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Sparkles,
  Zap,
  Info,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface AlertsPageProps {
  currentSymbol: string;
  currentMarket: MarketType;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ currentSymbol, currentMarket }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>(storage.getAlerts());
  const user = storage.getUser();

  const [alertType, setAlertType] = useState<'price' | 'dividend_yield'>('price');
  const [aMarket, setAMarket] = useState<MarketType>(currentMarket);
  const [aSymbol, setASymbol] = useState(currentSymbol);
  const [aTargetPrice, setATargetPrice] = useState<number>(3000);
  const [aTargetYield, setATargetYield] = useState<number>(2.5);
  const [aDir, setADir] = useState<'above' | 'below'>('above');

  const [filterType, setFilterType] = useState<'all' | 'price' | 'dividend_yield' | 'triggered'>('all');
  const [testResult, setTestResult] = useState<{
    message: string;
    triggeredList: Array<{ symbol: string; type: string; condition: string; currentVal: string }>;
  } | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setAlerts(storage.getAlerts());
    };
    window.addEventListener('predictx_alerts_updated', handleUpdate);
    return () => window.removeEventListener('predictx_alerts_updated', handleUpdate);
  }, []);

  const [infoMap, setInfoMap] = useState<Record<string, StockInfo>>({});
  const infoKey = (sym: string, m: MarketType) => `${sym.toUpperCase().replace(/\.NS|\.BO/, '')}|${m}`;
  const infoFor = (sym: string, m: MarketType): StockInfo => infoMap[infoKey(sym, m)] ?? getStockInfo(sym, m);

  useEffect(() => {
    let cancelled = false;
    const targets = new Map<string, { symbol: string; market: MarketType }>();
    targets.set(infoKey(aSymbol || currentSymbol, aMarket), { symbol: aSymbol || currentSymbol, market: aMarket });
    alerts.forEach((al) => targets.set(infoKey(al.symbol, al.market), { symbol: al.symbol, market: al.market }));
    targets.forEach(async (t, k) => {
      if (infoMap[k]) return;
      const info = await fetchStockInfo(t.symbol, t.market);
      if (info && !cancelled) setInfoMap((prev) => ({ ...prev, [k]: info }));
    });
    return () => { cancelled = true; };
  }, [aSymbol, aMarket, currentSymbol, alerts.length]);

  useEffect(() => {
    setASymbol(currentSymbol);
    setAMarket(currentMarket);
  }, [currentSymbol, currentMarket]);

  const currentStockInfo = infoFor(aSymbol || currentSymbol, aMarket);
  const currentStockYield = currentStockInfo.dividendYield || 0;

  useEffect(() => {
    if (currentStockYield > 0) setATargetYield(Number((currentStockYield * 1.2).toFixed(2)));
  }, [currentStockYield]);

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aSymbol.trim()) return;

    const sym = aSymbol.toUpperCase().trim();
    let newAlert: PriceAlert;

    if (alertType === 'dividend_yield') {
      newAlert = {
        id: `al-div-${Date.now()}`,
        alertType: 'dividend_yield',
        market: aMarket,
        symbol: sym,
        targetYield: Number(aTargetYield),
        targetPrice: 0,
        direction: aDir,
        createdAt: new Date().toISOString().split('T')[0],
        triggered: false,
      };
    } else {
      newAlert = {
        id: `al-prc-${Date.now()}`,
        alertType: 'price',
        market: aMarket,
        symbol: sym,
        targetPrice: Number(aTargetPrice),
        direction: aDir,
        createdAt: new Date().toISOString().split('T')[0],
        triggered: false,
      };
    }

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    storage.saveAlerts(updated);
    window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));

    const desc =
      newAlert.alertType === 'dividend_yield'
        ? `Dividend Yield alert registered for ${sym} (crosses ${newAlert.direction.toUpperCase()} ${newAlert.targetYield}%)`
        : `Price Target alert registered for ${sym} (${newAlert.direction.toUpperCase()} ${aMarket === 'US' ? '$' : '₹'}${newAlert.targetPrice})`;

    setTestResult({
      message: `${desc}. Monitoring active.`,
      triggeredList: [],
    });
  };

  const handleDeleteAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    storage.saveAlerts(updated);
    window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));
  };

  const handleSimulateCheck = async () => {
    const triggeredList: Array<{ symbol: string; type: string; condition: string; currentVal: string }> = [];

    const quotes = await fetchBatchStockQuotes(alerts.map((al) => ({ symbol: al.symbol, market: al.market })));
    const priceOf = (sym: string) => quotes[sym.toUpperCase()]?.price;

    const updated = alerts.map((al) => {
      if (al.alertType === 'dividend_yield') {
        const liveYield = infoFor(al.symbol, al.market).dividendYield;
        if (!liveYield) return al;
        const target = al.targetYield ?? 2.0;
        const meets = al.direction === 'above' ? liveYield >= target : liveYield <= target;
        if (meets) {
          triggeredList.push({
            symbol: al.symbol,
            type: 'Dividend Yield',
            condition: `${al.direction.toUpperCase()} ${target}%`,
            currentVal: `Current Yield: ${liveYield}%`,
          });
          return { ...al, triggered: true };
        }
        return al;
      }

      const price = priceOf(al.symbol);
      if (price === undefined) return al;
      const target = al.targetPrice;
      const meets = al.direction === 'above' ? price >= target : price <= target;
      if (meets) {
        const cur = al.market === 'US' ? '$' : '₹';
        triggeredList.push({
          symbol: al.symbol,
          type: 'Price Target',
          condition: `${al.direction.toUpperCase()} ${cur}${target}`,
          currentVal: `Live price: ${cur}${price.toLocaleString()}`,
        });
        return { ...al, triggered: true };
      }
      return al;
    });

    setAlerts(updated);
    storage.saveAlerts(updated);
    window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));

    setTestResult({
      message: `Evaluated ${alerts.length} alerts against live prices. ${triggeredList.length} triggered.`,
      triggeredList,
    });
  };

  const filteredAlerts = alerts.filter((al) => {
    if (filterType === 'all') return true;
    if (filterType === 'triggered') return al.triggered;
    if (filterType === 'dividend_yield') return al.alertType === 'dividend_yield';
    if (filterType === 'price') return al.alertType !== 'dividend_yield';
    return true;
  });

  const priceAlertCount = alerts.filter((a) => a.alertType !== 'dividend_yield').length;
  const dividendAlertCount = alerts.filter((a) => a.alertType === 'dividend_yield').length;
  const triggeredAlertCount = alerts.filter((a) => a.triggered).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Notification Delivery Status
          </span>
          <div className="flex items-center flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Mail className="w-3.5 h-3.5" /> Email: {user.email} (Active)
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5 font-bold text-slate-500">
              <MessageSquare className="w-3.5 h-3.5" /> SMS: {user.phone || 'Disabled'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400">
              <Coins className="w-3.5 h-3.5" /> Yield Alerts: {dividendAlertCount} Active
            </span>
          </div>
        </div>

        <button
          onClick={handleSimulateCheck}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Check & Evaluate All Alerts Now</span>
        </button>
      </div>

      {testResult && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{testResult.message}</span>
          </div>

          {testResult.triggeredList.length > 0 && (
            <div className="pl-6 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Triggered Threshold Notifications:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {testResult.triggeredList.map((trig, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/60 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white mr-2">
                        {trig.symbol}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {trig.type}
                      </span>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        Target: {trig.condition}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                      {trig.currentVal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Currently Tracked Stock: {currentStockInfo.displaySymbol}</span>
              <span className="text-[11px] font-semibold text-slate-500">· {aMarket}</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live Dividend Yield:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                {currentStockYield}%
              </strong>{' '}
              · 52W Range: {currentStockInfo.currencySymbol}{currentStockInfo.fiftyTwoWeekLow} - {currentStockInfo.currencySymbol}{currentStockInfo.fiftyTwoWeekHigh}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setAlertType('dividend_yield');
            setASymbol(currentStockInfo.displaySymbol);
            setATargetYield(Number((currentStockYield * 1.15).toFixed(2)));
            setADir('above');
          }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Monitor {currentStockInfo.displaySymbol} Yield</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-cyan-500" />
            <span>Create Automated Stock & Dividend Alert</span>
          </h3>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAlertType('price')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                alertType === 'price'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Price Target</span>
            </button>
            <button
              type="button"
              onClick={() => setAlertType('dividend_yield')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                alertType === 'dividend_yield'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Dividend Yield (%)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleAddAlert} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Market</label>
              <select
                value={aMarket}
                onChange={(e) => setAMarket(e.target.value as MarketType)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="US">US</option>
                <option value="INDEX">INDEX</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Symbol</label>
              <input
                type="text"
                value={aSymbol}
                onChange={(e) => setASymbol(e.target.value)}
                placeholder="e.g. RELIANCE"
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold uppercase"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                {alertType === 'dividend_yield' ? 'Yield Condition' : 'Price Condition'}
              </label>
              <select
                value={aDir}
                onChange={(e) => setADir(e.target.value as 'above' | 'below')}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              >
                <option value="above">
                  {alertType === 'dividend_yield' ? 'Yield rises ABOVE (≥)' : 'Price reaches ABOVE (≥)'}
                </option>
                <option value="below">
                  {alertType === 'dividend_yield' ? 'Yield falls BELOW (≤)' : 'Price falls BELOW (≤)'}
                </option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                {alertType === 'dividend_yield' ? 'Target Yield (%)' : 'Target Price (₹/$)'}
              </label>
              {alertType === 'dividend_yield' ? (
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="30"
                    value={aTargetYield}
                    onChange={(e) => setATargetYield(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 pr-7 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  step="0.05"
                  value={aTargetPrice}
                  onChange={(e) => setATargetPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className={`w-full py-2 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  alertType === 'dividend_yield'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {alertType === 'dividend_yield' ? <Coins className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                <span>Save {alertType === 'dividend_yield' ? 'Yield Alert' : 'Price Alert'}</span>
              </button>
            </div>
          </div>

          {alertType === 'dividend_yield' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Current Stock Yield:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  {currentStockYield}%
                </span>
                <span className="text-[11px] text-slate-400">
                  (Difference: {(aTargetYield - currentStockYield).toFixed(2)}%)
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Presets:</span>
                {[1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setATargetYield(val);
                      setADir(val >= currentStockYield ? 'above' : 'below');
                    }}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      aTargetYield === val
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-500" />
              <span>Active Watched Alerts ({alerts.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Continuously monitoring stock price targets and dividend yield thresholds.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilterType('dividend_yield')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filterType === 'dividend_yield'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <Coins className="w-3 h-3" />
              <span>Yield ({dividendAlertCount})</span>
            </button>
            <button
              onClick={() => setFilterType('price')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filterType === 'price'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}
            >
              <Bell className="w-3 h-3" />
              <span>Price ({priceAlertCount})</span>
            </button>
            {triggeredAlertCount > 0 && (
              <button
                onClick={() => setFilterType('triggered')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  filterType === 'triggered'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Triggered ({triggeredAlertCount})</span>
              </button>
            )}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <p>No alerts found matching the selected filter. Create one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAlerts.map((al) => {
              const isDivAlert = al.alertType === 'dividend_yield';
              const stockInfo = infoFor(al.symbol, al.market);
              const liveYield = stockInfo.dividendYield || 0;

              return (
                <div key={al.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {al.symbol}
                      </span>
                      <span className="text-slate-400 text-xs">({al.market})</span>

                      {isDivAlert ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          <Coins className="w-3 h-3" />
                          Dividend Yield Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                          <Bell className="w-3 h-3" />
                          Price Target Alert
                        </span>
                      )}

                      {al.triggered && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          <Zap className="w-3 h-3" />
                          TRIGGERED
                        </span>
                      )}
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {isDivAlert ? (
                        <span>
                          Notify when Dividend Yield crosses{' '}
                          <strong className="uppercase font-bold text-slate-700 dark:text-slate-200">
                            {al.direction} {al.targetYield ?? 0}%
                          </strong>{' '}
                          · (Current Stock Yield: <span className="font-bold text-emerald-600 dark:text-emerald-400">{liveYield}%</span>)
                        </span>
                      ) : (
                        <span>
                          Notify when price goes{' '}
                          <strong className="uppercase font-bold text-slate-700 dark:text-slate-200">
                            {al.direction}
                          </strong>{' '}
                          {al.market === 'US' ? '$' : '₹'}
                          {Number(al.targetPrice ?? 0).toLocaleString()}
                        </span>
                      )}
                      <span className="text-slate-400 ml-2">· Created on {al.createdAt}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        al.triggered
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                          : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                      }`}
                    >
                      {al.triggered ? 'Notification Sent' : 'Monitoring Active'}
                    </span>

                    <button
                      onClick={() => handleDeleteAlert(al.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
