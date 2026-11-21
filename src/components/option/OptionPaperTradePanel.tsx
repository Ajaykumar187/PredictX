import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  RotateCcw,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Target,
  Pencil,
} from 'lucide-react';
import type { OptionChainRow } from '../../utils/greeks';
import {
  PaperOrder,
  PaperPosition,
  getOrders,
  placeOrders,
  clearOrders,
  subscribeOrders,
  computeOptionPaperMetrics,
  setOptionPositionRisk,
} from '../../utils/paperTrades';
import { saveTradeForecast, directionFromSignal } from '../../utils/tradeAccuracy';

const fmtMoney = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtSignedMoney = (n: number) => `${n >= 0 ? '+' : '-'}${fmtMoney(n)}`;

const pnlColor = (n: number) =>
  n > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : n < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-600 dark:text-slate-300';

const roundTick = (v: number) => Math.max(0.05, Math.round(v * 20) / 20);

function validateOptionRisk(
  isLong: boolean,
  refPrice: number,
  sl?: number,
  tgt?: number
): string | null {
  if (sl !== undefined) {
    if (!Number.isFinite(sl) || sl <= 0) return 'Stop Loss must be greater than ₹0.';
    if (isLong && sl >= refPrice) {
      return `For a LONG option, Stop Loss must be below ₹${refPrice.toFixed(2)}.`;
    }
    if (!isLong && sl <= refPrice) {
      return `For a SHORT option, Stop Loss must be above ₹${refPrice.toFixed(2)}.`;
    }
  }
  if (tgt !== undefined) {
    if (!Number.isFinite(tgt) || tgt <= 0) return 'Target must be greater than ₹0.';
    if (isLong && tgt <= refPrice) {
      return `For a LONG option, Target must be above ₹${refPrice.toFixed(2)}.`;
    }
    if (!isLong && tgt >= refPrice) {
      return `For a SHORT option, Target must be below ₹${refPrice.toFixed(2)}.`;
    }
  }
  return null;
}

export interface QuickOptionTicketTarget {
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  price: number;
}

interface QuickOptionOrderModalProps {
  symbol: string;
  expiry: string;
  expiryLabel: string;
  lotSize: number;
  target: QuickOptionTicketTarget;
  availableCash: number;
  onClose: () => void;
  onOrderPlaced: (summary: string) => void;
}

