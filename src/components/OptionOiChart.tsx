import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts';
import { BarChart3, Activity, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { OptionChainRow } from '../utils/greeks';

interface OptionOiChartProps {
  chain: OptionChainRow[];
  atmStrike: number;
  spotPrice: number;
  indexName: string;
}

export const OptionOiChart: React.FC<OptionOiChartProps> = ({
  chain,
  atmStrike,
  spotPrice,
  indexName,
}) => {
  const [metric, setMetric] = useState<'OI' | 'VOLUME'>('OI');

  const chartData = chain.map((row) => ({
    strike: row.strike,
    strikeLabel: `${row.strike}`,
    CallOI: row.callOI,
    PutOI: row.putOI,
    CallVol: row.callVol,
    PutVol: row.putVol,
    callLTP: row.callLTP,
    putLTP: row.putLTP,
    isATM: row.isATM,
    diffOI: row.putOI - row.callOI,
  }));

  const maxCallOI = chartData.reduce((max, r) => (r.CallOI > max.CallOI ? r : max), chartData[0]);
  const maxPutOI = chartData.reduce((max, r) => (r.PutOI > max.PutOI ? r : max), chartData[0]);

  const totalCallOI = chartData.reduce((sum, r) => sum + r.CallOI, 0);
  const totalPutOI = chartData.reduce((sum, r) => sum + r.PutOI, 0);
  const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '1.00';

  const formatNumber = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toLocaleString('en-IN');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = chartData.find((d) => d.strike === Number(label));
    if (!row) return null;

    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md min-w-[210px] space-y-2">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
          <span className="font-bold text-sm text-cyan-300">Strike: ₹{row.strike.toLocaleString('en-IN')}</span>
          {row.isATM && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
              ATM
            </span>
          )}
        </div>

        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Call (CE) OI:
            </span>
            <span className="font-bold text-slate-100">{formatNumber(row.CallOI)} ({row.CallOI.toLocaleString('en-IN')})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Put (PE) OI:
            </span>
            <span className="font-bold text-slate-100">{formatNumber(row.PutOI)} ({row.PutOI.toLocaleString('en-IN')})</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-sans">
            <span>CE LTP: ₹{row.callLTP.toFixed(2)}</span>
            <span>PE LTP: ₹{row.putLTP.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
            <span>OI Net Difference:</span>
            <span className={`font-mono font-bold ${row.diffOI >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {row.diffOI >= 0 ? `+${formatNumber(row.diffOI)} (Put bias)` : `${formatNumber(row.diffOI)} (Call bias)`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Real-Time Open Interest (OI) Distribution Chart
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Side-by-Side Calls vs Puts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare Call OI (resistance writing) vs Put OI (support floor) for {indexName} across all near strikes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setMetric('OI')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                metric === 'OI'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Open Interest (OI)
            </button>
            <button
              onClick={() => setMetric('VOLUME')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                metric === 'VOLUME'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Traded Volume
            </button>
          </div>
        </div>
      </div>
      {/* Quick Summary Pill Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">
              Call Wall / Major Resistance
            </span>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
              ₹{maxCallOI ? maxCallOI.strike.toLocaleString('en-IN') : 'N/A'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 font-mono">
            {maxCallOI ? formatNumber(maxCallOI.CallOI) : ''}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">
              Put Base / Major Support
            </span>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
              ₹{maxPutOI ? maxPutOI.strike.toLocaleString('en-IN') : 'N/A'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-rose-600 font-mono">
            {maxPutOI ? formatNumber(maxPutOI.PutOI) : ''}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 block uppercase">
              ATM Strike Level
            </span>
            <span className="font-mono font-black text-sm text-cyan-600 dark:text-cyan-400">
              ₹{atmStrike.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Spot: ₹{spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block uppercase">
              Put-Call Ratio (PCR)
            </span>
            <span className="font-mono font-black text-sm text-purple-600 dark:text-purple-400">
              {pcr}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(pcr) >= 1 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
            {Number(pcr) >= 1 ? 'Bullish' : 'Bearish'}
          </span>
        </div>
      </div>

      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 0, bottom: 25 }}
            barGap={2}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
            <XAxis
              dataKey="strikeLabel"
              tickLine={false}
              stroke="#64748b"
              fontSize={11}
              interval={0}
              angle={-35}
              textAnchor="end"
              tick={(props: any) => {
                const { x, y, payload } = props;
                const isATM = Number(payload.value) === atmStrike;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={10}
                      textAnchor="end"
                      transform="rotate(-40)"
                      fontSize={10}
                      fontWeight={isATM ? 800 : 500}
                      fill={isATM ? '#06b6d4' : '#64748b'}
                    >
                      {payload.value} {isATM ? '★' : ''}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis
              tickLine={false}
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              formatter={(value) => {
                if (value === 'CallOI') return <span className="text-emerald-600 dark:text-emerald-400 font-bold">Call (CE) Open Interest</span>;
                if (value === 'PutOI') return <span className="text-rose-600 dark:text-rose-400 font-bold">Put (PE) Open Interest</span>;
                if (value === 'CallVol') return <span className="text-emerald-600 dark:text-emerald-400 font-bold">Call (CE) Volume</span>;
                if (value === 'PutVol') return <span className="text-rose-600 dark:text-rose-400 font-bold">Put (PE) Volume</span>;
                return value;
              }}
            />

            <ReferenceLine
              x={`${atmStrike}`}
              stroke="#06b6d4"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `ATM ₹${atmStrike}`,
                position: 'top',
                fill: '#06b6d4',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {metric === 'OI' ? (
              <>
                <Bar
                  dataKey="CallOI"
                  name="CallOI"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`call-cell-${entry.strike}`}
                      fill={entry.strike === maxCallOI?.strike ? '#059669' : '#10b981'}
                      opacity={entry.strike < spotPrice ? 0.6 : 0.95}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="PutOI"
                  name="PutOI"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`put-cell-${entry.strike}`}
                      fill={entry.strike === maxPutOI?.strike ? '#e11d48' : '#f43f5e'}
                      opacity={entry.strike > spotPrice ? 0.6 : 0.95}
                    />
                  ))}
                </Bar>
              </>
            ) : (
              <>
                <Bar
                  dataKey="CallVol"
                  name="CallVol"
                  fill="#34d399"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="PutVol"
                  name="PutVol"
                  fill="#fb7185"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
            <strong className="text-emerald-600 dark:text-emerald-400">Green: Call OI</strong> (Higher bars = Resistance overhead)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
            <strong className="text-rose-600 dark:text-rose-400">Red: Put OI</strong> (Higher bars = Support cushion below)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            <strong className="text-cyan-600 dark:text-cyan-400">★ Cyan: ATM Strike</strong>
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>Institutional buildup visualizer</span>
        </div>
      </div>
    </div>
  );
};
