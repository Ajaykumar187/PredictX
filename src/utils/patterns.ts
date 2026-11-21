import { IndicatorData } from '../types';

export interface DetectedPattern {
  date: string;
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

export function detectPatterns(df: IndicatorData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const n = df.length;
  if (n < 5) return patterns;

  const start = Math.max(2, n - 15);

  for (let i = start; i < n; i++) {
    const cur = df[i];
    const prev = df[i - 1];
    const prev2 = df[i - 2];

    const body = Math.abs(cur.close - cur.open);
    const range = cur.high - cur.low || 0.001;
    const upperShadow = cur.high - Math.max(cur.open, cur.close);
    const lowerShadow = Math.min(cur.open, cur.close) - cur.low;

    if (body <= 0.1 * range) {
      patterns.push({
        date: cur.date,
        name: 'Doji',
        type: 'neutral',
        description: 'Indecision candle with virtually identical open and close.',
      });
    }

    if (lowerShadow >= 2 * body && upperShadow <= 0.3 * body && cur.close > cur.open) {
      patterns.push({
        date: cur.date,
        name: 'Hammer',
        type: 'bullish',
        description: 'Bullish reversal pattern with long lower wick rejecting lower prices.',
      });
    }

    if (upperShadow >= 2 * body && lowerShadow <= 0.3 * body && cur.close < cur.open) {
      patterns.push({
        date: cur.date,
        name: 'Shooting Star',
        type: 'bearish',
        description: 'Bearish reversal pattern with long upper wick rejecting higher prices.',
      });
    }

    if (prev.close < prev.open && cur.close > cur.open && cur.open <= prev.close && cur.close >= prev.open) {
      patterns.push({
        date: cur.date,
        name: 'Bullish Engulfing',
        type: 'bullish',
        description: 'Green candle completely engulfing prior red body, indicating strong buyer takeover.',
      });
    }

    if (prev.close > prev.open && cur.close < cur.open && cur.open >= prev.close && cur.close <= prev.open) {
      patterns.push({
        date: cur.date,
        name: 'Bearish Engulfing',
        type: 'bearish',
        description: 'Red candle completely engulfing prior green body, indicating seller dominance.',
      });
    }

    const prevBody = Math.abs(prev.close - prev.open);
    const prevRange = prev.high - prev.low || 0.001;
    if (prev2.close < prev2.open && prevBody <= 0.35 * prevRange && cur.close > cur.open && cur.close > (prev2.open + prev2.close) / 2) {
      patterns.push({
        date: cur.date,
        name: 'Morning Star',
        type: 'bullish',
        description: 'Three-candle bullish reversal formation signaling seller exhaustion.',
      });
    }

    if (prev2.close > prev2.open && prevBody <= 0.35 * prevRange && cur.close < cur.open && cur.close < (prev2.open + prev2.close) / 2) {
      patterns.push({
        date: cur.date,
        name: 'Evening Star',
        type: 'bearish',
        description: 'Three-candle bearish reversal formation signaling buyer exhaustion.',
      });
    }
  }

  const seen = new Set<string>();
  const unique: DetectedPattern[] = [];
  for (let i = patterns.length - 1; i >= 0; i--) {
    const key = `${patterns[i].date}-${patterns[i].name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(patterns[i]);
    }
  }

  return unique;
}
