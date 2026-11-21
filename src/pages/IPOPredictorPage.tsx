import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { userKey } from '../utils/storage';
import { trainReport, type IPOSample } from '../utils/ipoModel';
import { calculateIPOScore, type IPORatingResult } from '../utils/ipoPredictor';
import { Rocket, CheckCircle2, RefreshCw, Trash2, Plus } from 'lucide-react';

interface LiveIPO {
  name: string;
  status: string;
  gmpRs: number | null;
  gmpPct: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  estListingPrice: number | null;
  issueSizeCr?: number | null;
  lotSize?: number | null;
  dates: string;
  subscriptionX: number | null;
  qibSubX?: number | null;
  niiSubX?: number | null;
  retailSubX?: number | null;
  sources: string[];
}

const TRAIN_BASE = 'predictx_ipo_training_v1';
const loadTrain = (): IPOSample[] => {
  try {
    return JSON.parse(localStorage.getItem(userKey(TRAIN_BASE)) || '[]');
  } catch {
    return [];
  }
};

export const IPOPredictorPage: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [priceLow, setPriceLow] = useState(0);
  const [priceHigh, setPriceHigh] = useState(0);
  const [issueSize, setIssueSize] = useState(0);
  const [lotSize, setLotSize] = useState(0);
  const [overallSub, setOverallSub] = useState(0);
  const [qibSub, setQibSub] = useState(0);
  const [gmpPercent, setGmpPercent] = useState(0);
  const [sectorMomentum, setSectorMomentum] = useState<'Neutral' | 'Hot' | 'Weak'>('Neutral');
  const [selectedLiveName, setSelectedLiveName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [train, setTrain] = useState<IPOSample[]>(loadTrain);
  const report = useMemo(() => trainReport(train), [train]);
  const [live, setLive] = useState<{ ipos: LiveIPO[]; sources: string[]; errors: string[]; fetchedAt?: string } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [tName, setTName] = useState('');
  const [tGmp, setTGmp] = useState('');
  const [tSub, setTSub] = useState('');
  const [tGain, setTGain] = useState('');

  const refreshLive = useCallback(async (force = false) => {
    setLiveBusy(true);
    try {
      const r = await fetch(`/api/ipo/live${force ? '?force=1' : ''}`);
      const d = await r.json();
      setLive({ ipos: d.ipos || [], sources: d.sources || [], errors: d.errors || [], fetchedAt: d.fetchedAt });
    } catch (e: any) {
      setLive({ ipos: [], sources: [], errors: [e?.message || 'Network error'] });
    } finally {
      setLiveBusy(false);
    }
  }, []);

  useEffect(() => {
    refreshLive();
    const t = setInterval(() => refreshLive(), 5 * 60_000);
    return () => clearInterval(t);
  }, [refreshLive]);

  const persistTrain = (rows: IPOSample[]) => {
    setTrain(rows);
    try {
      localStorage.setItem(userKey(TRAIN_BASE), JSON.stringify(rows));
    } catch {
    }
  };

  const compute = () =>
    calculateIPOScore({
      companyName,
      priceBandLow: priceLow,
      priceBandHigh: priceHigh,
      issueSizeCr: issueSize,
      lotSize,
      overallSubX: overallSub,
      qibSubX: qibSub,
      gmpPercent,
      sectorMomentum,
      model: report,
    });

  const [result, setResult] = useState<IPORatingResult | null>(null);
  useEffect(() => {
    setResult(compute());
  }, [report]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(compute());
  };

  const useLive = (i: LiveIPO) => {
    const nextPriceHigh = i.priceHigh ?? 0;
    const nextPriceLow = i.priceLow ?? nextPriceHigh;
    const nextIssueSize = i.issueSizeCr ?? 0;
    const nextLotSize = i.lotSize ?? 0;
    const nextGmp = i.gmpPct ?? 0;
    const nextOverallSub = i.subscriptionX ?? 0;
    const nextQibSub = i.qibSubX ?? 0;

    setSelectedLiveName(i.name);
    setCompanyName(i.name);
    setPriceHigh(nextPriceHigh);
    setPriceLow(nextPriceLow);
    setIssueSize(nextIssueSize);
    setLotSize(nextLotSize);
    setGmpPercent(nextGmp);
    setOverallSub(nextOverallSub);
    setQibSub(nextQibSub);

    setResult(
      calculateIPOScore({
        companyName: i.name,
        priceBandLow: nextPriceLow || undefined,
        priceBandHigh: nextPriceHigh || undefined,
        issueSizeCr: nextIssueSize || undefined,
        lotSize: nextLotSize || undefined,
        overallSubX: nextOverallSub,
        qibSubX: nextQibSub,
        gmpPercent: nextGmp,
        sectorMomentum,
        model: report,
      })
    );

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addTrain = () => {
    const g = Number(tGmp);
    const a = Number(tGain);
    if (!tName.trim() || !Number.isFinite(g) || !Number.isFinite(a) || tGain === '' || tGmp === '') return;
    persistTrain([...train, { name: tName.trim(), gmpPct: g, subX: tSub ? Number(tSub) : undefined, actualGainPct: a }]);
    setTName('');
    setTGmp('');
    setTSub('');
    setTGain('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Rocket className="w-5 h-5 text-rose-500" /> IPO Predictor & Listing-Gain Evaluator
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Live IPO list with current GMP, Issue Size, and QIB / Overall Subscription. Click <strong>Predict</strong> on any IPO to auto-fill all metrics and calculate the listing-gain forecast.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Live IPOs, GMP & QIB Subscription</h4>
          <button
            onClick={() => refreshLive(true)}
            disabled={liveBusy}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${liveBusy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {live && live.ipos.length === 0 && !liveBusy && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Live GMP is currently unavailable{live.errors.length ? ` (${live.errors.join(' | ')})` : ''}. You can still predict using the manual form below.
          </p>
        )}
        {live && live.ipos.length > 0 && (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 px-1">IPO</th>
                  <th className="px-1">GMP</th>
                  <th className="px-1 hidden sm:table-cell">Price</th>
                  <th className="px-1 hidden md:table-cell">Size (Cr)</th>
                  <th className="px-1 hidden lg:table-cell">Est. Listing</th>
                  <th className="px-1 hidden xl:table-cell">Dates</th>
                  <th className="px-1">Sub.</th>
                  <th className="px-1">QIB</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {live.ipos.map((i, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-slate-50 dark:border-slate-800/60 transition-colors ${
                      selectedLiveName === i.name ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <td className="py-2 px-1 font-bold">
                      {i.name}
                      <span
                        className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${
                          i.status === 'Open'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : i.status === 'Upcoming'
                            ? 'bg-blue-500/20 text-blue-600'
                            : 'bg-slate-500/20 text-slate-500'
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td
                      className={`px-1 font-bold ${
                        (i.gmpRs ?? 0) > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : (i.gmpRs ?? 0) < 0
                          ? 'text-rose-600'
                          : ''
                      }`}
                    >
                      {i.gmpRs == null ? '—' : `₹${i.gmpRs}`}
                      {i.gmpPct != null && <span className="font-normal text-slate-500"> ({i.gmpPct}%)</span>}
                    </td>
                    <td className="px-1 hidden sm:table-cell">{i.priceHigh ? `₹${i.priceHigh}` : '—'}</td>
                    <td className="px-1 hidden md:table-cell font-mono">
                      {i.issueSizeCr ? `₹${i.issueSizeCr.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-1 hidden lg:table-cell">{i.estListingPrice ? `₹${i.estListingPrice}` : '—'}</td>
                    <td className="px-1 hidden xl:table-cell text-slate-500">{i.dates || '—'}</td>
                    <td className="px-1 font-mono">{i.subscriptionX != null ? `${i.subscriptionX}x` : '—'}</td>
                    <td className="px-1 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {i.qibSubX != null ? `${i.qibSubX}x` : '—'}
                    </td>
                    <td className="px-1 text-right">
                      <button
                        type="button"
                        onClick={() => useLive(i)}
                        className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                      >
                        Predict
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {live && live.sources.length > 0 && (
          <p className="text-[10px] text-slate-400">
            Source: {live.sources.join(' + ')} · Live QIB, Overall Subscription & Issue Size synced automatically. GMP is unofficial and not guaranteed.
          </p>
        )}
      </div>

      <form
        ref={formRef}
        onSubmit={handleAnalyze}
        className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">IPO Issue Metrics</h4>
          {selectedLiveName && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              Auto-filled from live feed: {selectedLiveName}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Price Band Upper (₹)</label>
            <input
              type="number"
              value={priceHigh}
              onChange={(e) => setPriceHigh(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Total Issue Size (₹ Crore)</label>
            <input
              type="number"
              step="0.01"
              value={issueSize}
              onChange={(e) => setIssueSize(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Grey Market Premium (GMP %)</label>
            <input
              type="number"
              step="0.01"
              value={gmpPercent}
              onChange={(e) => setGmpPercent(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Overall Subscription (x times)</label>
            <input
              type="number"
              step="0.01"
              value={overallSub}
              onChange={(e) => setOverallSub(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">QIB Institutional (x times)</label>
            <input
              type="number"
              step="0.01"
              value={qibSub}
              onChange={(e) => setQibSub(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-blue-600 dark:text-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Sector Momentum</label>
            <select
              value={sectorMomentum}
              onChange={(e) => setSectorMomentum(e.target.value as 'Neutral' | 'Hot' | 'Weak')}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
            >
              <option value="Hot">Hot / Bullish Capital Inflows</option>
              <option value="Neutral">Neutral</option>
              <option value="Weak">Weak / Challenged Margins</option>
            </select>
          </div>

          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Calculate AI IPO Recommendation
            </button>
          </div>
        </div>
      </form>

      {result && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                AI Recommendation — {companyName}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={`text-2xl font-black px-4 py-1.5 rounded-xl uppercase tracking-wider ${
                    result.recommendation.startsWith('APPLY')
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : result.recommendation === 'AVOID'
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {result.recommendation}
                </span>
              </div>
            </div>

            <div className="flex gap-6">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Listing Gain Expectation</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {result.estimatedListingGainPct >= 0 ? '+' : ''}
                  {result.estimatedListingGainPct}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  range {result.gainLowPct}% to {result.gainHighPct}%
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">AI Confidence</span>
                <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                  {result.confidencePct}%
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Underlying Drivers & Signals
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Model Training (real past IPOs)</h4>
        <p className="text-xs text-slate-500">
          {report.trained ? `Model is trained on ${report.n} recorded IPOs.` : 'Currently using the default prior.'}
          {report.mae != null &&
            ` Leave-one-out error: ±${report.mae.toFixed(1)} pp (prior: ±${report.priorMae?.toFixed(1)} pp), direction accuracy: ${report.directionAcc?.toFixed(0)}%.`}{' '}
          Adding more actual outcomes improves accuracy (at least 8–10 rows recommended).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <input
            placeholder="IPO name"
            value={tName}
            onChange={(e) => setTName(e.target.value)}
            className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
          />
          <input
            placeholder="GMP % (pre-listing)"
            type="number"
            value={tGmp}
            onChange={(e) => setTGmp(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
          />
          <input
            placeholder="Subscription x"
            type="number"
            value={tSub}
            onChange={(e) => setTSub(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
          />
          <input
            placeholder="Actual listing gain %"
            type="number"
            value={tGain}
            onChange={(e) => setTGain(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
          />
          <button
            onClick={addTrain}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 text-white font-bold p-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {train.length > 0 && (
          <ul className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
            {train.map((t, i) => (
              <li key={i} className="flex items-center justify-between py-1.5 gap-2">
                <span className="font-semibold truncate">{t.name}</span>
                <span className="text-slate-500">
                  GMP {t.gmpPct}%{t.subX ? ` · ${t.subX}x` : ''} →{' '}
                  <b className={(t.actualGainPct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {t.actualGainPct}%
                  </b>
                </span>
                <button aria-label="remove" onClick={() => persistTrain(train.filter((_, j) => j !== i))}>
                  <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default IPOPredictorPage;
