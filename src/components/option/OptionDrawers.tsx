import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, X, Trash2, RefreshCw } from 'lucide-react';
import type { OptionChainRow } from '../../utils/greeks';
import { storage } from '../../utils/storage';
import type { WatchlistItem, MarketType } from '../../types';
import { fetchBatchQuotes, fetchDepth, BatchQuote, DepthResponse } from '../../utils/stockApi';
import {
  getOrders, clearOrders, subscribeOrders, derivePositions, placeOrders, PaperOrder,
} from '../../utils/paperTrades';

const INDEX_NAMES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTY 50', 'BANK NIFTY', 'FIN NIFTY', 'SENSEX'];
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pnlCls = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');

export const PanelShell: React.FC<{ title: string; onClose: () => void; right?: React.ReactNode; children: React.ReactNode }> = ({ title, onClose, right, children }) => (
  <div className="h-full flex flex-col bg-white dark:bg-slate-900">
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">{title}</h4>
      <div className="flex items-center gap-2">
        {right}
        <button onClick={onClose} aria-label="Close panel" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
);

export const WatchlistPanel: React.FC<{
  currentSymbol: string;
  onClose: () => void;
  onPick?: (symbol: string) => void;
}> = ({ currentSymbol, onClose, onPick }) => {
  const [list, setList] = useState<WatchlistItem[]>(() => storage.getWatchlist());
  const [quotes, setQuotes] = useState<Record<string, BatchQuote>>({});

  const load = useCallback(async () => {
    const q = await fetchBatchQuotes(list.map((w) => ({ symbol: w.symbol, market: w.market })));
    const m: Record<string, BatchQuote> = {};
    q.forEach((x) => (m[`${x.symbol}|${x.market}`] = x));
    setQuotes(m);
  }, [list]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const h = () => setList(storage.getWatchlist());
    window.addEventListener('predictx_watchlist_updated', h);
    return () => window.removeEventListener('predictx_watchlist_updated', h);
  }, []);

  const persist = (next: WatchlistItem[]) => {
    setList(next);
    storage.saveWatchlist(next);
    window.dispatchEvent(new Event('predictx_watchlist_updated'));
  };
  const curMarket: MarketType = INDEX_NAMES.includes(currentSymbol.toUpperCase()) ? 'INDEX' : 'NSE';
  const has = list.some((w) => w.symbol.toUpperCase() === currentSymbol.toUpperCase());

  return (
    <PanelShell title="Watchlist" onClose={onClose}
      right={<button onClick={load} title="Refresh" className="text-slate-400 hover:text-blue-600"><RefreshCw className="w-3.5 h-3.5" /></button>}>
      <div className="p-3">
        <button
          disabled={has}
          onClick={() => persist([...list, { symbol: currentSymbol, market: curMarket }])}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-blue-600 text-white disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800"
        >
          <Plus className="w-3.5 h-3.5" /> {has ? `${currentSymbol} already added` : `Add ${currentSymbol}`}
        </button>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((w) => {
          const q = quotes[`${w.symbol}|${w.market}`];
          return (
            <li key={`${w.symbol}|${w.market}`} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
              <button onClick={() => onPick?.(w.symbol)} className="text-left min-w-0">
                <div className="font-black text-slate-900 dark:text-white truncate">{w.symbol}</div>
                <div className="text-[10px] text-slate-400">{w.market}</div>
              </button>
              <div className="text-right font-mono">
                <div className="font-bold text-slate-900 dark:text-white">{q ? fmt(q.price) : '—'}</div>
                <div className={`text-[10px] ${pnlCls(q?.changePct ?? 0)}`}>{q ? `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%)` : ''}</div>
              </div>
              <button onClick={() => persist(list.filter((x) => x !== w))} aria-label={`Remove ${w.symbol}`} className="text-slate-300 hover:text-rose-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-6 text-center text-xs text-slate-400">Watchlist khaali hai.</li>}
      </ul>
    </PanelShell>
  );
};

function useOrders() {
  const [orders, setOrders] = useState<PaperOrder[]>(() => getOrders());
  useEffect(() => subscribeOrders(() => setOrders(getOrders())), []);
  return orders;
}

export const PositionsPanel: React.FC<{
  symbol: string; expiry: string; chain: OptionChainRow[]; lotSize: number; isLiveFeed: boolean; onClose: () => void;
}> = ({ symbol, expiry, chain, lotSize, isLiveFeed, onClose }) => {
  const orders = useOrders();
  const positions = useMemo(() => derivePositions(orders), [orders]);

  const ltpOf = (p: { underlying: string; expiry: string; strike: number; type: 'CE' | 'PE' }) => {
    if (!isLiveFeed || p.underlying !== symbol || p.expiry !== expiry) return null;
    const row = chain.find((r) => r.strike === p.strike);
    return row ? (p.type === 'CE' ? row.callLTP : row.putLTP) : null;
  };

  const open = positions.filter((p) => p.qty !== 0);
  const closed = positions.filter((p) => p.qty === 0 && p.realized !== 0);
  let unreal = 0;
  let real = positions.reduce((s, p) => s + p.realized, 0);
  open.forEach((p) => {
    const l = ltpOf(p);
    if (l !== null) unreal += (l - p.avg) * p.qty;
  });

  return (
    <PanelShell title="Positions (Paper)" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 p-3 text-xs">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">Unrealised</div><div className={`font-mono font-black ${pnlCls(unreal)}`}>₹{fmt(unreal)}</div></div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">Realised</div><div className={`font-mono font-black ${pnlCls(real)}`}>₹{fmt(real)}</div></div>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {open.map((p) => {
          const l = ltpOf(p);
          const pnl = l !== null ? (l - p.avg) * p.qty : null;
          return (
            <li key={p.key} className="px-3 py-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 dark:text-white">{p.underlying} {p.strike} {p.type}</span>
                <span className={`font-bold ${p.qty > 0 ? 'text-blue-600' : 'text-rose-600'}`}>{p.qty > 0 ? 'LONG' : 'SHORT'} {Math.abs(p.qty)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Avg ₹{fmt(p.avg)} · LTP {l !== null ? `₹${fmt(l)}` : '—'}</span>
                <span className={pnl !== null ? pnlCls(pnl) : ''}>{pnl !== null ? `₹${fmt(pnl)}` : ''}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Exp {p.expiry}</span>
                {l !== null && (
                  <button
                    onClick={() => placeOrders([{ underlying: p.underlying, expiry: p.expiry, strike: p.strike, type: p.type, action: p.qty > 0 ? 'SELL' : 'BUY', qty: Math.abs(p.qty), price: l }])}
                    className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-700 text-white font-bold"
                  >Square off</button>
                )}
              </div>
            </li>
          );
        })}
        {open.length === 0 && <li className="p-6 text-center text-xs text-slate-400">Koi open position nahi. Basket mode me B/S dabao ya Create Strategy se paper trade lagao.</li>}
      </ul>
      {closed.length > 0 && <div className="px-3 py-2 text-[10px] text-slate-400">{closed.length} closed position(s) — realised P&L upar total me jud chuka hai.</div>}
      <div className="px-3 pb-3 text-[10px] text-slate-400">Paper trading only — koi real order broker ko nahi jaata. lot size: {lotSize}</div>
    </PanelShell>
  );
};

