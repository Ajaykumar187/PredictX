import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
  ComposedChart,
  Line,
  Area,
} from 'recharts';
import {
  Coins,
  DollarSign,
  TrendingUp,
  Calendar,
  Zap,
  PieChart as PieChartIcon,
  BarChart3,
  PlusCircle,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Sliders,
  Wallet,
  CalendarDays,
  Percent,
  Layers,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { PortfolioHolding, MarketType, DividendResponse } from '../types';
import { storage } from '../utils/storage';
import { fetchDividends, fetchLiveQuote } from '../utils/stockApi';

interface PortfolioDividendProjectorProps {
  onSelectStock?: (symbol: string, market: MarketType) => void;
  activeSymbol?: string;
}

interface HoldingDividendMetric {
  holding: PortfolioHolding;
  livePrice: number;
  currentValue: number;
  investedValue: number;
  annualPayoutPerShare: number;
  dividendYield: number;
  annualDividendIncome: number;
  monthlyDividendIncome: number;
  yieldOnCost: number;
  frequency: string;
  nextExDate: string | null;
  nextExAmount: number | null;
  isUpcomingAnnounced: boolean;
  currencySymbol: string;
  monthsOfPayment: number[]; // 0-11
}


const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PIE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export const PortfolioDividendProjector: React.FC<PortfolioDividendProjectorProps> = ({
  onSelectStock,
  activeSymbol,
}) => {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    const saved = storage.getPortfolio();
    return saved || [];
  });

  const [dividendMap, setDividendMap] = useState<Record<string, DividendResponse>>({});
  const [quoteMap, setQuoteMap] = useState<Record<string, number>>({});
  const [isLoadingDividends, setIsLoadingDividends] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const [growthRateCAGR, setGrowthRateCAGR] = useState<number>(8.0);
  const [timeHorizonYears, setTimeHorizonYears] = useState<number>(10);
  const [enableDrip, setEnableDrip] = useState<boolean>(true); 
  const [monthlyContribution, setMonthlyContribution] = useState<number>(10000); 

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>('ITC');
  const [newMarket, setNewMarket] = useState<MarketType>('NSE');
  const [newQty, setNewQty] = useState<number>(50);
  const [newBuyPrice, setNewBuyPrice] = useState<number>(450);

  const [chartView, setChartView] = useState<'monthly' | 'distribution' | 'growth'>('monthly');

  const loadDividendData = async (holdingsList: PortfolioHolding[]) => {
    setIsLoadingDividends(true);
    const uniqueTickers = Array.from(new Set(holdingsList.map((h) => `${h.symbol}_${h.market}`)));
    const newMap: Record<string, DividendResponse> = { ...dividendMap };
    const newQuoteMap: Record<string, number> = { ...quoteMap };

    await Promise.all(
      uniqueTickers.map(async (key) => {
        const [sym, m] = key.split('_');
        try {
          const [res, quoteRes] = await Promise.all([
            fetchDividends(sym, m as MarketType),
            fetchLiveQuote(sym, m as MarketType),
          ]);
          if (res) {
            newMap[key] = res;
          }
          if (quoteRes && quoteRes.latestPrice > 0) {
            newQuoteMap[key] = quoteRes.latestPrice;
          }
        } catch (err) {
          console.warn(`[Projector] Failed to fetch live Yahoo Finance data for ${sym}:`, err);
        }
      })
    );

    setDividendMap(newMap);
    setQuoteMap(newQuoteMap);
    setIsLoadingDividends(false);
    setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    loadDividendData(holdings);
  }, [holdings.length]);

  const handleRefresh = () => {
    loadDividendData(holdings);
  };


  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSym = newSymbol.trim().toUpperCase();
    if (!cleanSym) return;

    const newH: PortfolioHolding = {
      id: `hold-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      symbol: cleanSym,
      market: newMarket,
      quantity: Math.max(1, Number(newQty) || 1),
      buyPrice: Math.max(0.1, Number(newBuyPrice) || 100),
      dateAdded: new Date().toISOString().split('T')[0],
    };

    const updated = [...holdings, newH];
    setHoldings(updated);
    storage.savePortfolio(updated);
    setShowAddForm(false);
    setNewSymbol('');
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    const updated = holdings
      .map((h) => {
        if (h.id === id) {
          const nextQ = Math.max(1, h.quantity + delta);
          return { ...h, quantity: nextQ };
        }
        return h;
      })
      .filter((h) => h.quantity > 0);

    setHoldings(updated);
    storage.savePortfolio(updated);
  };

  const handleDeleteHolding = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    storage.savePortfolio(updated);
  };

  const enrichedHoldings = useMemo<HoldingDividendMetric[]>(() => {
    return holdings.map((h) => {
      const key = `${h.symbol}_${h.market}`;
      const divRes = dividendMap[key];
      const cleanUpper = h.symbol.toUpperCase();

      const livePrice = quoteMap[key] || h.buyPrice;
      const currencySymbol = h.market === 'US' ? '$' : '₹';

      const annualPayoutPerShare = divRes?.annualPayout ?? 0;
      const dividendYield = divRes?.dividendYield ?? (livePrice > 0 ? Number(((annualPayoutPerShare / livePrice) * 100).toFixed(2)) : 0);

      const investedValue = h.quantity * h.buyPrice;
      const currentValue = h.quantity * livePrice;
      const annualDividendIncome = h.quantity * annualPayoutPerShare;
      const monthlyDividendIncome = annualDividendIncome / 12;
      const yieldOnCost = investedValue > 0 ? (annualDividendIncome / investedValue) * 100 : 0;

      const frequency = divRes?.frequency || (h.market === 'US' ? 'Quarterly' : 'Semi-Annual');

      let monthsOfPayment: number[] = [4, 10];
      if (divRes?.dividends && divRes.dividends.length > 0) {
        const foundMonths = new Set<number>();
        divRes.dividends.slice(0, 8).forEach((d) => {
          const parts = d.date.split('-');
          if (parts.length >= 2) {
            foundMonths.add(parseInt(parts[1], 10) - 1);
          }
        });
        if (foundMonths.size > 0) {
          monthsOfPayment = Array.from(foundMonths);
        }
      } else {
        if (frequency === 'Quarterly') {
          monthsOfPayment = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
        } else if (cleanUpper === 'TCS') {
          monthsOfPayment = [0, 4, 6, 9]; // Jan, May, Jul, Oct
        } else if (cleanUpper === 'COALINDIA') {
          monthsOfPayment = [1, 7, 8]; // Feb, Aug, Sep
        } else if (cleanUpper === 'ITC') {
          monthsOfPayment = [1, 4]; // Feb, May
        } else if (cleanUpper === 'RELIANCE') {
          monthsOfPayment = [5]; // June
        }
      }

      const nextExDate = divRes?.upcomingDividends?.[0]?.exDate || divRes?.upcomingDividends?.[0]?.date || null;
      const nextExAmount = divRes?.upcomingDividends?.[0]?.amount || null;
      const isUpcomingAnnounced = Boolean(nextExDate && nextExDate >= new Date().toISOString().split('T')[0]);

      return {
        holding: h,
        livePrice,
        currentValue,
        investedValue,
        annualPayoutPerShare,
        dividendYield,
        annualDividendIncome,
        monthlyDividendIncome,
        yieldOnCost,
        frequency,
        nextExDate,
        nextExAmount,
        isUpcomingAnnounced,
        currencySymbol,
        monthsOfPayment,
      };
    });
  }, [holdings, dividendMap]);

  const totals = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalAnnualIncome = 0;
    let upcomingCount = 0;
    let next30DaysIncome = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    enrichedHoldings.forEach((m) => {
      totalInvested += m.investedValue;
      totalCurrentValue += m.currentValue;
      totalAnnualIncome += m.annualDividendIncome;

      if (m.isUpcomingAnnounced) {
        upcomingCount++;
        if (m.nextExDate && m.nextExDate >= todayStr && m.nextExDate <= in30Days) {
          const perShare = m.nextExAmount || m.annualPayoutPerShare / (m.monthsOfPayment.length || 1);
          next30DaysIncome += m.holding.quantity * perShare;
        }
      }
    });

    const monthlyAvg = totalAnnualIncome / 12;
    const dailyAvg = totalAnnualIncome / 365;
    const weightedYield = totalCurrentValue > 0 ? (totalAnnualIncome / totalCurrentValue) * 100 : 0;
    const yieldOnCost = totalInvested > 0 ? (totalAnnualIncome / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalAnnualIncome,
      monthlyAvg,
      dailyAvg,
      weightedYield,
      yieldOnCost,
      upcomingCount,
      next30DaysIncome,
    };
  }, [enrichedHoldings]);

  const monthlyCashflowData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: MONTH_NAMES[i],
      fullName: MONTH_FULL_NAMES[i],
      amount: 0,
      stocks: [] as string[],
    }));

    enrichedHoldings.forEach((h) => {
      if (h.annualDividendIncome <= 0) return;
      const numDistributions = Math.max(1, h.monthsOfPayment.length);
      const amountPerDistribution = h.annualDividendIncome / numDistributions;

      h.monthsOfPayment.forEach((mIdx) => {
        if (mIdx >= 0 && mIdx < 12) {
          months[mIdx].amount += amountPerDistribution;
          months[mIdx].stocks.push(`${h.holding.symbol} (₹${Math.round(amountPerDistribution)})`);
        }
      });
    });

    return months.map((m) => ({
      ...m,
      amount: Math.round(m.amount),
    }));
  }, [enrichedHoldings]);

  const holdingsContributionData = useMemo(() => {
    if (totals.totalAnnualIncome === 0) return [];
    return enrichedHoldings
      .filter((h) => h.annualDividendIncome > 0)
      .map((h) => {
        const pct = (h.annualDividendIncome / totals.totalAnnualIncome) * 100;
        return {
          name: h.holding.symbol,
          value: Math.round(h.annualDividendIncome),
          percentage: Number(pct.toFixed(1)),
          shares: h.holding.quantity,
          yield: h.dividendYield,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [enrichedHoldings, totals.totalAnnualIncome]);

  const multiYearProjectionData = useMemo(() => {
    const data: Array<{
      year: string;
      yearNumber: number;
      cashIncome: number;
      dripIncome: number;
      portfolioValueDrip: number;
      cumulativeDividends: number;
    }> = [];

    const baseAnnual = totals.totalAnnualIncome;
    const basePortfolioVal = totals.totalCurrentValue;
    const gRate = growthRateCAGR / 100;
    const curYield = totals.weightedYield > 0 ? totals.weightedYield / 100 : 0.035;

    let dripPortfolio = basePortfolioVal;
    let cumulative = 0;

    for (let yr = 1; yr <= timeHorizonYears; yr++) {
      const cashIncome = Math.round(baseAnnual * Math.pow(1 + gRate, yr - 1));

      const dripIncome = Math.round(dripPortfolio * curYield * Math.pow(1 + gRate, yr - 1));

      cumulative += enableDrip ? dripIncome : cashIncome;
      dripPortfolio = dripPortfolio + dripIncome + monthlyContribution * 12;

      data.push({
        year: `Year ${yr}`,
        yearNumber: yr,
        cashIncome,
        dripIncome,
        portfolioValueDrip: Math.round(dripPortfolio),
        cumulativeDividends: Math.round(cumulative),
      });
    }

    return data;
  }, [totals, growthRateCAGR, timeHorizonYears, enableDrip, monthlyContribution]);

  const maxMonthlyAmount = Math.max(...monthlyCashflowData.map((m) => m.amount), 100);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 border border-emerald-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                <Wallet className="w-5 h-5 fill-emerald-400" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Portfolio Dividend Income Visualizer
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Real-Time Holdings Sync
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Projected Annual Dividend Income & Cashflow
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Calculates your guaranteed shareholder cashflow, monthly payouts, yield-on-cost, and compounding multi-year growth based on your actual portfolio holdings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={handleRefresh}
              disabled={isLoadingDividends}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh dividend calculations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDividends ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Rates</span>
            </button>

            <button
              onClick={() => setShowAddForm((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Stock</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddHolding}
            className="mt-5 p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-3 relative z-10 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                Add Holding to Dividend Portfolio:
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Stock Ticker</label>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. TCS, ITC, AAPL"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Market</label>
                <select
                  value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value as MarketType)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="NSE">NSE (India)</option>
                  <option value="BSE">BSE (India)</option>
                  <option value="US">US Market</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Quantity (Shares)</label>
                <input
                  type="number"
                  min="1"
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Avg Buy Price (₹/$)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={newBuyPrice}
                  onChange={(e) => setNewBuyPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-sm"
                >
                  Add Holding
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Projected Annual Income</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{Math.round(totals.totalAnnualIncome).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">/ yr</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Daily Passive Income:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              ₹{Math.round(totals.dailyAvg).toLocaleString()}/day
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Cashflow Avg</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
              ₹{Math.round(totals.monthlyAvg).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">/ mo</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Quarterly Avg:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              ₹{Math.round(totals.monthlyAvg * 3).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Yield on Cost (YoC)</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
              {totals.yieldOnCost.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400">on invested</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Current Value Yield:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {totals.weightedYield.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Portfolio Value</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              ₹{Math.round(totals.totalCurrentValue).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Invested Capital:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              ₹{Math.round(totals.totalInvested).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Dividend Income Projections & Visual Breakdown</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Explore month-by-month cashflow distribution, stock-wise contribution, and compounding multi-year reinvestment projections.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setChartView('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartView === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Monthly Cashflow</span>
            </button>

            <button
              onClick={() => setChartView('distribution')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartView === 'distribution'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Stock Contribution</span>
            </button>

            <button
              onClick={() => setChartView('growth')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartView === 'growth'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Multi-Year Growth & DRIP</span>
            </button>
          </div>
        </div>

        {chartView === 'monthly' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <span>
                Projected cash inflow across all 12 calendar months based on historical and scheduled payout distribution:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Peak Month: {monthlyCashflowData.reduce((prev, cur) => (cur.amount > prev.amount ? cur : prev)).fullName} (₹{Math.max(...monthlyCashflowData.map((m) => m.amount)).toLocaleString()})
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5">
                            <span className="font-black text-emerald-400 block">{item.fullName} Dividend Cashflow</span>
                            <div className="text-base font-black text-white">₹{item.amount.toLocaleString()}</div>
                            {item.stocks.length > 0 && (
                              <div className="text-[10px] text-slate-300 pt-1 border-t border-slate-800 space-y-0.5">
                                <span className="font-bold text-slate-400 block">Contributing Stocks:</span>
                                {item.stocks.map((s: string, idx: number) => (
                                  <div key={idx} className="truncate">• {s}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {monthlyCashflowData.map((entry, index) => {
                      const isPeak = entry.amount === Math.max(...monthlyCashflowData.map((m) => m.amount));
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isPeak ? '#10b981' : entry.amount > 0 ? '#3b82f6' : '#cbd5e1'}
                          opacity={entry.amount > 0 ? 0.9 : 0.3}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartView === 'distribution' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={holdingsContributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {holdingsContributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                            <span className="font-bold text-emerald-400 block">{d.name}</span>
                            <div className="font-black text-white">₹{d.value.toLocaleString()} / yr</div>
                            <div className="text-[10px] text-slate-300">
                              {d.percentage}% of portfolio dividend income • {d.shares} shares • {d.yield}% yield
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Top Dividend Income Generators:
              </span>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {holdingsContributionData.map((item, index) => (
                  <div
                    key={item.name}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.shares} shares • {item.yield}% yield
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-xs text-slate-900 dark:text-white block">
                        ₹{item.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">
                        {item.percentage}% share
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {chartView === 'growth' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Annual Dividend Growth CAGR:
                  </label>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {growthRateCAGR}% / yr
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="0.5"
                  value={growthRateCAGR}
                  onChange={(e) => setGrowthRateCAGR(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Expected historical YoY dividend hike rate
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Time Horizon (Years):
                  </label>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {timeHorizonYears} Years
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="25"
                  step="1"
                  value={timeHorizonYears}
                  onChange={(e) => setTimeHorizonYears(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Duration of dividend compounding
                </span>
              </div>

              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={enableDrip}
                    onChange={(e) => setEnableDrip(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Reinvest Dividends (DRIP Mode)</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {enableDrip
                    ? 'Dividends buy more shares annually, compounding future income exponentially.'
                    : 'Dividends are withdrawn as pure cash income without reinvestment.'}
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={multiYearProjectionData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5">
                            <span className="font-black text-emerald-400 block">{item.year} Projected Income</span>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Annual Dividend:</span>
                              <span className="font-extrabold text-white">
                                ₹{(enableDrip ? item.dripIncome : item.cashIncome).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Monthly Cashflow:</span>
                              <span className="font-extrabold text-emerald-400">
                                ₹{Math.round((enableDrip ? item.dripIncome : item.cashIncome) / 12).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Cumulative Dividends:</span>
                              <span className="font-bold text-blue-300">₹{item.cumulativeDividends.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={enableDrip ? 'dripIncome' : 'cashIncome'}
                    fill="#10b981"
                    fillOpacity={0.15}
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Projected Annual Dividend"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Year 1 Income</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  ₹{Math.round(totals.totalAnnualIncome).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Year 5 Projected</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ₹{multiYearProjectionData[Math.min(4, multiYearProjectionData.length - 1)]?.dripIncome.toLocaleString() || '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Year {timeHorizonYears} Projected</span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                  ₹{multiYearProjectionData[multiYearProjectionData.length - 1]?.dripIncome.toLocaleString() || '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cumulative Total Cash</span>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                  ₹{multiYearProjectionData[multiYearProjectionData.length - 1]?.cumulativeDividends.toLocaleString() || '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>Current Holdings & Dividend Payout Metrics</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {holdings.length} Positions
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live per-share payouts, annual dividend contribution, yield-on-cost, and next ex-dates for each holding.
            </p>
          </div>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Shares Held</th>
                <th className="py-3 px-4">Live Price</th>
                <th className="py-3 px-4">Current Value</th>
                <th className="py-3 px-4">Annual Div / Sh</th>
                <th className="py-3 px-4">Annual Income</th>
                <th className="py-3 px-4">Yield on Cost</th>
                <th className="py-3 px-4">Next Ex-Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {enrichedHoldings.map((m) => {
                const isSelected = m.holding.symbol === activeSymbol;
                return (
                  <tr
                    key={m.holding.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 dark:text-white text-xs">
                              {m.holding.symbol}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {m.holding.market}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Bought @ {m.currencySymbol}{m.holding.buyPrice}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateQuantity(m.holding.id, -5)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center cursor-pointer"
                          title="Decrease 5 shares"
                        >
                          -
                        </button>
                        <span className="font-black text-slate-900 dark:text-white px-1">
                          {m.holding.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(m.holding.id, 5)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center cursor-pointer"
                          title="Increase 5 shares"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                      {m.currencySymbol}{m.livePrice.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">
                      {m.currencySymbol}{Math.round(m.currentValue).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-slate-900 dark:text-white block">
                          {m.currencySymbol}{m.annualPayoutPerShare.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                          {m.dividendYield.toFixed(2)}% Yield
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 block text-xs">
                          {m.currencySymbol}{Math.round(m.annualDividendIncome).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          ~{m.currencySymbol}{Math.round(m.monthlyDividendIncome).toLocaleString()}/mo
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-black text-purple-600 dark:text-purple-400">
                        {m.yieldOnCost.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {m.nextExDate ? (
                        <div className="space-y-0.5">
                          <span className={`font-bold block text-[11px] ${
                            m.isUpcomingAnnounced
                              ? 'text-amber-600 dark:text-amber-400 font-black'
                              : 'text-slate-500'
                          }`}>
                            {m.nextExDate}
                          </span>
                          {m.isUpcomingAnnounced && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              ⚡ Upcoming
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">TBD</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onSelectStock && (
                          <button
                            onClick={() => onSelectStock(m.holding.symbol, m.holding.market)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Inspect in Calendar View"
                          >
                            <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteHolding(m.holding.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                          title="Remove from portfolio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioDividendProjector;
