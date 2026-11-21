export interface EmiResult {
  emi: number;
  totalPayment: number;
  totalInterest: number;
}

export function calculateEMI(principal: number, annualRatePct: number, tenureMonths: number): EmiResult {
  if (!(principal > 0) || !(tenureMonths > 0)) {
    return { emi: 0, totalPayment: 0, totalInterest: 0 };
  }
  const r = Math.max(0, annualRatePct) / 12 / 100;
  let emi = 0;
  if (r === 0) {
    emi = principal / tenureMonths;
  } else {
    emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  }
  const totalPayment = emi * tenureMonths;
  const totalInterest = totalPayment - principal;
  return {
    emi: Number.isFinite(emi) ? Math.round(emi * 100) / 100 : 0,
    totalPayment: Number.isFinite(totalPayment) ? Math.round(totalPayment * 100) / 100 : 0,
    totalInterest: Number.isFinite(totalInterest) ? Math.round(totalInterest * 100) / 100 : 0,
  };
}

export function calculateCAGR(beginValue: number, endValue: number, years: number): number {
  if (beginValue <= 0 || years <= 0) return 0;
  const cagr = (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;
  return Math.round(cagr * 100) / 100;
}

export function calculateXIRR(cashflows: Array<{ date: string; amount: number }>): number {
  if (cashflows.length < 2) return 0;
  const dates = cashflows.map(c => new Date(c.date).getTime());
  const amounts = cashflows.map(c => c.amount);
  const t0 = Math.min(...dates);
  const years = dates.map(d => (d - t0) / (365.25 * 24 * 3600 * 1000));

  const npv = (rate: number) => {
    return amounts.reduce((acc, a, idx) => acc + a / Math.pow(1 + rate, years[idx]), 0);
  };
  const npvDeriv = (rate: number) => {
    return amounts.reduce((acc, a, idx) => acc - (years[idx] * a) / Math.pow(1 + rate, years[idx] + 1), 0);
  };

  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(rate);
    const df = npvDeriv(rate);
    if (Math.abs(df) < 1e-10) break;
    const next = rate - f / df;
    if (Math.abs(next - rate) < 1e-6) {
      rate = next;
      break;
    }
    rate = next;
  }

  if (!Number.isFinite(rate)) return 0;
  return Math.round(rate * 10000) / 100;
}

export interface BrokerageResult {
  turnover: number;
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  totalCharges: number;
  grossPnL: number;
  netPnL: number;
}

export function calculateBrokerage(buyPrice: number, sellPrice: number, qty: number): BrokerageResult {
  if (!(qty > 0) || (!(buyPrice > 0) && !(sellPrice > 0))) {
    return {
      turnover: 0,
      brokerage: 0,
      stt: 0,
      exchangeCharges: 0,
      gst: 0,
      sebiCharges: 0,
      stampDuty: 0,
      totalCharges: 0,
      grossPnL: 0,
      netPnL: 0,
    };
  }
  const buyVal = Math.max(0, buyPrice) * qty;
  const sellVal = Math.max(0, sellPrice) * qty;
  const turnover = buyVal + sellVal;

  const brokerage = 40; // ₹20 per executed order (buy + sell flat discount rate)
  const stt = Math.round(sellVal * 0.001); // 0.1% on delivery sell
  const exchangeCharges = Math.round(turnover * 0.0000345 * 100) / 100;
  const sebiCharges = Math.round(turnover * 0.000001 * 100) / 100;
  const gst = Math.round((brokerage + exchangeCharges + sebiCharges) * 0.18 * 100) / 100;
  const stampDuty = Math.round(buyVal * 0.00015 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + exchangeCharges + gst + sebiCharges + stampDuty) * 100) / 100;
  const grossPnL = Math.round((sellVal - buyVal) * 100) / 100;
  const netPnL = Math.round((grossPnL - totalCharges) * 100) / 100;

  return {
    turnover: Math.round(turnover * 100) / 100,
    brokerage,
    stt,
    exchangeCharges,
    gst,
    sebiCharges,
    stampDuty,
    totalCharges,
    grossPnL,
    netPnL,
  };
}

export interface TaxResult {
  holdingPeriodDays: number;
  isLTCG: boolean;
  gain: number;
  taxableGain: number;
  taxRatePct: number;
  taxPayable: number;
}

export function calculateCapitalGainsTax(
  buyPrice: number,
  sellPrice: number,
  qty: number,
  holdingDays: number
): TaxResult {
  const gain = (sellPrice - buyPrice) * qty;
  const isLTCG = holdingDays > 365;

  let taxRatePct = 20;
  let taxableGain = Math.max(0, gain);
  let taxPayable = 0;

  if (isLTCG) {
    taxRatePct = 12.5;
    const exemption = 125000;
    taxableGain = Math.max(0, gain - exemption);
    taxPayable = taxableGain * (taxRatePct / 100);
  } else {
    taxPayable = taxableGain * (taxRatePct / 100);
  }

  return {
    holdingPeriodDays: holdingDays,
    isLTCG,
    gain: Math.round(gain * 100) / 100,
    taxableGain: Math.round(taxableGain * 100) / 100,
    taxRatePct,
    taxPayable: Math.round(taxPayable * 100) / 100,
  };
}

