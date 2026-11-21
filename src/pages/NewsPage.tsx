import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Newspaper,
  Gauge,
  RefreshCw,
  ExternalLink,
  ListChecks,
  Loader2,
  ChevronUp,
  FileText,
  AlertCircle,
  X,
  Languages,
  Layers,
  TrendingUp,
  Cpu,
  Globe,
  Coins,
  Landmark,
  Flame,
  Search,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { NewsItem, NewsSector, fetchStockNews } from '../utils/stockApi';
import { analyzeHeadline, Mood, NewsCategory } from '../utils/sentiment';
import {
  summarizeNewsArticle,
  translateNewsHeadlines,
  type NewsSummaryData,
  type TranslatedHeadlineEntry,
} from '../utils/newsSummaryApi';
import { getLanguageOption, type LanguageCode } from '../utils/languages';
import { LanguageSelector, usePreferredLanguage } from '../components/LanguageSelector';

const NEWS_PAGE_STRINGS = {
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
  searchPlaceholder: 'Search headlines, publishers, or keywords (e.g. earnings, RBI, gold)...',
  searchAriaLabel: 'Search news feed by keyword',
  clearSearch: 'Clear search',
  searchMatchCount: '{matched} of {total}',
  noSearchMatches: 'No headlines match "{query}" with the selected filters.',
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

type NewsPageStringKey = keyof typeof NEWS_PAGE_STRINGS;
type NewsPageDictionary = Record<NewsPageStringKey, string>;

const NEWS_PAGE_STRINGS_HI: NewsPageDictionary = {
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
  searchPlaceholder: 'सुर्खियाँ, प्रकाशक या कीवर्ड खोजें (उदा. नतीजे, RBI, सोना)...',
  searchAriaLabel: 'कीवर्ड से समाचार खोजें',
  clearSearch: 'खोज साफ़ करें',
  searchMatchCount: '{total} में से {matched}',
  noSearchMatches: '"{query}" और चयनित फ़िल्टर से कोई सुर्खी मेल नहीं खाती।',
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

const SECTOR_OPTIONS: ReadonlyArray<{
  id: NewsSector;
  labelKey: NewsPageStringKey;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', labelKey: 'sectorAll', icon: Layers },
  { id: 'markets', labelKey: 'sectorMarkets', icon: TrendingUp },
  { id: 'tech', labelKey: 'sectorTech', icon: Cpu },
  { id: 'global', labelKey: 'sectorGlobal', icon: Globe },
  { id: 'commodities', labelKey: 'sectorCommodities', icon: Coins },
  { id: 'banking', labelKey: 'sectorBanking', icon: Landmark },
  { id: 'energy', labelKey: 'sectorEnergy', icon: Flame },
];

function interpolateTemplate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

function useNewsPageLocalization(language: LanguageCode, useOriginal = false) {
  const isHindiUi = !useOriginal && language === 'hi';
  const activeDict: NewsPageDictionary = isHindiUi ? NEWS_PAGE_STRINGS_HI : NEWS_PAGE_STRINGS;

  const t = useCallback(
    (key: NewsPageStringKey, vars?: Record<string, string | number>): string => {
      const template = activeDict[key] || NEWS_PAGE_STRINGS[key];
      return interpolateTemplate(template, vars);
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

interface NewsPageProps {
  data: AnalysisResult;
}

interface SummarySlotState {
  loading: boolean;
  expanded: boolean;
  summary?: NewsSummaryData;
  error?: string;
}

const card = 'bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800';
const moodCls: Record<Mood, string> = {
  positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  negative: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  neutral: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
};

const sentimentTextCls: Record<NewsSummaryData['sentiment'], string> = {
  Bullish: 'text-emerald-600 dark:text-emerald-400',
  Bearish: 'text-rose-600 dark:text-rose-400',
  Neutral: 'text-slate-600 dark:text-slate-300',
};

const SummaryTakeawaysPanel: React.FC<{
  summary: NewsSummaryData;
  t: (key: NewsPageStringKey, vars?: Record<string, string | number>) => string;
  translateSentimentTone: (s: NewsSummaryData['sentiment']) => string;
  onCollapse?: () => void;
}> = ({ summary, t, translateSentimentTone, onCollapse }) => {
  const summaryLang = getLanguageOption(summary.language);
  const formattedWords = summary.originalWordCount.toLocaleString('en-IN');
  const sourceCaption =
    summary.sourceMode === 'pasted'
      ? t('sourcePasted', { count: formattedWords })
      : summary.sourceMode === 'article'
        ? t('sourceArticle', { count: formattedWords })
        : t('sourceHeadline');

  return (
    <div
      dir={summaryLang.dir}
      className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-slate-900 dark:text-white">{t('aiKeyTakeaways')}</span>
          {summaryLang.code !== 'en' && (
            <>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {summaryLang.nativeName}
              </span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className={`font-semibold ${sentimentTextCls[summary.sentiment]}`}>
            {translateSentimentTone(summary.sentiment)}
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">{sourceCaption}</span>
        </div>

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>{t('hide')}</span>
          </button>
        )}
      </div>

      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed list-disc pl-4 rtl:pl-0 rtl:pr-4 marker:text-blue-500">
        {summary.bullets.map((bullet, idx) => (
          <li key={idx}>{bullet}</li>
        ))}
      </ul>

      {summary.investorImpact && (
        <p className="text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
          <span className="font-semibold text-slate-900 dark:text-white">{t('investorAngle')}: </span>
          {summary.investorImpact}
        </p>
      )}
    </div>
  );
};

export const NewsPage: React.FC<NewsPageProps> = ({ data }) => {
  const [language, setLanguage, langOption] = usePreferredLanguage();

  const [state, setState] = useState<{
    loading: boolean;
    items: NewsItem[];
    source?: string;
    regionalCount?: number;
    error?: string;
  }>({ loading: true, items: [] });

  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<NewsSector>('all');
  const [moodFilter, setMoodFilter] = useState<'all' | Mood>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NewsCategory>('all');
  const [reloadTick, setReloadTick] = useState(0);

  const [translationState, setTranslationState] = useState<{
    loading: boolean;
    language: string;
    entries: Record<string, TranslatedHeadlineEntry>;
    error?: string;
  }>({ loading: false, language: 'en', entries: {} });
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [translateRetryTick, setTranslateRetryTick] = useState(0);

  const {
    t,
    translateMood,
    translateCategory,
    translateSector,
    translateSentimentTone,
    translateMeterLabel,
    formatAgo,
    uiLoading,
    uiError,
    uiTranslated,
    retryUiTranslation,
  } = useNewsPageLocalization(language, showOriginalText);

  const [itemSummaries, setItemSummaries] = useState<Record<string, SummarySlotState>>({});

  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customState, setCustomState] = useState<{
    loading: boolean;
    summary?: NewsSummaryData;
    error?: string;
  }>({ loading: false });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, items: [] });
    setTranslationState({ loading: false, language, entries: {} });
    setShowOriginalText(false);
    fetchStockNews(
      data.displaySymbol,
      data.market,
      data.info?.longName,
      language,
      sectorFilter
    ).then((r) => {
      if (alive) {
        setState({
          loading: false,
          items: r.items || [],
          source: r.source,
          regionalCount: r.regionalCount || 0,
          error: r.success ? undefined : r.error,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [data.displaySymbol, data.market, data.info?.longName, language, sectorFilter, reloadTick]);

  useEffect(() => {
    setItemSummaries({});
    setSearchQuery('');
    setSectorFilter('all');
    setMoodFilter('all');
    setCategoryFilter('all');
  }, [data.displaySymbol, data.market]);

  const handleSelectSector = (nextSector: NewsSector) => {
    if (nextSector === sectorFilter) return;
    setSectorFilter(nextSector);
    setMoodFilter('all');
    setCategoryFilter('all');
  };

  useEffect(() => {
    if (language === 'en' || state.loading || state.items.length === 0) {
      setTranslationState({ loading: false, language, entries: {} });
      return;
    }

    let alive = true;
    setTranslationState((prev) => ({
      loading: true,
      language,
      entries: prev.language === language ? prev.entries : {},
    }));

    const payload = state.items.map((item) => ({
      id: item.link || item.title,
      title: item.title,
      isRegionalSource: Boolean(item.isRegionalSource),
    }));

    translateNewsHeadlines(language, payload).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setTranslationState({
          loading: false,
          language,
          entries: res.translations,
        });
      } else {
        setTranslationState({
          loading: false,
          language,
          entries: {},
          error: res.error,
        });
      }
    });

    return () => {
      alive = false;
    };
  }, [language, state.items, state.loading, translateRetryTick]);

  const activeTranslations =
    language !== 'en' && translationState.language === language ? translationState.entries : {};

  const scored = useMemo(
    () =>
      state.items.map((n) => {
        const key = n.link || n.title;
        const analysis = analyzeHeadline(n.title);
        const tr = activeTranslations[key];

        const useTranslatedClassification = Boolean(
          tr && (n.isRegionalSource || (analysis.score === 0 && tr.mood && tr.mood !== 'neutral'))
        );

        const mood: Mood = useTranslatedClassification && tr?.mood ? tr.mood : analysis.mood;
        const score =
          useTranslatedClassification && tr?.mood
            ? tr.mood === 'positive'
              ? 0.65
              : tr.mood === 'negative'
                ? -0.65
                : 0
            : analysis.score;
        const category: NewsCategory =
          useTranslatedClassification && tr?.category ? tr.category : analysis.category;

        const hasTranslatedTitle = Boolean(
          language !== 'en' && tr?.title && !n.isRegionalSource && tr.title !== n.title
        );
        const displayTitle =
          language !== 'en' && !showOriginalText && tr?.title ? tr.title : n.title;

        return {
          ...n,
          itemKey: key,
          displayTitle,
          hasTranslatedTitle,
          score,
          mood,
          category,
          signals: analysis.signals,
        };
      }),
    [state.items, activeTranslations, language, showOriginalText]
  );

  const count = (m: Mood) => scored.filter((n) => n.mood === m).length;
  const posCount = count('positive');
  const neuCount = count('neutral');
  const negCount = count('negative');
  const totalCount = scored.length;

  const avg = totalCount ? scored.reduce((a, n) => a + n.score, 0) / totalCount : 0;
  const overall: Mood = avg > 0.12 ? 'positive' : avg < -0.12 ? 'negative' : 'neutral';

  const posPct = totalCount ? Math.round((posCount / totalCount) * 100) : 0;
  const neuPct = totalCount ? Math.round((neuCount / totalCount) * 100) : 0;
  const negPct = totalCount ? Math.max(0, 100 - posPct - neuPct) : 0;

  const availableCategories = useMemo(() => {
    const set = new Set<NewsCategory>();
    scored.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [scored]);

  const trimmedSearch = searchQuery.trim();

  const filteredItems = useMemo(() => {
    const terms = trimmedSearch
      ? trimmedSearch.toLowerCase().split(/\s+/).filter(Boolean)
      : [];

    return scored.filter((item) => {
      if (moodFilter !== 'all' && item.mood !== moodFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (terms.length > 0) {
        const haystack = [
          item.displayTitle,
          item.title,
          item.publisher,
          item.category,
          item.sector || '',
          item.signals.map((s) => s.slice(1)).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!terms.every((term) => haystack.includes(term))) return false;
      }
      return true;
    });
  }, [scored, moodFilter, categoryFilter, trimmedSearch]);

  const hasAnyTranslated = useMemo(
    () => uiTranslated || scored.some((item) => item.hasTranslatedTitle),
    [uiTranslated, scored]
  );

  const topDrivers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of scored) {
      for (const sig of item.signals) {
        counts.set(sig, (counts.get(sig) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([sig]) => sig);
  }, [scored]);

  const handleSummarizeHeadline = async (item: NewsItem, forceRetry = false) => {
    const baseKey = item.link || item.title;
    const slotKey = `${language}|${baseKey}`;
    const existing = itemSummaries[slotKey];

    if (!forceRetry && existing?.summary) {
      setItemSummaries((prev) => ({
        ...prev,
        [slotKey]: { ...existing, expanded: !existing.expanded },
      }));
      return;
    }

    if (existing?.loading) return;

    setItemSummaries((prev) => ({
      ...prev,
      [slotKey]: { loading: true, expanded: true },
    }));

    const res = await summarizeNewsArticle({
      title: item.title,
      url: item.link,
      publisher: item.publisher,
      symbol: data.displaySymbol,
      companyName: data.info?.longName,
      language,
    });

    setItemSummaries((prev) => ({
      ...prev,
      [slotKey]: res.ok
        ? { loading: false, expanded: true, summary: res.summary }
        : { loading: false, expanded: true, error: res.error },
    }));
  };

  const handleSummarizeCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = customInput.trim();
    if (!raw || customState.loading) return;

    const looksLikeUrl = /^https?:\/\/\S+$/i.test(raw);
    setCustomState({ loading: true });

    const res = await summarizeNewsArticle({
      title: customTitle.trim() || undefined,
      url: looksLikeUrl ? raw : undefined,
      text: looksLikeUrl ? undefined : raw,
      symbol: data.displaySymbol,
      companyName: data.info?.longName,
      language,
    });

    setCustomState(
      res.ok
        ? { loading: false, summary: res.summary }
        : { loading: false, error: res.error }
    );
  };

  const customWordCount = useMemo(() => {
    const tVal = customInput.trim();
    if (!tVal || /^https?:\/\/\S+$/i.test(tVal)) return 0;
    return tVal.split(/\s+/).length;
  }, [customInput]);

  const rsi = data.df[data.df.length - 1]?.rsi14 || 50;
  const meter = Math.max(5, Math.min(95, Math.round(rsi)));
  const meterLabel = translateMeterLabel(rsi);

  const diverge =
    scored.length >= 3 &&
    ((overall === 'positive' && data.changePct < -1) || (overall === 'negative' && data.changePct > 1));

  const pageDir = language !== 'en' && !showOriginalText ? langOption.dir : 'ltr';
  const isTranslatingAnything = language !== 'en' && (uiLoading || translationState.loading);
  const combinedTranslationError = translationState.error || uiError;

  const handleRetryAllTranslations = () => {
    if (uiError) retryUiTranslation();
    if (translationState.error) setTranslateRetryTick((n) => n + 1);
  };

  return (
    <div dir={pageDir} data-no-translate="true" className="space-y-6">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-blue-500 shrink-0" />
              <span>
                {data.info?.longName || data.displaySymbol} — {t('pageTitleSuffix')}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{data.displaySymbol} ({data.market})</span>
              {state.source && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t('feedLabel')}: {state.source}</span>
                </>
              )}
              {sectorFilter !== 'all' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {t('sectorLabel')}: {translateSector(sectorFilter)}
                  </span>
                </>
              )}
              {language !== 'en' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {t('languageLabel')}: {langOption.nativeName} ({langOption.name})
                  </span>
                </>
              )}
              {totalCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t('headlinesAnalyzed', { count: totalCount })}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto" dir="ltr">
            <LanguageSelector
              variant="toolbar"
              value={language}
              onChange={setLanguage}
              align="right"
            />

            <button
              type="button"
              onClick={() => setShowCustomPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showCustomPanel
                  ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('condenseArticle')}</span>
            </button>

            <button
              type="button"
              onClick={() => setReloadTick((tick) => tick + 1)}
              disabled={state.loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? 'animate-spin text-blue-500' : ''}`} />
              <span>{t('refreshFeed')}</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  setSearchQuery('');
                }
              }}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAriaLabel')}
              className="w-full pl-9 pr-24 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            />
            {trimmedSearch && (
              <div className="absolute right-2 flex items-center gap-1.5">
                {!state.loading && totalCount > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 select-none">
                    {t('searchMatchCount', { matched: filteredItems.length, total: totalCount })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('clearSearch')}
                  title={t('clearSearch')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label={t('sectorFilterLabel')}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          >
          {SECTOR_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = sectorFilter === opt.id;
            const label =
              opt.id === 'all'
                ? `${t(opt.labelKey)} · ${data.displaySymbol}`
                : t(opt.labelKey);

            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectSector(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
          </div>
        </div>

        {isTranslatingAnything && (
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 rounded-xl px-3.5 py-2.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              {uiLoading
                ? t('translatingPage', { lang: `${langOption.nativeName} (${langOption.name})` })
                : t('translatingHeadlines', { lang: `${langOption.nativeName} (${langOption.name})` })}
            </span>
          </div>
        )}

        {language !== 'en' && combinedTranslationError && !isTranslatingAnything && (
          <div className="flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{combinedTranslationError}</span>
            </div>
            <button
              type="button"
              onClick={handleRetryAllTranslations}
              className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t('retry')}</span>
            </button>
          </div>
        )}

        {state.loading && (
          <div className="space-y-2.5" aria-busy="true">
            <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        )}

        {!state.loading && totalCount === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {sectorFilter !== 'all' ? t('noSectorHeadlinesFound') : t('noHeadlinesFound')}
              {state.error ? ` (${state.error})` : ''}
            </p>
            {sectorFilter !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectSector('all')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('resetFilters')}
              </button>
            )}
          </div>
        )}

        {!state.loading && totalCount > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t('overallMood')}</span>
                <span
                  className={`text-sm font-extrabold uppercase ${
                    overall === 'positive'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : overall === 'negative'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {translateMood(overall)} ({avg >= 0 ? '+' : ''}
                  {avg.toFixed(2)})
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 font-mono tabular-nums">
                <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">{t('positiveNews')}</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  {posCount} ({posPct}%)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 font-mono tabular-nums">
                <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">{t('neutralNews')}</span>
                <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                  {neuCount} ({neuPct}%)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 font-mono tabular-nums">
                <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">{t('negativeNews')}</span>
                <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                  {negCount} ({negPct}%)
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800" dir="ltr">
                {posPct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${posPct}%` }} title={`${t('moodPositive')} ${posPct}%`} />}
                {neuPct > 0 && <div className="bg-slate-400 dark:bg-slate-600 h-full" style={{ width: `${neuPct}%` }} title={`${t('moodNeutral')} ${neuPct}%`} />}
                {negPct > 0 && <div className="bg-rose-500 h-full" style={{ width: `${negPct}%` }} title={`${t('moodNegative')} ${negPct}%`} />}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {t('sessionMove')}:{' '}
                  <strong className={`font-mono tabular-nums ${data.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {data.changePct >= 0 ? '+' : ''}
                    {data.changePct.toFixed(2)}%
                  </strong>
                  {diverge && ` — ${t('divergenceNotice')}`}
                </span>

                {topDrivers.length > 0 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('keyDrivers')}:{' '}
                    {topDrivers
                      .map((d) => (d.startsWith('+') ? d.slice(1) : `${d.slice(1)} (-)`))
                      .join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCustomPanel && (
        <section aria-label={t('aiSummarizerTitle')} className={`${card} space-y-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{t('aiSummarizerTitle')}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language !== 'en'
                  ? t('aiSummarizerSubtitleLang', { lang: `${langOption.nativeName} (${langOption.name})` })
                  : t('aiSummarizerSubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomPanel(false)}
              aria-label={t('hide')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSummarizeCustom} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                {t('headlineTopicLabel')}
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t('headlineTopicPlaceholder', { symbol: data.displaySymbol })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('articleTextOrUrlLabel')}
                </label>
                {customWordCount > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {t('wordsCount', { count: customWordCount.toLocaleString('en-IN') })}
                  </span>
                )}
              </div>
              <textarea
                rows={5}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={t('articleInputPlaceholder')}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={customState.loading || !customInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {customState.loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('condensingArticle')}</span>
                    </>
                  ) : (
                    <>
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>{t('generateTakeaways')}</span>
                    </>
                  )}
                </button>

                {(customInput || customTitle || customState.summary || customState.error) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTitle('');
                      setCustomInput('');
                      setCustomState({ loading: false });
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('outputLanguage')}: {langOption.nativeName}
                {langOption.code !== 'en' ? ` (${langOption.name})` : ''}
              </span>
            </div>
          </form>

          {customState.error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{customState.error}</span>
            </div>
          )}

          {customState.summary && (
            <SummaryTakeawaysPanel
              summary={customState.summary}
              t={t}
              translateSentimentTone={translateSentimentTone}
            />
          )}
        </section>
      )}

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t('rsiMeterTitle')}</span>
          </h4>
          <span className="text-xs font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300">
            {meterLabel} — RSI {rsi.toFixed(1)}
          </span>
        </div>
        <div className="w-full h-3 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 rounded-full relative" dir="ltr">
          <div className="w-4 h-4 bg-white border-2 border-slate-900 rounded-full absolute -top-0.5 -translate-x-1/2 shadow" style={{ left: `${meter}%` }} />
        </div>
        <p className="text-[11px] text-slate-400">
          {t('rsiMeterSubtitle', { symbol: data.displaySymbol })}
        </p>
      </div>

      {totalCount > 0 && (
        <div className={`${card} space-y-4`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {sectorFilter === 'all'
                  ? t('recentHeadlinesTitle', { count: filteredItems.length })
                  : t('sectorHeadlinesTitle', {
                      sector: translateSector(sectorFilter),
                      count: filteredItems.length,
                    })}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'en' || showOriginalText
                  ? t('recentHeadlinesHintEn')
                  : t('recentHeadlinesHintLocalized', {
                      lang: langOption.name,
                      native: langOption.nativeName,
                    })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {language !== 'en' && hasAnyTranslated && !isTranslatingAnything && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setShowOriginalText(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      !showOriginalText
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {langOption.nativeName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOriginalText(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      showOriginalText
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('originalToggle')}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['all', 'positive', 'neutral', 'negative'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoodFilter(m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      moodFilter === m
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m === 'all' ? t('filterAll') : translateMood(m)}
                  </button>
                ))}
              </div>

              {availableCategories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'all' | NewsCategory)}
                  aria-label={t('allCatalysts')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">{t('allCatalysts')}</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {translateCategory(cat)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-5 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {trimmedSearch
                  ? t('noSearchMatches', { query: trimmedSearch })
                  : t('noFilterMatches')}
              </p>
              {(trimmedSearch || moodFilter !== 'all' || categoryFilter !== 'all' || sectorFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setMoodFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {t('resetFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((n, i) => {
                const slotKey = `${language}|${n.itemKey}`;
                const slot = itemSummaries[slotKey];

                return (
                  <div key={`${n.itemKey}-${i}`} className="py-3.5 text-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="font-semibold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-start gap-1.5"
                        >
                          <span>{n.displayTitle}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 mt-1 opacity-50" />
                        </a>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{n.publisher}</span>
                          {n.time && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{formatAgo(n.time)}</span>
                            </>
                          )}
                          {n.sector && n.sector !== 'all' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {translateSector(n.sector)}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {translateCategory(n.category)}
                          </span>
                          {language !== 'en' && n.isRegionalSource && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {t('regionalLabel')} · {langOption.nativeName}
                              </span>
                            </>
                          )}
                          {language !== 'en' && n.hasTranslatedTitle && !showOriginalText && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {t('translatedLabel')} · {langOption.nativeName}
                              </span>
                            </>
                          )}
                          {n.signals.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {t('signalsLabel')}: {n.signals.map((s) => s.slice(1)).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSummarizeHeadline(n)}
                          disabled={slot?.loading}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                            slot?.summary && slot.expanded
                              ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {slot?.loading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                              <span>{t('summarizing')}</span>
                            </>
                          ) : slot?.summary ? (
                            <>
                              <ListChecks className="w-3 h-3" />
                              <span>{slot.expanded ? t('hideSummary') : t('showSummary')}</span>
                            </>
                          ) : (
                            <>
                              <ListChecks className="w-3 h-3" />
                              <span>{t('summarize')}</span>
                            </>
                          )}
                        </button>

                        <span
                          className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase whitespace-nowrap ${moodCls[n.mood]}`}
                        >
                          {translateMood(n.mood)}
                        </span>
                      </div>
                    </div>

                    {slot?.loading && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2" aria-busy="true">
                        <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      </div>
                    )}

                    {slot?.expanded && slot.error && !slot.loading && (
                      <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{slot.error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSummarizeHeadline(n, true)}
                          className="text-xs font-semibold underline hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {t('retry')}
                        </button>
                      </div>
                    )}

                    {slot?.expanded && slot.summary && !slot.loading && (
                      <SummaryTakeawaysPanel
                        summary={slot.summary}
                        t={t}
                        translateSentimentTone={translateSentimentTone}
                        onCollapse={() =>
                          setItemSummaries((prev) => ({
                            ...prev,
                            [slotKey]: { ...slot, expanded: false },
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
