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
import { Calculator, DollarSign, Percent, Shield, Target, Coins } from 'lucide-react';

export const InvestmentToolsPage: React.FC = () => {
  const [tab, setTab] = useState<'Position Size' | 'EMI' | 'CAGR' | 'XIRR' | 'Dividend' | 'Brokerage' | 'Tax' | 'Retirement' | 'Goal'>('Position Size');

  const [psCapital, setPsCapital] = useState(500000);
  const [psRisk, setPsRisk] = useState(1);
  const [psEntry, setPsEntry] = useState(0);
  const [psStop, setPsStop] = useState(0);
  const [psTarget, setPsTarget] = useState(0);
  const psRes = calculatePositionSize(psCapital, psRisk, psEntry, psStop, psTarget || undefined);

  const [emiPrincipal, setEmiPrincipal] = useState(1000000);
  const [emiRate, setEmiRate] = useState(8.5);
  const [emiTenure, setEmiTenure] = useState(20);

  const [cagrStart, setCagrStart] = useState(100000);
  const [cagrEnd, setCagrEnd] = useState(200000);
  const [cagrYears, setCagrYears] = useState(5);

  const [xirrFlows, setXirrFlows] = useState([
    { date: '2022-01-01', amount: -100000 },
    { date: '2023-01-01', amount: -50000 },
    { date: '2024-01-01', amount: 220000 },
  ]);

  const [divInvestment, setDivInvestment] = useState(500000);
  const [divYield, setDivYield] = useState(4.5);
  const [divYears, setDivYears] = useState(10);
  const [divDgr, setDivDgr] = useState(8);

  const [bBuy, setBBuy] = useState(100);
  const [bSell, setBSell] = useState(115);
  const [bQty, setBQty] = useState(500);

  const [tBuy, setTBuy] = useState(500);
  const [tSell, setTSell] = useState(750);
  const [tQty, setTQty] = useState(200);
  const [tDays, setTDays] = useState(420);

  const [curAge, setCurAge] = useState(30);
  const [retAge, setRetAge] = useState(60);
  const [expMonth, setExpMonth] = useState(50000);

  const [goalAmount, setGoalAmount] = useState(5000000);
  const [goalYears, setGoalYears] = useState(10);
  const [goalReturn, setGoalReturn] = useState(12);

  const emiRes = calculateEMI(emiPrincipal, emiRate, emiTenure * 12);
  const cagrRes = calculateCAGR(cagrStart, cagrEnd, cagrYears);
  const xirrRes = calculateXIRR(xirrFlows);
  const brokRes = calculateBrokerage(bBuy, bSell, bQty);
  const taxRes = calculateCapitalGainsTax(tBuy, tSell, tQty, tDays);
  const retireRes = calculateRetirementCorpus(curAge, retAge, expMonth);
  const goalRes = calculateGoalSIP(goalAmount, goalYears, goalReturn);

  const annualDivIncomeYear1 = (divInvestment * divYield) / 100;
  const monthlyDivIncomeYear1 = annualDivIncomeYear1 / 12;
  const futureDivIncome = annualDivIncomeYear1 * Math.pow(1 + divDgr / 100, divYears);
  const futureYieldOnCost = (futureDivIncome / divInvestment) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['Position Size', 'EMI', 'CAGR', 'XIRR', 'Dividend', 'Brokerage', 'Tax', 'Retirement', 'Goal'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === t
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {t === 'Tax' ? 'Capital Gains Tax' : t}{t === 'Position Size' ? '' : ' Calculator'}
          </button>
        ))}
      </div>

      {tab === 'Position Size' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Position Size — kitne shares lun?</h3>
            <p className="text-xs text-slate-500 mt-1">Apna capital aur ek trade mein kitna risk lena hai batayein. Stop loss lagne par bas utna hi nuksaan hoga.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              ['Total capital (₹)', psCapital, setPsCapital],
              ['Risk per trade (%)', psRisk, setPsRisk],
              ['Entry price', psEntry || '', setPsEntry],
              ['Stop loss', psStop || '', setPsStop],
              ['Target (optional)', psTarget || '', setPsTarget],
            ].map(([label, val, setter]: any) => (
              <div key={label}>
                <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
              </div>
            ))}
          </div>
          {!psRes.valid ? (
            <p className="text-xs text-slate-500">{psEntry && psStop ? psRes.message : 'Entry price aur stop loss daalein.'}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40">
                <span className="text-xs text-blue-800 dark:text-blue-300 block font-semibold">Shares kharidein</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{psRes.quantity.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500 block">Position value</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">₹{psRes.positionValue.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-slate-500 block">{psRes.capitalUsedPct}% of capital</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                <span className="text-xs text-rose-800 dark:text-rose-300 block font-semibold">Max nuksaan (SL par)</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">₹{psRes.riskAmount.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-slate-500 block">₹{psRes.perShareRisk} per share</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500 block">Reward : Risk</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{psRes.rewardRisk !== null ? `1 : ${psRes.rewardRisk}` : '—'}</span>
                {psRes.potentialProfit !== null && <span className="text-[11px] text-slate-500 block">Target par ₹{psRes.potentialProfit.toLocaleString('en-IN')}</span>}
              </div>
              {psRes.cappedByCapital && (
                <p className="col-span-full text-xs text-amber-600 dark:text-amber-400">
                  Stop loss bahut paas hai, risk ke hisaab se shares capital se zyada ho jaate. Isliye quantity capital tak seemit kar di gayi hai.
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
                value={emiPrincipal}
                onChange={(e) => setEmiPrincipal(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Interest Rate (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                value={emiRate}
                onChange={(e) => setEmiRate(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Tenure (Years)</label>
              <input
                type="number"
                value={emiTenure}
                onChange={(e) => setEmiTenure(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Monthly EMI</span>
              <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">₹{emiRes.emi.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Total Interest Payable</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">₹{emiRes.totalInterest.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Total Payment (Principal + Interest)</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">₹{emiRes.totalPayment.toLocaleString()}</span>
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
                value={cagrStart}
                onChange={(e) => setCagrStart(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Final Value (₹)</label>
              <input
                type="number"
                value={cagrEnd}
                onChange={(e) => setCagrEnd(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Duration (Years)</label>
              <input
                type="number"
                step="0.5"
                value={cagrYears}
                onChange={(e) => setCagrYears(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40">
            <span className="text-xs text-cyan-800 dark:text-cyan-300 block font-semibold">Annualized CAGR Rate</span>
            <span className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{cagrRes}%</span>
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
                    const next = [...xirrFlows];
                    next[idx].date = e.target.value;
                    setXirrFlows(next);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                />
                <input
                  type="number"
                  value={cf.amount}
                  onChange={(e) => {
                    const next = [...xirrFlows];
                    next[idx].amount = Number(e.target.value);
                    setXirrFlows(next);
                  }}
                  placeholder="Amount (- for buy, + for sell)"
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold flex-1"
                />
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
            <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Annualized XIRR</span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{xirrRes}%</span>
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
                step="25000"
                value={divInvestment}
                onChange={(e) => setDivInvestment(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Starting Dividend Yield (%)</label>
              <input
                type="number"
                step="0.1"
                value={divYield}
                onChange={(e) => setDivYield(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Dividend Growth Rate / CAGR (%)</label>
              <input
                type="number"
                step="0.5"
                value={divDgr}
                onChange={(e) => setDivDgr(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Time Horizon (Years)</label>
              <input
                type="number"
                min="1"
                max="40"
                value={divYears}
                onChange={(e) => setDivYears(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Year 1 Annual Dividend</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{Math.round(annualDivIncomeYear1).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40">
              <span className="text-xs text-blue-800 dark:text-blue-300 block font-semibold">Monthly Passive Income</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                ₹{Math.round(monthlyDivIncomeYear1).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40">
              <span className="text-xs text-purple-800 dark:text-purple-300 block font-semibold">Year {divYears} Annual Payout</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                ₹{Math.round(futureDivIncome).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
              <span className="text-xs text-amber-800 dark:text-amber-300 block font-semibold">Yield on Initial Cost</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
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
                value={bBuy}
                onChange={(e) => setBBuy(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Sell Price (₹)</label>
              <input
                type="number"
                value={bSell}
                onChange={(e) => setBSell(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Quantity</label>
              <input
                type="number"
                value={bQty}
                onChange={(e) => setBQty(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Total Turnover</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{brokRes.turnover.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Brokerage (Flat)</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{brokRes.brokerage}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">STT / CTT (0.1%)</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{brokRes.stt}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Exchange + GST + Stamp</span>
              <span className="font-bold text-slate-900 dark:text-white">
                ₹{(brokRes.exchangeCharges + brokRes.gst + brokRes.stampDuty).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex justify-between items-center">
            <div>
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Net Profit / Loss</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{brokRes.netPnL.toLocaleString()}
              </span>
            </div>
            <span className="text-xs text-slate-500">Total Taxes & Charges: ₹{brokRes.totalCharges}</span>
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
                value={tBuy}
                onChange={(e) => setTBuy(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Sell Price (₹)</label>
              <input
                type="number"
                value={tSell}
                onChange={(e) => setTSell(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Quantity</label>
              <input
                type="number"
                value={tQty}
                onChange={(e) => setTQty(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Holding Period (Days)</label>
              <input
                type="number"
                value={tDays}
                onChange={(e) => setTDays(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
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
              <span className="text-lg font-bold text-slate-900 dark:text-white">{taxRes.taxRatePct}%</span>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
              <span className="text-xs text-rose-800 dark:text-rose-300 block font-semibold">Tax Payable</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">₹{taxRes.taxPayable.toLocaleString()}</span>
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
                onChange={(e) => setCurAge(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Retirement Age</label>
              <input
                type="number"
                value={retAge}
                onChange={(e) => setRetAge(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Current Monthly Expenses (₹)</label>
              <input
                type="number"
                value={expMonth}
                onChange={(e) => setExpMonth(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Monthly Expenses at Retirement</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">₹{retireRes.futureMonthlyExp.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40">
              <span className="text-xs text-purple-800 dark:text-purple-300 block font-semibold">Total Corpus Required</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">₹{retireRes.corpusRequired.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">Monthly SIP Needed (12% Return)</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{retireRes.sipNeeded.toLocaleString()}/mo</span>
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
                value={goalAmount}
                onChange={(e) => setGoalAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Investment Horizon (Years)</label>
              <input
                type="number"
                value={goalYears}
                onChange={(e) => setGoalYears(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Expected Return (% p.a.)</label>
              <input
                type="number"
                value={goalReturn}
                onChange={(e) => setGoalReturn(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40">
              <span className="text-xs text-cyan-800 dark:text-cyan-300 block font-semibold">Monthly SIP Investment</span>
              <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">₹{goalRes.monthlySip.toLocaleString()} / month</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500 block">Alternative One-Time Lump Sum</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">₹{goalRes.lumpSum.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
