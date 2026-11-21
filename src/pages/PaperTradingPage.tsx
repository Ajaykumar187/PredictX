import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  X,
  RotateCcw,
  Layers,
  ArrowRight,
  Trophy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { AnalysisResult, MarketType, PaperAccount, PaperPendingOrder } from '../types';
import { storage, userKey } from '../utils/storage';
import {
  fetchBatchQuotes,
  fetchLeaderboard,
  submitLeaderboard,
  searchStocksApi,
} from '../utils/stockApi';
import type { BatchQuote, LeaderRow } from '../utils/stockApi';
import type { StockSearchResult } from '../utils/marketData';
import {
  getOrders,
  placeOrders,
  clearOrders,
  subscribeOrders,
  computeOptionPaperMetrics,
  deriveClosedEquityTrades,
  deriveClosedOptionTrades,
  deriveOpenEquityTimestamps,
  deriveOpenOptionTimestamps,
} from '../utils/paperTrades';
import type { PaperOrder, PaperPosition } from '../utils/paperTrades';
import { PaperTradingHistoryTab } from '../components/PaperTradingHistoryTab';
import type { OpenHistoryTrade } from '../components/PaperTradingHistoryTab';
import { PaperTradingSummaryDashboard } from '../components/PaperTradingSummaryDashboard';
import { FrontPageOrderModal } from '../components/FrontPageOrderModal';
import type {
  OrderSubmission,
  OrderTicketTarget,
} from '../components/FrontPageOrderModal';
import { TradeAccuracyPanel } from '../components/TradeAccuracyPanel';
import { TradePerformanceSummary } from '../components/TradePerformanceSummary';
import type { SessionPerformanceTrade } from '../utils/tradePerformance';
import {
  buildTradesForAccuracy,
  computeTradeAccuracySummary,
  directionFromSignal,
  evaluateTradeAccuracy,
  getTradeForecasts,
  saveTradeForecast,
  subscribeTradeForecasts,
  clearTradeForecasts,
} from '../utils/tradeAccuracy';
import type {
  PreTradeForecast,
  TradeAccuracyRecord,
  OrderPreTradeSnapshot,
} from '../utils/tradeAccuracy';
import type { PageId } from '../components/Sidebar';

type OrderSubmissionWithForecast = OrderSubmission & {
  preTradeForecast?: OrderPreTradeSnapshot | null;
};

const CompatibleOrderModal = FrontPageOrderModal as React.FC<
  React.ComponentProps<typeof FrontPageOrderModal> & {
    currentAnalysis?: AnalysisResult | null;
  }
>;

interface Props {
  data?: AnalysisResult | null;
  onSelectStock?: (symbol: string, market: MarketType) => void;
  onNavigate?: (page: PageId) => void;
}

interface WatchItem {
  symbol: string;
  market: MarketType;
}

type MainTab = 'positions' | 'orders' | 'history' | 'accuracy' | 'leaderboard';
type PositionFilter = 'ALL' | 'EQUITY' | 'OPTIONS';
type OrderSubFilter = 'ALL' | 'PENDING' | 'EXECUTED';

const DEFAULT_WATCHLIST: WatchItem[] = [
  { symbol: 'RELIANCE', market: 'NSE' },
  { symbol: 'TCS', market: 'NSE' },
  { symbol: 'HDFCBANK', market: 'NSE' },
  { symbol: 'INFY', market: 'NSE' },
  { symbol: 'ICICIBANK', market: 'NSE' },
  { symbol: 'SBIN', market: 'NSE' },
  { symbol: 'ITC', market: 'NSE' },
  { symbol: 'LT', market: 'NSE' },
];

const INDEX_SYMBOLS: WatchItem[] = [
  { symbol: 'NIFTY 50', market: 'INDEX' },
  { symbol: 'NIFTY BANK', market: 'INDEX' },
  { symbol: 'SENSEX', market: 'INDEX' },
];

const WATCH_STORAGE_BASE = 'predictx_tradelab_watchlist';

const loadWatchlist = (): WatchItem[] => {
  try {
    const raw = localStorage.getItem(userKey(WATCH_STORAGE_BASE));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
  }
  return DEFAULT_WATCHLIST;
};

const saveWatchlist = (items: WatchItem[]) => {
  try {
    localStorage.setItem(userKey(WATCH_STORAGE_BASE), JSON.stringify(items));
  } catch {
  }
};

const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
const inrExact = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pnlTextClass = (v: number) =>
  v > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : v < 0
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-600 dark:text-slate-400';

