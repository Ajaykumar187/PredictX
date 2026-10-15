import { IndicatorData, AnalysisResult, MarketType, RiskAnalysis, PriceBar, StockInfo } from '../types';
import { calculateIndicators } from './indicators';
import { getStockInfo, formatCurrencyValue } from './marketData';

export function runFullAnalysis(
  symbol: string,
  market: MarketType,
  customBars: PriceBar[],
  customInfo?: Partial<StockInfo>,
  liveLatestPrice?: number,
  liveChange?: number,
  liveChangePct?: number
): AnalysisResult {
  if (!customBars || customBars.length === 0) {
    throw new Error(`No live price data available for "${symbol}"`);
  }
  const bars = customBars;
  const df = calculateIndicators(bars);
  const baseInfo = getStockInfo(symbol, market);
  const info: StockInfo = {
    ...baseInfo,
    ...customInfo,
  };

  const n = df.length;
  const latestBar = df[n - 1];
  const prevBar = df[n - 2] || latestBar;
  const latestPrice = liveLatestPrice !== undefined ? liveLatestPrice : latestBar.close;
  const change = liveChange !== undefined ? liveChange : parseFloat((latestPrice - prevBar.close).toFixed(2));
  const changePct = liveChangePct !== undefined
    ? liveChangePct
    : (prevBar.close > 0 ? parseFloat(((change / prevBar.close) * 100).toFixed(2)) : 0);

  let score = 0;
  const reasons: string[] = [];
  const rsi = latestBar.rsi14 || 50;

  if (rsi < 30) {
    score += 25;
    reasons.push(`RSI14 is ${rsi.toFixed(1)} — oversold territory (bullish bounce expected).`);
  } else if (rsi > 70) {
    score -= 25;
    reasons.push(`RSI14 is ${rsi.toFixed(1)} — overbought territory (bearish cooling expected).`);
  } else {
    reasons.push(`RSI14 is ${rsi.toFixed(1)} — neutral momentum.`);
  }

  if (latestBar.macd !== undefined && latestBar.macdSignal !== undefined) {
    if (latestBar.macd > latestBar.macdSignal) {
      score += 20;
      reasons.push(`MACD (${latestBar.macd}) is above its signal line (${latestBar.macdSignal}) — bullish momentum.`);
    } else {
      score -= 20;
      reasons.push(`MACD (${latestBar.macd}) is below its signal line (${latestBar.macdSignal}) — bearish momentum.`);
    }
  }

  if (latestBar.sma50 !== undefined) {
    if (latestPrice > latestBar.sma50) {
      score += 15;
      reasons.push(`Price is above the 50-day moving average (₹/${info.currencySymbol}${latestBar.sma50}) — medium-term uptrend.`);
    } else {
      score -= 15;
      reasons.push(`Price is below the 50-day moving average (₹/${info.currencySymbol}${latestBar.sma50}) — medium-term downtrend.`);
    }
  }

  if (latestBar.sma200 !== undefined) {
    if (latestPrice > latestBar.sma200) {
      score += 15;
      reasons.push(`Price is above the 200-day moving average (₹/${info.currencySymbol}${latestBar.sma200}) — strong long-term uptrend.`);
    } else {
      score -= 15;
      reasons.push(`Price is below the 200-day moving average (₹/${info.currencySymbol}${latestBar.sma200}) — long-term downtrend.`);
    }
  }

  if (latestBar.bbUpper !== undefined && latestPrice >= latestBar.bbUpper) {
    score -= 10;
    reasons.push('Price is at or above the upper Bollinger Band — possible near-term pullback.');
  } else if (latestBar.bbLower !== undefined && latestPrice <= latestBar.bbLower) {
    score += 10;
    reasons.push('Price is at or below the lower Bollinger Band — possible oversold bounce.');
  }

  score = Math.max(-100, Math.min(100, score));
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  if (score >= 25) signal = 'BUY';
  else if (score <= -25) signal = 'SELL';

  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    returns.push((df[i].close - df[i - 1].close) / df[i - 1].close);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const annVol = parseFloat((dailyVol * Math.sqrt(252) * 100).toFixed(2));

  let peak = df[0].close;
  let maxDd = 0;
  for (let i = 0; i < n; i++) {
    if (df[i].close > peak) peak = df[i].close;
    const dd = (df[i].close - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  const maxDrawdownPct = parseFloat((Math.abs(maxDd) * 100).toFixed(2));

  let riskLabel: 'Low' | 'Moderate' | 'High' = 'Moderate';
  if (annVol < 20) riskLabel = 'Low';
  else if (annVol > 40) riskLabel = 'High';

  const risk: RiskAnalysis = {
    annual_volatility_pct: annVol,
    max_drawdown_pct: maxDrawdownPct,
    beta: info.beta,
    risk_label: riskLabel,
  };

  const SHRINK = 0.3;
  const recentMeanRet = (end: number, win = 20) => {
    const from = Math.max(1, end - win + 1);
    let sum = 0;
    let cnt = 0;
    for (let k = from; k <= end; k++) {
      sum += Math.log(df[k].close / df[k - 1].close);
      cnt++;
    }
    return cnt ? sum / cnt : 0;
  };
  const clampDrift = (d: number) => Math.max(-0.01, Math.min(0.01, d));

  const trainLen = Math.floor(n * 0.8);
  const actual: number[] = [];
  const predictions: number[] = [];
  let dirHits = 0;
  let dirTotal = 0;
  for (let i = Math.max(trainLen, 21); i < n; i++) {
    const prev = df[i - 1].close;
    const pred = parseFloat((prev * Math.exp(clampDrift(SHRINK * recentMeanRet(i - 1)))).toFixed(2));
    actual.push(df[i].close);
    predictions.push(pred);
    const pd = Math.sign(pred - prev);
    const ad = Math.sign(df[i].close - prev);
    if (pd !== 0 && ad !== 0) {
      dirTotal++;
      if (pd === ad) dirHits++;
    }
  }

  const hitRate = dirTotal >= 10 ? (dirHits / dirTotal) * 100 : 50;
  const confidence = parseFloat(Math.max(40, Math.min(85, hitRate)).toFixed(1));

  const forecast30: number[] = [];
  let curr = latestPrice;
  const baseDrift = clampDrift(SHRINK * recentMeanRet(n - 1));
  const scoreTilt = (score / 100) * 0.0008;
  for (let day = 1; day <= 30; day++) {
    const pull = latestBar.sma50 ? ((latestBar.sma50 - curr) / curr) * 0.01 : 0;
    curr = curr * Math.exp(baseDrift + scoreTilt + pull);
    forecast30.push(parseFloat(curr.toFixed(2)));
  }

  const forecastNextDay = forecast30[0];
  const forecast7d = forecast30.slice(0, 7);

  return {
    symbol: info.symbol,
    displaySymbol: info.displaySymbol,
    market,
    currencySymbol: info.currencySymbol,
    currencyFmt: (val: number) => formatCurrencyValue(val, market),
    latestPrice,
    change,
    changePct,
    confidence,
    signal,
    score,
    reasons,
    risk,
    forecastNextDay,
    forecast7d,
    forecast30,
    trainLen,
    predictions,
    actual,
    df,
    info,
  };
}

export function generateAIMarketSummary(res: AnalysisResult): string {
  const fmt = typeof res.currencyFmt === 'function' ? res.currencyFmt : (n: number) => formatCurrencyValue(n, res.market);
  const direction = res.changePct >= 0 ? 'gained' : 'fallen';
  const trendWord = res.signal === 'BUY' ? 'bullish' : res.signal === 'SELL' ? 'bearish' : 'mixed/consolidation';
  const weekDiff = res.forecast7d[res.forecast7d.length - 1] - res.latestPrice;
  const weekDir = weekDiff >= 0 ? 'higher' : 'lower';
  const weekPct = ((weekDiff / res.latestPrice) * 100).toFixed(2);

  return [
    `**${res.displaySymbol}** has ${direction} ${Math.abs(res.changePct).toFixed(2)}% today and last traded at ${fmt(res.latestPrice)}.`,
    `The combined AI signal reading is **${trendWord}** (${res.signal}, score ${res.score > 0 ? '+' : ''}${res.score}/100) based on RSI momentum, MACD cross, and moving-average positioning.`,
    `Annualised volatility is ${res.risk.annual_volatility_pct}% (${res.risk.risk_label} risk profile), with a maximum historical drawdown of ${res.risk.max_drawdown_pct}%.`,
    `The 7-day multi-day price projection points **${weekDir}**, to approximately ${fmt(res.forecast7d[res.forecast7d.length - 1])} (${Number(weekPct) > 0 ? '+' : ''}${weekPct}% expected change) with a model confidence of ${res.confidence}%.`,
    `This summary is generated from rule-based quantitative indicators and a predictive statistical model — it is for educational and informational analysis only.`
  ].join('\n\n');
}
