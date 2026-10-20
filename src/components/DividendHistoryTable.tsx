import React, { useState, useMemo, useEffect } from 'react';
import { DividendPayout } from '../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Copy,
  Check,
  DollarSign,
  Calculator,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarDays,
  FileSpreadsheet,
} from 'lucide-react';

export interface DividendHistoryTableProps {
  dividends: DividendPayout[];
  upcomingDividends?: DividendPayout[];
  currencySymbol?: string;
  symbol?: string;
  latestPrice?: number;
  initialYear?: string;
  onSelectYear?: (year: string) => void;
}

type SortField = 'date' | 'type' | 'year' | 'amount';
type SortDirection = 'asc' | 'desc';

export const DividendHistoryTable: React.FC<DividendHistoryTableProps> = ({
  dividends = [],
  upcomingDividends = [],
  currencySymbol = '$',
  symbol = 'STOCK',
  latestPrice = 0,
  initialYear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(initialYear || 'all');

  useEffect(() => {
    if (initialYear) {
      setSelectedYear(initialYear);
    }
  }, [initialYear]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [holdingShares, setHoldingShares] = useState<number>(100);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const normalizedRecords = useMemo(() => {
    const list: (DividendPayout & { computedYear: number })[] = [];
    const seen = new Set<string>();

    const all = [...dividends];
    if (upcomingDividends && upcomingDividends.length > 0) {
      all.unshift(...upcomingDividends);
    }

    for (const d of all) {
      const yearVal =
        d.year ||
        (d.date ? parseInt(d.date.slice(0, 4), 10) : new Date().getFullYear());
      const key = `${d.date}_${d.amount}_${d.type || 'Dividend'}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          ...d,
          computedYear: isNaN(yearVal) ? new Date().getFullYear() : yearVal,
          status: d.status || (d.isUpcoming ? 'expected' : 'paid'),
        });
      }
    }

    return list;
  }, [dividends, upcomingDividends]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(normalizedRecords.map((r) => String(r.computedYear))));
    return years.sort((a, b) => b.localeCompare(a));
  }, [normalizedRecords]);

  const availableTypes = useMemo(() => {
    const types = Array.from(
      new Set(
        normalizedRecords.map((r) => (r.type && r.type.trim() ? r.type.trim() : 'Regular'))
      )
    );
    return types.sort();
  }, [normalizedRecords]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'amount' || field === 'date' || field === 'year' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const processedRecords = useMemo(() => {
    let result = normalizedRecords.filter((item) => {
      // Year filter
      if (selectedYear !== 'all' && String(item.computedYear) !== selectedYear) {
        return false;
      }

      const itemType = item.type && item.type.trim() ? item.type.trim() : 'Regular';
      if (selectedType !== 'all' && itemType.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDate = item.date.toLowerCase().includes(q);
        const matchesYear = String(item.computedYear).includes(q);
        const matchesType = (item.type || '').toLowerCase().includes(q);
        const matchesAmount = item.amount.toString().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        return matchesDate || matchesYear || matchesType || matchesAmount || matchesNotes;
      }

      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortField === 'year') {
        comparison = a.computedYear - b.computedYear;
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'type') {
        const typeA = a.type || 'Regular';
        const typeB = b.type || 'Regular';
        comparison = typeA.localeCompare(typeB);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [normalizedRecords, selectedYear, selectedType, searchQuery, sortField, sortDirection]);

  const stats = useMemo(() => {
    const count = processedRecords.length;
    const totalAmount = processedRecords.reduce((acc, r) => acc + r.amount, 0);
    const avgAmount = count > 0 ? totalAmount / count : 0;
    const maxAmount = count > 0 ? Math.max(...processedRecords.map((r) => r.amount)) : 0;
    const maxRecord = processedRecords.find((r) => r.amount === maxAmount);

    return {
      count,
      totalAmount,
      avgAmount,
      maxAmount,
      maxRecord,
    };
  }, [processedRecords]);

  const totalPages = Math.max(1, Math.ceil(processedRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    if (pageSize >= processedRecords.length) return processedRecords;
    const startIndex = (currentPage - 1) * pageSize;
    return processedRecords.slice(startIndex, startIndex + pageSize);
  }, [processedRecords, currentPage, pageSize]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return { primary: 'N/A', secondary: '' };
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const formatted = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        return { primary: formatted, secondary: `${weekday} • ${dateStr}` };
      }
    } catch {
    }
    return { primary: dateStr, secondary: '' };
  };

  const getTypeBadgeStyle = (type?: string) => {
    const t = (type || 'Regular').toLowerCase();
    if (t.includes('final') || t.includes('annual')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
    if (t.includes('interim')) {
      return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
    }
    if (t.includes('special') || t.includes('bonus')) {
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
    }
    if (t.includes('quarterly')) {
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    }
    return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
  };

  const exportCsv = () => {
    const headers = ['Date', 'Type', 'Year', 'Amount', 'Currency', 'Symbol', 'Status'];
    const rows = processedRecords.map((r) => [
      r.date,
      `"${r.type || 'Regular'}"`,
      r.computedYear,
      r.amount.toFixed(2),
      currencySymbol,
      symbol,
      r.status || 'paid',
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${symbol}_dividend_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyCsv = () => {
    const headers = ['Date', 'Type', 'Year', 'Amount', 'Currency'];
    const rows = processedRecords.map((r) => [
      r.date,
      r.type || 'Regular',
      r.computedYear,
      r.amount.toFixed(2),
      currencySymbol,
    ]);
    const csvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
    navigator.clipboard.writeText(csvContent);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-500 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-500 ml-1 inline" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Distributions
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {stats.count}
            </span>
            <span className="text-[10px] text-slate-400">payments</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Across {availableYears.length} recorded years
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Cumulative Total Paid
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {currencySymbol}{stats.totalAmount.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">/ share</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            For {holdingShares} shares: {currencySymbol}{(stats.totalAmount * holdingShares).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Average Per Payment
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">
              {currencySymbol}{stats.avgAmount.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">/ share</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Avg payout per declaration
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Highest Single Payout
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
              {currencySymbol}{stats.maxAmount.toFixed(2)}
            </span>
            {stats.maxRecord && (
              <span className="text-[10px] text-slate-400">({stats.maxRecord.computedYear})</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {stats.maxRecord?.type || 'Record'} on {stats.maxRecord?.date || 'N/A'}
          </span>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by date (YYYY-MM-DD), year, type, or note..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              >
                <option value="all">All Years ({normalizedRecords.length})</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              >
                <option value="all">All Types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                showCalculator
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
              }`}
              title="Toggle Shareholder Income Calculator"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Income Calc</span>
            </button>

            <button
              onClick={copyCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
              title="Copy table to clipboard as TSV/CSV"
            >
              {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCsv ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={exportCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
              title="Export table as CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {showCalculator && (
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Simulate Cash Dividends Received
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter your shares held to calculate exact historical payout amounts
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Shares:</span>
              <div className="flex items-center gap-1">
                {[50, 100, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setHoldingShares(preset)}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all ${
                      holdingShares === preset
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={holdingShares}
                onChange={(e) => setHoldingShares(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 select-none">
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                    <span>Date</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('type')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    {renderSortIndicator('type')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('year')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                    <span>Year</span>
                    {renderSortIndicator('year')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('amount')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                    <span>Amount</span>
                    {renderSortIndicator('amount')}
                  </div>
                </th>

                <th className="py-3 px-4 text-right hidden sm:table-cell">
                  <span>Yield on Price</span>
                </th>

                <th className="py-3 px-4 text-right hidden md:table-cell">
                  <span>Income ({holdingShares} sh)</span>
                </th>

                <th className="py-3 px-4 text-right">
                  <span>Status</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-200">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No dividend records found
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Try resetting your search query or year filter.
                      </p>
                      {(searchQuery || selectedYear !== 'all' || selectedType !== 'all') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedYear('all');
                            setSelectedType('all');
                          }}
                          className="mt-2 text-xs font-bold text-emerald-600 hover:underline inline-block cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item, idx) => {
                  const dateInfo = formatDateDisplay(item.date);
                  const isExpected = item.status === 'expected' || item.isUpcoming;
                  const yieldOnCurrent =
                    latestPrice > 0 ? ((item.amount / latestPrice) * 100).toFixed(2) : null;
                  const shareIncome = (item.amount * holdingShares).toFixed(2);
                  const isMax = stats.maxAmount > 0 && item.amount === stats.maxAmount;

                  return (
                    <tr
                      key={`${item.date}-${item.amount}-${idx}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isExpected
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:text-emerald-500'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block text-xs">
                              {dateInfo.primary}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {dateInfo.secondary || item.date}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide ${getTypeBadgeStyle(
                            item.type
                          )}`}
                        >
                          {item.type || 'Regular Dividend'}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1 max-w-[140px]" title={item.notes}>
                            {item.notes}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                          {item.computedYear}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                              {currencySymbol}{item.amount.toFixed(2)}
                            </span>
                            {isMax && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                title="Highest single payout in evaluated period"
                              >
                                Max
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">per share</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        {yieldOnCurrent ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {yieldOnCurrent}%
                            </span>
                            <span className="text-[10px] text-slate-400">of current price</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right hidden md:table-cell">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol}{shareIncome}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isExpected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25">
                            <Clock className="w-3 h-3" />
                            <span>Expected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>
              Showing{' '}
              <strong className="text-slate-900 dark:text-white">
                {processedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, processedRecords.length)}
              </strong>{' '}
              of <strong className="text-slate-900 dark:text-white">{processedRecords.length}</strong>{' '}
              declarations
            </span>

            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[11px]">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={1000}>All</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return (
                    <span key={pageNum} className="px-1 text-slate-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
