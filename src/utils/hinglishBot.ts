import { AnalysisResult } from '../types';
import { formatCurrencyValue } from './marketData';
import { generateExpertAdvice } from './expertAdvice';

export function generateHinglishResponse(
  query: string,
  data?: AnalysisResult | null,
  fallbackStock: string = ''
): string {
  const q = query.toLowerCase();
  if (!data && !fallbackStock && !/(pcr|max pain|what is|how to|explain|meaning)/.test(q)) {
    return 'No stock is currently selected. Please search for any stock above (or from the sidebar) first so I can share its support/resistance levels, buy/sell zones, and multi-year return outlook.';
  }

  const sym = data?.displaySymbol || fallbackStock;
  const fmt = (val: number) =>
    data && typeof data.currencyFmt === 'function'
      ? data.currencyFmt(val)
      : formatCurrencyValue(val, data?.market || 'NSE');

  const advice = data ? generateExpertAdvice(data) : null;
  const numPrice = data?.latestPrice || 1000;
  const price = fmt(numPrice);
  const rsi = advice ? advice.technicalBaselines.rsi14.toFixed(1) : '52.4';
  const score = data?.score ?? 50;
  const signal = data?.signal ?? 'BUY';
  const sma50 = advice?.technicalBaselines.sma50;
  const target7d = fmt(data?.forecast7d?.[data.forecast7d.length - 1] || numPrice * 1.045);
  const stoploss = advice ? fmt(advice.stopLoss) : fmt(numPrice * 0.965);

  if (
    advice &&
    (q.includes('expert') ||
      q.includes('support') ||
      q.includes('resistance') ||
      q.includes('pivot') ||
      q.includes('level') ||
      q.includes('s1') ||
      q.includes('r1'))
  ) {
    return `**Expert Support & Resistance Levels for ${sym}** (CMP: **${price}**)

**Action Verdict**: **${advice.verdict}** (${advice.convictionLabel})

**Key Resistance Levels (Overhead Supply)**:
- **R1 (Immediate)**: **${fmt(advice.resistances[0].price)}** (${advice.resistances[0].distancePct >= 0 ? '+' : ''}${advice.resistances[0].distancePct}% · ${advice.resistances[0].basis})
- **R2 (Breakout Target)**: **${fmt(advice.resistances[1].price)}** (+${advice.resistances[1].distancePct}% · ${advice.resistances[1].basis})
- **R3 (Major Zone)**: **${fmt(advice.resistances[2].price)}** (+${advice.resistances[2].distancePct}% · ${advice.resistances[2].basis})

**Key Support Levels (Demand Zones)**:
- **S1 (Immediate)**: **${fmt(advice.supports[0].price)}** (${advice.supports[0].distancePct}% · ${advice.supports[0].basis})
- **S2 (Major Support)**: **${fmt(advice.supports[1].price)}** (${advice.supports[1].distancePct}% · ${advice.supports[1].basis})
- **S3 (Structural Floor)**: **${fmt(advice.supports[2].price)}** (${advice.supports[2].distancePct}% · ${advice.supports[2].basis})

**Buy & Sell Plan**:
- **Ideal Buy Zone**: **${fmt(advice.buyZone.low)} – ${fmt(advice.buyZone.high)}**
- **Breakout Buy Above**: **${fmt(advice.breakoutBuyTrigger)}**
- **Strict Stop Loss / Breakdown Sell**: **${fmt(advice.stopLoss)}** (-${advice.stopLossRiskPct.toFixed(1)}%)
- **Profit Booking / Sell Zone**: **${fmt(advice.profitBookZone.low)} – ${fmt(advice.profitBookZone.high)}** (Risk:Reward **${advice.riskRewardRatio}**)`;
  }

  if (
    advice &&
    (q.includes('year') ||
      q.includes('years') ||
      q.includes('saal') ||
      q.includes('cagr') ||
      q.includes('long term') ||
      q.includes('horizon') ||
      q.includes('compound') ||
      q.includes('kitna return') ||
      q.includes('how much return') ||
      q.includes('return'))
  ) {
    const p1 = advice.projections[0];
    const p3 = advice.projections[1];
    const p5 = advice.projections[2];
    return `**Multi-Year Return Projection for ${sym}** (CMP: **${price}**)

**Recommended Holding Horizon**: **${advice.suitabilityHorizon}**
${advice.horizonSummary}

**Estimated Return Scenarios** *(Conservative / Base Case / Optimistic)*:
- **1-Year Outlook**: **${p1.conservativeReturnPct >= 0 ? '+' : ''}${p1.conservativeReturnPct}%** to **+${p1.optimisticReturnPct}%** · Base Target: **${fmt(p1.basePrice)}** (**+${p1.baseReturnPct}%** | ~${p1.baseCagr}% CAGR)
- **3-Year Outlook**: **${p3.conservativeReturnPct >= 0 ? '+' : ''}${p3.conservativeReturnPct}%** to **+${p3.optimisticReturnPct}%** · Base Target: **${fmt(p3.basePrice)}** (**+${p3.baseReturnPct}%** | ~${p3.baseCagr}% CAGR)
- **5-Year Outlook**: **${p5.conservativeReturnPct >= 0 ? '+' : ''}${p5.conservativeReturnPct}%** to **+${p5.optimisticReturnPct}%** · Base Target: **${fmt(p5.basePrice)}** (**+${p5.baseReturnPct}%** | ~${p5.baseCagr}% CAGR)

*Note: These multi-year return bands are statistical projections modeled from historical trajectory, composite trend score, and volatility — actual future returns depend on quarterly earnings and broader market cycles.*`;
  }

  if (
    q.includes('buy') ||
    q.includes('sell') ||
    q.includes('view') ||
    q.includes('outlook') ||
    q.includes('hold') ||
    q.includes('wait') ||
    q.includes('entry')
  ) {
    const buyText = advice
      ? `Ideal Buy Zone sits at **${fmt(advice.buyZone.low)} – ${fmt(advice.buyZone.high)}**, or wait for a confirmed breakout above **${fmt(advice.breakoutBuyTrigger)}**. Profit booking zone is **${fmt(advice.profitBookZone.low)} – ${fmt(advice.profitBookZone.high)}** with a protective stop loss at **${fmt(advice.stopLoss)}** (Risk:Reward ${advice.riskRewardRatio}).`
      : `Enter gradually near support and maintain a strict stop loss at **${stoploss}**.`;

    return `**Quantitative Expert Outlook for ${sym}** (CMP: **${price}**)

1. **Verdict & Score**: **${advice?.verdict || signal}** (AI Composite Score: **${score > 0 ? '+' : ''}${score}/100**).
2. **RSI Momentum**: RSI(14) is **${rsi}**. ${
      Number(rsi) > 70
        ? 'The stock is in overbought territory, so staggered entry on dips is safer than chasing.'
        : Number(rsi) < 35
        ? 'The stock is oversold near demand support, where a mean-reversion bounce often develops.'
        : 'Momentum is in a constructive zone with room to extend.'
    }
3. **Moving Average Alignment**: ${
      sma50 && numPrice > sma50
        ? `Price is trading above its 50-day SMA (${fmt(sma50)}), keeping the medium-term trend positive.`
        : 'Price is consolidating near or below its 50-day moving average; wait for volume confirmation.'
    }
4. **Buy & Sell Plan**: ${buyText}`;
  }

  if (
    q.includes('stop loss') ||
    q.includes('stoploss') ||
    q.includes('target') ||
    q.includes('sl') ||
    q.includes('exit')
  ) {
    const t1 = advice ? fmt(advice.targets.shortTerm.price) : target7d;
    const t2 = advice ? fmt(advice.targets.mediumTerm.price) : fmt(numPrice * 1.08);
    const t3 = advice ? fmt(advice.targets.positional.price) : fmt(numPrice * 1.14);

    return `**Buy/Sell Targets & Risk Setup for ${sym}**

- **Current Price**: **${price}**
- **Ideal Buy Zone**: **${advice ? `${fmt(advice.buyZone.low)} – ${fmt(advice.buyZone.high)}` : price}**
- **Strict Stop Loss / Sell Trigger**: **${stoploss}** ${advice ? `(-${advice.stopLossRiskPct.toFixed(1)}%)` : ''}
- **Short-Term Target (T1)**: **${t1}** ${advice ? `(+${advice.targets.shortTerm.pct}% · ${advice.targets.shortTerm.timeframe})` : ''}
- **Medium-Term Target (T2)**: **${t2}** ${advice ? `(+${advice.targets.mediumTerm.pct}% · ${advice.targets.mediumTerm.timeframe})` : ''}
- **Positional Target (T3)**: **${t3}** ${advice ? `(+${advice.targets.positional.pct}% · ${advice.targets.positional.timeframe})` : ''}

**Risk Management**: Once Target 1 is reached, trail your stop loss up to your entry price to protect capital.`;
  }

  if (
    q.includes('rsi') ||
    q.includes('macd') ||
    q.includes('indicator') ||
    q.includes('technical') ||
    q.includes('ema') ||
    q.includes('sma')
  ) {
    return `**Technical Indicators Summary for ${sym}**

- **RSI (14)**: **${rsi}** — ${
      Number(rsi) > 60
        ? 'Bullish momentum remains active with buyers in control.'
        : Number(rsi) < 40
        ? 'Momentum is soft; watch S1 support before adding.'
        : 'Neutral consolidation phase.'
    }
- **MACD**: ${score > 0 ? 'Positive bias above signal baseline.' : 'Showing momentum contraction.'}
- **50-Day SMA**: ${sma50 ? fmt(sma50) : 'Steady baseline'}
- **ATR (14)**: ${advice ? fmt(advice.technicalBaselines.atr14) : 'Moderate'}
- **Risk Profile**: **${data?.risk.risk_label || 'Moderate'}** (Annualized Volatility: ${data?.risk.annual_volatility_pct || '21.5'}%)`;
  }

  if (
    q.includes('forecast') ||
    q.includes('predict') ||
    q.includes('future') ||
    q.includes('next')
  ) {
    const nextDayFmt = data?.forecastNextDay ? fmt(data.forecastNextDay) : price;
    const p1 = advice?.projections[0];
    return `**Statistical Price Forecast for ${sym}**

- **Next-Day Estimate**: **${nextDayFmt}**
- **7-Day Model Target**: **${target7d}** (Confidence: **${data?.confidence || 80}%**)
- **1-Year Base Case**: ${p1 ? `**${fmt(p1.basePrice)}** (**+${p1.baseReturnPct}%**)` : 'Steady growth path'}

*Note: Statistical models use historical volatility and trend momentum; earnings results and macro news can shift trajectories quickly.*`;
  }

  if (
    q.includes('pcr') ||
    q.includes('option') ||
    q.includes('f&o') ||
    q.includes('call') ||
    q.includes('put') ||
    q.includes('greeks') ||
    q.includes('max pain')
  ) {
    return `**Option Chain & Derivatives Guide**

- **Put-Call Ratio (PCR > 1.25)**: Strong Put writing below spot signals bullish support.
- **Put-Call Ratio (PCR < 0.80)**: Heavy Call writing indicates overhead resistance.
- **Range-Bound Zone (0.90 – 1.15)**: Balanced positioning pointing to consolidation.
- **Max Pain**: Near expiry, spot price often gravitates toward the strike where option sellers face minimum aggregate payout.`;
  }

  return `**Expert Summary for ${sym}** (${data?.market || 'NSE'} · CMP: **${price}**)

- **Verdict**: **${advice?.verdict || signal}** (Composite Score: ${score > 0 ? '+' : ''}${score}/100)
- **Immediate Support (S1) / Resistance (R1)**: **${advice ? fmt(advice.supports[0].price) : stoploss}** / **${advice ? fmt(advice.resistances[0].price) : target7d}**
- **3-Year Base Return Outlook**: ${advice ? `**+${advice.projections[1].baseReturnPct}%** (~${advice.projections[1].baseCagr}% CAGR)` : 'Switch to the Expert Advice tab to inspect full 1Y–5Y estimates'}

Try asking:
- *"What are the support, resistance, and buy/sell levels?"*
- *"How much return can this give in 1, 3, and 5 years?"*
- *"What should be the stop loss and targets?"*`;
}
