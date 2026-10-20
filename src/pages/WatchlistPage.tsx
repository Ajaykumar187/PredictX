import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, Plus, Trash2, RefreshCw, Search, Download, Pause, Play, FolderPlus, X } from 'lucide-react';
import type { MarketType, WatchlistItem } from '../types';
import { storage, userKey } from '../utils/storage';
import { fetchBatchQuotes, searchStocksApi, BatchQuote } from '../utils/stockApi';
import type { StockSearchResult } from '../utils/marketData';

interface Props {
  onSelectStock: (symbol: string, market: MarketType) => void;
}

interface NamedList { id: string; name: string; items: WatchlistItem[] }
const EXTRA_BASE = 'predictx_watchlists_extra';
const DEFAULT_ID = 'default';

function loadLists(): NamedList[] {
  let extra: NamedList[] = [];
  try {
    extra = JSON.parse(localStorage.getItem(userKey(EXTRA_BASE)) || '[]');
  } catch {}
  return [{ id: DEFAULT_ID, name: 'My Watchlist', items: storage.getWatchlist() }, ...extra];
}
function saveLists(lists: NamedList[]) {
  const def = lists.find((l) => l.id === DEFAULT_ID);
  if (def) {
    storage.saveWatchlist(def.items);
    window.dispatchEvent(new Event('predictx_watchlist_updated'));
  }
  try {
    localStorage.setItem(userKey(EXTRA_BASE), JSON.stringify(lists.filter((l) => l.id !== DEFAULT_ID)));
  } catch {  }
}

type SortKey = 'symbol' | 'price' | 'changePct' | 'volume';
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cur = (m: string) => (m === 'US' ? '$' : '₹');
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');
const vol = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : n ? n.toLocaleString('en-IN') : '—');

