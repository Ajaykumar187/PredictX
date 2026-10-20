import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { MarketType, AnalysisResult } from './types';
import { storage } from './utils/storage';
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
import { AlertCircle, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const AskPredictXPage = lazy(() => import('./pages/AskPredictXPage').then((m) => ({ default: m.AskPredictXPage })));
const ChartsPage = lazy(() => import('./pages/ChartsPage').then((m) => ({ default: m.ChartsPage })));
const StockComparePage = lazy(() => import('./pages/StockComparePage').then((m) => ({ default: m.StockComparePage })));
const TradeJournalPage = lazy(() => import('./pages/TradeJournalPage').then((m) => ({ default: m.TradeJournalPage })));
const TrackRecordPage = lazy(() => import('./pages/TrackRecordPage').then((m) => ({ default: m.TrackRecordPage })));
const AIFeaturesPage = lazy(() => import('./pages/AIFeaturesPage').then((m) => ({ default: m.AIFeaturesPage })));
const CompanyInfoPage = lazy(() => import('./pages/CompanyInfoPage').then((m) => ({ default: m.CompanyInfoPage })));
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
  'home', 'ask', 'compare', 'charts', 'ai', 'company', 'dividends', 'news',
  'portfolio', 'alerts', 'scanners', 'global', 'tools', 'strategy', 'report',
  'ipo', 'watchlist', 'options', 'advanced', 'account', 'journal', 'trackrecord',
  'smartmoney', 'paper'
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
  const [theme, setTheme] = useState<'Light' | 'Dark'>(storage.getTheme());
  const [activePage, setActivePage] = useState<PageId>(() => getSafePage(typeof window !== 'undefined' ? window.location.hash : 'home'));
  const [market, setMarket] = useState<MarketType>('NSE');
  const [symbol, setSymbol] = useState('');
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const closeSidebar = () => setSidebarOpen(false);

  const [historyStack, setHistoryStack] = useState<PageId[]>(() => {
    const initial = getSafePage(typeof window !== 'undefined' ? window.location.hash : 'home');
    return initial === 'home' ? ['home'] : ['home', initial];
  });

  const handleNavigate = (page: PageId, pushHistory = true) => {
    const target = getSafePage(page);
    if (target === activePage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (pushHistory) {
      setHistoryStack((prev) => [...prev, target]);
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

  const handleGoBack = () => {
    if (historyStack.length > 1) {
      const nextStack = [...historyStack];
      nextStack.pop();
      const prevPage = nextStack[nextStack.length - 1] || 'home';
      setHistoryStack(nextStack);
      setActivePage(prevPage);
      try {
        window.history.pushState(
          { page: prevPage, predictx: true },
          '',
          prevPage === 'home' ? '#home' : `#${prevPage}`
        );
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (activePage !== 'home') {
      setActivePage('home');
      setHistoryStack(['home']);
      try {
        window.history.pushState({ page: 'home', predictx: true }, '', '#home');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const initial = getSafePage(window.location.hash);
    setActivePage(initial);
    setHistoryStack(initial === 'home' ? ['home'] : ['home', initial]);

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

      setActivePage(targetPage);

      setHistoryStack((prev) => {
        const idx = prev.lastIndexOf(targetPage);
        if (idx !== -1) {
          return prev.slice(0, idx + 1);
        }
        return targetPage === 'home' ? ['home'] : ['home', targetPage];
      });

      if (targetPage === 'home') {
        try {
          if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
            window.history.replaceState({ page: 'home', predictx: true }, '', '#home');
          }
        } catch {}
      }

      setSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHashChange = () => {
      const targetPage = getSafePage(window.location.hash);
      setActivePage(targetPage);
      setSidebarOpen(false);
      setHistoryStack((prev) => {
        const idx = prev.lastIndexOf(targetPage);
        if (idx !== -1) {
          return prev.slice(0, idx + 1);
        }
        return targetPage === 'home' ? ['home'] : ['home', targetPage];
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => readCachedAnalysis());
  const reqId = useRef(0);
  const needsAnalysis = ['home', 'charts', 'ai', 'company', 'dividends', 'news', 'alerts', 'strategy', 'advanced'].includes(activePage);

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

      setRecentlyViewed((prev) => {
        const filtered = prev.filter((s) => s !== safeRes.displaySymbol);
        return [safeRes.displaySymbol, ...filtered].slice(0, 6);
      });
    } catch (err: any) {
      console.error('Error fetching live stock data from Yahoo Finance:', err);
      setErrorMessage(err.message || `No live data found on Yahoo Finance for "${target}".`);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      if (reqId.current === myReq) setIsLoading(false);
    }
  };

  const handleSelectStockFromModule = (sym: string, m: MarketType) => {
    setSymbol(sym);
    setMarket(m);
    handleLoadStock(sym, m);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors p-2.5 sm:p-3 md:p-5 font-sans flex flex-col overflow-x-hidden">
      <div className="max-w-[1600px] w-full mx-auto flex flex-col flex-1">
        <div className="flex-shrink-0 mb-2">
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Sidebar minimize karein' : 'Sidebar kholein'}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            <span>{sidebarOpen ? 'Hide Menu' : 'Menu'}</span>
          </button>
        </div>
        <div className="flex-shrink-0">
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
          />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch">
          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <div
            aria-hidden={!sidebarOpen}
            className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] p-2 transition-transform duration-300 ease-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
            }`}
          >
            <button
              onClick={closeSidebar}
              aria-label="Close sidebar"
              className="absolute top-5 right-5 z-10 w-7 h-7 flex items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          <Sidebar
            activePage={activePage}
            onSelectPage={(p) => { handleNavigate(p); closeSidebar(); }}
            market={market}
            onChangeMarket={(m) => setMarket(m)}
            symbol={symbol}
            onSymbolChange={(s) => setSymbol(s)}
            onLoadStock={(targetSym, targetMarket) => {
              const m = targetMarket || market;
              setMarket(m);
              handleLoadStock(targetSym || symbol, m);
              closeSidebar();
            }}
            isLoading={isLoading}
            recentlyViewed={recentlyViewed}
            onSelectRecent={(s, targetMarket) => {
              const m = targetMarket || market;
              setSymbol(s);
              setMarket(m);
              handleLoadStock(s, m);
              closeSidebar();
            }}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
          </div>

          <main className="flex-1 w-full min-w-0 pb-12 flex flex-col">
            <QuickNavHeader
              activePage={activePage}
              onNavigate={handleNavigate}
              onGoBack={handleGoBack}
              canGoBack={historyStack.length > 1 || activePage !== 'home'}
            />

            {needsAnalysis && !analysis && (
              isLoading ? (
                <PageSkeleton />
              ) : activePage === 'home' ? (
                <>
                  <LandingHome onNavigate={handleNavigate} onOpenMenu={() => setSidebarOpen(true)} />
                  {errorMessage && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 text-center">{errorMessage}</p>}
                </>
              ) : (
                <EmptyState
                  isLoading={isLoading}
                  errorMessage={errorMessage}
                  onLoadStock={handleSelectStockFromModule}
                  title="Pehle ek stock select karein"
                />
              )
            )}
            <ErrorBoundary onReset={() => handleLoadStock(symbol, market)}>
              <Suspense fallback={<PageSkeleton />}>
              {activePage === 'home' && analysis && <HomePage data={analysis} onNavigate={handleNavigate} theme={theme} />}
              {activePage === 'ask' && <AskPredictXPage data={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} onNavigate={handleNavigate} />}
              {activePage === 'compare' && <StockComparePage data={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'journal' && <TradeJournalPage currentAnalysis={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'trackrecord' && <TrackRecordPage currentAnalysis={analysis || undefined} theme={theme} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'charts' && analysis && <ChartsPage data={analysis} theme={theme} />}
              {activePage === 'ai' && analysis && <AIFeaturesPage data={analysis} theme={theme} />}
              {activePage === 'company' && analysis && <CompanyInfoPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'dividends' && analysis && <DividendPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'news' && analysis && <NewsPage data={analysis} />}
              {activePage === 'portfolio' && <PortfolioPage onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'alerts' && analysis && <AlertsPage currentSymbol={analysis.displaySymbol} currentMarket={analysis.market} />}
              {activePage === 'scanners' && <ScannersPage onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'global' && <GlobalMarketsPage onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'tools' && <InvestmentToolsPage />}
              {activePage === 'strategy' && analysis && <StrategyLabPage data={analysis} theme={theme} />}
              {activePage === 'report' && <ReportAnalyzerPage />}
              {activePage === 'ipo' && <IPOPredictorPage />}
              {activePage === 'watchlist' && <WatchlistPage onSelectStock={(s, m) => { handleSelectStockFromModule(s, m); handleNavigate('home'); }} />}
              {activePage === 'options' && <OptionAnalyzerPage />}
              {activePage === 'advanced' && analysis && <AdvancedPage data={analysis} theme={theme} />}
              {activePage === 'smartmoney' && <SmartMoneyPage data={analysis} />}
              {activePage === 'paper' && <PaperTradingPage data={analysis} onSelectStock={handleSelectStockFromModule} />}
              {activePage === 'account' && <AccountPage />}
              </Suspense>
            </ErrorBoundary>

            <Footer
              activePage={activePage}
              onNavigate={handleNavigate}
            />
          </main>
        </div>

        {errorMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce text-sm font-medium border border-rose-400">
            <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-2 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
