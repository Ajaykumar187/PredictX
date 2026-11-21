import { AnalysisResult } from '../types';

export interface PriceLevelItem {
  label: string;
  price: number;
  distancePct: number;
  basis: string;
}

export interface YearProjection {
  years: 1 | 3 | 5;
  label: string;
  conservativeCagr: number;
  baseCagr: number;
  optimisticCagr: number;
  conservativePrice: number;
  basePrice: number;
  optimisticPrice: number;
  conservativeReturnPct: number;
  baseReturnPct: number;
  optimisticReturnPct: number;
}

export type ExpertVerdict =
  | 'STRONG BUY'
  | 'BUY / ACCUMULATE'
  | 'HOLD / WAIT'
  | 'BOOK PROFIT / TRIM'
  | 'SELL / AVOID';

export interface ExpertAdviceReport {
  symbol: string;
  companyName: string;
  currentPrice: number;
  currencySymbol: string;
  verdict: ExpertVerdict;
  convictionLabel: string;
  suitabilityHorizon: string;
  horizonSummary: string;
  supports: PriceLevelItem[];
  resistances: PriceLevelItem[];
  classicPivot: number;
  technicalBaselines: {
    ema20: number | null;
    sma50: number | null;
    sma200: number | null;
    rsi14: number;
    atr14: number;
    fiftyTwoWeekLow: number;
    fiftyTwoWeekHigh: number;
  };
  buyZone: {
    low: number;
    high: number;
    note: string;
  };
  breakoutBuyTrigger: number;
  stopLoss: number;
  stopLossRiskPct: number;
  sellTrigger: number;
  profitBookZone: {
    low: number;
    high: number;
  };
  targets: {
    shortTerm: { price: number; pct: number; timeframe: string };
    mediumTerm: { price: number; pct: number; timeframe: string };
    positional: { price: number; pct: number; timeframe: string };
  };
  riskRewardRatio: string;
  projections: YearProjection[];
  rationale: string[];
  disclaimer: string;
}

const r2 = (n: number): number => Number(n.toFixed(2));
const pctDiff = (target: number, base: number): number =>
  base > 0 ? Number((((target - base) / base) * 100).toFixed(2)) : 0;

function pickDistinctLevels(
  candidates: Array<{ price: number | undefined; basis: string }>,
  cmp: number,
  direction: 'below' | 'above',
  atr: number
): Array<{ price: number; basis: string }> {
  const minGap = Math.max(cmp * 0.012, atr * 0.65);
  const valid = candidates
    .filter((c): c is { price: number; basis: string } => {
      if (typeof c.price !== 'number' || !Number.isFinite(c.price) || c.price <= 0) return false;
      return direction === 'below' ? c.price < cmp * 0.994 : c.price > cmp * 1.006;
    })
    .sort((a, b) => (direction === 'below' ? b.price - a.price : a.price - b.price));

  const picked: Array<{ price: number; basis: string }> = [];
  for (const item of valid) {
    const tooClose = picked.some((p) => Math.abs(p.price - item.price) < minGap);
    if (!tooClose) {
      picked.push({ price: r2(item.price), basis: item.basis });
    }
    if (picked.length === 3) break;
  }

  const fallbackSteps = [1.5, 3.2, 5.2];
  let idx = 0;
  while (picked.length < 3 && idx < fallbackSteps.length) {
    const step = Math.max(atr * fallbackSteps[idx], cmp * (0.03 * (idx + 1)));
    const candidate = direction === 'below' ? Math.max(cmp * 0.5, cmp - step) : cmp + step;
    const adjusted =
      picked.length > 0
        ? direction === 'below'
          ? Math.min(candidate, picked[picked.length - 1].price - minGap)
          : Math.max(candidate, picked[picked.length - 1].price + minGap)
        : candidate;
    picked.push({
      price: r2(Math.max(0.01, adjusted)),
      basis: direction === 'below' ? 'ATR Volatility Support' : 'ATR Projected Extension',
    });
    idx++;
  }

  return picked;
}

