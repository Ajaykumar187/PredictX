import React, { useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_CHANGED_EVENT,
  LANGUAGE_STORAGE_KEY,
  getLanguageOption,
  getSavedLanguage,
  saveLanguage,
  type LanguageCode,
  type LanguageOption,
} from '../utils/languages';

export function usePreferredLanguage(): [LanguageCode, (code: LanguageCode) => void, LanguageOption] {
  const [language, setLanguageState] = useState<LanguageCode>(() => getSavedLanguage());

  useEffect(() => {
    const onCustomChange = (e: Event) => {
      const detail = (e as CustomEvent<LanguageCode>).detail;
      if (detail === 'en' || detail === 'hi') {
        setLanguageState(detail);
      } else {
        setLanguageState(getSavedLanguage());
      }
    };
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) {
        setLanguageState(getSavedLanguage());
      }
    };

    window.addEventListener(LANGUAGE_CHANGED_EVENT, onCustomChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, onCustomChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
    saveLanguage(code);
  };

  const option = useMemo(() => getLanguageOption(language), [language]);
  return [language, setLanguage, option];
}

interface LanguageSelectorProps {
  variant?: 'compact' | 'toolbar';
  value?: LanguageCode;
  onChange?: (code: LanguageCode) => void;
  align?: 'left' | 'right';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'toolbar',
  value,
  onChange,
}) => {
  const [storedLang, setStoredLang] = usePreferredLanguage();
  const activeCode = value ?? storedLang;

  const handleSelect = (code: LanguageCode) => {
    if (code === activeCode) return;
    if (onChange) {
      onChange(code);
    } else {
      setStoredLang(code);
    }
  };

  const containerCls =
    variant === 'compact'
      ? 'inline-flex items-center gap-0.5 h-9 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/90 bg-slate-100/80 dark:bg-slate-800/80 shrink-0'
      : 'inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0';

  return (
    <div
      role="group"
      aria-label="Language selection"
      data-no-translate="true"
      className={containerCls}
    >
      <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mx-1.5 shrink-0 hidden sm:block" />
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = lang.code === activeCode;
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={selected}
            onClick={() => handleSelect(lang.code)}
            title={`Switch to ${lang.name} (${lang.nativeName})`}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selected
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {variant === 'compact' ? lang.shortLabel : lang.nativeName}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSelector;
