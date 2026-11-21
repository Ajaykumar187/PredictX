function normCDF(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

function normPDF(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface OptionGreeks {
  callPrice: number;
  putPrice: number;
  callDelta: number;
  putDelta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export function calculateBlackScholes(
  spot: number,
  strike: number,
  timeToExpiryYears: number,
  riskFreeRate: number = 0.07,
  volatility: number = 0.16
): OptionGreeks {
  const S = spot;
  const K = strike;
  const T = Math.max(0.001, timeToExpiryYears);
  const r = riskFreeRate;
  const sigma = Math.max(0.01, volatility);

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callPrice = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  const putPrice = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);

  const callDelta = normCDF(d1);
  const putDelta = callDelta - 1;

  const gamma = normPDF(d1) / (S * sigma * Math.sqrt(T));
  const theta = (-(S * normPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normCDF(d2)) / 365;
  const vega = (S * normPDF(d1) * Math.sqrt(T)) / 100;

  return {
    callPrice: Math.max(0.05, Math.round(callPrice * 100) / 100),
    putPrice: Math.max(0.05, Math.round(putPrice * 100) / 100),
    callDelta: Math.round(callDelta * 1000) / 1000,
    putDelta: Math.round(putDelta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

export interface OptionChainRow {
  strike: number;
  callOI: number;
  callChangeOI: number;
  callChangeOIPct?: number;
  callVol: number;
  callLTP: number;
  callLTPChange?: number;
  callLTPChangePct?: number;
  callIV: number;
  callDelta: number;
  callTheta: number;
  putLTP: number;
  putLTPChange?: number;
  putLTPChangePct?: number;
  putIV: number;
  putDelta: number;
  putTheta: number;
  putVol: number;
  putOI: number;
  putChangeOI: number;
  putChangeOIPct?: number;
  isATM: boolean;
  callToken?: string;
  putToken?: string;
}

export function generateOptionChain(spotPrice: number, indexName: string, numStrikesEachSide: number = 10): {
  chain: OptionChainRow[];
  atmStrike: number;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallChangeOI: number;
  totalPutChangeOI: number;
  maxPain: number;
  aiSignal: { signal: 'BUY CALL' | 'BUY PUT' | 'WATCH' | 'NO TRADE'; confidence: number; reason: string };
} {
  const step = indexName === 'BANKNIFTY' ? 100 : 50;
  const atmStrike = Math.round(spotPrice / step) * step;

  const strikes: number[] = [];
  for (let s = atmStrike - step * numStrikesEachSide; s <= atmStrike + step * numStrikesEachSide; s += step) {
    strikes.push(s);
  }

  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallChangeOI = 0;
  let totalPutChangeOI = 0;

  const chain: OptionChainRow[] = strikes.map((strike) => {
    const isATM = strike === atmStrike;
    const distance = Math.abs(strike - atmStrike) / step;
    const greeks = calculateBlackScholes(spotPrice, strike, 5 / 365, 0.07, 0.15 + distance * 0.005);

    const callOI = Math.round(25000 * Math.exp(-distance * 0.3) + (strike > spotPrice ? 8000 : 2000));
    const putOI = Math.round(25000 * Math.exp(-distance * 0.3) + (strike < spotPrice ? 8500 : 2500));

    const callBiasFactor = strike >= spotPrice ? 0.28 : -0.12;
    const putBiasFactor = strike <= spotPrice ? 0.32 : -0.09;
    const callChangeOI = Math.round(callOI * (callBiasFactor + Math.sin(strike * 0.01) * 0.08));
    const putChangeOI = Math.round(putOI * (putBiasFactor + Math.cos(strike * 0.01) * 0.08));

    totalCallOI += callOI;
    totalPutOI += putOI;
    totalCallChangeOI += callChangeOI;
    totalPutChangeOI += putChangeOI;

    const isCallITM = strike < spotPrice;
    const isPutITM = strike > spotPrice;

    const callLTPChange = isCallITM ? Number((greeks.callPrice * 0.45).toFixed(2)) : -Number((greeks.callPrice * 0.85).toFixed(2));
    const callLTPChangePct = isCallITM ? Number((180 + distance * 45).toFixed(2)) : -Number((80 + Math.min(19, distance * 5)).toFixed(2));
    const callChangeOIPct = Math.round((callChangeOI / Math.max(1, callOI)) * 100);

    const putLTPChange = isPutITM ? Number((greeks.putPrice * 0.40).toFixed(2)) : -Number((greeks.putPrice * 0.85).toFixed(2));
    const putLTPChangePct = isPutITM ? Number((150 + distance * 40).toFixed(2)) : -Number((85 + Math.min(14, distance * 4)).toFixed(2));
    const putChangeOIPct = Math.round((putChangeOI / Math.max(1, putOI)) * 100);

    return {
      strike,
      callOI,
      callChangeOI,
      callChangeOIPct,
      callVol: Math.round(callOI * 1.4),
      callLTP: greeks.callPrice,
      callLTPChange,
      callLTPChangePct,
      callIV: Math.round((0.14 + distance * 0.008) * 1000) / 10,
      callDelta: greeks.callDelta,
      callTheta: greeks.theta,
      putLTP: greeks.putPrice,
      putLTPChange,
      putLTPChangePct,
      putIV: Math.round((0.15 + distance * 0.008) * 1000) / 10,
      putDelta: greeks.putDelta,
      putTheta: greeks.theta,
      putVol: Math.round(putOI * 1.3),
      putOI,
      putChangeOI,
      putChangeOIPct,
      isATM,
    };
  });

  const pcr = totalCallOI > 0 ? Math.round((totalPutOI / totalCallOI) * 100) / 100 : 1;

  let signal: 'BUY CALL' | 'BUY PUT' | 'WATCH' | 'NO TRADE' = 'WATCH';
  let reason = '';
  let confidence = 72;

  if (pcr > 1.25) {
    signal = 'BUY CALL';
    confidence = 84;
    reason = `PCR is bullish at ${pcr} with aggressive Put writing at strikes below ATM, showing strong institutional floor support.`;
  } else if (pcr < 0.8) {
    signal = 'BUY PUT';
    confidence = 81;
    reason = `PCR is bearish at ${pcr} with heavy Call writing overhead at ATM and near-OTM strikes.`;
  } else if (pcr >= 0.95 && pcr <= 1.15) {
    signal = 'WATCH';
    confidence = 68;
    reason = `PCR is balanced at ${pcr}. Market in rangebound mode — wait for breakout above ${atmStrike + step} or below ${atmStrike - step}.`;
  } else {
    signal = 'NO TRADE';
    confidence = 60;
    reason = `High IV skew and chop around ATM strike ${atmStrike}. Favorable risk-reward absent.`;
  }

  return {
    chain,
    atmStrike,
    pcr,
    totalCallOI,
    totalPutOI,
    totalCallChangeOI,
    totalPutChangeOI,
    maxPain: atmStrike,
    aiSignal: { signal, confidence, reason },
  };
}
