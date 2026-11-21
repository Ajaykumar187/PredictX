import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { MarketType, AnalysisResult, RecentSearchItem } from './types';
import { AUTH_CHANGED_EVENT, storage } from './utils/storage';
import { Navbar } from './components/Navbar';
import { Sidebar, PageId } from './components/Sidebar';
import { fetchAndAnalyzeStock } from './utils/stockApi';
import { ensureCurrencyFmt } from './utils/marketData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuickNavHeader } from './components/QuickNavHeader';
import { Footer } from './components/Footer';
import { EmptyState } from './components/EmptyState';
import { LandingHome } from './components/LandingHome';
import { logPrediction } from './utils/accuracy';
import { getTradeSessionStartedAt } from './utils/tradePerformance';
import { usePreferredLanguage } from './components/LanguageSelector';
import { getSiteTranslator } from './utils/siteTranslator';
import { AlertCircle, X } from 'lucide-react';

getTradeSessionStartedAt();


const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const AskPredictXPage = lazy(() => import('./pages/AskPredictXPage').then((m) => ({ default: m.AskPredictXPage })));
const ChartsPage = lazy(() => import('./pages/ChartsPage').then((m) => ({ default: m.ChartsPage })));
const StockComparePage = lazy(() => import('./pages/StockComparePage').then((m) => ({ default: m.StockComparePage })));
const TradeJournalPage = lazy(() => import('./pages/TradeJournalPage').then((m) => ({ default: m.TradeJournalPage })));
const TrackRecordPage = lazy(() => import('./pages/TrackRecordPage').then((m) => ({ default: m.TrackRecordPage })));
const AIFeaturesPage = lazy(() => import('./pages/AIFeaturesPage').then((m) => ({ default: m.AIFeaturesPage })));
const CompanyInfoPage = lazy(() => import('./pages/CompanyInfoPage').then((m) => ({ default: m.CompanyInfoPage })));
const QuarterlyResultsPage = lazy(() => import('./pages/QuarterlyResultsPage').then((m) => ({ default: m.QuarterlyResultsPage })));
const DividendPage = lazy(() => import('./pages/DividendPage').then((m) => ({ default: m.DividendPage })));
const NewsPage = lazy(() => import('./pages/NewsPage').then((m) => ({ default: m.NewsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const ScannersPage = lazy(() => import('./pages/ScannersPage').then((m) => ({ default: m.ScannersPage })));
const GlobalMarketsPage = lazy(() => import('./pages/GlobalMarketsPage').then((m) => ({ default: m.GlobalMarketsPage })));
const InvestmentToolsPage = lazy(() => import('./pages/InvestmentToolsPage').then((m) => ({ default: m.InvestmentToolsPage })));
const StrategyLabPage = lazy(() => import('./pages/StrategyLabPage').then((m) => ({ default: m.StrategyLabPage })));
const ReportAnalyzerPage = lazy(() => import('./pages/ReportAnalyzerPage').then((m) => ({ default: m.ReportAnalyzerPage })));
const IPOPredictorPage = lazy(() => import('./pages/IPOPredictorPage').then((m) => ({ default: m.IPOPredictorPage })));
const OptionAnalyzerPage = lazy(() => import('./pages/OptionAnalyzerPage').then((m) => ({ default: m.OptionAnalyzerPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const AdvancedPage = lazy(() => import('./pages/AdvancedPage').then((m) => ({ default: m.AdvancedPage })));
const SmartMoneyPage = lazy(() => import('./pages/SmartMoneyPage').then((m) => ({ default: m.SmartMoneyPage })));
const PaperTradingPage = lazy(() => import('./pages/PaperTradingPage').then((m) => ({ default: m.PaperTradingPage })));
const MarketHeatmapPage = lazy(() => import('./pages/MarketHeatmapPage').then((m) => ({ default: m.MarketHeatmapPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));

const CACHE_KEY = 'predictx_last_analysis_v1';  
const readCachedAnalysis = (): AnalysisResult | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return ensureCurrencyFmt(parsed);
  } catch {
    return null;
  }
};
const writeCachedAnalysis = (a: AnalysisResult) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(a));
  } catch {
  }
};

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 ${className}`} />
);
const PageSkeleton: React.FC = () => (
  <div className="space-y-4" aria-hidden="true">
    <Skeleton className="h-28" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
    </div>
    <Skeleton className="h-72" />
  </div>
);

export const VALID_PAGES: PageId[] = [
  'home', 'ask', 'compare', 'charts', 'ai', 'company', 'quarterly', 'dividends', 'news',
  'portfolio', 'alerts', 'scanners', 'global', 'tools', 'strategy', 'report',
  'ipo', 'watchlist', 'options', 'advanced', 'account', 'journal', 'trackrecord',
  'smartmoney', 'paper', 'heatmap'
];

export const getSafePage = (raw: unknown): PageId => {
  if (typeof raw === 'string') {
    const clean = raw.replace(/^#/, '').trim().toLowerCase();
    if (VALID_PAGES.includes(clean as PageId)) {
      return clean as PageId;
    }
  }
  return 'home';
};

export const App: React.FC = () => {
  const [language] = usePreferredLanguage();
  const [theme, setTheme] = useState<'Light' | 'Dark'>(storage.getTheme());
  const [activePage, setActivePage] = useState<PageId>(() => getSafePage(typeof window !== 'undefined' ? window.location.hash : 'home'));
  const [market, setMarket] = useState<MarketType>('NSE');
  const [symbol, setSymbol] = useState('');
  const [recentlySearched, setRecentlySearched] = useState<RecentSearchItem[]>(() => storage.getRecentSearches());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const translator = getSiteTranslator();
    translator.setLanguage(language);
  }, [language, activePage]);

  useEffect(() => {
    let active = true;
    void storage.hydrateSession().finally(() => {
      if (active) setAuthVersion((v) => v + 1);
    });
    const onAuthChanged = () => {
      if (active) setAuthVersion((v) => v + 1);
    };
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === 'predictx_profile_cache_v1') {
        void storage.hydrateSession(true);
      }
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorageSync);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorageSync);
    };
  }, []);

  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward');

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  );
  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleNavigate = (page: PageId, pushHistory = true) => {
    const target = getSafePage(page);
    if (target === activePage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setNavDirection('forward');
    if (pushHistory) {
      try {
        window.history.pushState(
          { page: target, predictx: true },
          '',
          target === 'home' ? '#home' : `#${target}`
        );
      } catch {}
    }
    setActivePage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const initial = getSafePage(window.location.hash);
    setActivePage(initial);

    try {
      window.history.replaceState(
        { page: initial, predictx: true },
        '',
        initial === 'home' ? '#home' : `#${initial}`
      );
    } catch {}

    const handlePopState = (e: PopStateEvent) => {
      let targetPage: PageId = 'home';
      if (e.state && typeof e.state.page === 'string') {
        targetPage = getSafePage(e.state.page);
      } else {
        targetPage = getSafePage(window.location.hash);
      }

      setNavDirection('backward');
      setActivePage(targetPage);

      if (targetPage === 'home') {
        try {
          if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
            window.history.replaceState({ page: 'home', predictx: true }, '', '#home');
          }
        } catch {}
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHashChange = () => {
      const targetPage = getSafePage(window.location.hash);
      if (targetPage === activePage) return;
      setNavDirection('forward');
      setActivePage(targetPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activePage]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => readCachedAnalysis());
  const reqId = useRef(0);
  const needsAnalysis = ['home', 'charts', 'ai', 'company', 'quarterly', 'dividends', 'news', 'alerts', 'strategy', 'advanced'].includes(activePage);

  useEffect(() => {
    if (analysis) {
      setSymbol(analysis.displaySymbol);
      setMarket(analysis.market);
      handleLoadStock(analysis.displaySymbol, analysis.market);
    }
  }, []);

  useEffect(() => {
    if (theme === 'Dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    storage.saveTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'Dark' ? 'Light' : 'Dark'));
  };

  const handleLoadStock = async (stockSym?: string, stockMarket: MarketType = market) => {
    setIsLoading(true);
    setErrorMessage(null);
    const target = (stockSym || symbol).trim();
    if (!target) {
      setIsLoading(false);
      return;
    }
    const myReq = ++reqId.current;

    try {
      const res = await fetchAndAnalyzeStock(target, stockMarket, (enriched) => {
        if (reqId.current === myReq) {
          const safe = ensureCurrencyFmt(enriched);
          if (safe) {
            setAnalysis(safe);
            writeCachedAnalysis(safe);
          }
        }
      });
      if (reqId.current !== myReq) return;
      const safeRes = ensureCurrencyFmt(res) || res;
      setAnalysis(safeRes);
      writeCachedAnalysis(safeRes);
      try { logPrediction(safeRes); } catch { }
      setSymbol(safeRes.displaySymbol);
      setMarket(safeRes.market);

      const updatedSearches = storage.addRecentSearch(safeRes.displaySymbol, safeRes.market);
      setRecentlySearched(updatedSearches);
    } catch (err: any) {
      console.error('Error fetching live stock data from Yahoo Finance:', err);
      setErrorMessage(err.message || `No live data found on Yahoo Finance for "${target}".`);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      if (reqId.current === myReq) setIsLoading(false);
    }
  };

  const handleRemoveRecentSearch = (sym: string) => {
    const updated = storage.removeRecentSearch(sym);
    setRecentlySearched(updated);
  };

  const handleClearRecentSearches = () => {
    storage.clearRecentSearches();
    setRecentlySearched([]);
  };

  const handleSelectStockFromModule = (sym: string, m: MarketType) => {
    setSymbol(sym);
    setMarket(m);
    handleLoadStock(sym, m);
  };

  const renderPageContent = () => {
    if (needsAnalysis && !analysis) {
      if (isLoading) {
        return <PageSkeleton />;
      }
      if (activePage === 'home') {
        return (
          <div className="w-full">
            <LandingHome onNavigate={handleNavigate} onOpenMenu={() => setSidebarOpen(true)} />
            {errorMessage && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 text-center">{errorMessage}</p>}
          </div>
        );
      }
      return (
        <EmptyState
          isLoading={isLoading}
          errorMessage={errorMessage}
          onLoadStock={handleSelectStockFromModule}
          title="Select a stock first"
        />
      );
    }

    return (
      <div className="w-full space-y-6">
        {activePage === 'home' && analysis && <HomePage data={analysis} onNavigate={handleNavigate} theme={theme} />}
        {activePage === 'ask' && <AskPredictXPage data={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} onNavigate={handleNavigate} />}
        {activePage === 'compare' && <StockComparePage data={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'journal' && <TradeJournalPage currentAnalysis={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'trackrecord' && <TrackRecordPage currentAnalysis={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'charts' && analysis && <ChartsPage data={analysis} theme={theme} />}
        {activePage === 'ai' && analysis && <AIFeaturesPage data={analysis} theme={theme} />}
        {activePage === 'company' && analysis && <CompanyInfoPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'quarterly' && analysis && <QuarterlyResultsPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'dividends' && analysis && <DividendPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'news' && analysis && <NewsPage data={analysis} />}
        {activePage === 'portfolio' && <PortfolioPage key={`portfolio-${authVersion}`} onSelectStock={handleSelectStockFromModule} theme={theme} />}
        {activePage === 'alerts' && analysis && <AlertsPage key={`alerts-${authVersion}`} currentSymbol={analysis.displaySymbol} currentMarket={analysis.market} />}
        {activePage === 'scanners' && <ScannersPage onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'heatmap' && (
          <MarketHeatmapPage
            theme={theme}
            recentSearches={recentlySearched}
            onRemoveRecent={handleRemoveRecentSearch}
            onClearRecent={handleClearRecentSearches}
            activeSymbol={analysis?.displaySymbol}
            onSelectStock={(s, m) => {
              handleSelectStockFromModule(s, m);
              handleNavigate('home');
            }}
          />
        )}
        {activePage === 'global' && <GlobalMarketsPage onSelectStock={handleSelectStockFromModule} />}
        {activePage === 'tools' && <InvestmentToolsPage />}
        {activePage === 'strategy' && analysis && <StrategyLabPage data={analysis} theme={theme} />}
        {activePage === 'report' && <ReportAnalyzerPage />}
        {activePage === 'ipo' && <IPOPredictorPage />}
        {activePage === 'watchlist' && <WatchlistPage key={`watchlist-${authVersion}`} onSelectStock={(s, m) => { handleSelectStockFromModule(s, m); handleNavigate('home'); }} />}
        {activePage === 'options' && <OptionAnalyzerPage />}
        {activePage === 'advanced' && analysis && <AdvancedPage data={analysis} theme={theme} />}
        {activePage === 'smartmoney' && <SmartMoneyPage data={analysis} />}
        {activePage === 'paper' && <PaperTradingPage key={`paper-${authVersion}`} data={analysis} onSelectStock={handleSelectStockFromModule} onNavigate={handleNavigate} />}
        {activePage === 'account' && <AccountPage />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors font-sans flex flex-col overflow-x-hidden">
      <div
        className={`md:hidden fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[284px] max-w-[85vw] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <Sidebar
          activePage={activePage}
          onSelectPage={(p) => {
            handleNavigate(p);
            closeSidebar();
          }}
          market={market}
          onChangeMarket={(m) => setMarket(m)}
          symbol={symbol}
          onSymbolChange={(s) => setSymbol(s)}
          onLoadStock={(targetSym, targetMarket) => {
            const m = targetMarket || market;
            setMarket(m);
            handleLoadStock(targetSym || symbol, m);
            if (!needsAnalysis) {
              handleNavigate('home');
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            closeSidebar();
          }}
          isLoading={isLoading}
          recentlySearched={recentlySearched}
          recentlyViewed={recentlySearched.map((r) => r.symbol)}
          onSelectRecent={(s, targetMarket) => {
            const m = targetMarket || market;
            setSymbol(s);
            setMarket(m);
            handleLoadStock(s, m);
            if (!needsAnalysis) {
              handleNavigate('home');
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            closeSidebar();
          }}
          onRemoveRecent={handleRemoveRecentSearch}
          onClearRecent={handleClearRecentSearches}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onCloseSidebar={closeSidebar}
        />
      </div>

      <div
        onClick={(e) => {
          if (!sidebarOpen) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-sidebar-toggle="true"]')) return;
          closeSidebar();
        }}
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarOpen ? 'md:pl-[284px]' : 'md:pl-0'
        }`}
      >
        <Navbar
          theme={theme}
          onToggleTheme={handleToggleTheme}
          activeStock={analysis?.displaySymbol}
          activeMarket={analysis?.market}
          currentPrice={analysis?.latestPrice}
          change={analysis?.change}
          changePct={analysis?.changePct}
          currencySymbol={analysis?.currencySymbol}
          onNavigate={handleNavigate}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 md:px-6 pt-4 pb-12 flex flex-col min-w-0 overflow-x-clip">
          <QuickNavHeader
            activePage={activePage}
            onNavigate={handleNavigate}
          />

          <ErrorBoundary onReset={() => handleLoadStock(symbol, market)}>
            <Suspense fallback={<PageSkeleton />}>
              <div
                key={`${activePage}-${analysis ? analysis.displaySymbol : 'no-stock'}`}
                className={`w-full flex-1 flex flex-col page-transition-container ${
                  navDirection === 'backward' ? 'page-transition-backward' : 'page-transition-forward'
                }`}
              >
                {renderPageContent()}
              </div>
            </Suspense>
          </ErrorBoundary>

          <Footer
            activePage={activePage}
            onNavigate={handleNavigate}
          />
        </main>
      </div>

      {errorMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-rose-500">
          <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="ml-2 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