export const WatchlistPage: React.FC<Props> = ({ onSelectStock }) => {
  const [lists, setLists] = useState<NamedList[]>(() => loadLists());
  const [activeId, setActiveId] = useState(DEFAULT_ID);
  const [quotes, setQuotes] = useState<Record<string, BatchQuote>>({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState('');
  const [auto, setAuto] = useState(true);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'symbol', dir: 1 });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const timer = useRef<any>(null);

  const active = lists.find((l) => l.id === activeId) || lists[0];
  const key = (w: WatchlistItem) => `${w.symbol}|${w.market}`;

  const update = (next: NamedList[]) => {
    setLists(next);
    saveLists(next);
  };

  const refresh = useCallback(async () => {
    const items = active.items;
    if (!items.length) { setQuotes({}); return; }
    setLoading(true);
    const q = await fetchBatchQuotes(items.map((w) => ({ symbol: w.symbol, market: w.market })));
    const m: Record<string, BatchQuote> = {};
    q.forEach((x) => (m[`${x.symbol}|${x.market}`] = x));
    setQuotes(m);
    setUpdated(new Date().toLocaleTimeString('en-IN'));
    setLoading(false);
  }, [active]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [auto, refresh]);

  useEffect(() => {
    const h = () => setLists((prev) => prev.map((l) => (l.id === DEFAULT_ID ? { ...l, items: storage.getWatchlist() } : l)));
    window.addEventListener('predictx_watchlist_updated', h);
    return () => window.removeEventListener('predictx_watchlist_updated', h);
  }, []);

  const onQuery = (v: string) => {
    setQuery(v);
    clearTimeout(timer.current);
    if (!v.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => setResults((await searchStocksApi(v)).slice(0, 8)), 250);
  };

  const add = (r: StockSearchResult) => {
    const item: WatchlistItem = { symbol: r.displaySymbol, market: r.market };
    if (active.items.some((w) => key(w) === key(item))) return;
    update(lists.map((l) => (l.id === active.id ? { ...l, items: [...l.items, item] } : l)));
    setQuery(''); setResults([]);
  };
  const remove = (w: WatchlistItem) => update(lists.map((l) => (l.id === active.id ? { ...l, items: l.items.filter((x) => x !== w) } : l)));

  const createList = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `wl_${Date.now()}`;
    update([...lists, { id, name, items: [] }]);
    setActiveId(id); setNewName(''); setShowNew(false);
  };
  const deleteList = () => {
    if (active.id === DEFAULT_ID) return;
    update(lists.filter((l) => l.id !== active.id));
    setActiveId(DEFAULT_ID);
  };

  const rows = useMemo(() => {
    const r = active.items.map((w) => ({ w, q: quotes[key(w)] }));
    return r.sort((a, b) => {
      let x = 0;
      if (sort.k === 'symbol') x = a.w.symbol.localeCompare(b.w.symbol);
      else x = (a.q?.[sort.k] ?? -Infinity) - (b.q?.[sort.k] ?? -Infinity);
      return (Number.isNaN(x) ? 0 : x) * sort.dir;
    });
  }, [active, quotes, sort]);

  const loaded = rows.filter((r) => r.q);
  const adv = loaded.filter((r) => r.q!.changePct > 0).length;
  const dec = loaded.filter((r) => r.q!.changePct < 0).length;
  const best = loaded.reduce<typeof loaded[0] | null>((b, r) => (!b || r.q!.changePct > b.q!.changePct ? r : b), null);
  const worst = loaded.reduce<typeof loaded[0] | null>((b, r) => (!b || r.q!.changePct < b.q!.changePct ? r : b), null);

  const exportCsv = () => {
    const lines = ['Symbol,Market,LTP,Change,Change %,Day Low,Day High,52W Low,52W High,Volume'];
    rows.forEach(({ w, q }) => lines.push([w.symbol, w.market, q?.price ?? '', q?.change ?? '', q?.changePct ?? '', q?.low ?? '', q?.high ?? '', q?.low52 ?? '', q?.high52 ?? '', q?.volume ?? ''].join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `${active.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const th = (k: SortKey, label: string, right = false) => (
    <th className={`py-2.5 px-3 cursor-pointer select-none ${right ? 'text-right' : 'text-left'}`}
      onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : k === 'symbol' ? 1 : -1 }))}>
      {label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600"><Star className="w-5 h-5" /></div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Watchlist</h2>
              <p className="text-xs text-slate-500">Live prices — Angel One + Yahoo{updated ? ` · updated ${updated}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAuto((a) => !a)} title={auto ? 'Auto refresh pause' : 'Auto refresh chalu'} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              {auto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={refresh} title="Refresh" className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button onClick={exportCsv} title="Export CSV" className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lists.map((l) => (
            <button key={l.id} onClick={() => setActiveId(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${l.id === active.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
              {l.name} <span className="opacity-70">({l.items.length})</span>
            </button>
          ))}
          {showNew ? (
            <span className="flex items-center gap-1">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createList()} placeholder="List name"
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 w-32" />
              <button onClick={createList} className="text-xs font-bold text-blue-600">Add</button>
              <button onClick={() => setShowNew(false)} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </span>
          ) : (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-600">
              <FolderPlus className="w-3.5 h-3.5" /> New list
            </button>
          )}
          {active.id !== DEFAULT_ID && (
            <button onClick={deleteList} className="ml-auto text-[11px] font-bold text-rose-500">Delete this list</button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Stock / index search karke add karein (e.g. SUZLON, NVDA)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
              {results.map((r) => (
                <li key={`${r.symbol}|${r.market}`}>
                  <button onClick={() => add(r)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">
                    <span><b className="text-slate-900 dark:text-white">{r.displaySymbol}</b> <span className="text-slate-400">{r.longName}</span></span>
                    <span className="flex items-center gap-1 text-blue-600 font-bold"><Plus className="w-3 h-3" />{r.market}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {loaded.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Advancing</div><div className="text-lg font-black text-emerald-600">{adv}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Declining</div><div className="text-lg font-black text-rose-600">{dec}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Top gainer</div><div className="font-black text-slate-900 dark:text-white">{best?.w.symbol}</div><div className="text-emerald-600 font-mono">{best && `${best.q!.changePct >= 0 ? '+' : ''}${best.q!.changePct.toFixed(2)}%`}</div></div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Top loser</div><div className="font-black text-slate-900 dark:text-white">{worst?.w.symbol}</div><div className="text-rose-600 font-mono">{worst && `${worst.q!.changePct.toFixed(2)}%`}</div></div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold">
            <tr>
              {th('symbol', 'Symbol')}
              {th('price', 'LTP', true)}
              <th className="py-2.5 px-3 text-right">Change</th>
              {th('changePct', 'Chg %', true)}
              <th className="py-2.5 px-3 hidden md:table-cell">Day Range</th>
              <th className="py-2.5 px-3 hidden lg:table-cell">52W Range</th>
              {th('volume', 'Volume', true)}
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ w, q }) => {
              const dayPos = q && q.high > q.low ? ((q.price - q.low) / (q.high - q.low)) * 100 : null;
              const yrPos = q && q.high52 > q.low52 ? ((q.price - q.low52) / (q.high52 - q.low52)) * 100 : null;
              return (
                <tr key={key(w)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3"><div className="font-black text-slate-900 dark:text-white">{w.symbol}</div><div className="text-[10px] text-slate-400">{w.market}</div></td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{q ? `${cur(w.market)}${fmt(q.price)}` : '—'}</td>
                  <td className={`py-2.5 px-3 text-right font-mono ${tone(q?.change ?? 0)}`}>{q ? `${q.change >= 0 ? '+' : ''}${fmt(q.change)}` : '—'}</td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${tone(q?.changePct ?? 0)}`}>{q ? `${q.changePct >= 0 ? '+' : ''}${fmt(q.changePct)}%` : '—'}</td>
                  <td className="py-2.5 px-3 hidden md:table-cell w-40">
                    {dayPos !== null ? (
                      <div title={`${fmt(q!.low)} – ${fmt(q!.high)}`} className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 relative"><span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600" style={{ left: `calc(${dayPos}% - 4px)` }} /></div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 hidden lg:table-cell w-40">
                    {yrPos !== null ? (
                      <div title={`${fmt(q!.low52)} – ${fmt(q!.high52)}`} className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 relative"><span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500" style={{ left: `calc(${yrPos}% - 4px)` }} /></div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">{q ? vol(q.volume) : '—'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => onSelectStock(w.symbol, w.market)} className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[11px] mr-2">Analyze</button>
                    <button onClick={() => remove(w)} aria-label={`Remove ${w.symbol}`} className="text-slate-300 hover:text-rose-500 align-middle"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">Ye list khaali hai — upar search karke stock add karein.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && loaded.length < rows.length && !loading && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">{rows.length - loaded.length} symbol ka live data nahi mila (Angel/Yahoo).</p>
      )}
    </div>
  );
};