export const PaperTradingPage: React.FC<Props> = ({ data, onSelectStock, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<MainTab>('positions');
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL');
  const [orderFilter, setOrderFilter] = useState<OrderSubFilter>('ALL');

  const [acc, setAcc] = useState<PaperAccount>(() => storage.getPaperAccount());
  const [optOrders, setOptOrders] = useState<PaperOrder[]>(() => getOrders());
  const [tradeForecasts, setTradeForecasts] = useState<PreTradeForecast[]>(() => getTradeForecasts());
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => loadWatchlist());

  const [quotesMap, setQuotesMap] = useState<Record<string, BatchQuote>>({});
  const [indices, setIndices] = useState<BatchQuote[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [orderTicket, setOrderTicket] = useState<OrderTicketTarget | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [board, setBoard] = useState<{ loaded: boolean; configured: boolean; rows: LeaderRow[] }>({
    loaded: false,
    configured: true,
    rows: [],
  });
  const [boardMsg, setBoardMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const user = storage.getUser();

  useEffect(() => subscribeOrders(() => setOptOrders(getOrders())), []);
  useEffect(() => subscribeTradeForecasts(() => setTradeForecasts(getTradeForecasts())), []);

  const persist = (next: PaperAccount) => {
    setAcc(next);
    storage.savePaperAccount(next);
  };

  const safePositions = acc?.positions || {};
  const safeHistory = Array.isArray(acc?.history) ? acc.history : [];
  const positionKeys = Object.keys(safePositions);
  const pendingOrders = Array.isArray(acc?.pendingOrders) ? acc.pendingOrders : [];

  const symbolsToFetch = useMemo(() => {
    const seen = new Set<string>();
    const list: WatchItem[] = [];
    const add = (symbol: string, market: MarketType) => {
      const k = symbol.toUpperCase();
      if (!seen.has(k)) {
        seen.add(k);
        list.push({ symbol: k, market });
      }
    };
    watchlist.forEach((w) => add(w.symbol, w.market));
    positionKeys.forEach((s) => add(s, acc.positions[s].market));
    pendingOrders.forEach((p) => add(p.symbol, p.market));
    return list;
  }, [watchlist, positionKeys.join(','), pendingOrders.map((p) => p.symbol).join(',')]);

  const refreshQuotes = async () => {
    setRefreshing(true);
    try {
      const [stockQuotes, indexQuotes] = await Promise.all([
        symbolsToFetch.length ? fetchBatchQuotes(symbolsToFetch) : Promise.resolve([]),
        fetchBatchQuotes(INDEX_SYMBOLS),
      ]);
      const nextMap: Record<string, BatchQuote> = {};
      stockQuotes.forEach((q) => {
        if (q.price > 0) nextMap[q.symbol.toUpperCase()] = q;
      });
      setQuotesMap((prev) => ({ ...prev, ...nextMap }));
      if (indexQuotes.length > 0) setIndices(indexQuotes);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshQuotes();
  }, [symbolsToFetch.map((i) => `${i.symbol}:${i.market}`).join(',')]);

  const loadBoard = () =>
    fetchLeaderboard().then((r) =>
      setBoard({ loaded: true, configured: r.configured, rows: r.rows || [] })
    );
  useEffect(() => {
    loadBoard();
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchStocksApi(q)
        .then((res) => {
          if (alive) setSearchResults(res.slice(0, 6));
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 260);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const quoteOf = (sym: string): { price: number | null; changePct?: number } => {
    const upper = sym.toUpperCase();
    if (data && data.displaySymbol.toUpperCase() === upper) {
      return { price: data.latestPrice, changePct: data.changePct };
    }
    const q = quotesMap[upper];
    if (q && q.price > 0) return { price: q.price, changePct: q.changePct };
    return { price: null };
  };

  const optMetrics = useMemo(() => computeOptionPaperMetrics(optOrders), [optOrders]);

  const closedTrades = useMemo(() => {
    const eqClosed = deriveClosedEquityTrades(safeHistory, safePositions);
    const optClosed = deriveClosedOptionTrades(optOrders);
    return [...eqClosed, ...optClosed].sort(
      (a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt)
    );
  }, [safeHistory, safePositions, optOrders]);

  const openHistoryTrades = useMemo<OpenHistoryTrade[]>(() => {
    const nowMs = Date.now();
    const eqTimestamps = deriveOpenEquityTimestamps(safeHistory);
    const optTimestamps = deriveOpenOptionTimestamps(optOrders);

    const eqOpen: OpenHistoryTrade[] = positionKeys.map((sym) => {
      const p = safePositions[sym];
      const { price } = quoteOf(sym);
      const currentPrice = price;
      const pnl = currentPrice !== null ? (currentPrice - p.avgPrice) * p.quantity : 0;
      const pnlPct =
        currentPrice !== null && p.avgPrice > 0
          ? ((currentPrice - p.avgPrice) / p.avgPrice) * 100
          : 0;
      const openedAt = eqTimestamps[sym] || new Date(nowMs).toISOString();
      const durationMs = Math.max(0, nowMs - Date.parse(openedAt));

      return {
        id: `eq-open-${sym}`,
        segment: 'Equity',
        instrument: sym,
        symbol: sym,
        market: p.market,
        subtitle: `Equity · LONG · ${p.product || 'CNC'}`,
        side: 'LONG',
        qty: p.quantity,
        entryPrice: p.avgPrice,
        currentPrice,
        pnl,
        pnlPct,
        openedAt,
        durationMs,
      };
    });

    const optOpen: OpenHistoryTrade[] = optMetrics.openPositions.map((p) => {
      const side: 'LONG' | 'SHORT' = p.qty > 0 ? 'LONG' : 'SHORT';
      const openedAt = optTimestamps[p.key] || new Date(nowMs).toISOString();
      const durationMs = Math.max(0, nowMs - Date.parse(openedAt));
      const expiryText = p.expiry ? ` · ${p.expiry}` : '';

      return {
        id: `opt-open-${p.key}`,
        segment: 'Options',
        instrument: `${p.underlying} ${p.strike.toLocaleString('en-IN')} ${p.type}`,
        symbol: p.underlying,
        subtitle: `Options · ${side}${expiryText}`,
        side,
        qty: Math.abs(p.qty),
        entryPrice: p.avg,
        currentPrice: p.avg,
        pnl: 0,
        pnlPct: 0,
        openedAt,
        durationMs,
        optionPosition: p,
      };
    });

    return [...eqOpen, ...optOpen];
  }, [acc.positions, acc.history, positionKeys.join(','), quotesMap, data, optOrders, optMetrics.openPositions]);

  const accuracyRecords = useMemo<TradeAccuracyRecord[]>(() => {
    const tradesForAccuracy = buildTradesForAccuracy(
      openHistoryTrades.map((o) => {
        const pos = o.segment === 'Equity' ? acc.positions[o.symbol] : undefined;
        return {
          ...o,
          stopLoss: pos?.stopLoss,
          target: pos?.target,
        };
      }),
      closedTrades
    );
    return evaluateTradeAccuracy(tradesForAccuracy, tradeForecasts);
  }, [openHistoryTrades, closedTrades, acc.positions, tradeForecasts]);

  const accuracyById = useMemo<Record<string, TradeAccuracyRecord>>(() => {
    const map: Record<string, TradeAccuracyRecord> = {};
    for (const rec of accuracyRecords) {
      map[rec.trade.id] = rec;
    }
    return map;
  }, [accuracyRecords]);

  const accuracySummary = useMemo(
    () => computeTradeAccuracySummary(accuracyRecords),
    [accuracyRecords]
  );

  const sessionPerformanceTrades = useMemo<SessionPerformanceTrade[]>(() => {
    const openMapped: SessionPerformanceTrade[] = openHistoryTrades.map((o) => ({
      id: o.id,
      instrument: o.instrument,
      symbol: o.symbol,
      market: o.market,
      segment: o.segment,
      side: o.side,
      status: 'OPEN',
      pnl: o.pnl,
      pnlPct: o.pnlPct,
      openedAt: o.openedAt,
      currencySymbol: o.market === 'US' ? '$' : '₹',
    }));

    const closedMapped: SessionPerformanceTrade[] = closedTrades.map((c) => ({
      id: c.id,
      instrument: c.instrument,
      symbol: c.symbol,
      market: c.market,
      segment: c.segment,
      side: c.side,
      status: 'CLOSED',
      pnl: c.pnl,
      pnlPct: c.pnlPct,
      openedAt: c.openedAt,
      closedAt: c.closedAt,
      currencySymbol: c.market === 'US' ? '$' : '₹',
    }));

    return [...openMapped, ...closedMapped];
  }, [openHistoryTrades, closedTrades]);

  const equitySummary = useMemo(() => {
    let holdingsValue = 0;
    let investedCost = 0;
    let openPnL = 0;
    let unknown = false;

    positionKeys.forEach((s) => {
      const p = acc.positions[s];
      const cost = p.quantity * p.avgPrice;
      investedCost += cost;
      const { price } = quoteOf(s);
      if (price === null) {
        unknown = true;
        holdingsValue += cost;
      } else {
        const current = p.quantity * price;
        holdingsValue += current;
        openPnL += current - cost;
      }
    });

    const total = acc.cash + holdingsValue;
    const totalPnL = total - acc.initialCash;
    const returnPct = acc.initialCash > 0 ? (totalPnL / acc.initialCash) * 100 : 0;

    return { holdingsValue, investedCost, openPnL, total, totalPnL, returnPct, unknown };
  }, [acc, quotesMap, data]);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
  };

  const openTicketFor = async (symbol: string, market: MarketType, side: 'BUY' | 'SELL') => {
    const upper = symbol.toUpperCase();
    const existing = quoteOf(upper);
    let px = existing.price ?? 0;
    let chg = existing.changePct;

    if (px <= 0) {
      const fetched = await fetchBatchQuotes([{ symbol: upper, market }]);
      if (fetched[0] && fetched[0].price > 0) {
        px = fetched[0].price;
        chg = fetched[0].changePct;
        setQuotesMap((prev) => ({ ...prev, [upper]: fetched[0] }));
      }
    }

    setOrderTicket({ symbol: upper, market, price: px, changePct: chg, side });
  };

  const addToWatchlist = (symbol: string, market: MarketType) => {
    const upper = symbol.toUpperCase();
    if (watchlist.some((w) => w.symbol.toUpperCase() === upper)) return;
    const next = [{ symbol: upper, market }, ...watchlist];
    setWatchlist(next);
    saveWatchlist(next);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeFromWatchlist = (symbol: string) => {
    const upper = symbol.toUpperCase();
    const next = watchlist.filter((w) => w.symbol.toUpperCase() !== upper);
    setWatchlist(next);
    saveWatchlist(next);
  };

  const executeOrderFill = (
    sym: string,
    market: MarketType,
    side: 'BUY' | 'SELL',
    qty: number,
    fillPrice: number,
    product: 'CNC' | 'MIS',
    orderType: 'MARKET' | 'LIMIT',
    stopLoss?: number,
    target?: number,
    removePendingId?: string,
    preTradeForecast?: OrderPreTradeSnapshot | null
  ): { ok: boolean; text: string } => {
    const total = qty * fillPrice;
    const pos = acc.positions[sym];
    const nowIso = new Date().toISOString();
    const nextPending = removePendingId
      ? pendingOrders.filter((o) => o.id !== removePendingId)
      : pendingOrders;

    if (side === 'BUY') {
      if (total > acc.cash) {
        return { ok: false, text: 'Insufficient virtual cash for this order.' };
      }
      const newQty = (pos?.quantity || 0) + qty;
      const newAvg = ((pos?.quantity || 0) * (pos?.avgPrice || 0) + total) / newQty;
      persist({
        ...acc,
        cash: acc.cash - total,
        positions: {
          ...acc.positions,
          [sym]: {
            quantity: newQty,
            avgPrice: newAvg,
            market,
            product,
            stopLoss: stopLoss ?? pos?.stopLoss,
            target: target ?? pos?.target,
          },
        },
        history: [
          {
            id: `tx-${Date.now()}`,
            date: nowIso.slice(0, 10),
            timestamp: nowIso,
            market,
            product,
            orderType,
            type: 'BUY',
            symbol: sym,
            shares: qty,
            price: fillPrice,
            total,
          },
          ...acc.history,
        ],
        pendingOrders: nextPending,
      });

      // Persist pre-trade prediction snapshot before/at entry for accuracy grading
      if (preTradeForecast) {
        saveTradeForecast({
          ...preTradeForecast,
          tradeSide: 'LONG',
          entryPrice: fillPrice,
          openedAt: nowIso,
          userStopLoss: stopLoss,
          userTarget: target,
        });
      } else if (data && data.displaySymbol.toUpperCase() === sym.toUpperCase()) {
        const target7d = data.forecast7d?.[data.forecast7d.length - 1];
        const movePct =
          target7d && fillPrice > 0
            ? Number((((target7d - fillPrice) / fillPrice) * 100).toFixed(2))
            : undefined;
        saveTradeForecast({
          segment: 'Equity',
          instrument: sym,
          symbol: sym,
          market,
          tradeSide: 'LONG',
          entryPrice: fillPrice,
          openedAt: nowIso,
          predictedSignal: data.signal,
          predictedDirection: directionFromSignal(data.signal),
          predictedTarget: target7d ? Number(target7d.toFixed(2)) : undefined,
          predictedMovePct: movePct,
          confidence: data.confidence,
          score: data.score,
          rsiAtEntry: data.df?.[data.df.length - 1]?.rsi14,
          userStopLoss: stopLoss,
          userTarget: target,
          summary: `Model called ${data.signal} (score ${data.score > 0 ? '+' : ''}${data.score}/100, ${data.confidence.toFixed(0)}% conf)${target7d ? ` targeting ${data.currencySymbol}${target7d.toFixed(2)}` : ''}`,
          reasons: data.reasons.slice(0, 4),
          source: 'pre-trade-model',
        });
      } else if (stopLoss || target) {
        saveTradeForecast({
          segment: 'Equity',
          instrument: sym,
          symbol: sym,
          market,
          tradeSide: 'LONG',
          entryPrice: fillPrice,
          openedAt: nowIso,
          predictedSignal: 'BUY',
          predictedDirection: 'UP',
          predictedTarget: target,
          predictedMovePct:
            target && fillPrice > 0
              ? Number((((target - fillPrice) / fillPrice) * 100).toFixed(2))
              : undefined,
          userStopLoss: stopLoss,
          userTarget: target,
          summary: `Pre-trade LONG plan${target ? ` targeting ₹${target.toFixed(2)}` : ''}${stopLoss ? ` · SL ₹${stopLoss.toFixed(2)}` : ''}`,
          source: 'trade-plan',
        });
      }

      const text = `Bought ${qty} ${sym} (${product}) @ ${inrExact(fillPrice)}`;
      showToast(true, text);
      return { ok: true, text };
    }

    if (!pos || pos.quantity < qty) {
      return { ok: false, text: `You hold ${pos?.quantity || 0} shares of ${sym}.` };
    }
    const positions = { ...acc.positions };
    if (pos.quantity === qty) delete positions[sym];
    else positions[sym] = { ...pos, quantity: pos.quantity - qty };

    persist({
      ...acc,
      cash: acc.cash + total,
      positions,
      history: [
        {
          id: `tx-${Date.now()}`,
          date: nowIso.slice(0, 10),
          timestamp: nowIso,
          market: pos.market,
          product,
          orderType,
          type: 'SELL',
          symbol: sym,
          shares: qty,
          price: fillPrice,
          total,
        },
        ...acc.history,
      ],
      pendingOrders: nextPending,
    });
    const text = `Sold ${qty} ${sym} (${product}) @ ${inrExact(fillPrice)}`;
    showToast(true, text);
    return { ok: true, text };
  };

  const handleOrderSubmit = (order: OrderSubmissionWithForecast): { ok: boolean; text: string } => {
    const sym = order.symbol.toUpperCase();

    if (order.orderType === 'LIMIT' && order.limitPrice && order.limitPrice > 0) {
      const marketable =
        order.side === 'BUY'
          ? order.limitPrice >= order.price
          : order.limitPrice <= order.price;

      if (!marketable) {
        if (order.side === 'BUY' && order.qty * order.limitPrice > acc.cash) {
          return { ok: false, text: 'Insufficient virtual cash for this limit order.' };
        }
        if (order.side === 'SELL') {
          const held = acc.positions[sym]?.quantity || 0;
          if (held < order.qty) {
            return { ok: false, text: `You hold ${held} shares of ${sym}.` };
          }
        }
        const pending: PaperPendingOrder = {
          id: `pend-${Date.now()}`,
          createdAt: new Date().toISOString(),
          symbol: sym,
          market: order.market,
          type: order.side,
          product: order.product,
          orderType: 'LIMIT',
          shares: order.qty,
          limitPrice: order.limitPrice,
          stopLoss: order.stopLoss,
          target: order.target,
        };
        persist({
          ...acc,
          pendingOrders: [pending, ...pendingOrders],
        });
        const text = `Limit ${order.side} placed for ${order.qty} ${sym} @ ${inrExact(order.limitPrice)}`;
        showToast(true, text);
        setActiveTab('orders');
        return { ok: true, text };
      }

      return executeOrderFill(
        sym,
        order.market,
        order.side,
        order.qty,
        order.price,
        order.product,
        'LIMIT',
        order.stopLoss,
        order.target,
        undefined,
        order.preTradeForecast
      );
    }

    return executeOrderFill(
      sym,
      order.market,
      order.side,
      order.qty,
      order.price,
      order.product,
      'MARKET',
      order.stopLoss,
      order.target,
      undefined,
      order.preTradeForecast
    );
  };

  const cancelPendingOrder = (id: string) => {
    persist({
      ...acc,
      pendingOrders: pendingOrders.filter((o) => o.id !== id),
    });
    showToast(true, 'Pending limit order cancelled.');
  };

  const executePendingAtMarket = (p: PaperPendingOrder) => {
    const livePx = quoteOf(p.symbol).price ?? p.limitPrice;
    const res = executeOrderFill(
      p.symbol,
      p.market,
      p.type,
      p.shares,
      livePx,
      p.product,
      'LIMIT',
      p.stopLoss,
      p.target,
      p.id
    );
    if (!res.ok) showToast(false, res.text);
  };

  const closeEquityPosition = (sym: string) => {
    const pos = acc.positions[sym];
    if (!pos) return;
    const livePx = quoteOf(sym).price ?? pos.avgPrice;
    executeOrderFill(sym, pos.market, 'SELL', pos.quantity, livePx, pos.product || 'CNC', 'MARKET');
  };

  const closeOptionPosition = (pos: PaperPosition) => {
    const qty = Math.abs(pos.qty);
    if (qty <= 0) return;
    const action: 'BUY' | 'SELL' = pos.qty > 0 ? 'SELL' : 'BUY';
    placeOrders([
      {
        underlying: pos.underlying,
        expiry: pos.expiry,
        strike: pos.strike,
        type: pos.type,
        action,
        qty,
        price: pos.avg,
      },
    ]);
    showToast(
      true,
      `Squared off ${qty} ${pos.underlying} ${pos.strike.toLocaleString('en-IN')} ${pos.type} @ ₹${pos.avg.toFixed(2)}`
    );
  };

  const resetEquities = () => {
    persist({ cash: 1000000, initialCash: 1000000, positions: {}, history: [], pendingOrders: [] });
    clearTradeForecasts('Equity');
    showToast(true, 'Equity TradeLab account reset to ₹10,00,000.');
  };

  const resetOptions = () => {
    clearOrders();
    clearTradeForecasts('Options');
    showToast(true, 'Options (F&O) paper account reset to ₹10,00,000.');
  };

  const totalOpenPositions = positionKeys.length + optMetrics.openPositions.length;

  const executedOrders = useMemo(() => {
    const eq = acc.history.map((h) => ({
      id: h.id,
      time: h.timestamp || h.date,
      segment: 'Equity' as const,
      action: h.type,
      instrument: h.symbol,
      detail: `${h.product || 'CNC'} · ${h.orderType || 'MARKET'}`,
      qty: h.shares,
      price: h.price,
      total: h.total,
    }));
    const opt = optOrders.map((o) => ({
      id: o.id,
      time: o.time,
      segment: 'Options' as const,
      action: o.action,
      instrument: `${o.underlying} ${o.strike.toLocaleString('en-IN')} ${o.type}`,
      detail: `F&O · ${o.expiry || 'Current'}`,
      qty: o.qty,
      price: o.price,
      total: o.qty * o.price,
    }));
    return [...eq, ...opt].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [acc.history, optOrders]);

  const totalOrderCount = pendingOrders.length + executedOrders.length;

  const activeOrderTargetSymbol = data?.displaySymbol || watchlist[0]?.symbol || 'RELIANCE';
  const activeOrderTargetMarket: MarketType = data?.market || watchlist[0]?.market || 'NSE';

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              TradeLab
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Virtual Paper Trading
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
            {indices.length > 0 ? (
              indices.map((idx) => (
                <div key={idx.symbol} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="font-sans font-semibold text-slate-600 dark:text-slate-300">
                    {idx.symbol}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {idx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className={`font-semibold ${pnlTextClass(idx.changePct)}`}>
                    {idx.changePct >= 0 ? '+' : ''}
                    {idx.changePct.toFixed(2)}%
                  </span>
                </div>
              ))
            ) : (
              <span className="font-sans text-slate-500 dark:text-slate-400">
                NSE · BSE · Options F&amp;O Simulator
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshQuotes}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('options')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Option Chain</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openTicketFor(activeOrderTargetSymbol, activeOrderTargetMarket, 'BUY')}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Trade</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-xl px-4 py-2.5 border text-xs font-medium flex items-center justify-between gap-3 ${
            toast.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <aside className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Watchlist</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {watchlist.length} stocks · Tap B or S to trade
                </p>
              </div>
              {data && !watchlist.some((w) => w.symbol.toUpperCase() === data.displaySymbol.toUpperCase()) && (
                <button
                  type="button"
                  onClick={() => addToWatchlist(data.displaySymbol, data.market)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  + Add {data.displaySymbol}
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stock to trade or watch..."
                aria-label="Search stock to add to TradeLab watchlist"
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  aria-label="Clear stock search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 divide-y divide-slate-200/70 dark:divide-slate-700/70 overflow-hidden">
                {searching ? (
                  <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    Searching stocks...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    No matching symbols found.
                  </div>
                ) : (
                  searchResults.map((r) => (
                    <div
                      key={`${r.displaySymbol}-${r.market}`}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-white dark:hover:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {r.displaySymbol}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            · {r.market}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {r.longName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => addToWatchlist(r.displaySymbol, r.market)}
                          className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          + Watch
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addToWatchlist(r.displaySymbol, r.market);
                            openTicketFor(r.displaySymbol, r.market, 'BUY');
                          }}
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
            {watchlist.map((w) => {
              const q = quoteOf(w.symbol);
              const held = acc.positions[w.symbol]?.quantity || 0;
              return (
                <div
                  key={`${w.symbol}-${w.market}`}
                  className="px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectStock?.(w.symbol, w.market)}
                        className="text-sm font-bold text-slate-900 dark:text-white hover:underline truncate cursor-pointer"
                      >
                        {w.symbol}
                      </button>
                      <span className="text-[11px] text-slate-400">{w.market}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      {q.price !== null ? (
                        <>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {inrExact(q.price)}
                          </span>
                          {typeof q.changePct === 'number' && (
                            <span className={`ml-2 font-semibold ${pnlTextClass(q.changePct)}`}>
                              {q.changePct >= 0 ? '+' : ''}
                              {q.changePct.toFixed(2)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Loading quote...</span>
                      )}
                      {held > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-sans font-medium">
                          · {held} held
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openTicketFor(w.symbol, w.market, 'BUY')}
                      title={`Buy ${w.symbol}`}
                      className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => openTicketFor(w.symbol, w.market, 'SELL')}
                      title={`Sell ${w.symbol}`}
                      className="w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromWatchlist(w.symbol)}
                      aria-label={`Remove ${w.symbol} from watchlist`}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Equity Paper Portfolio Value
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {inr(equitySummary.total)}
                  </span>
                  <span
                    className={`text-sm font-mono tabular-nums font-bold ${pnlTextClass(
                      equitySummary.totalPnL
                    )}`}
                  >
                    {equitySummary.totalPnL >= 0 ? '+' : '-'}
                    {inr(equitySummary.totalPnL)} ({equitySummary.returnPct >= 0 ? '+' : ''}
                    {equitySummary.returnPct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetEquities}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Equity</span>
                </button>
                <button
                  type="button"
                  onClick={resetOptions}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset F&amp;O</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Available Margin</div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {inr(acc.cash)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Invested Value</div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {inr(equitySummary.holdingsValue)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Open Equity MTM</div>
                <div
                  className={`text-base font-bold font-mono tabular-nums mt-0.5 ${pnlTextClass(
                    equitySummary.openPnL
                  )}`}
                >
                  {equitySummary.openPnL >= 0 ? '+' : '-'}
                  {inr(equitySummary.openPnL)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">F&amp;O Margin Free</div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {inr(Math.max(0, optMetrics.availableCash))}
                </div>
              </div>
            </div>
          </div>

          <TradePerformanceSummary
            trades={sessionPerformanceTrades}
            onNewTrade={() => openTicketFor(activeOrderTargetSymbol, activeOrderTargetMarket, 'BUY')}
            newTradeLabel="New Paper Trade"
            onSelectStock={onSelectStock}
          />

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto">
              <div className="flex items-center gap-6" role="tablist">
                {(
                  [
                    { id: 'positions', label: 'Positions', count: totalOpenPositions },
                    { id: 'orders', label: 'Orders', count: totalOrderCount },
                    { id: 'history', label: 'Trading History', count: openHistoryTrades.length + closedTrades.length },
                    {
                      id: 'accuracy',
                      label:
                        accuracySummary.accuracyRatePct !== null
                          ? `Trade Accuracy · ${accuracySummary.accuracyRatePct.toFixed(0)}%`
                          : 'Trade Accuracy',
                      count: accuracySummary.trackedCount,
                    },
                    { id: 'leaderboard', label: 'Leaderboard', count: null },
                  ] as Array<{ id: MainTab; label: string; count: number | null }>
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== null && tab.count > 0 && (
                        <span className="ml-1.5 font-mono tabular-nums text-xs opacity-75">
                          ({tab.count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'positions' && (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {(
                      [
                        { id: 'ALL', label: `All (${totalOpenPositions})` },
                        { id: 'EQUITY', label: `Equities (${positionKeys.length})` },
                        { id: 'OPTIONS', label: `Options F&O (${optMetrics.openPositions.length})` },
                      ] as Array<{ id: PositionFilter; label: string }>
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPosFilter(f.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          posFilter === f.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('options')}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <span>Trade Calls &amp; Puts in Option Chain</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {totalOpenPositions === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      No active positions yet
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      Click <strong className="text-emerald-600">B</strong> or{' '}
                      <strong className="text-rose-600">S</strong> next to any stock in the Watchlist, or open the Option Chain to practice F&amp;O strategies.
                    </p>
                    <div className="flex items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          openTicketFor(activeOrderTargetSymbol, activeOrderTargetMarket, 'BUY')
                        }
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Place First Trade
                      </button>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('options')}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Open Option Chain
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(posFilter === 'ALL' || posFilter === 'EQUITY') && positionKeys.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                              <th className="py-2.5 pr-3">Instrument</th>
                              <th className="py-2.5 px-2 text-right">Qty</th>
                              <th className="py-2.5 px-2 text-right">Avg</th>
                              <th className="py-2.5 px-2 text-right">LTP</th>
                              <th className="py-2.5 px-2 text-right">MTM P&amp;L</th>
                              <th className="py-2.5 pl-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                            {positionKeys.map((s) => {
                              const p = acc.positions[s];
                              const { price } = quoteOf(s);
                              const pnl = price === null ? null : (price - p.avgPrice) * p.quantity;
                              const pnlPct =
                                price === null || p.avgPrice <= 0
                                  ? null
                                  : ((price - p.avgPrice) / p.avgPrice) * 100;
                              return (
                                <tr
                                  key={s}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <td className="py-3 pr-3">
                                    <button
                                      type="button"
                                      onClick={() => onSelectStock?.(s, p.market)}
                                      className="font-bold text-slate-900 dark:text-white hover:underline cursor-pointer"
                                    >
                                      {s}
                                    </button>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                                      {p.market} · {p.product || 'CNC'}
                                      {p.stopLoss ? ` · SL ₹${p.stopLoss}` : ''}
                                      {p.target ? ` · Tgt ₹${p.target}` : ''}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-right font-mono tabular-nums font-medium">
                                    {p.quantity}
                                  </td>
                                  <td className="py-3 px-2 text-right font-mono tabular-nums">
                                    ₹{p.avgPrice.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-2 text-right font-mono tabular-nums font-medium">
                                    {price === null ? '—' : `₹${price.toFixed(2)}`}
                                  </td>
                                  <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                                    {pnl === null ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <>
                                        <div className={`font-bold ${pnlTextClass(pnl)}`}>
                                          {pnl >= 0 ? '+' : '-'}
                                          {inrExact(pnl)}
                                        </div>
                                        {pnlPct !== null && (
                                          <div className={`text-xs ${pnlTextClass(pnlPct)}`}>
                                            {pnlPct >= 0 ? '+' : ''}
                                            {pnlPct.toFixed(2)}%
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </td>
                                  <td className="py-3 pl-2 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openTicketFor(s, p.market, 'BUY')}
                                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                                      >
                                        Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => closeEquityPosition(s)}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                                      >
                                        Exit
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(posFilter === 'ALL' || posFilter === 'OPTIONS') &&
                      optMetrics.openPositions.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Options (F&amp;O) Open Contracts
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                                  <th className="py-2 pr-3">Contract</th>
                                  <th className="py-2 px-2">Side</th>
                                  <th className="py-2 px-2 text-right">Qty</th>
                                  <th className="py-2 px-2 text-right">Avg Premium</th>
                                  <th className="py-2 pl-2 text-right">Expiry</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                                {optMetrics.openPositions.map((p) => (
                                  <tr key={p.key}>
                                    <td className="py-2.5 pr-3 font-bold">
                                      {p.underlying} {p.strike.toLocaleString('en-IN')} {p.type}
                                    </td>
                                    <td
                                      className={`py-2.5 px-2 text-xs font-bold ${
                                        p.qty > 0
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-rose-600 dark:text-rose-400'
                                      }`}
                                    >
                                      {p.qty > 0 ? 'LONG' : 'SHORT'}
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                                      {Math.abs(p.qty)}
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                                      ₹{p.avg.toFixed(2)}
                                    </td>
                                    <td className="py-2.5 pl-2 text-right text-xs text-slate-500 dark:text-slate-400">
                                      {p.expiry || 'Current'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    {posFilter === 'EQUITY' && positionKeys.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                        No open equity positions. Use the Watchlist on the left to buy or sell shares.
                      </p>
                    )}

                    {posFilter === 'OPTIONS' && optMetrics.openPositions.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                        No open option contracts. Open the Option Chain to paper trade Calls &amp; Puts.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="p-5 space-y-4">
                <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {(
                    [
                      { id: 'ALL', label: `All (${totalOrderCount})` },
                      { id: 'PENDING', label: `Pending (${pendingOrders.length})` },
                      { id: 'EXECUTED', label: `Executed (${executedOrders.length})` },
                    ] as Array<{ id: OrderSubFilter; label: string }>
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOrderFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        orderFilter === f.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {(orderFilter === 'ALL' || orderFilter === 'PENDING') && pendingOrders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Pending Limit Orders
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                            <th className="py-2 pr-3">Instrument</th>
                            <th className="py-2 px-2">Side</th>
                            <th className="py-2 px-2 text-right">Qty</th>
                            <th className="py-2 px-2 text-right">Limit / LTP</th>
                            <th className="py-2 pl-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                          {pendingOrders.map((p) => {
                            const live = quoteOf(p.symbol).price;
                            return (
                              <tr key={p.id}>
                                <td className="py-2.5 pr-3">
                                  <div className="font-bold">{p.symbol}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {p.product} · LIMIT
                                  </div>
                                </td>
                                <td
                                  className={`py-2.5 px-2 text-xs font-bold ${
                                    p.type === 'BUY'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {p.type}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                                  {p.shares}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs">
                                  <div className="font-semibold">₹{p.limitPrice.toFixed(2)}</div>
                                  <div className="text-slate-500 dark:text-slate-400">
                                    LTP {live ? `₹${live.toFixed(2)}` : '—'}
                                  </div>
                                </td>
                                <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => executePendingAtMarket(p)}
                                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                                    >
                                      Fill Now
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelPendingOrder(p.id)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                                    >
                                      Cancel
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
                )}

                {(orderFilter === 'ALL' || orderFilter === 'EXECUTED') && (
                  <div className="space-y-2">
                    {executedOrders.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                        No executed orders yet. Place a paper trade from the Watchlist or Option Chain.
                      </p>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                              <th className="py-2 pr-3">Instrument</th>
                              <th className="py-2 px-2">Side</th>
                              <th className="py-2 px-2 text-right">Qty @ Price</th>
                              <th className="py-2 pl-2 text-right">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                            {executedOrders.slice(0, 60).map((o) => (
                              <tr key={o.id}>
                                <td className="py-2.5 pr-3">
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {o.instrument}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {o.detail} ·{' '}
                                    {new Date(o.time).toLocaleString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </td>
                                <td
                                  className={`py-2.5 px-2 text-xs font-bold ${
                                    o.action === 'BUY'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {o.action}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-nums text-xs">
                                  {o.qty} @ ₹{o.price.toFixed(2)}
                                </td>
                                <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-medium">
                                  {inr(o.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {orderFilter === 'PENDING' && pendingOrders.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                    No pending limit orders. Choose Limit inside the New Trade ticket to queue a price-targeted order.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <PaperTradingHistoryTab
                embedded
                trades={closedTrades}
                openTrades={openHistoryTrades}
                accuracyById={accuracyById}
                onCloseEquityPosition={closeEquityPosition}
                onCloseOptionPosition={closeOptionPosition}
                onSelectStock={onSelectStock}
                onTradeEquities={() =>
                  openTicketFor(activeOrderTargetSymbol, activeOrderTargetMarket, 'BUY')
                }
                onOpenOptions={onNavigate ? () => onNavigate('options') : undefined}
              />
            )}

            {activeTab === 'accuracy' && (
              <TradeAccuracyPanel
                embedded
                records={accuracyRecords}
                onSelectStock={onSelectStock}
                onStartTrade={() =>
                  openTicketFor(activeOrderTargetSymbol, activeOrderTargetMarket, 'BUY')
                }
                onOpenOptions={onNavigate ? () => onNavigate('options') : undefined}
              />
            )}

            {activeTab === 'leaderboard' && (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>Community Return % Leaderboard</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Compare virtual equity performance with other traders.
                    </p>
                  </div>
                  {board.configured && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user.email) {
                          return setBoardMsg({
                            ok: false,
                            text: 'Please register on the Account page first (username + email).',
                          });
                        }
                        const r = await submitLeaderboard(
                          user.username,
                          user.email,
                          equitySummary.total
                        );
                        setBoardMsg(
                          r.ok
                            ? { ok: true, text: `Score submitted. Your rank: #${r.rank}` }
                            : { ok: false, text: r.error || 'Failed to submit score' }
                        );
                        if (r.ok) loadBoard();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Submit My Score
                    </button>
                  )}
                </div>

                {boardMsg && (
                  <p
                    className={`text-xs font-medium ${
                      boardMsg.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {boardMsg.text}
                  </p>
                )}

                {board.loaded && !board.configured && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Leaderboard is currently unavailable (Supabase is not configured on the server).
                  </p>
                )}

                {board.configured && board.rows.length === 0 && board.loaded && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No scores submitted yet.
                  </p>
                )}

                {board.rows.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left">
                        <th className="py-2 w-12">Rank</th>
                        <th className="py-2">Trader</th>
                        <th className="py-2 text-right">Portfolio Value</th>
                        <th className="py-2 text-right">Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                      {board.rows.map((r, i) => (
                        <tr key={r.username}>
                          <td className="py-2 font-mono tabular-nums text-slate-400">#{i + 1}</td>
                          <td className="py-2 font-semibold">{r.username}</td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {inr(r.total_value)}
                          </td>
                          <td
                            className={`py-2 text-right font-bold font-mono tabular-nums ${pnlTextClass(
                              r.return_pct
                            )}`}
                          >
                            {r.return_pct >= 0 ? '+' : ''}
                            {Number(r.return_pct).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p className="text-xs text-slate-400">
                  Scores are self-submitted for friendly competition. Only usernames are shown.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaperTradingSummaryDashboard
        closedTrades={closedTrades}
        equityBalance={equitySummary.total}
        equityInitialCash={acc.initialCash}
        optionsBalance={optMetrics.netEquity}
        optionsInitialCash={optMetrics.initialCash}
        showHistoryLink={activeTab !== 'history'}
        onViewHistory={() => setActiveTab('history')}
      />

      <CompatibleOrderModal
        ticket={orderTicket}
        availableCash={acc.cash}
        heldQty={orderTicket ? acc.positions[orderTicket.symbol]?.quantity || 0 : 0}
        currentAnalysis={data}
        onClose={() => setOrderTicket(null)}
        onSubmit={handleOrderSubmit}
      />
    </div>
  );
};

export default PaperTradingPage;
