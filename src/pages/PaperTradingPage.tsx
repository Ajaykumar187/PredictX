import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, RotateCcw } from 'lucide-react';
import { AnalysisResult, MarketType, PaperAccount } from '../types';
import { storage } from '../utils/storage';
import { fetchBatchQuotes, fetchLeaderboard, submitLeaderboard, LeaderRow } from '../utils/stockApi';

interface Props {
  data?: AnalysisResult | null;
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const cls = (v: number) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');

export const PaperTradingPage: React.FC<Props> = ({ data, onSelectStock }) => {
  const [acc, setAcc] = useState<PaperAccount>(() => storage.getPaperAccount());
  const [qty, setQty] = useState(10);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});

  const persist = (next: PaperAccount) => {
    setAcc(next);
    storage.savePaperAccount(next);
  };

  const positionKeys = Object.keys(acc.positions);
  useEffect(() => {
    if (!positionKeys.length) return;
    let alive = true;
    fetchBatchQuotes(positionKeys.map((s) => ({ symbol: s, market: acc.positions[s].market }))).then((qs) => {
      if (!alive) return;
      const m: Record<string, number> = {};
      qs.forEach((q) => { if (q.price > 0) m[q.symbol.toUpperCase()] = q.price; });
      setPrices(m);
    });
    return () => { alive = false; };
  }, [positionKeys.join(',')]);

  const [board, setBoard] = useState<{ loaded: boolean; configured: boolean; rows: LeaderRow[] }>({ loaded: false, configured: true, rows: [] });
  const [boardMsg, setBoardMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const user = storage.getUser();
  const loadBoard = () => fetchLeaderboard().then((r) => setBoard({ loaded: true, configured: r.configured, rows: r.rows || [] }));
  useEffect(() => { loadBoard(); }, []);

  const priceOf = (sym: string) => {
    if (data && data.displaySymbol === sym) return data.latestPrice;
    return prices[sym.toUpperCase()] ?? null;
  };

  const summary = useMemo(() => {
    let holdingsValue = 0;
    let unknown = false;
    positionKeys.forEach((s) => {
      const p = acc.positions[s];
      const px = priceOf(s);
      if (px === null) { unknown = true; holdingsValue += p.quantity * p.avgPrice; }
      else holdingsValue += p.quantity * px;
    });
    const total = acc.cash + holdingsValue;
    return { holdingsValue, total, pnl: total - acc.initialCash, unknown };
  }, [acc, prices, data]);

  const trade = (type: 'BUY' | 'SELL') => {
    if (!data) return;
    const q = Math.floor(qty);
    if (!(q > 0)) return setMsg({ ok: false, text: 'Quantity 1 ya usse zyada honi chahiye.' });
    const sym = data.displaySymbol;
    const px = data.latestPrice;
    const total = q * px;
    const pos = acc.positions[sym];

    if (type === 'BUY') {
      if (total > acc.cash) return setMsg({ ok: false, text: 'Virtual cash kam hai.' });
      const newQty = (pos?.quantity || 0) + q;
      const newAvg = ((pos?.quantity || 0) * (pos?.avgPrice || 0) + total) / newQty;
      persist({
        ...acc,
        cash: acc.cash - total,
        positions: { ...acc.positions, [sym]: { quantity: newQty, avgPrice: newAvg, market: data.market } },
        history: [{ id: `tx-${Date.now()}`, date: new Date().toISOString().slice(0, 10), type, symbol: sym, shares: q, price: px, total }, ...acc.history],
      });
    } else {
      if (!pos || pos.quantity < q) return setMsg({ ok: false, text: `${sym} ke itne shares aapke paas nahi hain.` });
      const positions = { ...acc.positions };
      if (pos.quantity === q) delete positions[sym];
      else positions[sym] = { ...pos, quantity: pos.quantity - q };
      persist({
        ...acc,
        cash: acc.cash + total,
        positions,
        history: [{ id: `tx-${Date.now()}`, date: new Date().toISOString().slice(0, 10), type, symbol: sym, shares: q, price: px, total }, ...acc.history],
      });
    }
    setMsg({ ok: true, text: `${type === 'BUY' ? 'Bought' : 'Sold'} ${q} ${sym} @ ${data.currencyFmt(px)}` });
  };

  const reset = () => {
    if (!confirm('Paper account reset karke ₹10,00,000 se dobara shuru karein?')) return;
    persist({ cash: 1000000, initialCash: 1000000, positions: {}, history: [] });
    setMsg({ ok: true, text: 'Account reset ho gaya.' });
  };

  return (
    <div className="space-y-6">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" /> Paper Trading
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Nakli paise (₹10 lakh) se asli prices par practice. Brokerage aur taxes shamil nahi hain.</p>
        </div>
        <button onClick={reset} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total value', inr(summary.total), ''],
          ['Cash', inr(acc.cash), ''],
          ['Holdings', inr(summary.holdingsValue), summary.unknown ? 'kuch ka live price nahi mila, cost par' : ''],
        ].map(([l, v, n]) => (
          <div key={l} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{v}</div>
            {n && <div className="text-[10px] text-slate-500">{n}</div>}
          </div>
        ))}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kul profit / loss</div>
          <div className={`text-xl font-black mt-0.5 ${cls(summary.pnl)}`}>
            {summary.pnl >= 0 ? '+' : '-'}{inr(Math.abs(summary.pnl))}
          </div>
          <div className={`text-[11px] ${cls(summary.pnl)}`}>{((summary.pnl / acc.initialCash) * 100).toFixed(2)}%</div>
        </div>
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Order</h3>
        {!data ? (
          <p className="text-sm text-slate-500">Trade karne ke liye pehle sidebar se koi stock search karein.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400">Stock</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{data.displaySymbol} @ {data.currencyFmt(data.latestPrice)}</div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block">Quantity</label>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))}
                className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm font-bold" />
            </div>
            <div className="text-xs text-slate-500 pb-2">Value: {data.currencyFmt(Math.max(0, qty) * data.latestPrice)}</div>
            <button onClick={() => trade('BUY')} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">Buy</button>
            <button onClick={() => trade('SELL')} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold">Sell</button>
          </div>
        )}
        {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Positions</h3>
        {positionKeys.length === 0 ? (
          <p className="text-sm text-slate-500">Abhi koi position nahi hai.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                  <th className="py-2">Stock</th><th>Qty</th><th>Avg</th><th>Abhi</th><th>P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                {positionKeys.map((s) => {
                  const p = acc.positions[s];
                  const px = priceOf(s);
                  const pnl = px === null ? null : (px - p.avgPrice) * p.quantity;
                  return (
                    <tr key={s}>
                      <td className="py-2"><button className="font-bold hover:underline" onClick={() => onSelectStock?.(s, p.market)}>{s}</button></td>
                      <td>{p.quantity}</td>
                      <td>{p.avgPrice.toFixed(2)}</td>
                      <td>{px === null ? '—' : px.toFixed(2)}</td>
                      <td className={pnl === null ? '' : `font-bold ${cls(pnl)}`}>{pnl === null ? '—' : `${pnl >= 0 ? '+' : '-'}${inr(Math.abs(pnl))}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Leaderboard (return %)</h3>
          {board.configured && (
            <button
              onClick={async () => {
                if (!user.email) return setBoardMsg({ ok: false, text: 'Pehle Account page par register karein (username + email).' });
                const r = await submitLeaderboard(user.username, user.email, summary.total);
                setBoardMsg(r.ok ? { ok: true, text: `Score submit ho gaya. Aapki rank: #${r.rank}` } : { ok: false, text: r.error || 'Submit nahi hua' });
                if (r.ok) loadBoard();
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Mera score submit karein
            </button>
          )}
        </div>
        {boardMsg && <p className={`text-xs ${boardMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{boardMsg.text}</p>}
        {board.loaded && !board.configured && (
          <p className="text-sm text-slate-500">Leaderboard abhi chalu nahi hai (server par Supabase set nahi hai).</p>
        )}
        {board.configured && board.rows.length === 0 && board.loaded && <p className="text-sm text-slate-500">Abhi kisi ne score submit nahi kiya.</p>}
        {board.rows.length > 0 && (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
              {board.rows.map((r, i) => (
                <tr key={r.username}>
                  <td className="py-1.5 w-10 text-slate-400">#{i + 1}</td>
                  <td className="font-semibold">{r.username}</td>
                  <td className="text-right">{inr(r.total_value)}</td>
                  <td className={`text-right font-bold ${cls(r.return_pct)}`}>{r.return_pct >= 0 ? '+' : ''}{Number(r.return_pct).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-slate-400">Score aap khud submit karte hain, isliye yeh sirf dosti ka khel hai, verified ranking nahi. Sirf username dikhta hai, email nahi.</p>
      </div>

      {acc.history.length > 0 && (
        <div className={`${card} space-y-3`}>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">History</h3>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                {acc.history.slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 text-slate-500">{t.date}</td>
                    <td className={t.type === 'BUY' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{t.type}</td>
                    <td>{t.symbol}</td>
                    <td>{t.shares} @ {t.price.toFixed(2)}</td>
                    <td className="text-right">{inr(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTradingPage;
