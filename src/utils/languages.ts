export type LanguageCode = 'en' | 'hi';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  shortLabel: string;
  dir: 'ltr';
  googleNews: {
    hl: string;
    gl: string;
    ceid: string;
  };
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    shortLabel: 'EN',
    dir: 'ltr',
    googleNews: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    shortLabel: 'हिन्दी',
    dir: 'ltr',
    googleNews: { hl: 'hi', gl: 'IN', ceid: 'IN:hi' },
  },
] as const;

const LANG_MAP = new Map<string, LanguageOption>(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l])
);

export function isValidLanguageCode(code?: string | null): code is LanguageCode {
  if (!code) return false;
  return LANG_MAP.has(code.trim().toLowerCase());
}

export function getLanguageOption(code?: string | null): LanguageOption {
  const normalized = (code || 'en').trim().toLowerCase();
  return LANG_MAP.get(normalized) || SUPPORTED_LANGUAGES[0];
}

export const LANGUAGE_STORAGE_KEY = 'predictx_language_v1';
export const LANGUAGE_CHANGED_EVENT = 'predictx_language_changed';

export function getSavedLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isValidLanguageCode(raw)) return raw;
  } catch {
  }
  return 'en';
}

export function saveLanguage(code: LanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
  }
  try {
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: code }));
  } catch {
  }
}
