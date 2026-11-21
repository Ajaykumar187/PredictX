import type { Router } from 'express';
import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import {
  getLanguageOption,
  isValidLanguageCode,
  type LanguageCode,
} from '../utils/languages.js';

export interface ArticleSummaryResult {
  bullets: string[];
  investorImpact: string;
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  sourceMode: 'article' | 'pasted' | 'headline';
  originalWordCount: number;
  language?: string;
  cached?: boolean;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 150;
const MAX_FETCH_BYTES = 256 * 1024;
const FETCH_BUDGET_MS = 2800;
const TRANSLATE_TIMEOUT_MS = 3800;
const MAX_ARTICLE_CHARS = 5000;
const MAX_PASTED_CHARS = 12000;

const SKIP_SCRAPE_HOSTS = new Set([
  'news.google.com',
  'consent.google.com',
  'consent.yahoo.com',
  'guce.yahoo.com',
]);

const TRANSLATION_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_TRANSLATION_CACHE_ENTRIES = 600;

type NewsCategory =
  | 'Earnings'
  | 'Analyst'
  | 'Orders & Deals'
  | 'Regulatory'
  | 'Corporate'
  | 'Market';

interface CachedTranslationEntry {
  title: string;
  mood: 'positive' | 'neutral' | 'negative';
  category: NewsCategory;
}

const summaryCache = new Map<string, { data: ArticleSummaryResult; expiresAt: number }>();
const translationCache = new Map<string, { data: CachedTranslationEntry; expiresAt: number }>();
const textTranslateCache = new Map<string, { text: string; expiresAt: number }>();

const BUILTIN_HINDI_UI: Record<string, string> = {
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

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
    const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Mapped) return isPrivateOrReservedIp(v4Mapped[1]);
    return false;
  }
  return true;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL | null> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;

    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal'
    ) {
      return null;
    }

    if (SKIP_SCRAPE_HOSTS.has(host)) {
      return null;
    }

    if (net.isIP(host)) {
      return isPrivateOrReservedIp(host) ? null : parsed;
    }

    const records = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);
    if (!records || records.length === 0) return null;
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;|&ndash;/gi, '—')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 32 && n <= 126 ? String.fromCharCode(n) : ' ';
    });
}

function isReadableProse(text: string): boolean {
  if (!text || text.length < 160) return false;
  const lower = text.toLowerCase();
  const noiseMarkers = [
    'af_initdatacallback',
    'wiz_global_data',
    'window.__',
    'function(',
    'enable javascript',
    'javascript is disabled',
    'access denied',
    'attention required',
    'please verify you are a human',
    'cloudflare',
    'bot detection',
    'cookies are required',
  ];
  for (const marker of noiseMarkers) {
    if (lower.includes(marker)) return false;
  }

  const codeChars = (text.match(/[{}[\];=<>\\]/g) || []).length;
  if (codeChars / text.length > 0.04) return false;

  const words = text.split(/\s+/).filter((w) => /[A-Za-z\u0900-\u097F]{2,}/.test(w));
  return words.length >= 25;
}

function extractReadableTextFromHtml(html: string): string {
  const metaMatch =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{40,500})["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{40,500})["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const metaDesc = metaMatch ? decodeHtmlEntities(metaMatch[1]).replace(/\s+/g, ' ').trim() : '';

  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = !articleMatch ? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) : null;
  let scope = articleMatch?.[1] || mainMatch?.[1] || html;

  scope = scope
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(scope)) !== null) {
    const clean = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (
      clean.length >= 45 &&
      !seen.has(clean) &&
      !/^(read more|subscribe|sign in|log in|copyright|advertisement|follow us|also read|share this)/i.test(clean)
    ) {
      seen.add(clean);
      paragraphs.push(clean);
    }
    if (paragraphs.join('\n\n').length >= MAX_ARTICLE_CHARS) break;
  }

  let body = paragraphs.join('\n\n');
  if (metaDesc && !body.includes(metaDesc.slice(0, 40))) {
    body = body ? `${metaDesc}\n\n${body}` : metaDesc;
  }

  const trimmed = body.replace(/\s{3,}/g, '\n\n').trim().slice(0, MAX_ARTICLE_CHARS);
  return isReadableProse(trimmed) ? trimmed : '';
}

