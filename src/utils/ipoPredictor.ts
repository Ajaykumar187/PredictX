import { ModelReport, trainReport, predictGain } from './ipoModel';

export interface IPORatingParams {
  companyName?: string;
  priceBandLow?: number;
  priceBandHigh?: number;
  issueSizeCr?: number;
  lotSize?: number;
  overallSubX?: number;
  qibSubX?: number;
  gmpPercent?: number;
  sectorMomentum?: 'Neutral' | 'Hot' | 'Weak';
  model?: ModelReport;
}

export interface IPORatingResult {
  recommendation: 'APPLY (STRONG)' | 'APPLY (MODERATE)' | 'AVOID' | 'MAYBE / HIGH RISK';
  score: number;
  maxScore: number;
  confidencePct: number;
  estimatedListingGainPct: number;
  gainLowPct: number;
  gainHighPct: number;
  reasons: string[];
}

export function calculateIPOScore(params: IPORatingParams): IPORatingResult {
  let score = 0;
  let maxScore = 0;
  const reasons: string[] = [];

  const gmp = params.gmpPercent ?? 0;
  maxScore += 4;
  if (gmp >= 35) {
    score += 4;
    reasons.push(`Grey Market Premium (GMP) is ${gmp.toFixed(1)}% — exceptional grey market listing appetite.`);
  } else if (gmp >= 15) {
    score += 3;
    reasons.push(`GMP is ${gmp.toFixed(1)}% — healthy double-digit listing premium expectation.`);
  } else if (gmp > 0) {
    score += 1;
    reasons.push(`GMP is ${gmp.toFixed(1)}% — modest positive premium, monitor market sentiment.`);
  } else if (gmp === 0) {
    reasons.push('GMP is at par (0%) — market is pricing this with no premium.');
  } else {
    score -= 3;
    reasons.push(`Negative GMP (${gmp.toFixed(1)}%) — grey market signals discount on listing.`);
  }

  const sub = params.overallSubX ?? 0;
  if (sub > 0) {
    maxScore += 3;
    if (sub >= 40) {
      score += 3;
      reasons.push(`Overall subscription is ${sub}x — massive retail and HNI oversubscription.`);
    } else if (sub >= 10) {
      score += 2;
      reasons.push(`Overall subscription is ${sub}x — healthy demand across investor categories.`);
    } else if (sub >= 1.5) {
      score += 1;
      reasons.push(`Overall subscription is ${sub}x — fully subscribed.`);
    } else {
      score -= 2;
      reasons.push(`Overall subscription is only ${sub}x — weak subscription poses listing risk.`);
    }
  }

  const qib = params.qibSubX ?? 0;
  if (qib > 0) {
    maxScore += 3;
    if (qib >= 25) {
      score += 3;
      reasons.push(`Institutional (QIB) demand is ${qib}x — top mutual funds and foreign institutions are aggressive.`);
    } else if (qib >= 5) {
      score += 2;
      reasons.push(`Institutional (QIB) demand is ${qib}x — good institutional backing.`);
    } else {
      score -= 1;
      reasons.push(`QIB subscription is muted (${qib}x) — institutional caution.`);
    }
  }

  const sector = params.sectorMomentum || 'Neutral';
  maxScore += 2;
  if (sector === 'Hot') {
    score += 2;
    reasons.push('Sector momentum is favorable with industry tailwinds attracting capital inflows.');
  } else if (sector === 'Weak') {
    score -= 1;
    reasons.push('Sector momentum is currently facing headwinds or regulatory scrutiny.');
  } else {
    score += 1;
    reasons.push('Sector sentiment is neutral.');
  }

  if (params.issueSizeCr) {
    if (params.issueSizeCr > 10000) {
      reasons.push(`Mega issue size (₹${params.issueSizeCr} Cr) — large supply may cap first-day listing pop.`);
    } else if (params.issueSizeCr < 500) {
      reasons.push(`Compact issue size (₹${params.issueSizeCr} Cr) — high chance of scarcity-driven listing spike if subscribed.`);
    }
  }

  const normalized = maxScore > 0 ? (score / maxScore) : 0;
  let recommendation: 'APPLY (STRONG)' | 'APPLY (MODERATE)' | 'AVOID' | 'MAYBE / HIGH RISK' = 'AVOID';
  if (normalized >= 0.7) recommendation = 'APPLY (STRONG)';
  else if (normalized >= 0.45) recommendation = 'APPLY (MODERATE)';
  else if (normalized >= 0.2) recommendation = 'MAYBE / HIGH RISK';
  else recommendation = 'AVOID';

  const model = params.model ?? trainReport([]);
  const confidencePct = Math.round(Math.min(92, Math.max(45, 50 + normalized * 40 - (model.n === 0 ? 5 : 0))));
  const pred = predictGain(
    { gmpPct: gmp, subX: sub, qibX: qib, issueSizeCr: params.issueSizeCr, hot: params.sectorMomentum === 'Hot', weak: params.sectorMomentum === 'Weak' } as any,
    model
  );
  const estimatedListingGainPct = Math.round(pred.gain);
  if (pred.gain < 0 && recommendation.startsWith('APPLY')) recommendation = 'MAYBE / HIGH RISK';
  if (pred.gain >= 15 && recommendation === 'AVOID') recommendation = 'MAYBE / HIGH RISK';
  reasons.push(`Model estimate: ${pred.gain >= 0 ? '+' : ''}${pred.gain.toFixed(1)}% listing (range ${pred.low.toFixed(0)}% to ${pred.high.toFixed(0)}%)${model.trained ? ` — trained on ${model.n} recorded IPOs` : ' — default prior, no training data yet'}.`);

  return {
    recommendation,
    score,
    maxScore,
    confidencePct,
    estimatedListingGainPct,
    gainLowPct: Math.round(pred.low),
    gainHighPct: Math.round(pred.high),
    reasons,
  };
}