export const QuickOptionOrderModal: React.FC<QuickOptionOrderModalProps> = ({
  symbol,
  expiry,
  expiryLabel,
  lotSize,
  target,
  availableCash,
  onClose,
  onOrderPlaced,
}) => {
  const [action, setAction] = useState<'BUY' | 'SELL'>(target.action);
  const [lotsInput, setLotsInput] = useState<string>('1');
  const [slInput, setSlInput] = useState<string>('');
  const [tgtInput, setTgtInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isLong = action === 'BUY';
  const parsedLots = Math.floor(parseFloat(lotsInput));
  const validLots = Number.isFinite(parsedLots) && parsedLots > 0 ? parsedLots : 0;
  const totalQty = validLots * lotSize;
  const orderValue = totalQty * target.price;

  const parsedSl = slInput.trim() === '' ? undefined : parseFloat(slInput);
  const parsedTgt = tgtInput.trim() === '' ? undefined : parseFloat(tgtInput);

  const maxRisk =
    parsedSl !== undefined && Number.isFinite(parsedSl) && parsedSl > 0 && totalQty > 0
      ? Math.abs(target.price - parsedSl) * totalQty
      : null;
  const estReward =
    parsedTgt !== undefined && Number.isFinite(parsedTgt) && parsedTgt > 0 && totalQty > 0
      ? Math.abs(parsedTgt - target.price) * totalQty
      : null;
  const rrRatio = maxRisk && maxRisk > 0 && estReward && estReward > 0 ? estReward / maxRisk : null;

  const applySlPct = (pct: number) => {
    const val = isLong ? target.price * (1 - pct / 100) : target.price * (1 + pct / 100);
    setSlInput(roundTick(val).toFixed(2));
    setError(null);
  };

  const applyTgtPct = (pct: number) => {
    const val = isLong ? target.price * (1 + pct / 100) : target.price * (1 - pct / 100);
    setTgtInput(roundTick(val).toFixed(2));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validLots <= 0) {
      setError('Enter at least 1 lot to place a paper order.');
      return;
    }
    if (!(target.price > 0)) {
      setError('Live option premium is unavailable for this strike.');
      return;
    }
    if (orderValue > availableCash) {
      setError(`Insufficient virtual F&O capital. Available: ${fmtMoney(availableCash)}`);
      return;
    }

    const riskErr = validateOptionRisk(isLong, target.price, parsedSl, parsedTgt);
    if (riskErr) {
      setError(riskErr);
      return;
    }

    placeOrders([
      {
        underlying: symbol,
        expiry,
        strike: target.strike,
        type: target.type,
        action,
        qty: totalQty,
        price: target.price,
        stopLoss: parsedSl,
        target: parsedTgt,
      },
    ]);

    const optInstrument = `${symbol} ${target.strike.toLocaleString('en-IN')} ${target.type}`;
    const isBullishOptionTrade =
      (action === 'BUY' && target.type === 'CE') || (action === 'SELL' && target.type === 'PE');
    const preSignal = isBullishOptionTrade ? 'BUY CALL' : 'BUY PUT';
    const expectedMovePct =
      parsedTgt && target.price > 0
        ? Number((((parsedTgt - target.price) / target.price) * 100 * (isLong ? 1 : -1)).toFixed(2))
        : undefined;

    saveTradeForecast({
      segment: 'Options',
      instrument: optInstrument,
      symbol,
      tradeSide: isLong ? 'LONG' : 'SHORT',
      entryPrice: target.price,
      openedAt: new Date().toISOString(),
      predictedSignal: preSignal,
      predictedDirection: directionFromSignal(preSignal),
      predictedTarget: parsedTgt,
      predictedMovePct: expectedMovePct,
      userStopLoss: parsedSl,
      userTarget: parsedTgt,
      summary: `Pre-trade F&O ${action} ${optInstrument} @ ₹${target.price.toFixed(2)}${parsedTgt ? ` · Target ₹${parsedTgt.toFixed(2)}` : ''}${parsedSl ? ` · SL ₹${parsedSl.toFixed(2)}` : ''}`,
      source: 'option-signal',
    });

    const riskTags = [
      parsedSl ? `SL ₹${parsedSl.toFixed(2)}` : null,
      parsedTgt ? `Target ₹${parsedTgt.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    onOrderPlaced(
      `${action} ${validLots} lot${validLots > 1 ? 's' : ''} (${totalQty} qty) ${symbol} ${target.strike} ${target.type} @ ₹${target.price.toFixed(2)}${riskTags ? ` (${riskTags})` : ''}`
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {symbol} {target.strike.toLocaleString('en-IN')} {target.type}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-500/30">
                Paper Order
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Expiry {expiryLabel} · Lot size {lotSize}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order ticket"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAction('BUY');
                setSlInput('');
                setTgtInput('');
                setError(null);
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                action === 'BUY'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>BUY (Long)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('SELL');
                setSlInput('');
                setTgtInput('');
                setError(null);
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                action === 'SELL'
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>SELL (Short)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Execution LTP
              </span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                ₹{target.price.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Number of Lots
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={lotsInput}
                onChange={(e) => {
                  setLotsInput(e.target.value);
                  setError(null);
                }}
                placeholder="1"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Quick lots
            </span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setLotsInput(String(n));
                    setError(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border transition-colors cursor-pointer ${
                    lotsInput === String(n)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {n}L
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Stop Loss</span>
                </label>
                {slInput && (
                  <button
                    type="button"
                    onClick={() => setSlInput('')}
                    className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={slInput}
                onChange={(e) => {
                  setSlInput(e.target.value);
                  setError(null);
                }}
                placeholder={isLong ? `< ${target.price.toFixed(1)}` : `> ${target.price.toFixed(1)}`}
                className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/70 rounded-lg px-2.5 py-1 text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
              <div className="flex items-center gap-1">
                {[10, 20, 30].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applySlPct(pct)}
                    className="flex-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-800/60 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer"
                  >
                    {isLong ? `-${pct}%` : `+${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Target</span>
                </label>
                {tgtInput && (
                  <button
                    type="button"
                    onClick={() => setTgtInput('')}
                    className="text-[10px] font-semibold text-slate-400 hover:text-emerald-600 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={tgtInput}
                onChange={(e) => {
                  setTgtInput(e.target.value);
                  setError(null);
                }}
                placeholder={isLong ? `> ${target.price.toFixed(1)}` : `< ${target.price.toFixed(1)}`}
                className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-lg px-2.5 py-1 text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="flex items-center gap-1">
                {[20, 40, 60].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyTgtPct(pct)}
                    className="flex-1 py-0.5 rounded bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
                  >
                    {isLong ? `+${pct}%` : `-${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Quantity</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {totalQty.toLocaleString('en-IN')} ({validLots} × {lotSize})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {action === 'BUY' ? 'Required Premium' : 'Estimated Contract Value'}
              </span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {fmtMoney(orderValue)}
              </span>
            </div>
            {(maxRisk !== null || estReward !== null) && (
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Risk / Reward</span>
                <span className="font-mono tabular-nums font-bold">
                  <span className="text-rose-600 dark:text-rose-400">
                    {maxRisk !== null ? `-${fmtMoney(maxRisk)}` : '—'}
                  </span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {estReward !== null ? `+${fmtMoney(estReward)}` : '—'}
                  </span>
                  {rrRatio !== null && (
                    <span className="text-slate-500 dark:text-slate-400 ml-1.5">
                      (1:{rrRatio.toFixed(1)})
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70">
              <span className="text-slate-500 dark:text-slate-400">Available Virtual Capital</span>
              <span className="font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {fmtMoney(Math.max(0, availableCash))}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer ${
                action === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {action === 'BUY' ? 'Place Paper Buy' : 'Place Paper Sell'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditOptionRiskModalProps {
  position: PaperPosition;
  liveLtp: number | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const EditOptionRiskModal: React.FC<EditOptionRiskModalProps> = ({
  position,
  liveLtp,
  onClose,
  onSaved,
}) => {
  const isLong = position.qty > 0;
  const refPrice = liveLtp && liveLtp > 0 ? liveLtp : position.avg;
  const [slInput, setSlInput] = useState<string>(
    position.stopLoss ? position.stopLoss.toFixed(2) : ''
  );
  const [tgtInput, setTgtInput] = useState<string>(
    position.target ? position.target.toFixed(2) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const parsedSl = slInput.trim() === '' ? undefined : parseFloat(slInput);
  const parsedTgt = tgtInput.trim() === '' ? undefined : parseFloat(tgtInput);

  const applySlPct = (pct: number) => {
    const val = isLong ? refPrice * (1 - pct / 100) : refPrice * (1 + pct / 100);
    setSlInput(roundTick(val).toFixed(2));
    setError(null);
  };

  const applyTgtPct = (pct: number) => {
    const val = isLong ? refPrice * (1 + pct / 100) : refPrice * (1 - pct / 100);
    setTgtInput(roundTick(val).toFixed(2));
    setError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateOptionRisk(isLong, refPrice, parsedSl, parsedTgt);
    if (err) {
      setError(err);
      return;
    }
    setOptionPositionRisk(position.key, { stopLoss: parsedSl, target: parsedTgt });
    const summaryParts = [
      parsedSl ? `SL ₹${parsedSl.toFixed(2)}` : null,
      parsedTgt ? `Target ₹${parsedTgt.toFixed(2)}` : null,
    ].filter(Boolean);
    onSaved(
      summaryParts.length > 0
        ? `Updated ${position.underlying} ${position.strike} ${position.type}: ${summaryParts.join(' · ')}`
        : `Cleared Stop Loss & Target for ${position.underlying} ${position.strike} ${position.type}`
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {position.underlying} {position.strike.toLocaleString('en-IN')} {position.type}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isLong
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                }`}
              >
                {isLong ? 'LONG' : 'SHORT'} {Math.abs(position.qty)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              Avg ₹{position.avg.toFixed(2)} · LTP {liveLtp ? `₹${liveLtp.toFixed(2)}` : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Stop Loss and Target modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Stop Loss Price (₹)</span>
              </label>
              {slInput && (
                <button
                  type="button"
                  onClick={() => setSlInput('')}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={slInput}
              onChange={(e) => {
                setSlInput(e.target.value);
                setError(null);
              }}
              placeholder={isLong ? `Below ₹${refPrice.toFixed(2)}` : `Above ₹${refPrice.toFixed(2)}`}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
            <div className="flex items-center gap-1.5">
              {[10, 15, 25, 35].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applySlPct(pct)}
                  className="flex-1 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
                >
                  {isLong ? `-${pct}%` : `+${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Target Price (₹)</span>
              </label>
              {tgtInput && (
                <button
                  type="button"
                  onClick={() => setTgtInput('')}
                  className="text-[11px] font-semibold text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={tgtInput}
              onChange={(e) => {
                setTgtInput(e.target.value);
                setError(null);
              }}
              placeholder={isLong ? `Above ₹${refPrice.toFixed(2)}` : `Below ₹${refPrice.toFixed(2)}`}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="flex items-center gap-1.5">
              {[20, 35, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyTgtPct(pct)}
                  className="flex-1 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                >
                  {isLong ? `+${pct}%` : `-${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Positions auto square-off at live option chain LTP whenever Stop Loss or Target is triggered.
          </p>

          {error && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Save Levels
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StrikeRiskProgressBarProps {
  position: PaperPosition;
  liveLtp: number;
  align: 'left' | 'right';
  onEdit: (pos: PaperPosition) => void;
}

export const StrikeRiskProgressBar: React.FC<StrikeRiskProgressBarProps> = ({
  position,
  liveLtp,
  align,
  onEdit,
}) => {
  const isLong = position.qty > 0;
  const sl = position.stopLoss && position.stopLoss > 0 ? position.stopLoss : undefined;
  const tgt = position.target && position.target > 0 ? position.target : undefined;
  const ltp = liveLtp > 0 ? liveLtp : position.avg;
  const isInProfit = isLong ? ltp >= position.avg : ltp <= position.avg;

  if (!sl && !tgt) {
    return (
      <div className={`mt-1 flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(position);
          }}
          title="Set Stop Loss and Target for this open option position"
          className="inline-flex items-center gap-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
        >
          <span className={isLong ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
            {isLong ? 'LONG' : 'SHORT'} {Math.abs(position.qty)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>+ SL/Tgt</span>
        </button>
      </div>
    );
  }

  let fillPct = 50;
  let entryMarkerPct: number | null = null;
  let barColorClass = isInProfit ? 'bg-emerald-500' : 'bg-rose-500';

  if (sl !== undefined && tgt !== undefined) {
    const span = isLong ? tgt - sl : sl - tgt;
    if (span > 0) {
      const raw = isLong ? (ltp - sl) / span : (sl - ltp) / span;
      fillPct = Math.max(0, Math.min(100, raw * 100));
      const rawEntry = isLong ? (position.avg - sl) / span : (sl - position.avg) / span;
      entryMarkerPct = Math.max(2, Math.min(98, rawEntry * 100));
    }
  } else if (tgt !== undefined) {
    const span = isLong ? tgt - position.avg : position.avg - tgt;
    if (span > 0) {
      const raw = isLong ? (ltp - position.avg) / span : (position.avg - ltp) / span;
      fillPct = Math.max(0, Math.min(100, raw * 100));
    }
    barColorClass = isInProfit ? 'bg-emerald-500' : 'bg-slate-400';
  } else if (sl !== undefined) {
    const cushion = isLong ? position.avg - sl : sl - position.avg;
    if (cushion > 0) {
      const raw = isLong ? (ltp - sl) / cushion : (sl - ltp) / cushion;
      fillPct = Math.max(0, Math.min(100, raw * 100));
    }
    barColorClass = fillPct < 35 ? 'bg-rose-500' : 'bg-amber-500';
  }

  return (
    <div className={`mt-1 flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(position);
        }}
        title={`Edit SL/Target · ${isLong ? 'LONG' : 'SHORT'} ${Math.abs(position.qty)} @ ₹${position.avg.toFixed(2)}${sl ? ` · SL ₹${sl.toFixed(2)}` : ''}${tgt ? ` · Target ₹${tgt.toFixed(2)}` : ''}`}
        className="w-32 sm:w-36 group text-left rounded px-1.5 py-1 bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between gap-1 text-[9px] leading-none font-mono tabular-nums mb-1">
          <span className="text-rose-600 dark:text-rose-400 font-bold truncate">
            {sl ? `SL ${sl.toFixed(1)}` : 'SL —'}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">
            {tgt ? `Tgt ${tgt.toFixed(1)}` : 'Tgt —'}
          </span>
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{ width: `${fillPct}%` }}
          />
          {entryMarkerPct !== null && (
            <span
              className="absolute top-0 bottom-0 w-0.5 bg-slate-900/75 dark:bg-white/85"
              style={{ left: `${entryMarkerPct}%` }}
            />
          )}
        </div>
      </button>
    </div>
  );
};

interface OptionPaperTradingTabProps {
  symbol: string;
  expiry: string;
  chain: OptionChainRow[];
  lotSize: number;
  onGoToChain: () => void;
}

export const OptionPaperTradingTab: React.FC<OptionPaperTradingTabProps> = ({
  symbol,
  expiry,
  chain,
  lotSize,
  onGoToChain,
}) => {
  const [orders, setOrders] = useState<PaperOrder[]>(() => getOrders());
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRiskPos, setEditingRiskPos] = useState<PaperPosition | null>(null);

  useEffect(() => subscribeOrders(() => setOrders(getOrders())), []);

  const ltpOf = (p: PaperPosition): number | null => {
    if (p.underlying !== symbol) return null;
    if (expiry && p.expiry && p.expiry !== expiry) return null;
    const row = chain.find((r) => r.strike === p.strike);
    if (!row) return null;
    const px = p.type === 'CE' ? row.callLTP : row.putLTP;
    return px > 0 ? px : null;
  };

  const metrics = useMemo(
    () => computeOptionPaperMetrics(orders, ltpOf),
    [orders, symbol, expiry, chain]
  );

  const squareOffPosition = (p: PaperPosition) => {
    const exitPrice = ltpOf(p) ?? p.avg;
    placeOrders([
      {
        underlying: p.underlying,
        expiry: p.expiry,
        strike: p.strike,
        type: p.type,
        action: p.qty > 0 ? 'SELL' : 'BUY',
        qty: Math.abs(p.qty),
        price: exitPrice,
        exitReason: 'MANUAL',
      },
    ]);
    setNotice(
      `Squared off ${p.underlying} ${p.strike} ${p.type} (${Math.abs(p.qty)} qty) @ ₹${exitPrice.toFixed(2)}`
    );
  };

  const squareOffAll = () => {
    if (metrics.openPositions.length === 0) return;
    placeOrders(
      metrics.openPositions.map((p) => ({
        underlying: p.underlying,
        expiry: p.expiry,
        strike: p.strike,
        type: p.type,
        action: p.qty > 0 ? 'SELL' : 'BUY',
        qty: Math.abs(p.qty),
        price: ltpOf(p) ?? p.avg,
        exitReason: 'MANUAL',
      }))
    );
    setNotice(`Squared off all ${metrics.openPositions.length} open option position(s).`);
  };

  const handleReset = () => {
    clearOrders();
    setNotice('Option paper trading account reset to ₹10,00,000 virtual capital.');
  };

  return (
    <div className="p-4 sm:p-5 space-y-5 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Option Chain Paper Trading Desk</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Practice NSE F&amp;O calls and puts with ₹10,00,000 virtual capital, Stop Loss, and Target auto square-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoToChain}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Trade from Option Chain
          </button>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-600 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Virtual Equity
          </span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
            {fmtMoney(metrics.netEquity)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Available Capital
          </span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
            {fmtMoney(Math.max(0, metrics.availableCash))}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Unrealised MTM P/L
          </span>
          <span className={`text-lg font-extrabold font-mono tabular-nums mt-0.5 block ${pnlColor(metrics.unrealizedPnL)}`}>
            {fmtSignedMoney(metrics.unrealizedPnL)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Realised P/L
          </span>
          <span className={`text-lg font-extrabold font-mono tabular-nums mt-0.5 block ${pnlColor(metrics.realizedPnL)}`}>
            {fmtSignedMoney(metrics.realizedPnL)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Open Option Positions ({metrics.openPositions.length})
          </h4>
          {metrics.openPositions.length > 0 && (
            <button
              type="button"
              onClick={squareOffAll}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
            >
              Square Off All
            </button>
          )}
        </div>

        {metrics.openPositions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No open option positions yet. Switch to the <strong>Option Chain</strong> tab and click <strong>B</strong> (Buy) or <strong>S</strong> (Sell) on any Call or Put strike to place a paper order.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/60 dark:bg-slate-900/50 text-[11px] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Contract</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Avg Price</th>
                  <th className="py-2.5 px-3 text-right">Live LTP</th>
                  <th className="py-2.5 px-3 text-right">SL / Target</th>
                  <th className="py-2.5 px-3 text-right">MTM P/L</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.openPositions.map((p) => {
                  const ltp = ltpOf(p);
                  const mtm = ltp !== null ? (ltp - p.avg) * p.qty : null;
                  const mtmPct =
                    ltp !== null && p.avg > 0
                      ? ((p.qty > 0 ? ltp - p.avg : p.avg - ltp) / p.avg) * 100
                      : null;
                  return (
                    <tr key={p.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {p.underlying} {p.strike.toLocaleString('en-IN')} {p.type}
                        </div>
                        <div className="text-[10px] text-slate-400">Exp {p.expiry || 'Current'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            p.qty > 0
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {p.qty > 0 ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {Math.abs(p.qty).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        ₹{p.avg.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                        {ltp !== null ? `₹${ltp.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingRiskPos(p)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-[11px] font-mono tabular-nums cursor-pointer"
                          title="Edit Stop Loss & Target"
                        >
                          {p.stopLoss || p.target ? (
                            <span>
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                {p.stopLoss ? `SL ${p.stopLoss.toFixed(1)}` : 'SL —'}
                              </span>
                              <span className="text-slate-400 mx-1">/</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {p.target ? `Tgt ${p.target.toFixed(1)}` : 'Tgt —'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 font-sans font-semibold">
                              + Set SL / Tgt
                            </span>
                          )}
                          <Pencil className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                          mtm !== null ? pnlColor(mtm) : 'text-slate-400'
                        }`}
                      >
                        {mtm !== null ? (
                          <>
                            {fmtSignedMoney(mtm)}
                            {mtmPct !== null && (
                              <span className="text-[10px] font-semibold ml-1">
                                ({mtmPct >= 0 ? '+' : ''}
                                {mtmPct.toFixed(1)}%)
                              </span>
                            )}
                          </>
                        ) : (
                          'Switch symbol/expiry'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => squareOffPosition(p)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Square Off
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Paper Order History ({orders.length})
            </h4>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/60 dark:bg-slate-900/50 text-[11px] text-slate-500 dark:text-slate-400 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Contract</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...orders].reverse().slice(0, 50).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">
                      {new Date(o.time).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`font-bold ${
                          o.action === 'BUY'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {o.action}
                      </span>
                      {o.exitReason && o.exitReason !== 'MANUAL' && (
                        <span
                          className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            o.exitReason === 'TARGET'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {o.exitReason === 'TARGET' ? 'TGT HIT' : 'SL HIT'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                      {o.underlying} {o.strike.toLocaleString('en-IN')} {o.type}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{o.qty}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      ₹{o.price.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                      {fmtMoney(o.qty * o.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Simulated paper trading only — no real exchange orders are placed. Current {symbol} lot size: {lotSize}.
      </p>

      {editingRiskPos && (
        <EditOptionRiskModal
          position={editingRiskPos}
          liveLtp={ltpOf(editingRiskPos)}
          onClose={() => setEditingRiskPos(null)}
          onSaved={(msg) => setNotice(msg)}
        />
      )}
    </div>
  );
};