async function fetchArticleTextSafely(rawUrl: string): Promise<string> {
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), FETCH_BUDGET_MS);

  try {
    let currentUrl = rawUrl;
    for (let hop = 0; hop < 2; hop++) {
      const safeUrl = await assertPublicHttpUrl(currentUrl);
      if (!safeUrl || controller.signal.aborted) return '';

      const res = await fetch(safeUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PredictXNewsReader/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return '';
        currentUrl = new URL(location, safeUrl).toString();
        continue;
      }

      if (!res.ok) return '';

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (
        contentType &&
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml') &&
        !contentType.includes('text/plain')
      ) {
        return '';
      }

      const reader = res.body?.getReader();
      if (!reader) return '';
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const remaining = MAX_FETCH_BYTES - received;
          if (remaining <= 0) {
            await reader.cancel().catch(() => {});
            break;
          }
          chunks.push(value.length > remaining ? value.subarray(0, remaining) : value);
          received += Math.min(value.length, remaining);
        }
      }

      const rawText = Buffer.concat(chunks).toString('utf-8');
      if (contentType.includes('text/plain')) {
        const cleanPlain = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_ARTICLE_CHARS);
        return isReadableProse(cleanPlain) ? cleanPlain : '';
      }
      return extractReadableTextFromHtml(rawText);
    }
    return '';
  } catch {
    return '';
  } finally {
    clearTimeout(budgetTimer);
  }
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getCache(key: string): ArticleSummaryResult | null {
  const hit = summaryCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return { ...hit.data, cached: true };
  }
  if (hit) summaryCache.delete(key);
  return null;
}

