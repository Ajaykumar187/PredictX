import { IndicatorData } from '../types';

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  type: 'LONG';
}

export interface BacktestResult {
  equityCurve: Array<{ date: string; equity: number; buyHold: number }>;
  trades: BacktestTrade[];
  totalReturnPct: number;
  buyHoldReturnPct: number;
  maxDrawdownPct: number;
  numTrades: number;
  winRatePct: number;
  finalEquity: number;
}

export function backtestSMACrossover(
  df: IndicatorData[],
  fastPeriod: number = 20,
  slowPeriod: number = 50,
  initialCapital: number = 100000
): BacktestResult {
  const n = df.length;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = '';
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ date: string; equity: number; buyHold: number }> = [];

  const startPrice = df[0].close;

  for (let i = 0; i < n; i++) {
    const cur = df[i];
    const fastSMA = cur.sma20 || cur.close;
    const slowSMA = cur.sma50 || cur.close;
    const wantLong = fastSMA > slowSMA;

    if (wantLong && shares === 0) {
      shares = cash / cur.close;
      cash = 0;
      entryPrice = cur.close;
      entryDate = cur.date;
    } else if (!wantLong && shares > 0) {
      cash = shares * cur.close;
      const ret = parseFloat((((cur.close - entryPrice) / entryPrice) * 100).toFixed(2));
      trades.push({
        entryDate,
        exitDate: cur.date,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice: parseFloat(cur.close.toFixed(2)),
        returnPct: ret,
        type: 'LONG',
      });
      shares = 0;
    }

    const currentEquity = cash + shares * cur.close;
    const currentBuyHold = (cur.close / startPrice) * initialCapital;
    equityCurve.push({
      date: cur.date,
      equity: parseFloat(currentEquity.toFixed(2)),
      buyHold: parseFloat(currentBuyHold.toFixed(2)),
    });
  }

  if (shares > 0) {
    const lastBar = df[n - 1];
    const ret = parseFloat((((lastBar.close - entryPrice) / entryPrice) * 100).toFixed(2));
    trades.push({
      entryDate,
      exitDate: lastBar.date,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      exitPrice: parseFloat(lastBar.close.toFixed(2)),
      returnPct: ret,
      type: 'LONG',
    });
  }

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || initialCapital;
  const totalReturnPct = parseFloat((((finalEquity - initialCapital) / initialCapital) * 100).toFixed(2));
  const buyHoldReturnPct = parseFloat((((df[n - 1].close - startPrice) / startPrice) * 100).toFixed(2));

  let peak = initialCapital;
  let maxDd = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (pt.equity - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  const maxDrawdownPct = parseFloat((Math.abs(maxDd) * 100).toFixed(2));

  const wins = trades.filter(t => t.returnPct > 0);
  const winRatePct = trades.length > 0 ? parseFloat(((wins.length / trades.length) * 100).toFixed(1)) : 0;

  return {
    equityCurve,
    trades,
    totalReturnPct,
    buyHoldReturnPct,
    maxDrawdownPct,
    numTrades: trades.length,
    winRatePct,
    finalEquity: parseFloat(finalEquity.toFixed(2)),
  };
}

export function backtestRSIStrategy(
  df: IndicatorData[],
  oversold: number = 30,
  overbought: number = 70,
  initialCapital: number = 100000
): BacktestResult {
  const n = df.length;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = '';
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ date: string; equity: number; buyHold: number }> = [];

  const startPrice = df[0].close;

  for (let i = 0; i < n; i++) {
    const cur = df[i];
    const rsi = cur.rsi14 || 50;

    if (rsi < oversold && shares === 0) {
      shares = cash / cur.close;
      cash = 0;
      entryPrice = cur.close;
      entryDate = cur.date;
    } else if (rsi > overbought && shares > 0) {
      cash = shares * cur.close;
      const ret = parseFloat((((cur.close - entryPrice) / entryPrice) * 100).toFixed(2));
      trades.push({
        entryDate,
        exitDate: cur.date,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice: parseFloat(cur.close.toFixed(2)),
        returnPct: ret,
        type: 'LONG',
      });
      shares = 0;
    }

    const currentEquity = cash + shares * cur.close;
    const currentBuyHold = (cur.close / startPrice) * initialCapital;
    equityCurve.push({
      date: cur.date,
      equity: parseFloat(currentEquity.toFixed(2)),
      buyHold: parseFloat(currentBuyHold.toFixed(2)),
    });
  }

  if (shares > 0) {
    const lastBar = df[n - 1];
    const ret = parseFloat((((lastBar.close - entryPrice) / entryPrice) * 100).toFixed(2));
    trades.push({
      entryDate,
      exitDate: lastBar.date,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      exitPrice: parseFloat(lastBar.close.toFixed(2)),
      returnPct: ret,
      type: 'LONG',
    });
  }

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || initialCapital;
  const totalReturnPct = parseFloat((((finalEquity - initialCapital) / initialCapital) * 100).toFixed(2));
  const buyHoldReturnPct = parseFloat((((df[n - 1].close - startPrice) / startPrice) * 100).toFixed(2));

  let peak = initialCapital;
  let maxDd = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (pt.equity - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  const maxDrawdownPct = parseFloat((Math.abs(maxDd) * 100).toFixed(2));

  const wins = trades.filter(t => t.returnPct > 0);
  const winRatePct = trades.length > 0 ? parseFloat(((wins.length / trades.length) * 100).toFixed(1)) : 0;

  return {
    equityCurve,
    trades,
    totalReturnPct,
    buyHoldReturnPct,
    maxDrawdownPct,
    numTrades: trades.length,
    winRatePct,
    finalEquity: parseFloat(finalEquity.toFixed(2)),
  };
}
