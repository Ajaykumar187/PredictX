import { PriceBar, IndicatorData } from '../types';

export function calculateIndicators(bars: PriceBar[]): IndicatorData[] {
  const result: IndicatorData[] = bars.map(b => ({ ...b }));
  const n = bars.length;

  const calcSMA = (period: number) => {
    for (let i = 0; i < n; i++) {
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
        const avg = parseFloat((sum / period).toFixed(2));
        if (period === 20) result[i].sma20 = avg;
        if (period === 50) result[i].sma50 = avg;
        if (period === 100) result[i].sma100 = avg;
        if (period === 200) result[i].sma200 = avg;
      }
    }
  };
  calcSMA(20);
  calcSMA(50);
  calcSMA(100);
  calcSMA(200);

  const calcEMA = (period: number) => {
    const k = 2 / (period + 1);
    let ema = bars[0].close;
    for (let i = 0; i < n; i++) {
      ema = bars[i].close * k + ema * (1 - k);
      if (period === 20) result[i].ema20 = parseFloat(ema.toFixed(2));
      if (period === 50) result[i].ema50 = parseFloat(ema.toFixed(2));
    }
  };
  calcEMA(20);
  calcEMA(50);

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= 14 && i < n; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / 14;
  let avgLoss = losses / 14;

  for (let i = 14; i < n; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * 13 + currentGain) / 14;
    avgLoss = (avgLoss * 13 + currentLoss) / 14;

    if (avgLoss === 0) {
      result[i].rsi14 = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i].rsi14 = parseFloat((100 - (100 / (1 + rs))).toFixed(2));
    }
  }

  const k12 = 2 / (12 + 1);
  const k26 = 2 / (26 + 1);
  const k9 = 2 / (9 + 1);
  let ema12 = bars[0].close;
  let ema26 = bars[0].close;
  let macdSignal = 0;

  for (let i = 0; i < n; i++) {
    ema12 = bars[i].close * k12 + ema12 * (1 - k12);
    ema26 = bars[i].close * k26 + ema26 * (1 - k26);
    const macdVal = ema12 - ema26;
    result[i].macd = parseFloat(macdVal.toFixed(2));

    if (i >= 26) {
      if (i === 26) macdSignal = macdVal;
      else macdSignal = macdVal * k9 + macdSignal * (1 - k9);
      result[i].macdSignal = parseFloat(macdSignal.toFixed(2));
      result[i].macdHist = parseFloat((macdVal - macdSignal).toFixed(2));
    }
  }

  for (let i = 19; i < n; i++) {
    let sum = 0;
    for (let j = i - 19; j <= i; j++) sum += bars[j].close;
    const mean = sum / 20;
    let variance = 0;
    for (let j = i - 19; j <= i; j++) variance += Math.pow(bars[j].close - mean, 2);
    const stdDev = Math.sqrt(variance / 20);

    result[i].bbMiddle = parseFloat(mean.toFixed(2));
    result[i].bbUpper = parseFloat((mean + 2 * stdDev).toFixed(2));
    result[i].bbLower = parseFloat((mean - 2 * stdDev).toFixed(2));
  }

  for (let i = 1; i < n; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    if (i >= 14) {
      result[i].atr14 = parseFloat((tr * 0.1 + (result[i - 1]?.atr14 || tr) * 0.9).toFixed(2));
    } else {
      result[i].atr14 = parseFloat(tr.toFixed(2));
    }

    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = result[i].atr14 || tr;
    const upperBand = hl2 + 2.5 * atr;
    const lowerBand = hl2 - 2.5 * atr;

    if (bars[i].close > (result[i - 1]?.supertrend || upperBand)) {
      result[i].supertrend = parseFloat(lowerBand.toFixed(2));
      result[i].trendDir = 'up';
    } else {
      result[i].supertrend = parseFloat(upperBand.toFixed(2));
      result[i].trendDir = 'down';
    }
  }

  const windowHigh = Math.max(...bars.slice(-60).map(b => b.high));
  const windowLow = Math.min(...bars.slice(-60).map(b => b.low));
  const diff = windowHigh - windowLow;

  const fib0 = windowLow;
  const fib236 = windowLow + 0.236 * diff;
  const fib382 = windowLow + 0.382 * diff;
  const fib500 = windowLow + 0.500 * diff;
  const fib618 = windowLow + 0.618 * diff;
  const fib786 = windowLow + 0.786 * diff;
  const fib100 = windowHigh;

  for (let i = 0; i < n; i++) {
    result[i].fib0 = parseFloat(fib0.toFixed(2));
    result[i].fib236 = parseFloat(fib236.toFixed(2));
    result[i].fib382 = parseFloat(fib382.toFixed(2));
    result[i].fib500 = parseFloat(fib500.toFixed(2));
    result[i].fib618 = parseFloat(fib618.toFixed(2));
    result[i].fib786 = parseFloat(fib786.toFixed(2));
    result[i].fib100 = parseFloat(fib100.toFixed(2));

    const prevBar = i > 0 ? bars[i - 1] : bars[0];
    const pivot = (prevBar.high + prevBar.low + prevBar.close) / 3;
    result[i].pivotP = parseFloat(pivot.toFixed(2));
    result[i].pivotR1 = parseFloat((2 * pivot - prevBar.low).toFixed(2));
    result[i].pivotR2 = parseFloat((pivot + (prevBar.high - prevBar.low)).toFixed(2));
    result[i].pivotS1 = parseFloat((2 * pivot - prevBar.high).toFixed(2));
    result[i].pivotS2 = parseFloat((pivot - (prevBar.high - prevBar.low)).toFixed(2));
  }

  return result;
}
