import { useCallback } from 'react';
import type { LanguageCode } from './languages';
import type { Mood, NewsCategory } from './sentiment';

export interface NewsSummaryData {
  bullets: string[];
  investorImpact: string;
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  sourceMode: 'article' | 'pasted' | 'headline';
  originalWordCount: number;
  language?: string;
  cached?: boolean;
}

export interface SummarizeNewsRequest {
  title?: string;
  url?: string;
  text?: string;
  publisher?: string;
  symbol?: string;
  companyName?: string;
  language?: LanguageCode;
}

export type SummarizeNewsResponse =
  | { ok: true; summary: NewsSummaryData }
  | { ok: false; error: string };

export async function summarizeNewsArticle(
  payload: SummarizeNewsRequest
): Promise<SummarizeNewsResponse> {
  try {
    const res = await fetch('/api/news/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.summary) {
      return {
        ok: false,
        error: data?.error || `Failed to summarize article (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      summary: data.summary as NewsSummaryData,
    };
  } catch {
    return {
      ok: false,
      error: 'Unable to reach the summary service. Please check your connection and try again.',
    };
  }
}

export interface TranslatedHeadlineEntry {
  title: string;
  mood?: Mood;
  category?: NewsCategory;
}

export type TranslateNewsResponse =
  | {
      ok: true;
      language: LanguageCode;
      translations: Record<string, TranslatedHeadlineEntry>;
      cachedCount?: number;
    }
  | { ok: false; error: string };

export async function translateNewsHeadlines(
  targetLanguage: LanguageCode,
  items: Array<{ id: string; title: string; isRegionalSource?: boolean }>
): Promise<TranslateNewsResponse> {
  try {
    const res = await fetch('/api/news/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetLanguage,
        items,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.translations) {
      return {
        ok: false,
        error: data?.error || `Failed to translate headlines (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      language: data.language as LanguageCode,
      translations: data.translations as Record<string, TranslatedHeadlineEntry>,
      cachedCount: data.cachedCount,
    };
  } catch {
    return {
      ok: false,
      error: 'Unable to reach the translation service. Showing original headlines.',
    };
  }
}

export const NEWS_PAGE_STRINGS = {
  pageTitleSuffix: 'Live Financial News & Sentiment',
  feedLabel: 'Feed',
  languageLabel: 'Language',
  headlinesAnalyzed: '{count} live headlines analyzed',
  condenseArticle: 'Condense Article',
  refreshFeed: 'Refresh Feed',
  noHeadlinesFound: 'No recent news headlines were found for this symbol right now.',
  noSectorHeadlinesFound: 'No recent headlines were found for this sector right now.',
  sectorLabel: 'Sector',
  sectorFilterLabel: 'Financial Sectors',
  sectorAll: 'All',
  sectorMarkets: 'Markets',
  sectorTech: 'Tech',
  sectorGlobal: 'Global',
  sectorCommodities: 'Commodities',
  sectorBanking: 'Banking',
  sectorEnergy: 'Energy',
  sectorHeadlinesTitle: '{sector} Headlines ({count})',
  resetFilters: 'Reset Filters',
  overallMood: 'Overall Mood',
  positiveNews: 'Positive News',
  neutralNews: 'Neutral News',
  negativeNews: 'Negative News',
  sessionMove: 'Session Move',
  divergenceNotice: 'Notice: News sentiment is diverging from intraday price action; wait for confirmation.',
  keyDrivers: 'Key Drivers',
  aiSummarizerTitle: 'Financial Article Summarizer',
  aiSummarizerSubtitle: 'Paste a lengthy financial article, earnings press release, or article URL to condense it into concise bulleted takeaways.',
  aiSummarizerSubtitleLang: 'Paste a lengthy financial article, earnings press release, or article URL to condense it into concise bulleted takeaways in {lang}.',
  headlineTopicLabel: 'Headline or Topic (optional)',
  headlineTopicPlaceholder: 'e.g. {symbol} Q4 earnings commentary',
  articleTextOrUrlLabel: 'Article Text or URL',
  articleInputPlaceholder: 'Paste full article text or an https:// financial news URL...',
  wordsCount: '{count} words',
  generateTakeaways: 'Generate Key Takeaways',
  condensingArticle: 'Condensing Article...',
  clear: 'Clear',
  outputLanguage: 'Output language',
  rsiMeterTitle: 'Technical Momentum Meter (RSI-14)',
  rsiMeterSubtitle: "Calculated from {symbol}'s 14-day Relative Strength Index to complement headline sentiment.",
  meterOverbought: 'Overbought',
  meterBullish: 'Bullish Momentum',
  meterOversold: 'Oversold',
  meterWeak: 'Weak',
  meterNeutral: 'Neutral',
  recentHeadlinesTitle: 'Recent Financial Headlines ({count})',
  recentHeadlinesHintEn: 'Click Summarize on any article to condense it into bulleted key takeaways.',
  recentHeadlinesHintLocalized: 'Showing regional {lang} sources & translated headlines · Summaries generated in {native}.',
  originalToggle: 'Original',
  filterAll: 'All',
  moodPositive: 'Positive',
  moodNeutral: 'Neutral',
  moodNegative: 'Negative',
  allCatalysts: 'All Catalysts',
  catEarnings: 'Earnings',
  catAnalyst: 'Analyst',
  catOrdersDeals: 'Orders & Deals',
  catRegulatory: 'Regulatory',
  catCorporate: 'Corporate',
  catMarket: 'Market',
  translatingPage: 'Translating headlines to {lang}...',
  translatingHeadlines: 'Translating headlines to {lang}...',
  retry: 'Retry',
  noFilterMatches: 'No headlines match the selected filters.',
  regionalLabel: 'Regional',
  translatedLabel: 'Translated',
  signalsLabel: 'Signals',
  summarize: 'Summarize',
  summarizing: 'Summarizing...',
  showSummary: 'Show Summary',
  hideSummary: 'Hide Summary',
  hide: 'Hide',
  aiKeyTakeaways: 'Key Takeaways',
  toneBullish: 'Bullish tone',
  toneBearish: 'Bearish tone',
  toneNeutral: 'Neutral tone',
  investorAngle: 'Investor Angle',
  sourcePasted: 'Condensed {count} words',
  sourceArticle: 'Full article condensed ({count} words)',
  sourceHeadline: 'Headline brief (full article restricted by publisher)',
  justNow: 'Just now',
  minsAgo: '{n}m ago',
  hoursAgo: '{n}h ago',
  daysAgo: '{n}d ago',
} as const;

export type NewsPageStringKey = keyof typeof NEWS_PAGE_STRINGS;
export type NewsPageDictionary = Record<NewsPageStringKey, string>;

export const NEWS_PAGE_STRINGS_HI: NewsPageDictionary = {
  pageTitleSuffix: 'लाइव वित्तीय समाचार और सेंटीमेंट',
  feedLabel: 'फ़ीड',
  languageLabel: 'भाषा',
  headlinesAnalyzed: '{count} लाइव सुर्खियों का विश्लेषण',
  condenseArticle: 'लेख का सारांश बनाएं',
  refreshFeed: 'फ़ीड रीफ़्रेश करें',
  noHeadlinesFound: 'इस स्टॉक के लिए अभी कोई ताज़ा समाचार सुर्खी नहीं मिली।',
  noSectorHeadlinesFound: 'इस सेक्टर के लिए अभी कोई ताज़ा समाचार सुर्खी नहीं मिली।',
  sectorLabel: 'सेक्टर',
  sectorFilterLabel: 'वित्तीय सेक्टर',
  sectorAll: 'सभी',
  sectorMarkets: 'बाज़ार',
  sectorTech: 'टेक',
  sectorGlobal: 'ग्लोबल',
  sectorCommodities: 'कमोडिटी',
  sectorBanking: 'बैंकिंग',
  sectorEnergy: 'ऊर्जा',
  sectorHeadlinesTitle: '{sector} समाचार ({count})',
  resetFilters: 'फ़िल्टर रीसेट करें',
  overallMood: 'समग्र रुझान',
  positiveNews: 'सकारात्मक समाचार',
  neutralNews: 'तटस्थ समाचार',
  negativeNews: 'नकारात्मक समाचार',
  sessionMove: 'सत्र चाल',
  divergenceNotice: 'सूचना: समाचार सेंटीमेंट इंट्राडे कीमत की चाल से भिन्न है; पुष्टि की प्रतीक्षा करें।',
  keyDrivers: 'मुख्य कारण',
  aiSummarizerTitle: 'वित्तीय लेख सारांशक',
  aiSummarizerSubtitle: 'संक्षिप्त बुलेट पॉइंट्स में मुख्य बातें निकालने के लिए पूरा वित्तीय लेख, नतीजों की प्रेस विज्ञप्ति या लेख का URL पेस्ट करें।',
  aiSummarizerSubtitleLang: '{lang} में मुख्य बुलेट पॉइंट्स निकालने के लिए वित्तीय लेख, प्रेस विज्ञप्ति या लेख का URL पेस्ट करें।',
  headlineTopicLabel: 'शीर्षक या विषय (वैकल्पिक)',
  headlineTopicPlaceholder: 'उदा. {symbol} तिमाही नतीजे विश्लेषण',
  articleTextOrUrlLabel: 'लेख का टेक्स्ट या URL',
  articleInputPlaceholder: 'पूरा लेख टेक्स्ट या https:// वित्तीय समाचार URL पेस्ट करें...',
  wordsCount: '{count} शब्द',
  generateTakeaways: 'मुख्य बिंदु निकालें',
  condensingArticle: 'सारांश तैयार हो रहा है...',
  clear: 'साफ़ करें',
  outputLanguage: 'आउटपुट भाषा',
  rsiMeterTitle: 'तकनीकी मोमेंटम मीटर (RSI-14)',
  rsiMeterSubtitle: 'समाचार सेंटीमेंट के साथ {symbol} के 14-दिवसीय रिलेटिव स्ट्रेंथ इंडेक्स (RSI) से गणना की गई।',
  meterOverbought: 'ओवरबॉट',
  meterBullish: 'तेज़ी का मोमेंटम',
  meterOversold: 'ओवरसोल्ड',
  meterWeak: 'कमज़ोर',
  meterNeutral: 'तटस्थ',
  recentHeadlinesTitle: 'ताज़ा वित्तीय सुर्खियाँ ({count})',
  recentHeadlinesHintEn: 'किसी भी समाचार के मुख्य बिंदु देखने के लिए "सारांश" पर क्लिक करें।',
  recentHeadlinesHintLocalized: 'हिन्दी समाचार और अनुवादित सुर्खियाँ · सारांश {native} में तैयार किए जाएंगे।',
  originalToggle: 'मूल (English)',
  filterAll: 'सभी',
  moodPositive: 'सकारात्मक',
  moodNeutral: 'तटस्थ',
  moodNegative: 'नकारात्मक',
  allCatalysts: 'सभी श्रेणियाँ',
  catEarnings: 'तिमाही नतीजे',
  catAnalyst: 'विश्लेषक',
  catOrdersDeals: 'ऑर्डर व सौदे',
  catRegulatory: 'नियामक',
  catCorporate: 'कॉर्पोरेट',
  catMarket: 'बाज़ार',
  translatingPage: 'सुर्खियों का {lang} में अनुवाद हो रहा है...',
  translatingHeadlines: 'सुर्खियों का {lang} में अनुवाद हो रहा है...',
  retry: 'पुनः प्रयास करें',
  noFilterMatches: 'चयनित फ़िल्टर से कोई सुर्खी मेल नहीं खाती।',
  regionalLabel: 'हिन्दी स्रोत',
  translatedLabel: 'अनुवादित',
  signalsLabel: 'संकेत',
  summarize: 'सारांश',
  summarizing: 'सारांश बन रहा है...',
  showSummary: 'सारांश देखें',
  hideSummary: 'सारांश छिपाएं',
  hide: 'छिपाएं',
  aiKeyTakeaways: 'मुख्य बिंदु (सारांश)',
  toneBullish: 'तेज़ी का संकेत',
  toneBearish: 'मंदी का संकेत',
  toneNeutral: 'तटस्थ संकेत',
  investorAngle: 'निवेशक दृष्टिकोण',
  sourcePasted: '{count} शब्दों का सारांश',
  sourceArticle: 'पूरे लेख का सारांश ({count} शब्द)',
  sourceHeadline: 'सुर्खी संक्षेप (पूरा लेख प्रकाशक द्वारा सीमित है)',
  justNow: 'अभी',
  minsAgo: '{n} मि. पहले',
  hoursAgo: '{n} घं. पहले',
  daysAgo: '{n} दि. पहले',
};

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

export function useNewsPageLocalization(language: LanguageCode, useOriginal = false) {
  const isHindiUi = !useOriginal && language === 'hi';
  const activeDict: NewsPageDictionary = isHindiUi ? NEWS_PAGE_STRINGS_HI : NEWS_PAGE_STRINGS;

  const t = useCallback(
    (key: NewsPageStringKey, vars?: Record<string, string | number>): string => {
      const template = activeDict[key] || NEWS_PAGE_STRINGS[key];
      return interpolate(template, vars);
    },
    [activeDict]
  );

  const translateMood = useCallback(
    (mood: Mood): string => {
      if (mood === 'positive') return t('moodPositive');
      if (mood === 'negative') return t('moodNegative');
      return t('moodNeutral');
    },
    [t]
  );

  const translateCategory = useCallback(
    (cat: NewsCategory): string => {
      switch (cat) {
        case 'Earnings':
          return t('catEarnings');
        case 'Analyst':
          return t('catAnalyst');
        case 'Orders & Deals':
          return t('catOrdersDeals');
        case 'Regulatory':
          return t('catRegulatory');
        case 'Corporate':
          return t('catCorporate');
        case 'Market':
        default:
          return t('catMarket');
      }
    },
    [t]
  );

  const translateSector = useCallback(
    (sector: string): string => {
      switch (sector.toLowerCase()) {
        case 'markets':
          return t('sectorMarkets');
        case 'tech':
          return t('sectorTech');
        case 'global':
          return t('sectorGlobal');
        case 'commodities':
          return t('sectorCommodities');
        case 'banking':
          return t('sectorBanking');
        case 'energy':
          return t('sectorEnergy');
        case 'all':
        default:
          return t('sectorAll');
      }
    },
    [t]
  );

  const translateSentimentTone = useCallback(
    (sentiment: NewsSummaryData['sentiment']): string => {
      if (sentiment === 'Bullish') return t('toneBullish');
      if (sentiment === 'Bearish') return t('toneBearish');
      return t('toneNeutral');
    },
    [t]
  );

  const translateMeterLabel = useCallback(
    (rsi: number): string => {
      if (rsi >= 70) return t('meterOverbought');
      if (rsi >= 55) return t('meterBullish');
      if (rsi <= 30) return t('meterOversold');
      if (rsi <= 45) return t('meterWeak');
      return t('meterNeutral');
    },
    [t]
  );

  const formatAgo = useCallback(
    (timestamp: number | null): string => {
      if (!timestamp) return '';
      const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
      if (mins < 60) return mins <= 1 ? t('justNow') : t('minsAgo', { n: mins });
      const h = Math.round(mins / 60);
      return h < 24 ? t('hoursAgo', { n: h }) : t('daysAgo', { n: Math.round(h / 24) });
    },
    [t]
  );

  const retryUiTranslation = useCallback(() => {}, []);

  return {
    t,
    translateMood,
    translateCategory,
    translateSector,
    translateSentimentTone,
    translateMeterLabel,
    formatAgo,
    uiLoading: false,
    uiError: undefined as string | undefined,
    uiProvider: 'builtin',
    uiTranslated: isHindiUi,
    retryUiTranslation,
  };
}
