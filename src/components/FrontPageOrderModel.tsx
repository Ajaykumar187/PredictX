import React, { useEffect, useState } from 'react';
import { X, Loader2, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalysisResult, MarketType } from '../types';
import { fetchLiveQuote } from '../utils/stockApi';
import { runFullAnalysis } from '../utils/aiEngine';
import {
  directionFromSignal,
  type PreTradeForecast,
  type OrderPreTradeSnapshot,
} from '../utils/tradeAccuracy';

export type { OrderPreTradeSnapshot };

export interface OrderTicketTarget {
  symbol: string;
  market: MarketType;
  price: number;
  changePct?: number;
  side: 'BUY' | 'SELL';
}

export interface OrderSubmission {
  symbol: string;
  market: MarketType;
  side: 'BUY' | 'SELL';
  product: 'CNC' | 'MIS';
  orderType: 'MARKET' | 'LIMIT';
  qty: number;
  price: number;
  limitPrice?: number;
  stopLoss?: number;
  target?: number;
  preTradeForecast?: OrderPreTradeSnapshot | null;
}

export interface FrontPageOrderModalProps {
  ticket: OrderTicketTarget | null;
  availableCash: number;
  heldQty: number;
  currentAnalysis?: AnalysisResult | null;
  onClose: () => void;
  onSubmit: (order: OrderSubmission) => { ok: boolean; text: string };
}

type Props = FrontPageOrderModalProps;

const preTradeCache = new Map<string, { at: number; snapshot: OrderPreTradeSnapshot }>();
const PRE_TRADE_CACHE_MS = 5 * 60 * 1000;

function snapshotFromAnalysis(a: AnalysisResult): OrderPreTradeSnapshot {
  const target7d = a.forecast7d?.[a.forecast7d.length - 1];
  const movePct =
    target7d && a.latestPrice > 0
      ? Number((((target7d - a.latestPrice) / a.latestPrice) * 100).toFixed(2))
      : undefined;
  const latestInd = a.df?.[a.df.length - 1];
  const rsiVal = typeof latestInd?.rsi14 === 'number' ? latestInd.rsi14 : undefined;
  const tgtText =
    target7d !== undefined
      ? ` targeting ${a.currencySymbol}${target7d.toFixed(2)} (${movePct !== undefined && movePct >= 0 ? '+' : ''}${movePct ?? 0}%)`
      : '';
  return {
    segment: 'Equity',
    instrument: a.displaySymbol,
    symbol: a.displaySymbol,
    market: a.market,
    predictedSignal: a.signal,
    predictedDirection: directionFromSignal(a.signal),
    predictedTarget: target7d ? Number(target7d.toFixed(2)) : undefined,
    predictedMovePct: movePct,
    confidence: a.confidence,
    score: a.score,
    rsiAtEntry: rsiVal,
    summary: `Model called ${a.signal} (score ${a.score > 0 ? '+' : ''}${a.score}/100, ${a.confidence.toFixed(0)}% conf)${tgtText}`,
    reasons: a.reasons.slice(0, 4),
    source: 'pre-trade-model',
  };
}

const QUICK_QTYS = [1, 5, 10, 25, 50, 100];

