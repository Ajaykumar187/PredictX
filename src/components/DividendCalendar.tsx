import React, { useState, useMemo, useEffect } from 'react';
import { DividendPayout, DividendResponse } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
  DollarSign,
  TrendingUp,
  Sparkles,
  Info,
  CalendarDays,
  ListFilter,
  ArrowRight,
  Layers,
  Zap,
  ShieldAlert,
  BellRing,
  HelpCircle,
  Bookmark,
} from 'lucide-react';

interface DividendCalendarProps {
  dividendData: DividendResponse;
  symbol: string;
  currencySymbol: string;
  latestPrice: number;
}

interface CalendarDayItem {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  exEvents: DividendPayout[];
  paymentEvents: DividendPayout[];
  allEvents: DividendPayout[];
}

export const DividendCalendar: React.FC<DividendCalendarProps> = ({
  dividendData,
  symbol,
  currencySymbol,
  latestPrice,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDateStr = today.toISOString().split('T')[0];

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const monthShortNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const formatDateNice = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
    }
    return dateStr;
  };

  const getCumDividendBuyDate = (exDateStr: string) => {
    try {
      const parts = exDateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setDate(d.getDate() - 1);
        if (d.getDay() === 0) d.setDate(d.getDate() - 2);
        else if (d.getDay() === 6) d.setDate(d.getDate() - 1); 
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
    }
    return '1 trading day prior';
  };

  const allEvents: DividendPayout[] = useMemo(() => {
    const list: DividendPayout[] = [];
    const seen = new Set<string>();

    if (dividendData.upcomingDividends && dividendData.upcomingDividends.length > 0) {
      for (const d of dividendData.upcomingDividends) {
        const key = `${d.date}_${d.amount}_upcoming`;
        if (!seen.has(key)) {
          seen.add(key);
          const exDate = d.exDate || d.date;
          let paymentDate = d.paymentDate;
          if (!paymentDate) {
            const exD = new Date(exDate);
            paymentDate = new Date(exD.getTime() + 16 * 86400000).toISOString().split('T')[0];
          }
          list.push({
            ...d,
            exDate,
            paymentDate,
            status: d.status || 'expected',
            isUpcoming: true,
          });
        }
      }
    }

    if (dividendData.dividends && dividendData.dividends.length > 0) {
      for (const d of dividendData.dividends) {
        const isFuture = d.date >= todayDateStr;
        const key = `${d.date}_${d.amount}_${isFuture ? 'upcoming' : 'paid'}`;
        if (!seen.has(key)) {
          seen.add(key);
          const exDate = d.exDate || d.date;
          const paymentDate = d.paymentDate || d.date;
          list.push({
            ...d,
            exDate,
            paymentDate,
            status: d.status || (isFuture ? 'expected' : 'paid'),
            isUpcoming: isFuture,
          });
        }
      }
    }
    return list.sort((a, b) => (b.exDate || b.date).localeCompare(a.exDate || a.date));
  }, [dividendData, todayDateStr]);

  const currentYearUpcoming = useMemo(() => {
    return allEvents
      .filter((e) => {
        const exY = parseInt((e.exDate || e.date).split('-')[0], 10);
        return exY === todayYear && (e.isUpcoming || (e.exDate || e.date) >= todayDateStr);
      })
      .sort((a, b) => (a.exDate || a.date).localeCompare(b.exDate || b.date));
  }, [allEvents, todayYear, todayDateStr]);

  const allUpcoming = useMemo(() => {
    return allEvents
      .filter((e) => e.isUpcoming || (e.exDate || e.date) >= todayDateStr)
      .sort((a, b) => (a.exDate || a.date).localeCompare(b.exDate || b.date));
  }, [allEvents, todayDateStr]);

  const nextExDividend = useMemo(() => {
    return allUpcoming.length > 0 ? allUpcoming[0] : null;
  }, [allUpcoming]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    allEvents.forEach((d) => {
      const y = parseInt((d.exDate || d.date).split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    yearsSet.add(todayYear);
    yearsSet.add(todayYear + 1);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [allEvents, todayYear]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (nextExDividend) {
      const y = parseInt((nextExDividend.exDate || nextExDividend.date).split('-')[0], 10);
      return !isNaN(y) ? y : todayYear;
    }
    return todayYear;
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (nextExDividend) {
      const parts = (nextExDividend.exDate || nextExDividend.date).split('-');
      if (parts.length >= 2) {
        return parseInt(parts[1], 10) - 1;
      }
    }
    return todayMonth;
  });

  useEffect(() => {
    if (nextExDividend) {
      const parts = (nextExDividend.exDate || nextExDividend.date).split('-');
      if (parts.length >= 2) {
        setSelectedYear(parseInt(parts[0], 10));
        setSelectedMonth(parseInt(parts[1], 10) - 1);
        setSelectedEvent(nextExDividend);
        return;
      }
    }
    setSelectedYear(todayYear);
    setSelectedMonth(todayMonth);
    setSelectedEvent(allEvents.length > 0 ? allEvents[0] : null);
  }, [symbol, nextExDividend, allEvents, todayYear, todayMonth]);

  const [viewMode, setViewMode] = useState<'calendar' | 'yearView' | 'timeline'>('calendar');
  const [filterHighlight, setFilterHighlight] = useState<'all' | 'exOnly' | 'upcomingOnly'>('all');
  const [selectedEvent, setSelectedEvent] = useState<DividendPayout | null>(nextExDividend || allEvents[0] || null);
  const [sharesHeld, setSharesHeld] = useState<number>(100);
  const [copiedSchedule, setCopiedSchedule] = useState<boolean>(false);
  const [showExplainer, setShowExplainer] = useState<boolean>(false);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentYear = () => {
    setSelectedYear(todayYear);
    setSelectedMonth(todayMonth);
  };

  const handleJumpToNextDividend = () => {
    if (nextExDividend) {
      const parts = (nextExDividend.exDate || nextExDividend.date).split('-');
      if (parts.length >= 2) {
        setSelectedYear(parseInt(parts[0], 10));
        setSelectedMonth(parseInt(parts[1], 10) - 1);
        setSelectedEvent(nextExDividend);
      }
    }
  };

  const calendarDays = useMemo<CalendarDayItem[]>(() => {
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();

    const days: CalendarDayItem[] = [];

    const getEventsForDate = (dateStr: string) => {
      const exEvents = allEvents.filter((e) => (e.exDate || e.date) === dateStr);
      const paymentEvents = allEvents.filter((e) => e.paymentDate === dateStr && (e.exDate || e.date) !== dateStr);
      const allMatching = Array.from(new Set([...exEvents, ...paymentEvents]));
      return { exEvents, paymentEvents, allEvents: allMatching };
    };

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const { exEvents, paymentEvents, allEvents: matched } = getEventsForDate(dateStr);
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dateStr === todayDateStr,
        exEvents,
        paymentEvents,
        allEvents: matched,
      });
    }

    for (let dNum = 1; dNum <= totalDaysInMonth; dNum++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const { exEvents, paymentEvents, allEvents: matched } = getEventsForDate(dateStr);
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: true,
        isToday: dateStr === todayDateStr,
        exEvents,
        paymentEvents,
        allEvents: matched,
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = selectedMonth === 11 ? 0 : selectedMonth + 1;
      const nextY = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const { exEvents, paymentEvents, allEvents: matched } = getEventsForDate(dateStr);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayDateStr,
        exEvents,
        paymentEvents,
        allEvents: matched,
      });
    }

    return days;
  }, [selectedYear, selectedMonth, allEvents, todayDateStr]);

  const activeMonthEvents = useMemo(() => {
    return allEvents.filter((e) => {
      const d = e.exDate || e.date;
      const parts = d.split('-');
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) === selectedYear && parseInt(parts[1], 10) - 1 === selectedMonth;
      }
      return false;
    });
  }, [allEvents, selectedYear, selectedMonth]);

  const getDaysDiff = (dateStr: string) => {
    const target = new Date(dateStr);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const projectedMetrics = useMemo(() => {
    const shares = Math.max(0, sharesHeld || 0);
    const nextAmount = nextExDividend ? nextExDividend.amount * shares : 0;
    const annualEst = (dividendData.annualPayout || 0) * shares;
    const monthlyAvg = annualEst / 12;
    const portfolioValue = latestPrice * shares;
    const yieldOnCost = portfolioValue > 0 ? ((annualEst / portfolioValue) * 100).toFixed(2) : '0.00';

    return {
      nextAmount,
      annualEst,
      monthlyAvg,
      portfolioValue,
      yieldOnCost,
    };
  }, [sharesHeld, nextExDividend, dividendData.annualPayout, latestPrice]);

  const eventsCountPerMonth = useMemo(() => {
    const counts = Array(12).fill(0);
    const hasUpcoming = Array(12).fill(false);
    allEvents.forEach((e) => {
      const d = e.exDate || e.date;
      const parts = d.split('-');
      if (parts.length >= 2 && parseInt(parts[0], 10) === selectedYear) {
        const m = parseInt(parts[1], 10) - 1;
        if (m >= 0 && m < 12) {
          counts[m]++;
          if (e.isUpcoming || d >= todayDateStr) {
            hasUpcoming[m] = true;
          }
        }
      }
    });
    return { counts, hasUpcoming };
  }, [allEvents, selectedYear, todayDateStr]);

  const handleExportICS = () => {
    const upcomingList = allEvents.filter((e) => e.isUpcoming || (e.exDate || e.date) >= todayDateStr);
    if (upcomingList.length === 0) {
      alert('No upcoming dividend dates found to export.');
      return;
    }

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PredictX//Dividend Income Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${symbol} Ex-Dividend & Payment Schedule`,
    ];

    upcomingList.forEach((div) => {
      const exDate = div.exDate || div.date;
      const dtParts = exDate.split('-');
      const dtStr = `${dtParts[0]}${dtParts[1]}${dtParts[2]}`;
      const payoutForShares = (div.amount * (sharesHeld || 100)).toFixed(2);
      const uid = `div-${symbol}-${exDate}-${Math.random().toString(36).substring(2, 9)}@predictx.app`;

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStr}T090000Z`,
        `DTSTART;VALUE=DATE:${dtStr}`,
        `SUMMARY:⚡ EX-DIVIDEND: ${symbol} (${currencySymbol}${div.amount.toFixed(2)}/sh)`,
        `DESCRIPTION:${symbol} Ex-Dividend Date cutoff.\\nMust hold shares before this date to receive dividend.\\nAmount: ${currencySymbol}${div.amount.toFixed(2)}/share.\\nTotal for ${sharesHeld} shares: ${currencySymbol}${payoutForShares}.\\nExpected Payment Date: ${div.paymentDate || 'TBD'}.`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${symbol} Ex-Dividend Date is Tomorrow!`,
        'END:VALARM',
        'END:VEVENT'
      );
    });

    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${symbol}_ExDividend_Schedule_${selectedYear}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySchedule = () => {
    const lines = [
      `📅 ${symbol} ${selectedYear} Dividend Calendar (${currencySymbol})`,
      `Shares Tracked: ${sharesHeld} | Annual Est: ${currencySymbol}${projectedMetrics.annualEst.toFixed(2)}`,
      '------------------------------------------------',
      ...allEvents.slice(0, 12).map((e) => {
        const total = (e.amount * sharesHeld).toFixed(2);
        const statusLabel = e.isUpcoming || (e.exDate || e.date) >= todayDateStr ? '🕒 UPCOMING' : '✅ PAID';
        return `Ex-Date: ${e.exDate || e.date} | Pay: ${e.paymentDate || 'TBD'} | ${e.type || 'Dividend'}: ${currencySymbol}${e.amount.toFixed(2)}/sh (${currencySymbol}${total}) [${statusLabel}]`;
      }),
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSchedule(true);
    setTimeout(() => setCopiedSchedule(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                <Zap className="w-4 h-4 fill-amber-400" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Dividend Calendar & Ex-Date Radar
              </span>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Year {selectedYear}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white flex flex-wrap items-center gap-2">
              <span>{symbol} {nextExDividend ? 'Official Upcoming Ex-Dividend Calendar' : 'Dividend & Payout Calendar'}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Yahoo Finance Live
              </span>
            </h3>

            {nextExDividend ? (
              <div className="p-3.5 rounded-xl bg-slate-800/95 border border-amber-500/50 space-y-2 backdrop-blur-md shadow-lg">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-sm">
                    <Zap className="w-3 h-3 fill-slate-950" />
                    OFFICIAL ANNOUNCED EX-DATE
                  </span>
                  <strong className="text-amber-300 font-black text-sm">
                    {formatDateNice(nextExDividend.exDate || nextExDividend.date)}
                  </strong>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/40">
                    {getDaysDiff(nextExDividend.exDate || nextExDividend.date) > 0
                      ? `In ${getDaysDiff(nextExDividend.exDate || nextExDividend.date)} days`
                      : getDaysDiff(nextExDividend.exDate || nextExDividend.date) === 0
                      ? 'Today!'
                      : `${Math.abs(getDaysDiff(nextExDividend.exDate || nextExDividend.date))} days ago`}
                  </span>
                  <span className="text-slate-300 font-bold">
                    • {currencySymbol}{nextExDividend.amount.toFixed(2)}/sh ({nextExDividend.type || 'Dividend'})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 font-medium pt-1 border-t border-slate-700/60">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong>Eligibility Rule:</strong> Must buy shares before market close on{' '}
                    <span className="underline decoration-amber-400 font-bold">
                      {getCumDividendBuyDate(nextExDividend.exDate || nextExDividend.date)}
                    </span>{' '}
                    to qualify for this payout.
                  </span>
                </div>
              </div>
            ) : dividendData.dividends && dividendData.dividends.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-2 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[11px] border border-blue-500/40">
                      LAST EX-DIVIDEND: {formatDateNice(dividendData.lastExDate || dividendData.dividends[0].date)}
                    </span>
                    <span className="text-slate-300 font-bold">
                      • {currencySymbol}{(dividendData.lastDividendAmount || dividendData.dividends[0].amount).toFixed(2)}/share
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const dStr = dividendData.lastExDate || dividendData.dividends[0].date;
                      const parts = dStr.split('-');
                      if (parts.length >= 2) {
                        setSelectedYear(parseInt(parts[0], 10));
                        setSelectedMonth(parseInt(parts[1], 10) - 1);
                        setSelectedEvent(dividendData.dividends[0]);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-[11px] font-bold border border-blue-500/40 transition-colors cursor-pointer"
                  >
                    Jump to Last Paid Month →
                  </button>
                </div>
                <p className="text-[11px] text-slate-300">
                  No upcoming ex-dividend date has been announced yet by <strong>{symbol}</strong> on Yahoo Finance. Below are all verified historical payouts.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1 backdrop-blur-md">
                <p className="text-xs text-slate-300">
                  <strong>Zero Dividend:</strong> According to Yahoo Finance, <strong>{symbol}</strong> does not distribute cash dividends.
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-700/80 sm:w-auto w-full min-w-[300px]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Your Shares in Portfolio:
              </span>
              <div className="flex items-center gap-1">
                {[25, 50, 100, 500].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSharesHeld(count)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                      sharesHeld === count
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={sharesHeld}
                onChange={(e) => setSharesHeld(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-extrabold text-sm focus:outline-none focus:border-emerald-500 text-center"
              />
              <div className="flex-1 text-right">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">
                  Next Payout for You
                </div>
                <div className="text-lg font-black text-emerald-400">
                  {currencySymbol}{projectedMetrics.nextAmount.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300">
              <span>Projected Annual Income:</span>
              <strong className="text-cyan-400 font-extrabold">
                {currencySymbol}{projectedMetrics.annualEst.toFixed(2)}/yr
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Monthly Grid</span>
            </button>
            <button
              onClick={() => setViewMode('yearView')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'yearView'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>12-Month Year View</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Timeline Schedule</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} {yr === todayYear ? '(Current)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleJumpToCurrentYear}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ml-1 ${
                selectedYear === todayYear && selectedMonth === todayMonth
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title="Jump to Current Month and Year"
            >
              Current ({todayYear})
            </button>

            {nextExDividend && (
              <button
                onClick={handleJumpToNextDividend}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-extrabold transition-colors flex items-center gap-1"
                title="Jump to Next Expected Ex-Dividend"
              >
                <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>Next Ex-Date</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleCopySchedule}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700"
              title="Copy Schedule Summary"
            >
              {copiedSchedule ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchedule ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleExportICS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
              title="Download .ics Calendar File"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Add to Calendar (.ics)</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-0.5">
            <span>{selectedYear} Months:</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Filter view:</span>
              <button
                onClick={() => setFilterHighlight('all')}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                  filterHighlight === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterHighlight('exOnly')}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors flex items-center gap-0.5 ${
                  filterHighlight === 'exOnly'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                Ex-Dates Only
              </button>
              <button
                onClick={() => setFilterHighlight('upcomingOnly')}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                  filterHighlight === 'upcomingOnly'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                Upcoming Only
              </button>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {monthShortNames.map((mShort, idx) => {
              const count = eventsCountPerMonth.counts[idx];
              const hasUp = eventsCountPerMonth.hasUpcoming[idx];
              const isSelected = selectedMonth === idx;
              const isCurrentCalendarMonth = selectedYear === todayYear && todayMonth === idx;

              return (
                <button
                  key={mShort}
                  onClick={() => {
                    setSelectedMonth(idx);
                    if (viewMode !== 'calendar') setViewMode('calendar');
                  }}
                  className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all relative ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-500/20'
                      : isCurrentCalendarMonth
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-extrabold">{mShort}</span>
                  {count > 0 ? (
                    <span
                      className={`text-[9px] font-black mt-0.5 px-1 rounded-full flex items-center gap-0.5 ${
                        isSelected
                          ? 'bg-emerald-800 text-emerald-100'
                          : hasUp
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {hasUp && <Zap className="w-2 h-2 fill-current" />}
                      {count}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 mt-0.5 opacity-40">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-700 dark:text-amber-400 font-black text-[10px] flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5 fill-current" /> EX-DATE
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Ex-Dividend Cutoff</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/60 text-emerald-700 dark:text-emerald-400 font-black text-[10px]">
              💳 PAYOUT
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Payment Date</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-500/20 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">Today</span>
          </div>
        </div>

        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 ml-auto"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{showExplainer ? 'Hide Ex-Dividend Guide' : 'What is an Ex-Dividend Date?'}</span>
        </button>
      </div>

      {showExplainer && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 text-xs space-y-3">
          <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-black text-sm">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Understanding Dividend Milestone Dates & Cutoff Rules</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            When a company distributes dividends, four milestone dates dictate your eligibility to receive the payment:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-1">
              <span className="font-black text-slate-900 dark:text-white block">1. Declaration Date</span>
              <p className="text-slate-500 text-[11px]">The Board approves the dividend amount and officially announces key dates.</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/40 space-y-1">
              <span className="font-black text-amber-700 dark:text-amber-300 block flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" /> 2. Ex-Dividend Date
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                <strong>CRITICAL CUTOFF:</strong> You must own shares BEFORE this date to receive the dividend. Shares bought on or after the Ex-Date do not qualify!
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-1">
              <span className="font-black text-slate-900 dark:text-white block">3. Record Date</span>
              <p className="text-slate-500 text-[11px]">The company reviews its shareholder ledger to confirm all eligible holders.</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/40 space-y-1">
              <span className="font-black text-emerald-700 dark:text-emerald-300 block">4. Payment Date</span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">The dividend money is directly credited into your bank or brokerage account.</p>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{monthNames[selectedMonth]} {selectedYear}</span>
                {selectedYear === todayYear && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                    Current Year
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeMonthEvents.length > 0 ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {activeMonthEvents.length} dividend event(s) scheduled in {monthNames[selectedMonth]} {selectedYear}
                  </span>
                ) : (
                  <span>No dividend events scheduled for this month</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/80 text-center text-xs font-black text-slate-500 dark:text-slate-400 py-2.5">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
            {calendarDays.map((cell, idx) => {
              const hasExEvents = cell.exEvents.length > 0;
              const hasPayEvents = cell.paymentEvents.length > 0;
              const hasAnyEvents = cell.allEvents.length > 0;

              let isHighlighted = false;
              if (filterHighlight === 'exOnly') {
                isHighlighted = hasExEvents;
              } else if (filterHighlight === 'upcomingOnly') {
                isHighlighted = cell.allEvents.some((e) => e.isUpcoming || (e.exDate || e.date) >= todayDateStr);
              } else {
                isHighlighted = hasAnyEvents;
              }

              const isSelected = selectedEvent && cell.allEvents.some((e) => (e.exDate || e.date) === (selectedEvent.exDate || selectedEvent.date));

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    if (hasAnyEvents) {
                      setSelectedEvent(cell.allEvents[0]);
                    }
                  }}
                  className={`min-h-[110px] p-2 flex flex-col justify-between transition-all relative ${
                    cell.isCurrentMonth
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/50 dark:bg-slate-950/40 opacity-40'
                  } ${cell.isToday ? 'ring-2 ring-indigo-500/70 ring-inset bg-indigo-500/5' : ''} ${
                    hasExEvents
                      ? 'border-l-4 border-l-amber-500 bg-amber-500/[0.04]'
                      : hasPayEvents
                      ? 'border-l-4 border-l-emerald-500 bg-emerald-500/[0.04]'
                      : ''
                  } ${hasAnyEvents ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''} ${
                    isSelected ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasExEvents && (
                      <span className="flex items-center gap-1">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="mt-1 space-y-1">
                    {cell.exEvents.map((ev, evIdx) => {
                      const isUpcoming = ev.isUpcoming || (ev.exDate || ev.date) >= todayDateStr;
                      return (
                        <div
                          key={`ex-${evIdx}`}
                          className="p-1 rounded-lg border text-[10px] leading-tight font-black shadow-sm transition-transform hover:scale-[1.02] bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-0.5 text-[9px] uppercase font-black text-amber-700 dark:text-amber-400">
                              <Zap className="w-2.5 h-2.5 fill-current" />
                              EX-DATE
                            </span>
                            <span className="font-extrabold text-[10px]">
                              {currencySymbol}{ev.amount.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[9px] font-medium opacity-80 truncate mt-0.5">
                            {ev.type || 'Dividend'} {isUpcoming ? '• Exp' : '• Past'}
                          </div>
                        </div>
                      );
                    })}

                    {cell.paymentEvents.map((ev, evIdx) => (
                      <div
                        key={`pay-${evIdx}`}
                        className="p-1 rounded-lg border text-[10px] leading-tight font-black shadow-sm transition-transform hover:scale-[1.02] bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] uppercase font-black text-emerald-600 dark:text-emerald-400">
                            PAYOUT
                          </span>
                          <span className="font-extrabold text-[10px]">
                            {currencySymbol}{ev.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[9px] font-medium opacity-80 truncate mt-0.5">
                          Bank Credit
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'yearView' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                12-Month Dividend Map for {selectedYear}
              </h4>
              <p className="text-xs text-slate-500">
                Full-year breakdown highlighting months with scheduled ex-dividend dates and expected distributions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {monthNames.map((name, mIdx) => {
              const monthEvents = allEvents.filter((e) => {
                const d = e.exDate || e.date;
                const parts = d.split('-');
                if (parts.length >= 2) {
                  return parseInt(parts[0], 10) === selectedYear && parseInt(parts[1], 10) - 1 === mIdx;
                }
                return false;
              });

              const hasPayout = monthEvents.length > 0;
              const monthTotal = monthEvents.reduce((acc, curr) => acc + curr.amount, 0);
              const isFutureMonth = new Date(selectedYear, mIdx, 1) >= new Date(todayYear, todayMonth, 1);
              const isCurrentActiveMonth = selectedYear === todayYear && mIdx === todayMonth;

              return (
                <div
                  key={name}
                  onClick={() => {
                    setSelectedMonth(mIdx);
                    setViewMode('calendar');
                    if (hasPayout) {
                      setSelectedEvent(monthEvents[0]);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    hasPayout
                      ? isFutureMonth
                        ? 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/40 hover:border-amber-500 shadow-sm'
                        : 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  } ${isCurrentActiveMonth ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      {name}
                    </span>
                    {hasPayout && (
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isFutureMonth
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        {monthEvents.length} Event{monthEvents.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {hasPayout ? (
                    <div className="space-y-1.5">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {currencySymbol}{monthTotal.toFixed(2)}
                        <span className="text-[10px] font-normal text-slate-500 ml-1">/ share</span>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {monthEvents.map((ev, eIdx) => (
                          <div key={eIdx} className="flex items-center justify-between py-0.5 border-t border-slate-200/50 dark:border-slate-800 text-[10px]">
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              Ex: {formatDateNice(ev.exDate || ev.date)}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {currencySymbol}{ev.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                        <span>Portfolio ({sharesHeld} sh):</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                          {currencySymbol}{(monthTotal * sharesHeld).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium">
                      No Dividend Expected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-emerald-500" />
                Comprehensive Dividend Schedule Timeline
              </h4>
              <p className="text-xs text-slate-500">
                Sorted chronologically with highlighted Ex-Dividend cutoffs.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {allEvents.map((div, i) => {
              const isUpcoming = div.isUpcoming || (div.exDate || div.date) >= todayDateStr;
              const daysDiff = getDaysDiff(div.exDate || div.date);
              const totalPayout = (div.amount * sharesHeld).toFixed(2);
              const yieldOnCurrent = latestPrice > 0 ? ((div.amount / latestPrice) * 100).toFixed(2) : '0.00';
              const isSelected = selectedEvent && (selectedEvent.exDate || selectedEvent.date) === (div.exDate || div.date);

              return (
                <div
                  key={`${div.date}-${i}`}
                  onClick={() => setSelectedEvent(div)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/50'
                      : isUpcoming
                      ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isUpcoming
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                      }`}
                    >
                      {isUpcoming ? <Zap className="w-5 h-5 fill-amber-500" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Ex-Date: {formatDateNice(div.exDate || div.date)}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isUpcoming
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isUpcoming ? (daysDiff > 0 ? `In ${daysDiff} days` : 'Upcoming') : 'Paid'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {div.type || 'Dividend'} • Expected Payout: {formatDateNice(div.paymentDate || div.date)} • Yield: {yieldOnCurrent}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Per Share
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {currencySymbol}{div.amount.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Your Payout ({sharesHeld} sh)
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {currencySymbol}{totalPayout}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  selectedEvent.isUpcoming || (selectedEvent.exDate || selectedEvent.date) >= todayDateStr
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                }`}
              >
                <Zap className="w-6 h-6 fill-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    Dividend Event: {formatDateNice(selectedEvent.exDate || selectedEvent.date)}
                  </h4>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      selectedEvent.isUpcoming || (selectedEvent.exDate || selectedEvent.date) >= todayDateStr
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedEvent.isUpcoming || (selectedEvent.exDate || selectedEvent.date) >= todayDateStr
                      ? 'Upcoming Expected'
                      : 'Historical Paid'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedEvent.type || 'Cash Dividend'} • {symbol} Shareholder Return
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-semibold block">
                Dividend per share
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {currencySymbol}{selectedEvent.amount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-black text-[10px] uppercase">
                <span>⚡ Ex-Dividend Date</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 font-bold">Cutoff</span>
              </div>
              <span className="font-black text-slate-900 dark:text-white text-base mt-1 block">
                {formatDateNice(selectedEvent.exDate || selectedEvent.date)}
              </span>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 block mt-1 font-medium">
                Must own shares BEFORE this date to receive dividend.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                Last Buy Date (Cum-Div)
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white text-base mt-1 block">
                {getCumDividendBuyDate(selectedEvent.exDate || selectedEvent.date)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Last trading day to purchase and still be eligible.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                Expected Payment Date
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base mt-1 block">
                {formatDateNice(selectedEvent.paymentDate || selectedEvent.date)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Funds credited to bank / Demat account.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                Your Payout ({sharesHeld} shares)
              </span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-base mt-1 block">
                {currencySymbol}{(selectedEvent.amount * sharesHeld).toFixed(2)}
              </span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block mt-1 font-semibold">
                Yield: {latestPrice > 0 ? ((selectedEvent.amount / latestPrice) * 100).toFixed(2) : '0.00'}% on CMP
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DividendCalendar;
