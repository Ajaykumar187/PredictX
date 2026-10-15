import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Loader2, Trash2 } from 'lucide-react';
import { AnalysisResult, MarketType } from '../types';
import {
  LoggedPrediction,
  clearPredictionLog,
  getPredictionLog,
  liveStats,
  resolveDuePredictions,
  walkForwardBacktest,
} from '../utils/accuracy';

interface TrackRecordPageProps {
  currentAnalysis?: AnalysisResult | null;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
}

const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';
const fmtPct = (v: number | null, d = 1) => (v === null ? '—' : `${v.toFixed(d)}%`);

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{note}</div>}
  </div>
);

export const TrackRecordPage: React.FC<TrackRecordPageProps> = ({ currentAnalysis, onSelectStock }) => {
  const [log, setLog] = useState<LoggedPrediction[]>(() => getPredictionLog());
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let alive = true;
    setResolving(true);
    resolveDuePredictions()
      .then((changed) => {
        if (alive && changed) setLog(getPredictionLog());
      })
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => liveStats(log), [log]);
  const bt = useMemo(() => (currentAnalysis ? walkForwardBacktest(currentAnalysis, 7) : null), [currentAnalysis]);

  const exportCsv = () => {
    const head = ['Symbol', 'Market', 'Date', 'Signal', 'Price', 'Target7d', 'Low', 'High', 'Actual', 'Direction', 'ErrorPct', 'InRange'];
    const rows = log.map((p) => [
      p.symbol, p.market, p.date, p.signal, p.price, p.target, p.lo, p.hi,
      p.result?.actual ?? '', p.result?.directionCorrect ?? '', p.result ? p.result.errorPct.toFixed(2) : '', p.result?.inBand ?? '',
    ]);
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'predictx-prediction-log.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className={`${card} p-5`}>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" /> Model kitna sahi hai?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Yahan sirf asli numbers hain: ek purani data par test, aur doosra aapki apni saved predictions jo 7 din baad asli price se match hoti hain.
        </p>
      </div>

      {/* A. Instant walk-forward test */}
      <div className={`${card} p-5 space-y-4`}>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Pichhla test{currentAnalysis ? `: ${currentAnalysis.displaySymbol}` : ''}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Har purani tareekh par sirf utna data liya jo tab tak available tha, model chalaya, aur 7 din baad ki asli price se compare kiya.
          </p>
        </div>

        {!currentAnalysis && <p className="text-sm text-slate-500">Test dekhne ke liye pehle koi stock search karein.</p>}

        {bt && bt.samples.length < 8 && (
          <p className="text-sm text-slate-500">Is stock ka itna history nahi hai ki test ho sake.</p>
        )}

        {bt && bt.samples.length >= 8 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                label="Direction sahi"
                value={fmtPct(bt.directional.pct, 0)}
                note={`${bt.directional.correct} / ${bt.directional.calls} BUY/SELL calls (${bt.holdCount} HOLD ginte nahi)`}
              />
              <Stat
                label="Sirf 'upar' bolne par"
                value={fmtPct(bt.baselineUpPct, 0)}
                note="Compare ke liye: is dauran price itni baar 7 din mein upar gaya"
              />
              <Stat
                label="Target ka average error"
                value={fmtPct(bt.mapePct, 2)}
                note={`Compare ke liye: "price wahi rahegi" guess ka error ${fmtPct(bt.baselineMapePct, 2)}`}
              />
              <Stat label="80% range mein" value={fmtPct(bt.bandHitPct, 0)} note="Asli price range ke andar rahi (80% ke aas-paas achha)" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bt.samples.length} test points, {bt.samples[0].date} se {bt.samples[bt.samples.length - 1].date} tak. Past performance future ki guarantee nahi hai.
              {bt.directional.pct !== null && bt.baselineUpPct !== null && (
                <>
                  {' '}
                  {bt.mapePct !== null && bt.baselineMapePct !== null && bt.mapePct > bt.baselineMapePct
                    ? 'Target ka error "price wahi rahegi" guess se zyada hai — target ko andaza hi samjhein. '
                    : ''}
                  {bt.directional.pct > 50 && bt.directional.pct >= Math.max(bt.baselineUpPct, 100 - bt.baselineUpPct) + 3
                    ? 'Model simple "sirf upar/neeche" guess se behtar raha.'
                    : 'Model simple "sirf upar/neeche" guess se khaas behtar nahi raha — signal par akele bharosa mat karein.'}
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* B. Live log */}
      <div className={`${card} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Aapki saved predictions {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jab bhi aap koi stock kholte hain, uski prediction apne aap save hoti hai (ek stock, ek din mein ek baar) aur 7 trading din baad score hoti hai.
            </p>
          </div>
          {log.length > 0 && (
            <div className="flex gap-2">
              <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => {
                  if (confirm('Saari saved predictions delete karein?')) {
                    clearPredictionLog();
                    setLog([]);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-rose-600 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          )}
        </div>

        {log.length === 0 ? (
          <p className="text-sm text-slate-500">Abhi koi prediction save nahi hui. Koi stock search karein, yahan apne aap aa jayegi.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Total / scored" value={`${stats.total} / ${stats.resolved}`} note={`${stats.pending} abhi 7 din pure hone ka intezaar`} />
              <Stat
                label="Direction sahi"
                value={stats.directionalCalls >= 5 ? fmtPct(stats.directionalPct, 0) : '—'}
                note={stats.directionalCalls >= 5 ? `${stats.directionalCorrect} / ${stats.directionalCalls} calls` : `Kam se kam 5 scored BUY/SELL calls chahiye (abhi ${stats.directionalCalls})`}
              />
              <Stat label="Target ka error" value={fmtPct(stats.mapePct, 1)} />
              <Stat label="Range ke andar" value={fmtPct(stats.bandHitPct, 0)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <th className="py-2">Stock</th>
                    <th>Tareekh</th>
                    <th>Signal</th>
                    <th>Tab price</th>
                    <th>Target (range)</th>
                    <th>Asli (7 din baad)</th>
                    <th>Natija</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                  {log.slice(0, 100).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">
                        <button
                          onClick={() => onSelectStock?.(p.symbol, p.market)}
                          className="font-bold hover:underline"
                        >
                          {p.symbol}
                        </button>
                      </td>
                      <td>{p.date}</td>
                      <td>{p.signal}</td>
                      <td>{p.currencySymbol}{p.price.toFixed(2)}</td>
                      <td>
                        {p.currencySymbol}{p.target.toFixed(2)}
                        <span className="text-xs text-slate-500"> ({p.lo.toFixed(0)}–{p.hi.toFixed(0)})</span>
                      </td>
                      <td>{p.result ? `${p.currencySymbol}${p.result.actual.toFixed(2)}` : '—'}</td>
                      <td>
                        {!p.result ? (
                          <span className="text-slate-400 text-xs">Intezaar</span>
                        ) : p.result.directionCorrect === null ? (
                          <span className="text-slate-500 text-xs">HOLD</span>
                        ) : p.result.directionCorrect ? (
                          <span className="text-emerald-600 font-bold text-xs">Sahi</span>
                        ) : (
                          <span className="text-rose-600 font-bold text-xs">Galat</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrackRecordPage;
