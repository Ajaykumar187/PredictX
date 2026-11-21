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
import { TrendingUp, TrendingDown, Activity, Info, Zap, Flame } from 'lucide-react';
import { OptionChainRow } from '../utils/greeks';

interface OptionChangeOiChartProps {
  chain: OptionChainRow[];
  atmStrike: number;
  spotPrice: number;
  indexName: string;
}

export const OptionChangeOiChart: React.FC<OptionChangeOiChartProps> = ({
  chain,
  atmStrike,
  spotPrice,
  indexName,
}) => {
  const [viewMode, setViewMode] = useState<'SIDE_BY_SIDE' | 'NET_BUILDUP'>('SIDE_BY_SIDE');

  const chartData = chain.map((row) => {
    const netBuildUp = row.putChangeOI - row.callChangeOI;

    return {
      strike: row.strike,
      strikeLabel: `${row.strike}`,
      CallChangeOI: row.callChangeOI,
      PutChangeOI: row.putChangeOI,
      absCallChangeOI: Math.abs(row.callChangeOI),
      absPutChangeOI: Math.abs(row.putChangeOI),
      netBuildUp,
      callLTP: row.callLTP,
      putLTP: row.putLTP,
      isATM: row.isATM,
      callOI: row.callOI,
      putOI: row.putOI,
    };
  });

  const maxCallAddition = chartData.reduce(
    (max, r) => (r.CallChangeOI > max.CallChangeOI ? r : max),
    chartData[0]
  );
  const maxPutAddition = chartData.reduce(
    (max, r) => (r.PutChangeOI > max.PutChangeOI ? r : max),
    chartData[0]
  );

  const totalCallChangeOI = chartData.reduce((sum, r) => sum + r.CallChangeOI, 0);
  const totalPutChangeOI = chartData.reduce((sum, r) => sum + r.PutChangeOI, 0);
  const netDailyBias = totalPutChangeOI - totalCallChangeOI;

  const formatNumber = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : val > 0 ? '+' : '';
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
    return `${sign}${abs.toLocaleString('en-IN')}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = chartData.find((d) => d.strike === Number(label));
    if (!row) return null;

    const callAction =
      row.CallChangeOI > 0
        ? 'Call Writing (Resistance buildup)'
        : row.CallChangeOI < 0
        ? 'Call Short Covering / Unwinding'
        : 'Neutral';

    const putAction =
      row.PutChangeOI > 0
        ? 'Put Writing (Support buildup)'
        : row.PutChangeOI < 0
        ? 'Put Long Liquidation / Unwinding'
        : 'Neutral';

    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md min-w-[240px] space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm text-amber-300">₹{row.strike.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">Strike</span>
          </div>
          {row.isATM && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black">
              ATM SPOT
            </span>
          )}
        </div>

        <div className="space-y-2 font-mono text-[11px]">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Call Chg OI:
              </span>
              <span>{formatNumber(row.CallChangeOI)} ({row.CallChangeOI >= 0 ? '+' : ''}{row.CallChangeOI.toLocaleString('en-IN')})</span>
            </div>
            <div className="text-[10px] text-slate-300 font-sans mt-0.5">{callAction}</div>
          </div>

          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center justify-between text-rose-400 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Put Chg OI:
              </span>
              <span>{formatNumber(row.PutChangeOI)} ({row.PutChangeOI >= 0 ? '+' : ''}{row.PutChangeOI.toLocaleString('en-IN')})</span>
            </div>
            <div className="text-[10px] text-slate-300 font-sans mt-0.5">{putAction}</div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-slate-400 font-sans">Net Strike Bias:</span>
            <span
              className={`font-black ${
                row.netBuildUp > 0 ? 'text-emerald-400' : row.netBuildUp < 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {row.netBuildUp > 0 ? `+${formatNumber(row.netBuildUp)} (Bullish Base)` : `${formatNumber(row.netBuildUp)} (Bearish Cap)`}
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
              <Activity className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              Change in Open Interest (Chg OI) Bar Chart
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" />
              Intraday Buildup
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify fresh contract creation vs unwinding/liquidation across strikes for {indexName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('SIDE_BY_SIDE')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                viewMode === 'SIDE_BY_SIDE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Side-by-Side (CE vs PE)
            </button>
            <button
              onClick={() => setViewMode('NET_BUILDUP')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                viewMode === 'NET_BUILDUP'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Net Strike Bias
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">
              Max Call Addition (Resistance)
            </span>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
              ₹{maxCallAddition ? maxCallAddition.strike.toLocaleString('en-IN') : 'N/A'}
            </span>
          </div>
          <span className="text-[11px] font-black text-emerald-600 font-mono">
            {maxCallAddition ? formatNumber(maxCallAddition.CallChangeOI) : ''}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">
              Max Put Addition (Support)
            </span>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
              ₹{maxPutAddition ? maxPutAddition.strike.toLocaleString('en-IN') : 'N/A'}
            </span>
          </div>
          <span className="text-[11px] font-black text-rose-600 font-mono">
            {maxPutAddition ? formatNumber(maxPutAddition.PutChangeOI) : ''}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              Total Day Chg: CE vs PE
            </span>
            <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-200">
              <span className="text-emerald-600 dark:text-emerald-400">{formatNumber(totalCallChangeOI)}</span> vs{' '}
              <span className="text-rose-600 dark:text-rose-400">{formatNumber(totalPutChangeOI)}</span>
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block uppercase">
              Intraday Buildup Bias
            </span>
            <span
              className={`font-mono font-black text-sm ${
                netDailyBias >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {netDailyBias >= 0 ? 'Put Writing (Bullish)' : 'Call Writing (Bearish)'}
            </span>
          </div>
          {netDailyBias >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-500" />
          )}
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
                      fill={isATM ? '#f59e0b' : '#64748b'}
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
                if (value === 'CallChangeOI') return <span className="text-emerald-600 dark:text-emerald-400 font-bold">Call (CE) Change in OI</span>;
                if (value === 'PutChangeOI') return <span className="text-rose-600 dark:text-rose-400 font-bold">Put (PE) Change in OI</span>;
                if (value === 'netBuildUp') return <span className="text-amber-500 font-bold">Net Strike Buildup Bias</span>;
                return value;
              }}
            />

            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" />

            <ReferenceLine
              x={`${atmStrike}`}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `ATM ₹${atmStrike}`,
                position: 'top',
                fill: '#f59e0b',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {viewMode === 'SIDE_BY_SIDE' ? (
              <>
                <Bar
                  dataKey="CallChangeOI"
                  name="CallChangeOI"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`call-change-${entry.strike}`}
                      fill={entry.CallChangeOI >= 0 ? '#10b981' : '#059669'}
                      opacity={entry.CallChangeOI >= 0 ? 0.95 : 0.65}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="PutChangeOI"
                  name="PutChangeOI"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`put-change-${entry.strike}`}
                      fill={entry.PutChangeOI >= 0 ? '#f43f5e' : '#e11d48'}
                      opacity={entry.PutChangeOI >= 0 ? 0.95 : 0.65}
                    />
                  ))}
                </Bar>
              </>
            ) : (
              <Bar
                dataKey="netBuildUp"
                name="netBuildUp"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`net-${entry.strike}`}
                    fill={entry.netBuildUp >= 0 ? '#10b981' : '#f43f5e'}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
            <strong className="text-emerald-600 dark:text-emerald-400">Green Bars: Call Chg OI</strong> (Positive = Resistance addition, Negative = Unwinding)
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
            <strong className="text-rose-600 dark:text-rose-400">Red Bars: Put Chg OI</strong> (Positive = Support addition, Negative = Unwinding)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
          <Zap className="w-3.5 h-3.5" />
          <span>Tracking institutional fresh positions</span>
        </div>
      </div>
    </div>
  );
};
