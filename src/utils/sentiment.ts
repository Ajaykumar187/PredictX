const POS = [
  'surge', 'surges', 'soar', 'soars', 'jump', 'jumps', 'rally', 'rallies', 'gain', 'gains', 'rise', 'rises', 'rises',
  'beat', 'beats', 'record', 'profit', 'profits', 'growth', 'upgrade', 'upgrades', 'outperform', 'buy', 'bullish',
  'strong', 'robust', 'win', 'wins', 'order', 'orders', 'expansion', 'dividend', 'bonus', 'buyback', 'high', 'boost', 'recover', 'recovery', 'approval', 'approved',
];
const NEG = [
  'fall', 'falls', 'drop', 'drops', 'plunge', 'plunges', 'slump', 'slumps', 'loss', 'losses', 'miss', 'misses', 'cut', 'cuts',
  'downgrade', 'downgrades', 'sell', 'bearish', 'weak', 'probe', 'fraud', 'penalty', 'fine', 'lawsuit', 'default', 'debt',
  'decline', 'declines', 'crash', 'warning', 'warns', 'concern', 'concerns', 'low', 'layoff', 'layoffs', 'ban', 'recall', 'resigns', 'resign', 'tumble', 'tumbles',
];

export type Mood = 'positive' | 'negative' | 'neutral';

export function headlineScore(title: string): number {
  const words = title.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
  let s = 0;
  for (const w of words) {
    if (POS.includes(w)) s += 1;
    else if (NEG.includes(w)) s -= 1;
  }
  return Math.max(-1, Math.min(1, s / 2));
}

export function moodOf(score: number): Mood {
  return score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
}