function putCache(key: string, data: ArticleSummaryResult): void {
  if (summaryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = summaryCache.keys().next().value;
    if (oldestKey) summaryCache.delete(oldestKey);
  }
  summaryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getTranslationCache(key: string): CachedTranslationEntry | null {
  const hit = translationCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.data;
  if (hit) translationCache.delete(key);
  return null;
}

function putTranslationCache(key: string, data: CachedTranslationEntry): void {
  if (translationCache.size >= MAX_TRANSLATION_CACHE_ENTRIES) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
  translationCache.set(key, { data, expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS });
}

const EN_POSITIVE = [
  'surge', 'surges', 'rally', 'rallies', 'jump', 'jumps', 'soar', 'soars', 'gain', 'gains',
  'rise', 'rises', 'beat', 'beats', 'outperform', 'upgrade', 'upgrades', 'bullish', 'record',
  'profit', 'growth', 'strong', 'expansion', 'wins', 'won', 'order', 'deal', 'buyback',
  'dividend', 'approval', 'approved', 'launch', 'boost', 'boosts', 'optimistic', 'recovery',
  'breakout', 'higher', 'upbeat', 'rebound', 'milestone', 'accelerat',
];

const EN_NEGATIVE = [
  'fall', 'falls', 'drop', 'drops', 'plunge', 'plunges', 'slump', 'slumps', 'crash', 'decline',
  'declines', 'loss', 'losses', 'miss', 'misses', 'downgrade', 'downgrades', 'bearish', 'weak',
  'cut', 'cuts', 'warning', 'warns', 'risk', 'risks', 'penalty', 'fine', 'probe', 'lawsuit',
  'investigation', 'fraud', 'default', 'debt', 'layoff', 'layoffs', 'delay', 'tumble', 'tumbles',
  'selloff', 'sell-off', 'pressure', 'slowdown', 'lower', 'concern', 'concerns', 'volatile',
];

const HI_POSITIVE = [
  'तेजी', 'बढ़त', 'उछाल', 'मुनाफा', 'लाभ', 'मजबूत', 'खरीदारी', 'रिकॉर्ड', 'वृद्धि', 'बढ़ा', 'बढ़ी',
  'बेहतर', 'लाभांश', 'बोनस', 'ऑर्डर', 'डील', 'मंजूरी', 'रैली', 'बुलिश', 'सकारात्मक', 'शानदार',
];

const HI_NEGATIVE = [
  'गिरावट', 'नुकसान', 'घाटा', 'बिकवाली', 'कमजोर', 'कमज़ोर', 'दबाव', 'झटका', 'चिंता', 'जुर्माना',
  'जांच', 'जाँच', 'कटौती', 'मंदी', 'नकारात्मक', 'टूटा', 'टूटे', 'फिसला', 'फिसले', 'जोखिम', 'घाटे',
];

function classifyFinancialText(text: string): {
  mood: 'positive' | 'neutral' | 'negative';
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  category: NewsCategory;
} {
  const lower = text.toLowerCase();
  let score = 0;

  for (const w of EN_POSITIVE) {
    if (lower.includes(w)) score += 1;
  }
  for (const w of EN_NEGATIVE) {
    if (lower.includes(w)) score -= 1;
  }
  for (const w of HI_POSITIVE) {
    if (text.includes(w)) score += 1;
  }
  for (const w of HI_NEGATIVE) {
    if (text.includes(w)) score -= 1;
  }

  const mood: 'positive' | 'neutral' | 'negative' =
    score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const sentiment: 'Bullish' | 'Neutral' | 'Bearish' =
    score > 0 ? 'Bullish' : score < 0 ? 'Bearish' : 'Neutral';

  let category: NewsCategory = 'Market';
  if (/(q[1-4]\b|quarter|earnings|results|profit|revenue|ebitda|pat\b|eps\b|margin|तिमाही|नतीजे|मुनाफा|राजस्व)/i.test(text)) {
    category = 'Earnings';
  } else if (/(upgrade|downgrade|target price|brokerage|analyst|rating|buy call|sell call|outperform|ब्रोकरेज|टारगेट|रेटिंग|विश्लेषक)/i.test(text)) {
    category = 'Analyst';
  } else if (/(order|contract|deal|partnership|acquire|acquisition|merger|joint venture|agreement|ऑर्डर|करार|डील|सौदा|अधिग्रहण)/i.test(text)) {
    category = 'Orders & Deals';
  } else if (/(sebi|rbi|fed\b|federal reserve|regulator|regulatory|ministry|court|penalty|fine|policy|tariff|सेबी|आरबीआई|नियामक|कोर्ट|जुर्माना|नीति)/i.test(text)) {
    category = 'Regulatory';
  } else if (/(dividend|buyback|split|bonus|ipo|board|ceo|cfo|promoter|stake|fundraise|capex|लाभांश|बायबैक|बोनस|आईपीओ|बोर्ड|हिस्सेदारी)/i.test(text)) {
    category = 'Corporate';
  }

  return { mood, sentiment, category };
}

function protectPlaceholders(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(/\{[a-zA-Z0-9_]+\}/g, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__PX${idx}__`;
  });
  return { masked, tokens };
}

function restorePlaceholders(text: string, tokens: string[]): string {
  let out = text;
  tokens.forEach((tok, idx) => {
    out = out.replace(new RegExp(`__PX${idx}__`, 'gi'), tok);
  });
  return out;
}

async function translateTextEnToHi(rawText: string): Promise<string> {
  const trimmed = rawText.trim();
  if (!trimmed || hasDevanagari(trimmed)) return trimmed;

  const cacheKey = createHash('sha256').update(`mm_en_hi|${trimmed}`).digest('hex');
  const cached = textTranslateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.text;
  }

  const { masked, tokens } = protectPlaceholders(trimmed.slice(0, 480));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(masked)}&langpair=en|hi`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PredictXNews/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return trimmed;
    const json = await res.json().catch(() => null);
    const status = Number(json?.responseStatus || 0);
    const translatedRaw = String(json?.responseData?.translatedText || '').trim();
    if (
      status !== 200 ||
      !translatedRaw ||
      translatedRaw.toUpperCase().includes('MYMEMORY WARNING') ||
      translatedRaw.toUpperCase().includes('QUERY LENGTH LIMIT')
    ) {
      return trimmed;
    }

    const decoded = restorePlaceholders(decodeHtmlEntities(translatedRaw), tokens).trim();
    if (!decoded) return trimmed;

    if (textTranslateCache.size >= 800) {
      const oldest = textTranslateCache.keys().next().value;
      if (oldest) textTranslateCache.delete(oldest);
    }
    textTranslateCache.set(cacheKey, {
      text: decoded,
      expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS,
    });
    return decoded;
  } catch {
    return trimmed;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(pool);
  return results;
}

function splitSentences(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawParts = normalized
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30);

  if (rawParts.length > 0) return rawParts;

  return normalized
    .split(/[;|\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);
}

function tokenizeForOverlap(sentence: string): Set<string> {
  return new Set(
    sentence
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function trimBullet(sentence: string, maxLen = 210): string {
  const clean = sentence.replace(/^[-•*]\s*/, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-]+$/, '')}…`;
}

function extractKeyBullets(
  text: string,
  symbol: string,
  companyName: string,
  maxBullets = 4
): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  if (sentences.length <= maxBullets) {
    return sentences.map((s) => trimBullet(s));
  }

  const symLower = symbol.toLowerCase();
  const compTokens = companyName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['limited', 'india', 'corp', 'inc.', 'industries'].includes(w));

  const scored = sentences.map((s, idx) => {
    const lower = s.toLowerCase();
    let score = 0;

    if (idx === 0) score += 3.2;
    else if (idx === 1) score += 2.0;
    else if (idx === 2) score += 1.2;

    const numMatches = s.match(/(\d+(?:\.\d+)?%|[₹$€£]\s?\d+|rs\.?\s?\d+|\d+\s?(?:crore|lakh|billion|million|bps|करोड़|लाख|प्रतिशत))/gi);
    if (numMatches) score += Math.min(4.5, numMatches.length * 1.6);

    if (/(revenue|profit|net income|ebitda|pat\b|eps\b|margin|guidance|forecast|outlook|target|dividend|buyback|capex|order|deal|acquisition|q[1-4]|fy\d{2}|yoy|qoq|मुनाफा|राजस्व|तिमाही|लाभांश|ऑर्डर|टारगेट)/i.test(s)) {
      score += 2.4;
    }

    if (symLower && lower.includes(symLower)) score += 1.6;
    if (compTokens.some((tok) => lower.includes(tok))) score += 1.4;

    if (s.length >= 60 && s.length <= 240) score += 1.0;
    else if (s.length > 340) score -= 0.8;

    if (/(subscribe|newsletter|click here|disclaimer|also read|follow us|copyright)/i.test(lower)) {
      score -= 5;
    }

    return { idx, sentence: s, score, tokens: tokenizeForOverlap(s) };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked: typeof scored = [];
  for (const cand of scored) {
    if (picked.length >= maxBullets) break;
    const tooSimilar = picked.some((p) => jaccardSimilarity(p.tokens, cand.tokens) > 0.52);
    if (!tooSimilar) {
      picked.push(cand);
    }
  }

  picked.sort((a, b) => a.idx - b.idx);
  return picked.map((p) => trimBullet(p.sentence));
}

function categoryHindiName(cat: NewsCategory): string {
  switch (cat) {
    case 'Earnings':
      return 'तिमाही नतीजे (Earnings)';
    case 'Analyst':
      return 'विश्लेषक व ब्रोकरेज (Analyst)';
    case 'Orders & Deals':
      return 'ऑर्डर व सौदे (Orders & Deals)';
    case 'Regulatory':
      return 'नियामक अपडेट (Regulatory)';
    case 'Corporate':
      return 'कॉर्पोरेट गतिविधि (Corporate)';
    case 'Market':
    default:
      return 'बाज़ार गतिविधि (Market)';
  }
}

function buildInvestorImpact(
  sentiment: 'Bullish' | 'Neutral' | 'Bearish',
  category: NewsCategory,
  subject: string,
  lang: LanguageCode
): string {
  if (lang === 'hi') {
    const catHi = categoryHindiName(category);
    if (sentiment === 'Bullish') {
      return `${subject} के लिए यह ${catHi} से जुड़ा सकारात्मक संकेत दर्शाता है; निवेशक अगली चाल के लिए कीमत और वॉल्यूम की पुष्टि देख सकते हैं।`;
    }
    if (sentiment === 'Bearish') {
      return `${subject} पर यह ${catHi} से जुड़ा दबाव या जोखिम का संकेत देता है; निवेशक पोजीशन लेने से पहले जोखिम स्तर और सपोर्ट ज़ोन जांचें।`;
    }
    return `${subject} से जुड़ा यह ${catHi} अपडेट फिलहाल संतुलित दिखता है; स्पष्ट दिशा के लिए आधिकारिक आंकड़ों और बाज़ार प्रतिक्रिया पर नज़र रखें।`;
  }

  if (sentiment === 'Bullish') {
    return `Constructive ${category.toLowerCase()} signal for ${subject}; watch for follow-through in trading volume and official guidance.`;
  }
  if (sentiment === 'Bearish') {
    return `Cautious ${category.toLowerCase()} signal for ${subject}; monitor downside risk, margin pressure, and key technical support levels.`;
  }
  return `Balanced ${category.toLowerCase()} update for ${subject}; verify underlying figures and watch how price reacts before acting.`;
}

async function buildHeadlineOnlyBullets(
  title: string,
  publisher: string,
  symbol: string,
  companyName: string,
  sentiment: 'Bullish' | 'Neutral' | 'Bearish',
  category: NewsCategory,
  lang: LanguageCode
): Promise<string[]> {
  const subject = companyName || symbol || (lang === 'hi' ? 'इस शेयर' : 'this stock');
  const displayHeadline = lang === 'hi' ? await translateTextEnToHi(title) : title;

  if (lang === 'hi') {
    const toneWord =
      sentiment === 'Bullish'
        ? 'सकारात्मक (Bullish)'
        : sentiment === 'Bearish'
          ? 'नकारात्मक (Bearish)'
          : 'तटस्थ (Neutral)';
    return [
      `${displayHeadline}${publisher ? ` — स्रोत: ${publisher}` : ''}`,
      `यह अपडेट मुख्य रूप से ${categoryHindiName(category)} श्रेणी से जुड़ा है और शुरुआती रुझान ${toneWord} दिख रहा है।`,
      `पूरा लेख प्रकाशक साइट पर सीमित होने के कारण, निवेशक ${subject} से जुड़े सटीक आंकड़ों, प्रबंधन मार्गदर्शन और वॉल्यूम पुष्टि की जांच करें।`,
    ];
  }

  const toneWord =
    sentiment === 'Bullish'
      ? 'positive (Bullish)'
      : sentiment === 'Bearish'
        ? 'cautious (Bearish)'
        : 'neutral';

  return [
    `${displayHeadline}${publisher ? ` (Source: ${publisher})` : ''}.`,
    `Primary catalyst classified under ${category} with an initial ${toneWord} headline tone.`,
    `Full article text is restricted by the publisher; verify official numbers, management commentary, and price/volume confirmation for ${subject}.`,
  ];
}

export function registerNewsSummary(router: Router): void {
  router.post('/news/summarize', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 320) : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim().slice(0, 1200) : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, MAX_PASTED_CHARS) : '';
    const publisher = typeof req.body?.publisher === 'string' ? req.body.publisher.trim().slice(0, 120) : '';
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim().slice(0, 32) : '';
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim().slice(0, 120) : '';
    const langOpt = getLanguageOption(typeof req.body?.language === 'string' ? req.body.language : 'en');

    if (!title && !text && !url) {
      return res.status(400).json({
        ok: false,
        error: 'Provide an article URL, headline, or article text to summarize.',
      });
    }

    const cacheFingerprint = createHash('sha256')
      .update(`v4_nokey|${langOpt.code}|${symbol}|${url}|${title}|${text.slice(0, 2000)}`)
      .digest('hex');

    const hit = getCache(cacheFingerprint);
    if (hit) {
      return res.json({ ok: true, summary: hit });
    }

    let processedText = '';
    let sourceMode: 'article' | 'pasted' | 'headline' = 'headline';

    if (text.length >= 60) {
      processedText = text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      sourceMode = 'pasted';
    } else if (url) {
      const fetched = await fetchArticleTextSafely(url);
      if (fetched.length >= 160) {
        processedText = fetched;
        sourceMode = 'article';
      }
    }

    const analysisInput = `${title} ${processedText}`.trim();
    const { sentiment, category } = classifyFinancialText(analysisInput);
    const subject = companyName || symbol || (langOpt.code === 'hi' ? 'संबंधित स्टॉक' : 'the stock');
    const originalWordCount =
      sourceMode === 'headline' ? countWords(title) : countWords(processedText);

    let bullets: string[] = [];

    if (sourceMode === 'headline') {
      bullets = await buildHeadlineOnlyBullets(
        title || url,
        publisher,
        symbol,
        companyName,
        sentiment,
        category,
        langOpt.code
      );
    } else {
      const extracted = extractKeyBullets(processedText, symbol, companyName, 4);
      if (extracted.length > 0) {
        bullets =
          langOpt.code === 'hi'
            ? await mapWithConcurrency(extracted, 4, (b) => translateTextEnToHi(b))
            : extracted;
      } else {
        bullets = await buildHeadlineOnlyBullets(
          title || processedText.slice(0, 200),
          publisher,
          symbol,
          companyName,
          sentiment,
          category,
          langOpt.code
        );
      }
    }

    const summary: ArticleSummaryResult = {
      bullets,
      investorImpact: buildInvestorImpact(sentiment, category, subject, langOpt.code),
      sentiment,
      sourceMode,
      originalWordCount,
      language: langOpt.code,
    };

    putCache(cacheFingerprint, summary);
    return res.json({ ok: true, summary });
  });

  router.post('/news/translate', async (req, res) => {
    const rawTarget =
      typeof req.body?.targetLanguage === 'string' ? req.body.targetLanguage.trim().toLowerCase() : '';
    if (!isValidLanguageCode(rawTarget)) {
      return res.status(400).json({
        ok: false,
        error: 'Only English (en) and Hindi (hi) are supported.',
      });
    }

    const langOpt = getLanguageOption(rawTarget);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalizedItems: Array<{ id: string; title: string; isRegionalSource?: boolean }> = [];
    for (const item of rawItems.slice(0, 25)) {
      const id = typeof item?.id === 'string' ? item.id.trim().slice(0, 1200) : '';
      const title = typeof item?.title === 'string' ? item.title.trim().slice(0, 320) : '';
      if (!id || !title) continue;
      normalizedItems.push({
        id,
        title,
        isRegionalSource: Boolean(item?.isRegionalSource),
      });
    }

    if (normalizedItems.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Provide at least one headline to translate.',
      });
    }

    if (langOpt.code === 'en') {
      const passthrough: Record<string, { title: string }> = {};
      for (const item of normalizedItems) {
        passthrough[item.id] = { title: item.title };
      }
      return res.json({
        ok: true,
        language: 'en',
        translations: passthrough,
        cachedCount: normalizedItems.length,
      });
    }

    const results: Record<string, CachedTranslationEntry> = {};
    const pending: Array<{ id: string; title: string; isRegionalSource?: boolean; cacheKey: string }> = [];
    let cachedCount = 0;

    for (const item of normalizedItems) {
      const cacheKey = createHash('sha256')
        .update(`tr_v2_nokey|hi|${item.isRegionalSource ? 'reg' : 'en'}|${item.title}`)
        .digest('hex');
      const hit = getTranslationCache(cacheKey);
      if (hit) {
        results[item.id] = hit;
        cachedCount++;
      } else {
        pending.push({ ...item, cacheKey });
      }
    }

    if (pending.length > 0) {
      await mapWithConcurrency(pending, 4, async (item) => {
        const alreadyHindi = Boolean(item.isRegionalSource) || hasDevanagari(item.title);
        const translatedTitle = alreadyHindi ? item.title : await translateTextEnToHi(item.title);
        const cls = classifyFinancialText(`${item.title} ${translatedTitle}`);
        const entry: CachedTranslationEntry = {
          title: translatedTitle,
          mood: cls.mood,
          category: cls.category,
        };
        results[item.id] = entry;
        putTranslationCache(item.cacheKey, entry);
      });
    }

    return res.json({
      ok: true,
      language: 'hi',
      translations: results,
      cachedCount,
    });
  });

  registerUiBatchTranslate(router);
}

const MAX_UI_BATCH_KEYS = 100;
const MAX_UI_VALUE_CHARS = 320;

function registerUiBatchTranslate(router: Router): void {
  router.post('/translate/batch', async (req, res) => {
    const rawTarget =
      typeof req.body?.targetLanguage === 'string' ? req.body.targetLanguage.trim().toLowerCase() : '';
    if (!isValidLanguageCode(rawTarget)) {
      return res.status(400).json({
        ok: false,
        error: 'Only English (en) and Hindi (hi) are supported.',
      });
    }

    const langOpt = getLanguageOption(rawTarget);
    const rawStrings = req.body?.strings;
    if (!rawStrings || typeof rawStrings !== 'object' || Array.isArray(rawStrings)) {
      return res.status(400).json({
        ok: false,
        error: 'Provide a strings dictionary object to translate.',
      });
    }

    const entries: Array<[string, string]> = [];
    for (const [rawKey, rawVal] of Object.entries(rawStrings)) {
      if (entries.length >= MAX_UI_BATCH_KEYS) break;
      const key = String(rawKey || '').trim().slice(0, 80);
      const val = typeof rawVal === 'string' ? rawVal.trim().slice(0, MAX_UI_VALUE_CHARS) : '';
      if (key && val) {
        entries.push([key, val]);
      }
    }

    if (entries.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No valid strings were provided for translation.',
      });
    }

    if (langOpt.code === 'en') {
      return res.json({
        ok: true,
        language: 'en',
        provider: 'builtin',
        translations: Object.fromEntries(entries),
        cached: true,
      });
    }

    const translations: Record<string, string> = {};
    const unknownEntries: Array<[string, string]> = [];

    for (const [key, orig] of entries) {
      if (BUILTIN_HINDI_UI[key]) {
        translations[key] = BUILTIN_HINDI_UI[key];
      } else {
        unknownEntries.push([key, orig]);
      }
    }

    if (unknownEntries.length > 0) {
      await mapWithConcurrency(unknownEntries, 4, async ([key, orig]) => {
        translations[key] = await translateTextEnToHi(orig);
      });
    }

    return res.json({
      ok: true,
      language: 'hi',
      provider: unknownEntries.length === 0 ? 'builtin' : 'mymemory',
      translations,
      cached: unknownEntries.length === 0,
    });
  });
}