export function generateExpertAdvice(data: AnalysisResult): ExpertAdviceReport {
  const df = data.df || [];
  const last = df[df.length - 1] || ({} as any);
  const cmp = data.latestPrice || last.close || 100;
  const atr = last.atr14 && last.atr14 > 0 ? last.atr14 : cmp * 0.022;
  const rsi = typeof last.rsi14 === 'number' ? last.rsi14 : 50;

  const recent20 = df.slice(-20);
  const recent60 = df.slice(-60);
  const high20 = recent20.length ? Math.max(...recent20.map((b) => b.high)) : cmp * 1.04;
  const low20 = recent20.length ? Math.min(...recent20.map((b) => b.low)) : cmp * 0.96;
  const high60 = recent60.length ? Math.max(...recent60.map((b) => b.high)) : cmp * 1.08;
  const low60 = recent60.length ? Math.min(...recent60.map((b) => b.low)) : cmp * 0.92;
  const high52 = data.info?.fiftyTwoWeekHigh && data.info.fiftyTwoWeekHigh > 0 ? data.info.fiftyTwoWeekHigh : high60;
  const low52 = data.info?.fiftyTwoWeekLow && data.info.fiftyTwoWeekLow > 0 ? data.info.fiftyTwoWeekLow : low60;

  const classicPivot = r2(last.pivotP || (high20 + low20 + cmp) / 3);

  const supportRaw = pickDistinctLevels(
    [
      { price: last.pivotS1, basis: 'Pivot S1' },
      { price: last.ema20, basis: '20-Day EMA' },
      { price: last.sma50, basis: '50-Day SMA' },
      { price: low20, basis: '20-Day Swing Low' },
      { price: last.fib618, basis: 'Fib 0.618 Retracement' },
      { price: last.pivotS2, basis: 'Pivot S2' },
      { price: last.bbLower, basis: 'Lower Bollinger Band' },
      { price: last.fib382, basis: 'Fib 0.382 Level' },
      { price: last.sma200, basis: '200-Day SMA' },
      { price: low60, basis: '60-Day Structural Low' },
      { price: low52, basis: '52-Week Low' },
    ],
    cmp,
    'below',
    atr
  );

  const resistanceRaw = pickDistinctLevels(
    [
      { price: last.pivotR1, basis: 'Pivot R1' },
      { price: high20, basis: '20-Day Swing High' },
      { price: last.bbUpper, basis: 'Upper Bollinger Band' },
      { price: last.pivotR2, basis: 'Pivot R2' },
      { price: high60, basis: '60-Day High' },
      { price: high52, basis: '52-Week High' },
      { price: cmp + atr * 4.5, basis: 'Extended Resistance' },
    ],
    cmp,
    'above',
    atr
  );

  const supports: PriceLevelItem[] = supportRaw.map((s, idx) => ({
    label: `Support S${idx + 1}`,
    price: s.price,
    distancePct: pctDiff(s.price, cmp),
    basis: s.basis,
  }));

  const resistances: PriceLevelItem[] = resistanceRaw.map((r, idx) => ({
    label: `Resistance R${idx + 1}`,
    price: r.price,
    distancePct: pctDiff(r.price, cmp),
    basis: r.basis,
  }));

  const s1 = supports[0].price;
  const s2 = supports[1].price;
  const r1 = resistances[0].price;
  const res2 = resistances[1].price;
  const res3 = resistances[2].price;

  let verdict: ExpertVerdict = 'HOLD / WAIT';
  if (data.score >= 45 && rsi < 74) {
    verdict = 'STRONG BUY';
  } else if (data.score >= 15 || (data.signal === 'BUY' && rsi < 70)) {
    verdict = 'BUY / ACCUMULATE';
  } else if (data.score <= -40 || (data.signal === 'SELL' && rsi < 45)) {
    verdict = 'SELL / AVOID';
  } else if (rsi >= 75 || data.score <= -15) {
    verdict = 'BOOK PROFIT / TRIM';
  }

  const convictionLabel =
    Math.abs(data.score) >= 50
      ? 'High Conviction'
      : Math.abs(data.score) >= 20
      ? 'Moderate Conviction'
      : 'Neutral / Balanced';

  const nearSupport = (cmp - s1) / cmp < 0.025;
  const buyLow = r2(Math.max(s2, nearSupport ? s1 * 0.992 : s1));
  const buyHigh = r2(Math.min(cmp * 1.002, Math.max(buyLow * 1.01, (s1 + cmp) / 2)));
  const breakoutBuyTrigger = r2(r1 * 1.004);

  const rawSl = Math.min(s1 - atr * 0.55, cmp * 0.965);
  const clampedSl = Math.max(cmp * 0.88, Math.min(cmp * 0.975, rawSl));
  const stopLoss = r2(clampedSl);
  const stopLossRiskPct = Math.abs(pctDiff(stopLoss, cmp));

  const sellTrigger = r2(Math.min(s1 * 0.99, stopLoss));
  const profitBookZone = {
    low: r1,
    high: res2,
  };

  const entryAnchor = (buyLow + buyHigh) / 2;
  const riskPerShare = Math.max(0.01, entryAnchor - stopLoss);
  const rewardPerShare = Math.max(0.01, res2 - entryAnchor);
  const rr = Math.max(0.5, Math.min(6, rewardPerShare / riskPerShare));
  const riskRewardRatio = `1 : ${rr.toFixed(1)}`;

  const firstClose = df[0]?.close || cmp;
  const spanDays = Math.max(30, df.length * 1.42); 
  const rawHistAnn = firstClose > 0 ? Math.pow(cmp / firstClose, 365 / spanDays) - 1 : 0.1;
  const marketPrior = data.market === 'US' ? 0.1 : 0.12;
  const clampedHist = Math.max(-0.2, Math.min(0.42, rawHistAnn));
  const scoreAdj = (data.score / 100) * 0.045;
  const volDrag = Math.min(0.04, ((data.risk?.annual_volatility_pct || 22) - 18) * 0.0012);
  const pe = data.info?.trailingPE || 0;
  const valuationAdj = pe > 65 ? -0.02 : pe > 0 && pe < 20 ? 0.015 : 0;

  const baseCagrDec = Math.max(
    0.04,
    Math.min(0.26, 0.58 * marketPrior + 0.42 * clampedHist + scoreAdj + valuationAdj - Math.max(0, volDrag))
  );
  const spread = Math.max(0.035, Math.min(0.09, ((data.risk?.annual_volatility_pct || 22) / 100) * 0.25));

  const buildYearProjection = (years: 1 | 3 | 5, label: string): YearProjection => {
    const horizonDamp = years === 1 ? 1 : years === 3 ? 0.94 : 0.88;
    const baseCagr = baseCagrDec * horizonDamp + (1 - horizonDamp) * marketPrior;
    const consCagr = Math.max(-0.08, baseCagr - spread * (years === 1 ? 1.1 : 0.85));
    const optCagr = Math.min(0.34, baseCagr + spread * (years === 1 ? 1.15 : 0.9));

    const consPrice = r2(cmp * Math.pow(1 + consCagr, years));
    const basePrice = r2(cmp * Math.pow(1 + baseCagr, years));
    const optPrice = r2(cmp * Math.pow(1 + optCagr, years));

    return {
      years,
      label,
      conservativeCagr: Number((consCagr * 100).toFixed(1)),
      baseCagr: Number((baseCagr * 100).toFixed(1)),
      optimisticCagr: Number((optCagr * 100).toFixed(1)),
      conservativePrice: consPrice,
      basePrice,
      optimisticPrice: optPrice,
      conservativeReturnPct: pctDiff(consPrice, cmp),
      baseReturnPct: pctDiff(basePrice, cmp),
      optimisticReturnPct: pctDiff(optPrice, cmp),
    };
  };

  const projections: YearProjection[] = [
    buildYearProjection(1, '1 Year Outlook'),
    buildYearProjection(3, '3 Years Medium-Long'),
    buildYearProjection(5, '5 Years Compounding'),
  ];

  let suitabilityHorizon = 'Medium-Term Positional (1–3 Years)';
  let horizonSummary =
    'Balanced momentum and moderate volatility suit phased accumulation for a 1 to 3 year holding horizon.';

  if (data.risk?.risk_label === 'High' && rsi > 62) {
    suitabilityHorizon = 'Short-Term Swing / Tactical (1–3 Months)';
    horizonSummary =
      'Elevated volatility and active momentum favor disciplined swing trades with strict stop-loss trailing rather than aggressive chasing.';
  } else if (data.score >= 30 && data.risk?.risk_label !== 'High') {
    suitabilityHorizon = 'Long-Term Wealth Compounding (3–5 Years)';
    horizonSummary =
      'Healthy trend structure and controlled volatility support multi-year compounding across a 3 to 5 year horizon.';
  } else if (data.score < -15) {
    suitabilityHorizon = 'Wait for Stabilization (Avoid Fresh Longs)';
    horizonSummary =
      'Bearish pressure dominates near-term action. Wait for price to reclaim immediate resistance or stabilize near S2 support before committing capital.';
  }

  const rationale: string[] = [
    `Price stands at ${data.currencySymbol}${cmp.toLocaleString()} with a composite AI score of ${data.score > 0 ? '+' : ''}${data.score}/100 and RSI(14) at ${rsi.toFixed(1)}.`,
    `Immediate demand support lies at S1 (${data.currencySymbol}${s1.toLocaleString()}, ${supports[0].basis}), with deeper structural support near S2 (${data.currencySymbol}${s2.toLocaleString()}).`,
    `Overhead supply sits at R1 (${data.currencySymbol}${r1.toLocaleString()}, ${resistances[0].basis}); a sustained close above R1 opens upside toward R2 (${data.currencySymbol}${res2.toLocaleString()}).`,
    `With annualized volatility of ${data.risk?.annual_volatility_pct ?? 22}% (${data.risk?.risk_label ?? 'Moderate'} Risk), projected base-case compounding estimates ${projections[2].baseCagr}% CAGR over 5 years.`,
  ];

  return {
    symbol: data.displaySymbol,
    companyName: data.info?.longName || data.displaySymbol,
    currentPrice: cmp,
    currencySymbol: data.currencySymbol,
    verdict,
    convictionLabel,
    suitabilityHorizon,
    horizonSummary,
    supports,
    resistances,
    classicPivot,
    technicalBaselines: {
      ema20: typeof last.ema20 === 'number' ? r2(last.ema20) : null,
      sma50: typeof last.sma50 === 'number' ? r2(last.sma50) : null,
      sma200: typeof last.sma200 === 'number' ? r2(last.sma200) : null,
      rsi14: Number(rsi.toFixed(1)),
      atr14: r2(atr),
      fiftyTwoWeekLow: r2(low52),
      fiftyTwoWeekHigh: r2(high52),
    },
    buyZone: {
      low: buyLow,
      high: buyHigh,
      note: nearSupport
        ? 'Currently trading close to immediate support — suitable for staggered accumulation.'
        : 'Prefer buying on pullbacks toward the support zone rather than chasing spikes.',
    },
    breakoutBuyTrigger,
    stopLoss,
    stopLossRiskPct,
    sellTrigger,
    profitBookZone,
    targets: {
      shortTerm: { price: r1, pct: pctDiff(r1, cmp), timeframe: '2–6 Weeks' },
      mediumTerm: { price: res2, pct: pctDiff(res2, cmp), timeframe: '2–4 Months' },
      positional: { price: res3, pct: pctDiff(res3, cmp), timeframe: '6–12 Months' },
    },
    riskRewardRatio,
    projections,
    rationale,
    disclaimer:
      'Support, resistance, buy/sell levels, and multi-year return projections are statistical estimates derived from historical price action, volatility, and technical indicators for educational purposes — not SEBI-registered investment advice.',
  };
}
