export type Mood = 'positive' | 'negative' | 'neutral';
export type NewsCategory =
  | 'Earnings'
  | 'Analyst'
  | 'Orders & Deals'
  | 'Regulatory'
  | 'Corporate'
  | 'Market';

const STRONG_POS_PHRASES = [
  'net profit jumps', 'profit surges', 'profit rises', 'beats estimates', 'beats expectations',
  'record revenue', 'record profit', 'all-time high', '52-week high', 'price target raised',
  'target hiked', 'order win', 'bags order', 'wins contract', 'secures order',
  'dividend declared', 'interim dividend', 'share buyback', 'bonus issue', 'margin expansion',
  'upgraded to buy', 'strong quarterly', 'debt reduction', 'regulatory approval',
];

const STRONG_NEG_PHRASES = [
  'net profit falls', 'profit drops', 'profit plunges', 'misses estimates', 'misses expectations',
  'price target cut', 'target lowered', 'downgraded to sell', 'margin pressure',
  'regulatory probe', 'sebi notice', 'tax demand', 'penalty imposed', '52-week low',
  'guidance cut', 'weak demand', 'stake sale', 'block deal discount', 'debt default',
];

const POS_WORDS = new Set([
  'surge', 'surges', 'surged', 'soar', 'soars', 'soared', 'jump', 'jumps', 'jumped',
  'rally', 'rallies', 'rallied', 'gain', 'gains', 'gained', 'rise', 'rises', 'rose', 'rising',
  'beat', 'beats', 'record', 'profit', 'profits', 'profitable', 'growth', 'upgrade', 'upgrades',
  'upgraded', 'outperform', 'overweight', 'buy', 'bullish', 'strong', 'robust', 'win', 'wins',
  'won', 'order', 'orders', 'deal', 'deals', 'expansion', 'expand', 'expands', 'dividend',
  'bonus', 'buyback', 'high', 'boost', 'boosts', 'recover', 'recovery', 'approval', 'approved',
  'partnership', 'milestone', 'accelerate', 'accelerates', 'breakout', 'momentum', 'positive',
  'optimistic', 'momentum', 'climb', 'climbs', 'climbed', 'advance', 'advances',
]);

const NEG_WORDS = new Set([
  'fall', 'falls', 'fell', 'drop', 'drops', 'dropped', 'plunge', 'plunges', 'plunged',
  'slump', 'slumps', 'slumped', 'loss', 'losses', 'miss', 'misses', 'missed', 'cut', 'cuts',
  'downgrade', 'downgrades', 'downgraded', 'underperform', 'underweight', 'sell', 'bearish',
  'weak', 'weakness', 'probe', 'fraud', 'penalty', 'fine', 'fined', 'lawsuit', 'default',
  'debt', 'decline', 'declines', 'declined', 'crash', 'crashed', 'warning', 'warns', 'warned',
  'concern', 'concerns', 'low', 'layoff', 'layoffs', 'ban', 'banned', 'recall', 'resigns',
  'resign', 'tumble', 'tumbles', 'tumbled', 'slide', 'slides', 'slid', 'drag', 'headwind',
  'headwinds', 'investigation', 'disappoints', 'disappointing', 'risk', 'risks',
]);

const NEGATORS = new Set(['not', 'no', 'never', 'despite', 'fails', 'fail', 'failed', 'without', 'unlikely']);

export function categorizeHeadline(title: string): NewsCategory {
  const lower = title.toLowerCase();
  if (/(q1|q2|q3|q4|quarter|quarterly|earnings|results|ebitda|margin|revenue|net profit|eps|pat\b)/.test(lower)) {
    return 'Earnings';
  }
  if (/(target|upgrade|downgrade|brokerage|rating|buy rating|sell rating|hold rating|outperform|underperform|analyst)/.test(lower)) {
    return 'Analyst';
  }
  if (/(order|contract|deal|acquisition|acquire|merger|partnership|mou|joint venture|project|awarded)/.test(lower)) {
    return 'Orders & Deals';
  }
  if (/(sebi|rbi|sec|fda|regulator|regulatory|penalty|fine|tax|court|lawsuit|probe|notice|compliance)/.test(lower)) {
    return 'Regulatory';
  }
  if (/(dividend|buyback|bonus|split|ceo|cfo|board|stake|promoter|fundraise|qip|ipo|shareholder)/.test(lower)) {
    return 'Corporate';
  }
  return 'Market';
}

export interface HeadlineAnalysis {
  score: number;
  mood: Mood;
  category: NewsCategory;
  signals: string[];
}

export function analyzeHeadline(title: string): HeadlineAnalysis {
  const lower = title.toLowerCase();
  const category = categorizeHeadline(title);
  const signals: string[] = [];
  let rawScore = 0;

  for (const phrase of STRONG_POS_PHRASES) {
    if (lower.includes(phrase)) {
      rawScore += 1.6;
      signals.push(`+${phrase}`);
    }
  }
  for (const phrase of STRONG_NEG_PHRASES) {
    if (lower.includes(phrase)) {
      rawScore -= 1.6;
      signals.push(`-${phrase}`);
    }
  }

  const words = lower.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = i > 0 ? words[i - 1] : '';
    const prev2 = i > 1 ? words[i - 2] : '';
    const isNegated = NEGATORS.has(prev) || NEGATORS.has(prev2);

    if (POS_WORDS.has(w)) {
      rawScore += isNegated ? -0.8 : 0.9;
      if (!isNegated && signals.length < 3) signals.push(`+${w}`);
    } else if (NEG_WORDS.has(w)) {
      rawScore += isNegated ? 0.6 : -0.9;
      if (!isNegated && signals.length < 3) signals.push(`-${w}`);
    }
  }

  const score = Math.max(-1, Math.min(1, Number((rawScore / 2.2).toFixed(2))));
  return {
    score,
    mood: moodOf(score),
    category,
    signals: Array.from(new Set(signals)).slice(0, 3),
  };
}

export function headlineScore(title: string): number {
  return analyzeHeadline(title).score;
}

export function moodOf(score: number): Mood {
  return score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
}
