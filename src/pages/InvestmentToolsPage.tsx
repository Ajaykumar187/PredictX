import React, { useState } from 'react';
import {
  calculateEMI,
  calculateCAGR,
  calculateXIRR,
  calculateBrokerage,
  calculateCapitalGainsTax,
  calculateRetirementCorpus,
  calculateGoalSIP,
  calculatePositionSize,
} from '../utils/calculators';
import { Coins } from 'lucide-react';

const toNum = (val: string): number => {
  if (!val || val === '-' || val === '.' || val === '-.') return 0;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const InvestmentToolsPage: React.FC = () => {
  const [tab, setTab] = useState<'Position Size' | 'EMI' | 'CAGR' | 'XIRR' | 'Dividend' | 'Brokerage' | 'Tax' | 'Retirement' | 'Goal'>('Position Size');

  const [psCapital, setPsCapital] = useState('500000');
  const [psRisk, setPsRisk] = useState('1');
  const [psEntry, setPsEntry] = useState('');
  const [psStop, setPsStop] = useState('');
  const [psTarget, setPsTarget] = useState('');
  const psEntryNum = toNum(psEntry);
  const psStopNum = toNum(psStop);
  const psTargetNum = toNum(psTarget);
  const psRes = calculatePositionSize(
    toNum(psCapital),
    toNum(psRisk),
    psEntryNum,
    psStopNum,
    psTargetNum > 0 ? psTargetNum : undefined
  );

  const [emiPrincipal, setEmiPrincipal] = useState('1000000');
  const [emiRate, setEmiRate] = useState('8.5');
  const [emiTenure, setEmiTenure] = useState('20');

  const [cagrStart, setCagrStart] = useState('100000');
  const [cagrEnd, setCagrEnd] = useState('200000');
  const [cagrYears, setCagrYears] = useState('5');

  const [xirrFlows, setXirrFlows] = useState([
    { date: '2022-01-01', amount: '-100000' },
    { date: '2023-01-01', amount: '-50000' },
    { date: '2024-01-01', amount: '220000' },
  ]);

  const [divInvestment, setDivInvestment] = useState('500000');
  const [divYield, setDivYield] = useState('4.5');
  const [divYears, setDivYears] = useState('10');
  const [divDgr, setDivDgr] = useState('8');

  const [bBuy, setBBuy] = useState('100');
  const [bSell, setBSell] = useState('115');
  const [bQty, setBQty] = useState('500');

  const [tBuy, setTBuy] = useState('500');
  const [tSell, setTSell] = useState('750');
  const [tQty, setTQty] = useState('200');
  const [tDays, setTDays] = useState('420');

  const [curAge, setCurAge] = useState('30');
  const [retAge, setRetAge] = useState('60');
  const [expMonth, setExpMonth] = useState('50000');

  const [goalAmount, setGoalAmount] = useState('5000000');
  const [goalYears, setGoalYears] = useState('10');
  const [goalReturn, setGoalReturn] = useState('12');

  const emiRes = calculateEMI(toNum(emiPrincipal), toNum(emiRate), toNum(emiTenure) * 12);
  const cagrRes = calculateCAGR(toNum(cagrStart), toNum(cagrEnd), toNum(cagrYears));
  const xirrRes = calculateXIRR(
    xirrFlows.map((cf) => ({ date: cf.date, amount: toNum(cf.amount) }))
  );
  const brokRes = calculateBrokerage(toNum(bBuy), toNum(bSell), toNum(bQty));
  const taxRes = calculateCapitalGainsTax(toNum(tBuy), toNum(tSell), toNum(tQty), toNum(tDays));
  const retireRes = calculateRetirementCorpus(toNum(curAge), toNum(retAge), toNum(expMonth));
  const goalRes = calculateGoalSIP(toNum(goalAmount), toNum(goalYears), toNum(goalReturn));

  const divInvNum = toNum(divInvestment);
  const divYieldNum = toNum(divYield);
  const divYearsNum = toNum(divYears);
  const divDgrNum = toNum(divDgr);
  const annualDivIncomeYear1 = (divInvNum * divYieldNum) / 100;
  const monthlyDivIncomeYear1 = annualDivIncomeYear1 / 12;
  const futureDivIncome = annualDivIncomeYear1 * Math.pow(1 + divDgrNum / 100, divYearsNum);
  const futureYieldOnCost = divInvNum > 0 ? (futureDivIncome / divInvNum) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Position Size', 'EMI', 'CAGR', 'XIRR', 'Dividend', 'Brokerage', 'Tax', 'Retirement', 'Goal'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === t
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t === 'Tax' ? 'Capital Gains Tax' : t}{t === 'Position Size' ? '' : ' Calculator'}
          </button>
        ))}
      </div>

      {tab === 'Position Size' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Position Size — How many shares should I buy?</h3>
            <p className="text-xs text-slate-500 mt-1">Enter your trading capital and the percentage risk per trade. If your stop loss triggers, your loss stays capped at that risk amount.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {([
              ['Total capital (₹)', psCapital, setPsCapital, 'e.g. 500000'],
              ['Risk per trade (%)', psRisk, setPsRisk, 'e.g. 1'],
              ['Entry price', psEntry, setPsEntry, 'Enter price'],
              ['Stop loss', psStop, setPsStop, 'Enter stop loss'],
              ['Target (optional)', psTarget, setPsTarget, 'Enter target'],
            ] as const).map(([label, val, setter, placeholder]) => (
              <div key={label}>
                <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  value={val}
                  placeholder={placeholder}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
          {!psRes.valid ? (
            <p className="text-xs text-slate-500">{psEntryNum > 0 && psStopNum > 0 ? psRes.message : 'Enter entry price and stop loss.'}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40">
                <span className="text-xs text-blue-800 dark:text-blue-300 block font-semibold">Shares to Buy</span>
                <span className="text-2xl font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">{psRes.quantity.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500 block">Position value</span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">₹{psRes.positionValue.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-slate-500 block">{psRes.capitalUsedPct}% of capital</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                <span className="text-xs text-rose-800 dark:text-rose-300 block font-semibold">Max Loss (at SL)</span>
                <span className="text-lg font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">₹{psRes.riskAmount.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-slate-500 block">₹{psRes.perShareRisk} per share</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500 block">Reward : Risk</span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{psRes.rewardRisk !== null ? `1 : ${psRes.rewardRisk}` : '—'}</span>
                {psRes.potentialProfit !== null && <span className="text-[11px] text-slate-500 block">At target: ₹{psRes.potentialProfit.toLocaleString('en-IN')}</span>}
              </div>
              {psRes.cappedByCapital && (
                <p className="col-span-full text-xs text-amber-600 dark:text-amber-400">
                  Stop loss is very tight, so risk-based quantity would exceed available capital. Quantity has been capped to fit your capital.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'EMI' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Loan EMI Calculator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Loan Amount (₹)</label>
              <input
                type="number"
                step="any"
                value={emiPrincipal}
                placeholder="Enter loan amount"
                onChange={(e) => setEmiPrincipal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Interest Rate (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                value={emiRate}
                placeholder="Enter rate"
                onChange={(e) => setEmiRate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Tenure (Years)</label>
              <input
                type="number"
                step="any"
                value={emiTenure}
                placeholder="Enter tenure"
                onChange={(e) => setEmiTenure(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Monthly EMI</span>
              <span className="text-xl font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">₹{emiRes.emi.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Total Interest Payable</span>
              <span className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">₹{emiRes.totalInterest.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Total Payment (Principal + Interest)</span>
              <span className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">₹{emiRes.totalPayment.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'CAGR' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Compound Annual Growth Rate (CAGR)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Initial Investment (₹)</label>
              <input
                type="number"
                step="any"
                value={cagrStart}
                placeholder="Enter initial amount"
                onChange={(e) => setCagrStart(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Final Value (₹)</label>
              <input
                type="number"
                step="any"
                value={cagrEnd}
                placeholder="Enter final value"
                onChange={(e) => setCagrEnd(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Duration (Years)</label>
              <input
                type="number"
                step="0.5"
                value={cagrYears}
                placeholder="Enter years"
                onChange={(e) => setCagrYears(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40">
            <span className="text-xs text-cyan-800 dark:text-cyan-300 block font-semibold">Annualized CAGR Rate</span>
            <span className="text-3xl font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">{cagrRes}%</span>
          </div>
        </div>
      )}

      {tab === 'XIRR' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Extended Internal Rate of Return (XIRR)</h3>
          <p className="text-xs text-slate-500">
            Computes annualized return across irregular SIP instalments (negative for investments, positive for redemption/current portfolio value).
          </p>

          <div className="space-y-2">
            {xirrFlows.map((cf, idx) => (
              <div key={idx} className="flex gap-4">
                <input
                  type="date"
                  value={cf.date}
                  onChange={(e) => {
                    const next = xirrFlows.map((item, i) =>
                      i === idx ? { ...item, date: e.target.value } : item
                    );
                    setXirrFlows(next);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
                <input
                  type="number"
                  step="any"
                  value={cf.amount}
                  onChange={(e) => {
                    const next = xirrFlows.map((item, i) =>
                      i === idx ? { ...item, amount: e.target.value } : item
                    );
                    setXirrFlows(next);
                  }}
                  placeholder="Amount (- for buy, + for sell)"
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums flex-1"
                />
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
            <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Annualized XIRR</span>
            <span className="text-3xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{xirrRes}%</span>
          </div>
        </div>
      )}

      {tab === 'Dividend' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-500" />
                <span>Dividend Income & Yield-on-Cost Calculator</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Project your passive cash-flow income and compounding yield over time based on dividend yields and annual payout growth.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Portfolio Investment (₹)</label>
              <input
                type="number"
                step="any"
                value={divInvestment}
                placeholder="Enter investment"
                onChange={(e) => setDivInvestment(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Starting Dividend Yield (%)</label>
              <input
                type="number"
                step="0.1"
                value={divYield}
                placeholder="Enter yield %"
                onChange={(e) => setDivYield(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Dividend Growth Rate / CAGR (%)</label>
              <input
                type="number"
                step="0.5"
                value={divDgr}
                placeholder="Enter growth %"
                onChange={(e) => setDivDgr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Time Horizon (Years)</label>
              <input
                type="number"
                min="1"
                max="40"
                value={divYears}
                placeholder="Enter years"
                onChange={(e) => setDivYears(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Year 1 Annual Dividend</span>
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                ₹{Math.round(annualDivIncomeYear1).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40">
              <span className="text-xs text-blue-800 dark:text-blue-300 block font-semibold">Monthly Passive Income</span>
              <span className="text-2xl font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">
                ₹{Math.round(monthlyDivIncomeYear1).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40">
              <span className="text-xs text-purple-800 dark:text-purple-300 block font-semibold">Year {divYearsNum || 0} Annual Payout</span>
              <span className="text-2xl font-black font-mono tabular-nums text-purple-600 dark:text-purple-400">
                ₹{Math.round(futureDivIncome).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
              <span className="text-xs text-amber-800 dark:text-amber-300 block font-semibold">Yield on Initial Cost</span>
              <span className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {futureYieldOnCost.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Brokerage' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Indian Stock Brokerage & Regulatory Charges</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Buy Price (₹)</label>
              <input
                type="number"
                step="any"
                value={bBuy}
                placeholder="Enter buy price"
                onChange={(e) => setBBuy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Sell Price (₹)</label>
              <input
                type="number"
                step="any"
                value={bSell}
                placeholder="Enter sell price"
                onChange={(e) => setBSell(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Quantity</label>
              <input
                type="number"
                value={bQty}
                placeholder="Enter quantity"
                onChange={(e) => setBQty(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Total Turnover</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">₹{brokRes.turnover.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Brokerage (Flat)</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">₹{brokRes.brokerage}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">STT / CTT (0.1%)</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">₹{brokRes.stt}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Exchange + GST + Stamp</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                ₹{(brokRes.exchangeCharges + brokRes.gst + brokRes.stampDuty).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Net Profit / Loss</span>
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                ₹{brokRes.netPnL.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">Total Taxes & Charges: ₹{brokRes.totalCharges}</span>
          </div>
        </div>
      )}

      {tab === 'Tax' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Equity Capital Gains Tax (Budget 2024 Revised)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Buy Price (₹)</label>
              <input
                type="number"
                step="any"
                value={tBuy}
                placeholder="Enter buy price"
                onChange={(e) => setTBuy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Sell Price (₹)</label>
              <input
                type="number"
                step="any"
                value={tSell}
                placeholder="Enter sell price"
                onChange={(e) => setTSell(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Quantity</label>
              <input
                type="number"
                value={tQty}
                placeholder="Enter quantity"
                onChange={(e) => setTQty(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Holding Period (Days)</label>
              <input
                type="number"
                value={tDays}
                placeholder="Enter days"
                onChange={(e) => setTDays(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Classification</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {taxRes.isLTCG ? 'LTCG (> 365 Days)' : 'STCG (≤ 365 Days)'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Applicable Tax Rate</span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{taxRes.taxRatePct}%</span>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
              <span className="text-xs text-rose-800 dark:text-rose-300 block font-semibold">Tax Payable</span>
              <span className="text-xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">₹{taxRes.taxPayable.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Retirement' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Retirement Corpus Planner</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Current Age</label>
              <input
                type="number"
                value={curAge}
                placeholder="Enter age"
                onChange={(e) => setCurAge(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Retirement Age</label>
              <input
                type="number"
                value={retAge}
                placeholder="Enter retirement age"
                onChange={(e) => setRetAge(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Current Monthly Expenses (₹)</label>
              <input
                type="number"
                step="any"
                value={expMonth}
                placeholder="Enter monthly expenses"
                onChange={(e) => setExpMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Monthly Expenses at Retirement</span>
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">₹{retireRes.futureMonthlyExp.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40">
              <span className="text-xs text-purple-800 dark:text-purple-300 block font-semibold">Total Corpus Required</span>
              <span className="text-2xl font-black font-mono tabular-nums text-purple-600 dark:text-purple-400">₹{retireRes.corpusRequired.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Monthly SIP Needed (12% Return)</span>
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">₹{retireRes.sipNeeded.toLocaleString('en-IN')}/mo</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Goal' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Target Financial Goal Planner</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Target Wealth Goal (₹)</label>
              <input
                type="number"
                step="any"
                value={goalAmount}
                placeholder="Enter target goal"
                onChange={(e) => setGoalAmount(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Investment Horizon (Years)</label>
              <input
                type="number"
                step="any"
                value={goalYears}
                placeholder="Enter years"
                onChange={(e) => setGoalYears(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Expected Return (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                value={goalReturn}
                placeholder="Enter return %"
                onChange={(e) => setGoalReturn(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40">
              <span className="text-xs text-cyan-800 dark:text-cyan-300 block font-semibold">Monthly SIP Investment</span>
              <span className="text-2xl font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">₹{goalRes.monthlySip.toLocaleString('en-IN')} / month</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Alternative One-Time Lump Sum</span>
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">₹{goalRes.lumpSum.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
