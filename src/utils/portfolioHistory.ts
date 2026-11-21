import type { JournalTrade, PaperAccount, PortfolioHolding, PriceBar } from '../types';

export interface HistoricalQuoteLike {
  price: number;
  change: number;
  changePct: number;
  bars: PriceBar[];
}

export type PortfolioTrendScope = 'all' | 'holdings' | 'trades';
export type PortfolioTrendRange = '1W' | '1M' | '3M' | 'ALL';

export interface TradeEventSummary {
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE';
  quantity: number;
  price: number;
  source: 'Holding' | 'Journal' | 'Paper';
}

export interface PortfolioValuePoint {
  date: string;
  label: string;
  totalValue: number;
  investedValue: number;
  netPnL: number;
  returnPct: number;
  openPositionsValue: number;
  cashBalance: number;
  events: TradeEventSummary[];
}

export interface PortfolioValueSummary {
  points: PortfolioValuePoint[];
  latestValue: number;
  latestInvested: number;
  latestPnL: number;
  latestReturnPct: number;
  periodChange: number;
  periodChangePct: number;
  highValue: number;
  lowValue: number;
  maxDrawdownPct: number;
  totalRecordedEvents: number;
  reconstructedFromMarketBars: boolean;
}

interface NormalizedEvent {
  date: string;
  order: number;
  kind: 'HOLDING_BUY' | 'JOURNAL_OPEN' | 'JOURNAL_CLOSE' | 'PAPER_BUY' | 'PAPER_SELL';
  id: string;
  symbol: string;
  normSymbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  realizedPnlOverride?: number;
}

const normalizeSymbol = (sym: string): string =>
  sym.toUpperCase().replace('.NS', '').replace('.BO', '').trim();