export function calculateRetirementCorpus(
  currentAge: number,
  retireAge: number,
  monthlyExpenses: number,
  inflationPct: number = 6,
  postRetireReturnPct: number = 8,
  lifeExpectancy: number = 85
) {
  const yearsToRetire = retireAge - currentAge;
  const retireYears = lifeExpectancy - retireAge;
  if (!(monthlyExpenses > 0) || !(yearsToRetire > 0) || !(retireYears > 0)) {
    return {
      futureMonthlyExp: 0,
      corpusRequired: 0,
      sipNeeded: 0,
      yearsToRetire: Math.max(0, yearsToRetire),
    };
  }

  const futureMonthlyExp = monthlyExpenses * Math.pow(1 + inflationPct / 100, yearsToRetire);
  const futureAnnualExp = futureMonthlyExp * 12;

  const realRate = (postRetireReturnPct - inflationPct) / (1 + inflationPct / 100) / 100;
  const corpusRequired = (futureAnnualExp * (1 - Math.pow(1 + realRate, -retireYears))) / realRate;

  const rMonth = 12 / 12 / 100;
  const months = yearsToRetire * 12;
  const sipNeeded = (corpusRequired * rMonth) / (Math.pow(1 + rMonth, months) - 1);

  return {
    futureMonthlyExp: Number.isFinite(futureMonthlyExp) ? Math.round(futureMonthlyExp) : 0,
    corpusRequired: Number.isFinite(corpusRequired) ? Math.round(corpusRequired) : 0,
    sipNeeded: Number.isFinite(sipNeeded) ? Math.round(sipNeeded) : 0,
    yearsToRetire,
  };
}

export function calculateGoalSIP(targetAmount: number, years: number, expectedReturnPct: number = 12) {
  if (!(targetAmount > 0) || !(years > 0)) {
    return { monthlySip: 0, lumpSum: 0 };
  }
  const months = years * 12;
  const rMonth = Math.max(0, expectedReturnPct) / 12 / 100;
  const monthlySip =
    rMonth === 0
      ? targetAmount / months
      : (targetAmount * rMonth) / (Math.pow(1 + rMonth, months) - 1);
  const lumpSum =
    expectedReturnPct <= 0
      ? targetAmount
      : targetAmount / Math.pow(1 + expectedReturnPct / 100, years);

  return {
    monthlySip: Number.isFinite(monthlySip) ? Math.round(monthlySip) : 0,
    lumpSum: Number.isFinite(lumpSum) ? Math.round(lumpSum) : 0,
  };
}

export interface PositionSizeResult {
  valid: boolean;
  message?: string;
  riskAmount: number;
  perShareRisk: number;
  quantity: number;
  positionValue: number;
  capitalUsedPct: number;
  cappedByCapital: boolean;
  rewardRisk: number | null;
  potentialProfit: number | null;
}

export function calculatePositionSize(
  capital: number,
  riskPct: number,
  entry: number,
  stopLoss: number,
  target?: number
): PositionSizeResult {
  const empty = { riskAmount: 0, perShareRisk: 0, quantity: 0, positionValue: 0, capitalUsedPct: 0, cappedByCapital: false, rewardRisk: null, potentialProfit: null };
  if (!(capital > 0) || !(riskPct > 0) || !(entry > 0) || !(stopLoss > 0)) {
    return { valid: false, message: 'All values must be greater than 0.', ...empty };
  }
  const perShareRisk = Math.abs(entry - stopLoss);
  if (perShareRisk === 0) return { valid: false, message: 'Stop loss must differ from entry price.', ...empty };

  const riskAmount = (capital * riskPct) / 100;
  let quantity = Math.floor(riskAmount / perShareRisk);
  const maxByCapital = Math.floor(capital / entry);
  const cappedByCapital = quantity > maxByCapital;
  if (cappedByCapital) quantity = maxByCapital;

  const positionValue = quantity * entry;
  const isLong = stopLoss < entry;
  let rewardRisk: number | null = null;
  let potentialProfit: number | null = null;
  if (target && target > 0 && ((isLong && target > entry) || (!isLong && target < entry))) {
    const reward = Math.abs(target - entry);
    rewardRisk = Number((reward / perShareRisk).toFixed(2));
    potentialProfit = Math.round(reward * quantity);
  }
  return {
    valid: true,
    riskAmount: Math.round(quantity * perShareRisk),
    perShareRisk: Number(perShareRisk.toFixed(2)),
    quantity,
    positionValue: Math.round(positionValue),
    capitalUsedPct: Number(((positionValue / capital) * 100).toFixed(1)),
    cappedByCapital,
    rewardRisk,
    potentialProfit,
  };
}