export const OrdersPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const orders = useOrders();
  return (
    <PanelShell title="Orders (Paper)" onClose={onClose}
      right={orders.length > 0 ? <button onClick={clearOrders} className="text-[10px] font-bold text-rose-500">Clear</button> : undefined}>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {[...orders].reverse().map((o) => (
          <li key={o.id} className="px-3 py-2.5 text-xs flex items-center justify-between gap-2">
            <div>
              <div className="font-black text-slate-900 dark:text-white">
                <span className={o.action === 'BUY' ? 'text-blue-600' : 'text-rose-600'}>{o.action}</span> {o.underlying} {o.strike} {o.type}
              </div>
              <div className="text-[10px] text-slate-400">{new Date(o.time).toLocaleString('en-IN')} · Exp {o.expiry}</div>
            </div>
            <div className="text-right font-mono">
              <div className="font-bold">₹{fmt(o.price)}</div>
              <div className="text-[10px] text-slate-400">Qty {o.qty}</div>
            </div>
          </li>
        ))}
        {orders.length === 0 && <li className="p-6 text-center text-xs text-slate-400">Abhi koi order nahi.</li>}
      </ul>
    </PanelShell>
  );
};

export const DepthPanel: React.FC<{
  chain: OptionChainRow[]; atmStrike: number; isLiveFeed: boolean; target: { strike: number; side: 'CE' | 'PE' } | null;
  onClose: () => void;
}> = ({ chain, atmStrike, isLiveFeed, target, onClose }) => {
  const [strike, setStrike] = useState<number>(target?.strike ?? atmStrike);
  const [side, setSide] = useState<'CE' | 'PE'>(target?.side ?? 'CE');
  const [d, setD] = useState<DepthResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) { setStrike(target.strike); setSide(target.side); }
  }, [target]);

  const row = chain.find((r) => r.strike === strike);
  const token = side === 'CE' ? row?.callToken : row?.putToken;

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setD(await fetchDepth('NFO', token));
    setBusy(false);
  }, [token]);

  useEffect(() => {
    setD(null);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const levels = Array.from({ length: 5 }, (_, i) => ({ b: d?.buy?.[i], s: d?.sell?.[i] }));
  const maxQty = Math.max(1, ...(d?.buy || []).map((x) => x.quantity), ...(d?.sell || []).map((x) => x.quantity));

  return (
    <PanelShell title="Market Depth" onClose={onClose}
      right={<button onClick={load} title="Refresh" className="text-slate-400 hover:text-blue-600"><RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /></button>}>
      <div className="p-3 flex gap-2">
        <select value={strike} onChange={(e) => setStrike(Number(e.target.value))} className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5">
          {chain.map((r) => <option key={r.strike} value={r.strike}>{r.strike}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {(['CE', 'PE'] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`px-3 py-1.5 ${side === s ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>{s}</button>
          ))}
        </div>
      </div>

      {!isLiveFeed || !token ? (
        <div className="p-6 text-center text-xs text-slate-400">Market depth ke liye live Angel One feed chahiye (abhi estimated data dikh raha hai).</div>
      ) : d && !d.success ? (
        <div className="p-4 text-xs text-amber-700 dark:text-amber-300">{d.error || 'Depth load nahi hua'}</div>
      ) : !d ? (
        <div className="p-6 text-center text-xs text-slate-400">Loading depth…</div>
      ) : (
        <div className="px-3 pb-4 space-y-3 text-xs">
          <div className="flex justify-between font-mono">
            <span className="font-black text-slate-900 dark:text-white">{d.tradingSymbol || `${strike} ${side}`}</span>
            <span className="font-bold">₹{fmt(d.ltp)}</span>
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead className="text-[10px] text-slate-400 uppercase">
              <tr><th className="text-left">Bid Qty</th><th className="text-right">Bid</th><th className="text-left pl-3">Ask</th><th className="text-right">Ask Qty</th></tr>
            </thead>
            <tbody>
              {levels.map((l, i) => (
                <tr key={i}>
                  <td className="py-1 relative"><span className="absolute inset-y-0.5 left-0 bg-emerald-500/15" style={{ width: `${((l.b?.quantity || 0) / maxQty) * 100}%` }} /><span className="relative">{l.b ? l.b.quantity.toLocaleString('en-IN') : '—'}</span></td>
                  <td className="text-right text-emerald-600 dark:text-emerald-400 font-bold">{l.b ? fmt(l.b.price) : '—'}</td>
                  <td className="pl-3 text-rose-600 dark:text-rose-400 font-bold">{l.s ? fmt(l.s.price) : '—'}</td>
                  <td className="py-1 relative text-right"><span className="absolute inset-y-0.5 right-0 bg-rose-500/15" style={{ width: `${((l.s?.quantity || 0) / maxQty) * 100}%` }} /><span className="relative">{l.s ? l.s.quantity.toLocaleString('en-IN') : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-emerald-500/10 p-2"><div className="text-[10px] text-slate-400">Total Buy Qty</div><b className="font-mono">{d.totBuyQuan.toLocaleString('en-IN')}</b></div>
            <div className="rounded-lg bg-rose-500/10 p-2"><div className="text-[10px] text-slate-400">Total Sell Qty</div><b className="font-mono">{d.totSellQuan.toLocaleString('en-IN')}</b></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">OI</div><b className="font-mono">{d.oi.toLocaleString('en-IN')}</b></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">Volume</div><b className="font-mono">{d.volume.toLocaleString('en-IN')}</b></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">Day Low / High</div><b className="font-mono">{fmt(d.low)} / {fmt(d.high)}</b></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2"><div className="text-[10px] text-slate-400">Circuit</div><b className="font-mono">{fmt(d.lowerCircuit)} – {fmt(d.upperCircuit)}</b></div>
          </div>
        </div>
      )}
    </PanelShell>
  );
};
