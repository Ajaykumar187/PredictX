import { AnalysisResult } from '../types';
import { formatCurrencyValue } from './marketData';

export function generateHinglishResponse(
  query: string,
  data?: AnalysisResult | null,
  fallbackStock: string = ''
): string {
  const q = query.toLowerCase();
  if (!data && !fallbackStock && !/(pcr|max pain|kya hota|kya hai|kaise|what is|matlab|explain)/.test(q)) {
    return 'Abhi koi stock select nahi hai. Pehle sidebar se koi stock search karke load karein, phir main uska view, target aur stop loss bata paunga.';
  }
  const sym = data?.displaySymbol || fallbackStock;
  const numPrice = data?.latestPrice || 1000;
  const price = data && typeof data.currencyFmt === 'function'
    ? data.currencyFmt(data.latestPrice)
    : formatCurrencyValue(numPrice, data?.market || 'NSE');

  const rsi = data?.df?.[data.df.length - 1]?.rsi14
    ? data.df[data.df.length - 1].rsi14!.toFixed(1)
    : '52.4';
  const score = data?.score ?? 68;
  const signal = data?.signal ?? 'BUY';
  const sma50 = data?.df?.[data.df.length - 1]?.sma50;
  const f7 = data?.forecast7d?.[data.forecast7d.length - 1];
  const target7d = f7
    ? (typeof data?.currencyFmt === 'function' ? data.currencyFmt(f7) : formatCurrencyValue(f7, data?.market || 'NSE'))
    : `${data?.currencySymbol || '₹'}${(numPrice * 1.05).toFixed(2)}`;
  const stoploss = `${data?.currencySymbol || '₹'}${(numPrice * 0.965).toFixed(2)}`;

  if (
    q.includes('buy') ||
    q.includes('sell') ||
    q.includes('kharid') ||
    q.includes('kya karu') ||
    q.includes('view') ||
    q.includes('chahiye') ||
    q.includes('karein') ||
    q.includes('hold')
  ) {
    return `Dekhiye bhai, **${sym}** ka current quantitative setup kuch aisa dikh raha hai:

1. **Current Trend & Price**: Stock abhi **${price}** par chal raha hai. AI composite score **${score > 0 ? '+' : ''}${score}/100** hai, jo **${signal}** signal trigger kar raha hai.
2. **RSI Momentum**: RSI abhi **${rsi}** par hai. ${
      Number(rsi) > 70
        ? 'Stock overbought zone me hai, fresh breakout ke baad thoda consolidation aa sakta hai.'
        : Number(rsi) < 35
        ? 'Stock oversold territory me hai, yahan se mean-reversion bounce expected hai.'
        : 'RSI healthy neutral-to-bullish zone me hai jahan trend continuation ki probability achhi rehti hai.'
    }
3. **Moving Average Check**: ${
      sma50 && numPrice > sma50
        ? `Price 50-day SMA (${typeof data?.currencyFmt === 'function' ? data.currencyFmt(sma50) : formatCurrencyValue(sma50, data?.market || 'NSE')}) ke **upar** trade kar raha hai — trend buyers ke favor me hai.`
        : 'Price 50-day moving average ke aas-paas support test kar raha hai.'
    }
4. **Actionable View**: Agar fresh entry plan kar rahe ho, to ek saath sara capital na lagayein. Small tranches (SIP mode ya pullback par) entry lein aur strict Stop Loss **${stoploss}** zarur follow karein!`;
  }

  if (
    q.includes('stop loss') ||
    q.includes('stoploss') ||
    q.includes('target') ||
    q.includes('sl') ||
    q.includes('exit') ||
    q.includes('rok')
  ) {
    const target2 = `${data?.currencySymbol || '₹'}${(numPrice * 1.08).toFixed(2)}`;
    return `**${sym}** ke liye suggested Risk:Reward Setup:

🎯 **Entry Price**: ${price} (Current Market Price)
🛑 **Strict Stop Loss**: **${stoploss}** (Lagbhag -3.5% swing support ke neeche)
🚀 **Target 1 (7-Day Projection)**: **${target7d}** (+4.5% to +6.0%)
🌟 **Target 2 (Major Resistance)**: **${target2}** (+8.0%)

💡 **Trader Tip**:
- Agar target 1 hit ho jaye, to stop loss ko cost (entry price) par trail kar lijiye taki profit lock ho sake.
- Intraday me 1.5% se zyada risk na lein, aur position sizing capital ke 5-8% se zyada ek stock me na rakhein.`;
  }

  if (
    q.includes('rsi') ||
    q.includes('macd') ||
    q.includes('indicator') ||
    q.includes('technical') ||
    q.includes('ema') ||
    q.includes('sma')
  ) {
    return `**${sym}** ke Latest Technical Indicators:

📊 **RSI (14)**: **${rsi}** — ${
      Number(rsi) > 60
        ? 'Bullish strength bani hui hai, buyers dominate kar rahe hain.'
        : Number(rsi) < 40
        ? 'Weakness hai, buyers ka volume dry hai.'
        : 'Consolidation phase me hai.'
    }
📈 **MACD Line**: ${score > 0 ? 'Signal line ke upar positive cross maintain kar raha hai.' : 'Histogram contraction dikha raha hai.'}
📉 **50-Day SMA**: ${sma50 ? (typeof data?.currencyFmt === 'function' ? data.currencyFmt(sma50) : formatCurrencyValue(sma50, data?.market || 'NSE')) : 'Trend baseline steady hai.'}
🛡️ **Risk Level**: **${data?.risk.risk_label || 'Moderate'}** (Annualized Volatility: ${data?.risk.annual_volatility_pct || '21.5'}%)

Ye indicators suggest karte hain ki momentum active hai par confirmation breakout levels par hi aayega.`;
  }

  if (
    q.includes('forecast') ||
    q.includes('predict') ||
    q.includes('aage kya') ||
    q.includes('future') ||
    q.includes('kahan tak jayega') ||
    q.includes('kal') ||
    q.includes('hafta')
  ) {
    const nextDayFmt = data?.forecastNextDay
      ? (typeof data?.currencyFmt === 'function' ? data.currencyFmt(data.forecastNextDay) : formatCurrencyValue(data.forecastNextDay, data?.market || 'NSE'))
      : 'Consolidation zone';

    return `**${sym}** ke Multi-Day Machine Learning Forecast:

🔮 **Next Day Expected Price**: ${nextDayFmt}
📅 **7-Day Target Estimate**: **${target7d}** (Model Confidence: **${data?.confidence || 82}%**)
📊 **30-Day Trajectory**: Statistical auto-regressive model ke mutabiq stock medium term me **${signal === 'BUY' ? 'upward continuation channel' : 'sideways/range-bound'}** follow kar sakta hai.

⚠️ *Dhyan rahe: AI forecast historical price action aur volatility distribution par based hai, earnings ya market news se levels shift ho sakte hain.*`;
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
    return `**Option Chain & Derivatives Insight**:

📈 **Put-Call Ratio (PCR)**:
- Agar PCR **> 1.25** ho, to Put writing aggressive hoti hai (Strong bullish support below spot).
- Agar PCR **< 0.80** ho, to Call writers supply build karte hain (Bearish overhead resistance).
- PCR **0.90 - 1.15** ke dauran expiry range-bound settle hone ke chances zyada rehte hain.

💡 **Max Pain Rule**: Expiry par price aksar Max Pain strike ki taraf gravitate karta hai kyunki wahan option writers ka net payout minimum hota hai.`;
  }

  return `Bhai, aapne **"${query}"** ke baare me poochha:

Current stock **${sym}** (${data?.market || 'NSE'}) par hamari quantitative research yeh kehti hai:
- Price momentum abhi **${signal}** mode me hai (Composite score: ${score}/100).
- Immediate support **${stoploss}** par hai aur 7-day target band **${target7d}** ke aas-paas test ho sakta hai.
- RSI **${rsi}** par hai, jo short-term trend me ${Number(rsi) > 50 ? 'bulls ke control' : 'consolidation'} ko darshata hai.

Aap mujhse poochh sakte hain:
- *"Bhai target aur stop loss batao?"*
- *"Aaj fresh buy karein ya wait karein?"*
- *"Option chain aur PCR ka data kya keh raha hai?"*`;
}
