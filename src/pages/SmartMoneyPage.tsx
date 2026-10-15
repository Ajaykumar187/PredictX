import React, { useEffect, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { AnalysisResult } from '../types';
import { FiiDiiRow, HoldersResponse, fetchFiiDii, fetchHolders } from '../utils/stockApi';
import { userKey } from '../utils/storage';

interface Props {
  data?: AnalysisResult | null;
}

const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5';
const SNAP_BASE = 'predictx_fiidii_snapshots';

type Snap = Record<string, { fii?: FiiDiiRow; dii?: FiiDiiRow }>;

const readSnaps = (): Snap => {
  try { return JSON.parse(localStorage.getItem(userKey(SNAP_BASE)) || '{}'); } catch { return {}; }
};
const writeSnaps = (s: Snap) => {
  try {
    const keys = Object.keys(s).slice(-30);
    const trimmed: Snap = {};
    keys.forEach((k) => (trimmed[k] = s[k]));
    localStorage.setItem(userKey(SNAP_BASE), JSON.stringify(trimmed));
  } catch { /* ignore */ }
};

const cr = (v: number) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
const netCls = (v: number) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(2)}%`);

export const SmartMoneyPage: React.FC<Props> = ({ data }) => {
  const [fii, setFii] = useState<{ loading: boolean; error?: string; snaps: Snap }>({ loading: true, snaps: readSnaps() });
  const [holders, setHolders] = useState<{ loading: boolean; res?: HoldersResponse }>({ loading: false });

  useEffect(() => {
    let alive = true;
    fetchFiiDii().then((r) => {
      if (!alive) return;
      if (!r.success || !r.rows.length) {
        setFii((p) => ({ ...p, loading: false, error: r.error || 'Data nahi mila' }));
        return;
      }
      const snaps = readSnaps();
      r.rows.forEach((row) => {
        const d = row.date;
        snaps[d] = snaps[d] || {};
        if (/FII|FPI/i.test(row.category)) snaps[d].fii = row;
        else if (/DII/i.test(row.category)) snaps[d].dii = row;
      });
      writeSnaps(snaps);
      setFii({ loading: false, snaps });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    setHolders({ loading: true });
    fetchHolders(data.displaySymbol, data.market).then((res) => alive && setHolders({ loading: false, res }));
    return () => { alive = false; };
  }, [data?.displaySymbol, data?.market]);

  const days = Object.entries(fii.snaps).reverse();
  const h = holders.res;

  return (
    <div className="space-y-6">
      <div className={card}>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Landmark className="w-5 h-5 text-blue-600" /> Smart Money
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Badi institutions kharid rahi hain ya bech rahi hain, aur stock mein kis ka kitna hissa hai.
        </p>
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">FII / DII — cash market (NSE)</h3>
        {fii.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {!fii.loading && days.length === 0 && (
          <p className="text-sm text-slate-500">FII/DII data abhi load nahi hua{fii.error ? ` (${fii.error})` : ''}. NSE kabhi-kabhi server requests block karta hai — thodi der baad try karein.</p>
        )}
        {days.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <th className="py-2">Tareekh</th>
                    <th>FII/FPI net</th>
                    <th>DII net</th>
                    <th>Dono ka net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                  {days.map(([date, v]) => {
                    const f = v.fii?.netValue;
                    const d = v.dii?.netValue;
                    const both = (f ?? 0) + (d ?? 0);
                    return (
                      <tr key={date}>
                        <td className="py-2">{date}</td>
                        <td className={f !== undefined ? `font-bold ${netCls(f)}` : ''}>{f !== undefined ? cr(f) : '—'}</td>
                        <td className={d !== undefined ? `font-bold ${netCls(d)}` : ''}>{d !== undefined ? cr(d) : '—'}</td>
                        <td className={`font-bold ${netCls(both)}`}>{cr(both)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              NSE sirf ek din ka data deta hai. Jab bhi aap yeh page kholte hain, din ka data aapke browser mein save ho jata hai, isliye history waqt ke saath badhti hai (max 30 din). Positive net = kharidari.
            </p>
          </>
        )}
      </div>

      <div className={`${card} space-y-4`}>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
          {data ? `${data.displaySymbol} — kiske paas kitna hissa` : 'Stock ki holding'}
        </h3>
        {!data && <p className="text-sm text-slate-500">Pehle sidebar se koi stock search karein.</p>}
        {holders.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {h && !h.success && (
          <p className="text-sm text-slate-500">Is stock ka holder data nahi mil paya{h.error ? ` (${h.error})` : ''}. Chhote ya naye stocks ka data Yahoo par aksar nahi hota.</p>
        )}
        {h && h.success && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Insiders / Promoters', pct(h.insidersPct)],
                ['Institutions', pct(h.institutionsPct)],
                ['Next earnings', h.nextEarnings || '—'],
                ['Ex-dividend', h.exDividendDate || '—'],
              ].map(([l, v]) => (
                <div key={l} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{v}</div>
                </div>
              ))}
            </div>

            {h.topInstitutions && h.topInstitutions.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Top institutional holders</h4>
                <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {h.topInstitutions.map((o, i) => (
                    <li key={i} className="py-1.5 flex justify-between gap-3 text-slate-700 dark:text-slate-300">
                      <span className="truncate">{o.name}</span>
                      <span className="font-semibold">{pct(o.pct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {h.insiderTransactions && h.insiderTransactions.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Insider transactions</h4>
                <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {h.insiderTransactions.map((t, i) => (
                    <li key={i} className="py-1.5 text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">{t.name}</span> ({t.relation}) — {t.text || 'transaction'}
                      {t.shares ? `, ${t.shares.toLocaleString('en-IN')} shares` : ''} <span className="text-xs text-slate-500">{t.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Source: {h.source}. Promoter pledge (girvi) ka data yahan nahi hai — uske liye company ka latest shareholding pattern NSE/BSE par dekhein.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SmartMoneyPage;