export const toIsoDate = (raw?: string | null): string => {
  const today = new Date();
  const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
    parsed.getDate()
  ).padStart(2, '0')}`;
};

export const formatTrendDateShort = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(5);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const formatTrendDateFull = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function buildPriceLookup(liveQuotes: Record<string, HistoricalQuoteLike>) {
  const sortedBarsMap = new Map<string, Array<{ date: string; close: number }>>();
  const livePriceMap = new Map<string, number>();

  for (const [rawKey, q] of Object.entries(liveQuotes)) {
    const key = normalizeSymbol(rawKey);
    if (!q) continue;
    if (Number.isFinite(q.price) && q.price > 0) {
      livePriceMap.set(key, q.price);
    }
    if (Array.isArray(q.bars) && q.bars.length > 0) {
      const bars = q.bars
        .filter((b) => b && b.date && Number.isFinite(b.close) && b.close > 0)
        .map((b) => ({ date: toIsoDate(b.date), close: b.close }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (bars.length > 0) {
        sortedBarsMap.set(key, bars);
      }
    }
  }

  const getPriceOnDate = (
    normSym: string,
    dt: string,
    fallbackPrice: number,
    isFinalDate: boolean
  ): number => {
    if (isFinalDate) {
      const live = livePriceMap.get(normSym);
      if (live !== undefined && live > 0) return live;
    }
    const bars = sortedBarsMap.get(normSym);
    if (!bars || bars.length === 0) {
      return isFinalDate ? livePriceMap.get(normSym) ?? fallbackPrice : fallbackPrice;
    }

    // Binary search for latest bar with bar.date <= dt
    let lo = 0;
    let hi = bars.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].date <= dt) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found >= 0) return bars[found].close;
    return fallbackPrice;
  };

  return { sortedBarsMap, livePriceMap, getPriceOnDate };
}

function collectEvents(
  holdings: PortfolioHolding[],
  journalTrades: JournalTrade[],
  paperAccount: PaperAccount,
  scope: PortfolioTrendScope
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  let seq = 0;

  if (scope === 'all' || scope === 'holdings') {
    for (const h of holdings) {
      if (!h.symbol || !Number.isFinite(h.quantity) || h.quantity <= 0 || !Number.isFinite(h.buyPrice) || h.buyPrice <= 0) {
        continue;
      }
      events.push({
        date: toIsoDate(h.dateAdded),
        order: seq++,
        kind: 'HOLDING_BUY',
        id: `h_${h.id}`,
        symbol: h.symbol.toUpperCase().trim(),
        normSymbol: normalizeSymbol(h.symbol),
        side: 'BUY',
        quantity: h.quantity,
        price: h.buyPrice,
      });
    }
  }

  if (scope === 'all' || scope === 'trades') {
    for (const t of journalTrades) {
      if (!t.symbol || !Number.isFinite(t.quantity) || t.quantity <= 0 || !Number.isFinite(t.entryPrice) || t.entryPrice <= 0) {
        continue;
      }
      const entryDate = toIsoDate(t.entryDate || t.createdAt);
      events.push({
        date: entryDate,
        order: seq++,
        kind: 'JOURNAL_OPEN',
        id: `j_${t.id}`,
        symbol: t.symbol.toUpperCase().trim(),
        normSymbol: normalizeSymbol(t.symbol),
        side: t.type === 'SELL' ? 'SELL' : 'BUY',
        quantity: t.quantity,
        price: t.entryPrice,
      });

      if (t.status === 'CLOSED') {
        const exitDate = toIsoDate(t.exitDate || t.closedAt || entryDate);
        const safeExitDate = exitDate < entryDate ? entryDate : exitDate;
        const exitPrice =
          typeof t.exitPrice === 'number' && Number.isFinite(t.exitPrice) && t.exitPrice > 0
            ? t.exitPrice
            : t.entryPrice;
        events.push({
          date: safeExitDate,
          order: seq++,
          kind: 'JOURNAL_CLOSE',
          id: `j_${t.id}`,
          symbol: t.symbol.toUpperCase().trim(),
          normSymbol: normalizeSymbol(t.symbol),
          side: t.type === 'SELL' ? 'SELL' : 'BUY',
          quantity: t.quantity,
          price: exitPrice,
          realizedPnlOverride:
            typeof t.pnl === 'number' && Number.isFinite(t.pnl) ? t.pnl : undefined,
        });
      }
    }

    const paperHistory = Array.isArray(paperAccount?.history) ? paperAccount.history : [];
    const chronologicalPaper = [...paperHistory].sort((a, b) => {
      const da = toIsoDate(a.timestamp || a.date);
      const db = toIsoDate(b.timestamp || b.date);
      if (da !== db) return da.localeCompare(db);
      return String(a.timestamp || a.id).localeCompare(String(b.timestamp || b.id));
    });

    for (const p of chronologicalPaper) {
      if (!p.symbol || !Number.isFinite(p.shares) || p.shares <= 0 || !Number.isFinite(p.price) || p.price <= 0) {
        continue;
      }
      events.push({
        date: toIsoDate(p.timestamp || p.date),
        order: seq++,
        kind: p.type === 'SELL' ? 'PAPER_SELL' : 'PAPER_BUY',
        id: `p_${p.id}`,
        symbol: p.symbol.toUpperCase().trim(),
        normSymbol: normalizeSymbol(p.symbol),
        side: p.type === 'SELL' ? 'SELL' : 'BUY',
        quantity: p.shares,
        price: p.price,
      });
    }
  }

  return events.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.order - b.order));
}

function sliceByRange(points: PortfolioValuePoint[], range: PortfolioTrendRange): PortfolioValuePoint[] {
  if (range === 'ALL' || points.length <= 2) return points;
  const days = range === '1W' ? 7 : range === '1M' ? 30 : 90;
  const latest = points[points.length - 1];
  const latestMs = Date.parse(`${latest.date}T00:00:00`);
  if (Number.isNaN(latestMs)) return points;
  const cutoffMs = latestMs - days * 86_400_000;
  const filtered = points.filter((p) => {
    const ms = Date.parse(`${p.date}T00:00:00`);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  });
  return filtered.length >= 2 ? filtered : points.slice(-Math.min(points.length, days));
}

export function buildPortfolioValueTrend(params: {
  holdings: PortfolioHolding[];
  journalTrades: JournalTrade[];
  paperAccount: PaperAccount;
  liveQuotes: Record<string, HistoricalQuoteLike>;
  scope: PortfolioTrendScope;
  range: PortfolioTrendRange;
}): PortfolioValueSummary {
  const { holdings, journalTrades, paperAccount, liveQuotes, scope, range } = params;
  const todayIso = toIsoDate();
  const events = collectEvents(holdings, journalTrades, paperAccount, scope);

  if (events.length === 0) {
    return {
      points: [],
      latestValue: 0,
      latestInvested: 0,
      latestPnL: 0,
      latestReturnPct: 0,
      periodChange: 0,
      periodChangePct: 0,
      highValue: 0,
      lowValue: 0,
      maxDrawdownPct: 0,
      totalRecordedEvents: 0,
      reconstructedFromMarketBars: false,
    };
  }

  const { sortedBarsMap, getPriceOnDate } = buildPriceLookup(liveQuotes);
  const activeSymbols = new Set(events.map((e) => e.normSymbol));
  const earliestEventDate = events[0].date;

  const marketDateSet = new Set<string>();
  for (const sym of activeSymbols) {
    const bars = sortedBarsMap.get(sym);
    if (!bars) continue;
    for (const b of bars) {
      if (b.date <= todayIso) {
        marketDateSet.add(b.date);
      }
    }
  }
  const sortedMarketDates = Array.from(marketDateSet).sort((a, b) => a.localeCompare(b));

  const onlyTodayHoldings =
    earliestEventDate === todayIso &&
    events.every((e) => e.kind === 'HOLDING_BUY' || e.kind === 'JOURNAL_OPEN' || e.kind === 'PAPER_BUY') &&
    sortedMarketDates.length >= 2;

  let rawPoints: PortfolioValuePoint[] = [];

  if (onlyTodayHoldings) {
    const windowDates = sortedMarketDates.slice(-90);
    if (windowDates[windowDates.length - 1] !== todayIso) {
      windowDates.push(todayIso);
    }

    const totalCostBasis = events.reduce((acc, e) => acc + e.quantity * e.price, 0);

    rawPoints = windowDates.map((dt, idx) => {
      const isFinal = idx === windowDates.length - 1;
      let totalValue = 0;
      for (const ev of events) {
        const markPrice = getPriceOnDate(ev.normSymbol, dt, ev.price, isFinal);
        if (ev.side === 'SELL') {
          totalValue += ev.quantity * ev.price + (ev.price - markPrice) * ev.quantity;
        } else {
          totalValue += ev.quantity * markPrice;
        }
      }
      const netPnL = totalValue - totalCostBasis;
      const returnPct = totalCostBasis > 0 ? (netPnL / totalCostBasis) * 100 : 0;

      return {
        date: dt,
        label: formatTrendDateShort(dt),
        totalValue: Number(totalValue.toFixed(2)),
        investedValue: Number(totalCostBasis.toFixed(2)),
        netPnL: Number(netPnL.toFixed(2)),
        returnPct: Number(returnPct.toFixed(2)),
        openPositionsValue: Number(totalValue.toFixed(2)),
        cashBalance: 0,
        events: isFinal
          ? events.map((ev) => ({
              symbol: ev.symbol,
              action: ev.side,
              quantity: ev.quantity,
              price: ev.price,
              source:
                ev.kind === 'HOLDING_BUY'
                  ? 'Holding'
                  : ev.kind.startsWith('JOURNAL')
                    ? 'Journal'
                    : 'Paper',
            }))
          : [],
      };
    });
  } else {
    const timelineSet = new Set<string>();
    for (const ev of events) timelineSet.add(ev.date);
    for (const dt of sortedMarketDates) {
      if (dt >= earliestEventDate && dt <= todayIso) {
        timelineSet.add(dt);
      }
    }
    if (earliestEventDate <= todayIso) {
      timelineSet.add(todayIso);
    }

    const timelineDates = Array.from(timelineSet).sort((a, b) => a.localeCompare(b));
    const eventsByDate = new Map<string, NormalizedEvent[]>();
    for (const ev of events) {
      const bucket = eventsByDate.get(ev.date) || [];
      bucket.push(ev);
      eventsByDate.set(ev.date, bucket);
    }

    let cash = 0;
    let externalDeposits = 0;

    const holdingLots: Array<{ normSymbol: string; quantity: number; buyPrice: number }> = [];
    const openJournal = new Map<
      string,
      { normSymbol: string; side: 'BUY' | 'SELL'; quantity: number; entryPrice: number; margin: number }
    >();
    const paperPos = new Map<string, { quantity: number; avgPrice: number; lastPrice: number }>();

    const fundPurchase = (cost: number) => {
      if (cost <= 0) return;
      if (cash >= cost) {
        cash -= cost;
      } else {
        const deficit = cost - cash;
        externalDeposits += deficit;
        cash = 0;
      }
    };

    for (let i = 0; i < timelineDates.length; i++) {
      const dt = timelineDates[i];
      const isFinal = i === timelineDates.length - 1;
      const dayEvents = eventsByDate.get(dt) || [];
      const eventSummaries: TradeEventSummary[] = [];

      for (const ev of dayEvents) {
        if (ev.kind === 'HOLDING_BUY') {
          const cost = ev.quantity * ev.price;
          fundPurchase(cost);
          holdingLots.push({
            normSymbol: ev.normSymbol,
            quantity: ev.quantity,
            buyPrice: ev.price,
          });
          eventSummaries.push({
            symbol: ev.symbol,
            action: 'BUY',
            quantity: ev.quantity,
            price: ev.price,
            source: 'Holding',
          });
        } else if (ev.kind === 'JOURNAL_OPEN') {
          const margin = ev.quantity * ev.price;
          fundPurchase(margin);
          openJournal.set(ev.id, {
            normSymbol: ev.normSymbol,
            side: ev.side,
            quantity: ev.quantity,
            entryPrice: ev.price,
            margin,
          });
          eventSummaries.push({
            symbol: ev.symbol,
            action: ev.side,
            quantity: ev.quantity,
            price: ev.price,
            source: 'Journal',
          });
        } else if (ev.kind === 'JOURNAL_CLOSE') {
          const open = openJournal.get(ev.id);
          if (open) {
            const realized =
              ev.realizedPnlOverride !== undefined
                ? ev.realizedPnlOverride
                : open.side === 'BUY'
                  ? (ev.price - open.entryPrice) * open.quantity
                  : (open.entryPrice - ev.price) * open.quantity;
            cash += Math.max(0, open.margin + realized);
            openJournal.delete(ev.id);
          }
          eventSummaries.push({
            symbol: ev.symbol,
            action: 'CLOSE',
            quantity: ev.quantity,
            price: ev.price,
            source: 'Journal',
          });
        } else if (ev.kind === 'PAPER_BUY') {
          const cost = ev.quantity * ev.price;
          fundPurchase(cost);
          const prev = paperPos.get(ev.normSymbol);
          if (prev && prev.quantity > 0) {
            const totalQty = prev.quantity + ev.quantity;
            const avgPrice = (prev.quantity * prev.avgPrice + cost) / totalQty;
            paperPos.set(ev.normSymbol, { quantity: totalQty, avgPrice, lastPrice: ev.price });
          } else {
            paperPos.set(ev.normSymbol, {
              quantity: ev.quantity,
              avgPrice: ev.price,
              lastPrice: ev.price,
            });
          }
          eventSummaries.push({
            symbol: ev.symbol,
            action: 'BUY',
            quantity: ev.quantity,
            price: ev.price,
            source: 'Paper',
          });
        } else if (ev.kind === 'PAPER_SELL') {
          const prev = paperPos.get(ev.normSymbol);
          const proceeds = ev.quantity * ev.price;
          if (prev && prev.quantity > 0) {
            const sellQty = Math.min(prev.quantity, ev.quantity);
            cash += sellQty * ev.price;
            const rem = prev.quantity - sellQty;
            if (rem > 0) {
              paperPos.set(ev.normSymbol, { ...prev, quantity: rem, lastPrice: ev.price });
            } else {
              paperPos.delete(ev.normSymbol);
            }
          } else {
            cash += proceeds;
          }
          eventSummaries.push({
            symbol: ev.symbol,
            action: 'SELL',
            quantity: ev.quantity,
            price: ev.price,
            source: 'Paper',
          });
        }
      }

      let openPositionsValue = 0;

      for (const lot of holdingLots) {
        const px = getPriceOnDate(lot.normSymbol, dt, lot.buyPrice, isFinal);
        openPositionsValue += lot.quantity * px;
      }

      for (const tr of openJournal.values()) {
        const px = getPriceOnDate(tr.normSymbol, dt, tr.entryPrice, isFinal);
        const unrealized =
          tr.side === 'BUY'
            ? (px - tr.entryPrice) * tr.quantity
            : (tr.entryPrice - px) * tr.quantity;
        openPositionsValue += Math.max(0, tr.margin + unrealized);
      }

      for (const [normSym, pos] of paperPos.entries()) {
        const px = getPriceOnDate(normSym, dt, pos.lastPrice, isFinal);
        openPositionsValue += pos.quantity * px;
      }

      const totalValue = cash + openPositionsValue;
      const netPnL = totalValue - externalDeposits;
      const returnPct = externalDeposits > 0 ? (netPnL / externalDeposits) * 100 : 0;

      rawPoints.push({
        date: dt,
        label: formatTrendDateShort(dt),
        totalValue: Number(totalValue.toFixed(2)),
        investedValue: Number(externalDeposits.toFixed(2)),
        netPnL: Number(netPnL.toFixed(2)),
        returnPct: Number(returnPct.toFixed(2)),
        openPositionsValue: Number(openPositionsValue.toFixed(2)),
        cashBalance: Number(cash.toFixed(2)),
        events: eventSummaries,
      });
    }

    if (rawPoints.length === 1) {
      const only = rawPoints[0];
      rawPoints = [
        {
          ...only,
          label: 'Cost Basis',
          totalValue: only.investedValue,
          netPnL: 0,
          returnPct: 0,
          openPositionsValue: only.investedValue,
          cashBalance: 0,
          events: [],
        },
        {
          ...only,
          label: 'Now',
        },
      ];
    }
  }

  const points = sliceByRange(rawPoints, range);
  const first = points[0];
  const latest = points[points.length - 1];

  let highValue = -Infinity;
  let lowValue = Infinity;
  let runningPeak = -Infinity;
  let maxDrawdownPct = 0;

  for (const p of points) {
    if (p.totalValue > highValue) highValue = p.totalValue;
    if (p.totalValue < lowValue) lowValue = p.totalValue;
    if (p.totalValue > runningPeak) runningPeak = p.totalValue;
    if (runningPeak > 0) {
      const dd = ((runningPeak - p.totalValue) / runningPeak) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  const periodChange = latest.totalValue - first.totalValue;
  const periodChangePct = first.totalValue > 0 ? (periodChange / first.totalValue) * 100 : 0;

  return {
    points,
    latestValue: latest.totalValue,
    latestInvested: latest.investedValue,
    latestPnL: latest.netPnL,
    latestReturnPct: latest.returnPct,
    periodChange: Number(periodChange.toFixed(2)),
    periodChangePct: Number(periodChangePct.toFixed(2)),
    highValue: Number.isFinite(highValue) ? highValue : 0,
    lowValue: Number.isFinite(lowValue) ? lowValue : 0,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    totalRecordedEvents: events.length,
    reconstructedFromMarketBars: onlyTodayHoldings,
  };
}