const inr = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const FrontPageOrderModal: React.FC<Props> = ({
  ticket,
  availableCash,
  heldQty,
  currentAnalysis,
  onClose,
  onSubmit,
}) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [product, setProduct] = useState<'CNC' | 'MIS'>('CNC');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qtyInput, setQtyInput] = useState<string>('10');
  const [limitInput, setLimitInput] = useState<string>('');
  const [slInput, setSlInput] = useState<string>('');
  const [targetInput, setTargetInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [preTrade, setPreTrade] = useState<OrderPreTradeSnapshot | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setSide(ticket.side);
    setProduct('CNC');
    setOrderType('MARKET');
    setQtyInput(ticket.side === 'SELL' && heldQty > 0 ? String(heldQty) : '10');
    setLimitInput(ticket.price > 0 ? ticket.price.toFixed(2) : '');
    setSlInput('');
    setTargetInput('');
    setError(null);

    const upper = ticket.symbol.toUpperCase();
    const cacheKey = `${upper}|${ticket.market}`;

    if (currentAnalysis && currentAnalysis.displaySymbol.toUpperCase() === upper) {
      const snap = snapshotFromAnalysis(currentAnalysis);
      preTradeCache.set(cacheKey, { at: Date.now(), snapshot: snap });
      setPreTrade(snap);
      setLoadingForecast(false);
      return;
    }

    const cached = preTradeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < PRE_TRADE_CACHE_MS) {
      setPreTrade(cached.snapshot);
      setLoadingForecast(false);
      return;
    }

    let alive = true;
    setPreTrade(null);
    setLoadingForecast(true);
    fetchLiveQuote(ticket.symbol, ticket.market)
      .then((q) => {
        if (!alive || !q || !Array.isArray(q.bars) || q.bars.length < 15) return;
        const analysis = runFullAnalysis(
          q.displaySymbol,
          q.market,
          q.bars,
          q.info,
          q.latestPrice,
          q.change,
          q.changePct
        );
        const snap = snapshotFromAnalysis(analysis);
        preTradeCache.set(cacheKey, { at: Date.now(), snapshot: snap });
        if (alive) setPreTrade(snap);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingForecast(false);
      });

    return () => {
      alive = false;
    };
  }, [ticket, heldQty, currentAnalysis]);

  if (!ticket) return null;

  const parsedQty = Math.floor(parseFloat(qtyInput));
  const qty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;

  const parsedLimit = parseFloat(limitInput);
  const effectivePrice =
    orderType === 'LIMIT' && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : ticket.price;

  const parsedSl = parseFloat(slInput);
  const stopLoss = Number.isFinite(parsedSl) && parsedSl > 0 ? parsedSl : undefined;

  const parsedTarget = parseFloat(targetInput);
  const target = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined;

  const estValue = qty * effectivePrice;
  const isBuy = side === 'BUY';
  const insufficientCash = isBuy && estValue > availableCash;
  const insufficientShares = !isBuy && qty > heldQty;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (qty <= 0) {
      setError('Enter a quantity of at least 1 share.');
      return;
    }
    if (effectivePrice <= 0) {
      setError('Live market price is unavailable for this symbol right now.');
      return;
    }
    if (orderType === 'LIMIT' && !(Number.isFinite(parsedLimit) && parsedLimit > 0)) {
      setError('Enter a valid limit price.');
      return;
    }

    const res = onSubmit({
      symbol: ticket.symbol,
      market: ticket.market,
      side,
      product,
      orderType,
      qty,
      price: ticket.price,
      limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined,
      stopLoss,
      target,
      preTradeForecast: preTrade,
    });

    if (!res.ok) {
      setError(res.text);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Place paper order for ${ticket.symbol}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 ${
            isBuy
              ? 'bg-emerald-50/70 dark:bg-emerald-950/25'
              : 'bg-rose-50/70 dark:bg-rose-950/25'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {ticket.symbol}
              </h3>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {ticket.market}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono tabular-nums text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                {ticket.price > 0 ? inr(ticket.price) : 'Fetching LTP...'}
              </span>
              {typeof ticket.changePct === 'number' && Number.isFinite(ticket.changePct) && (
                <span
                  className={
                    ticket.changePct >= 0
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-rose-600 dark:text-rose-400 font-semibold'
                  }
                >
                  {ticket.changePct >= 0 ? '+' : ''}
                  {ticket.changePct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close order ticket"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Pre-Trade Forecast</span>
              </span>
              {loadingForecast && (
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing...
                </span>
              )}
              {!loadingForecast && preTrade && (
                <span
                  className={`text-xs font-bold inline-flex items-center gap-1 ${
                    preTrade.predictedDirection === 'UP'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : preTrade.predictedDirection === 'DOWN'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {preTrade.predictedDirection === 'UP' ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : preTrade.predictedDirection === 'DOWN' ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  <span>{preTrade.predictedSignal}</span>
                  {typeof preTrade.confidence === 'number' && (
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                      · {preTrade.confidence.toFixed(0)}% conf
                    </span>
                  )}
                </span>
              )}
            </div>

            {preTrade ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  <span>
                    {preTrade.predictedTarget
                      ? `7D Target ${inr(preTrade.predictedTarget)} (${
                          (preTrade.predictedMovePct ?? 0) >= 0 ? '+' : ''
                        }${(preTrade.predictedMovePct ?? 0).toFixed(1)}%)`
                      : `Score ${preTrade.score ?? 0}/100`}
                    {typeof preTrade.rsiAtEntry === 'number' ? ` · RSI ${preTrade.rsiAtEntry.toFixed(1)}` : ''}
                  </span>
                  {isBuy && preTrade.predictedTarget && preTrade.predictedTarget > effectivePrice && (
                    <button
                      type="button"
                      onClick={() => setTargetInput(preTrade.predictedTarget!.toFixed(2))}
                      className="text-blue-600 dark:text-blue-400 font-sans font-semibold hover:underline cursor-pointer"
                    >
                      Apply target
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {preTrade.predictedDirection === 'FLAT'
                    ? 'Neutral pre-trade call — saved automatically to track trade outcome accuracy.'
                    : (isBuy && preTrade.predictedDirection === 'UP') ||
                        (!isBuy && preTrade.predictedDirection === 'DOWN')
                      ? `Aligned with ${preTrade.predictedSignal} call — saved automatically for post-trade accuracy.`
                      : `Contrarian to ${preTrade.predictedSignal} call — saved automatically for post-trade accuracy.`}
                </div>
              </>
            ) : !loadingForecast ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pre-trade model call unavailable right now. Any Stop Loss / Target you enter will still be graded in Trade Accuracy.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setSide('BUY');
                setError(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isBuy
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => {
                setSide('SELL');
                setError(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                !isBuy
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              SELL
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                Product
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['CNC', 'MIS'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProduct(p)}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      product === p
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'CNC' ? 'Delivery' : 'Intraday'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                Order Type
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['MARKET', 'LIMIT'] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      orderType === ot
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {ot === 'MARKET' ? 'Market' : 'Limit'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Quantity
                </label>
                {!isBuy && heldQty > 0 && (
                  <button
                    type="button"
                    onClick={() => setQtyInput(String(heldQty))}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Max ({heldQty})
                  </button>
                )}
              </div>
              <input
                type="number"
                min={1}
                value={qtyInput}
                placeholder="Qty"
                onChange={(e) => setQtyInput(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                {orderType === 'MARKET' ? 'Market Price' : 'Limit Price (₹)'}
              </label>
              <input
                type="number"
                step="0.05"
                disabled={orderType === 'MARKET'}
                value={orderType === 'MARKET' ? (ticket.price > 0 ? ticket.price.toFixed(2) : '') : limitInput}
                placeholder="Price"
                onChange={(e) => setLimitInput(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                  orderType === 'MARKET'
                    ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_QTYS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQtyInput(String(q))}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums font-semibold transition-colors cursor-pointer ${
                  qty === q
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {isBuy && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  Stop Loss (Optional)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={slInput}
                  placeholder="e.g. SL price"
                  onChange={(e) => setSlInput(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  Target (Optional)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={targetInput}
                  placeholder="e.g. Target price"
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Estimated Order Value</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {inr(estValue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>{isBuy ? 'Available Virtual Cash' : 'Shares Held'}</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  insufficientCash || insufficientShares
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {isBuy ? inr(availableCash) : `${heldQty.toLocaleString('en-IN')} shares`}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={qty <= 0 || effectivePrice <= 0 || insufficientCash || insufficientShares}
            className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              isBuy
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {orderType === 'LIMIT'
              ? `Place Limit ${isBuy ? 'Buy' : 'Sell'} Order`
              : `Confirm ${isBuy ? 'Buy' : 'Sell'} · ${qty} ${ticket.symbol}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FrontPageOrderModal;
