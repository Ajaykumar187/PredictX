import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateOptionChain } from '../utils/greeks';
import * as stockApi from '../utils/stockApi';
import { fetchLiveQuote, fetchLiveOptionChain } from '../utils/stockApi';
import type { LiveOptionChainResponse } from '../utils/stockApi';
import type { MarketType } from '../types';
import { NseOptionChainTable } from '../components/NseOptionChainTable';
import {
  Layers,
  RefreshCw,
  AlertTriangle,
  Pause,
  Play,
} from 'lucide-react';

interface InstrumentMeta {
  ticker: string;
  name: string;
  market: MarketType;
  exchange: 'NSE' | 'BSE' | 'COMMODITY';
  lotSize: number;
  step: number;
}

const INSTRUMENT_CONFIG: Record<string, InstrumentMeta> = {
  NIFTY: { ticker: '^NSEI', name: 'NIFTY 50', market: 'INDEX', exchange: 'NSE', lotSize: 75, step: 50 },
  BANKNIFTY: { ticker: '^NSEBANK', name: 'BANK NIFTY', market: 'INDEX', exchange: 'NSE', lotSize: 30, step: 100 },
  FINNIFTY: { ticker: 'NIFTY_FIN_SERVICE.NS', name: 'FIN NIFTY', market: 'INDEX', exchange: 'NSE', lotSize: 65, step: 50 },
  SENSEX: { ticker: '^BSESN', name: 'BSE SENSEX', market: 'INDEX', exchange: 'BSE', lotSize: 20, step: 100 },
  RELIANCE: { ticker: 'RELIANCE.NS', name: 'Reliance Industries', market: 'NSE', exchange: 'NSE', lotSize: 500, step: 20 },
  TCS: { ticker: 'TCS.NS', name: 'Tata Consultancy', market: 'NSE', exchange: 'NSE', lotSize: 175, step: 50 },
  INFY: { ticker: 'INFY.NS', name: 'Infosys Limited', market: 'NSE', exchange: 'NSE', lotSize: 400, step: 20 },
  GOLD: { ticker: 'GC=F', name: 'Gold Futures', market: 'US', exchange: 'COMMODITY', lotSize: 100, step: 25 },
  SILVER: { ticker: 'SI=F', name: 'Silver Futures', market: 'US', exchange: 'COMMODITY', lotSize: 30, step: 0.5 },
  CRUDEOIL: { ticker: 'CL=F', name: 'Crude Oil Futures', market: 'US', exchange: 'COMMODITY', lotSize: 100, step: 1 },
  NATURALGAS: { ticker: 'NG=F', name: 'Natural Gas Futures', market: 'US', exchange: 'COMMODITY', lotSize: 1250, step: 0.1 },
};

const AVAILABLE_SYMBOLS = Object.entries(INSTRUMENT_CONFIG).map(([symbol, meta]) => ({
  symbol,
  name: meta.name,
}));

const REFRESH_MS = 10_000;

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const OptionAnalyzerPage: React.FC = () => {
  const [indexName, setIndexName] = useState<string>('NIFTY');
  const [spot, setSpot] = useState<number>(0);
  const [spotChange, setSpotChange] = useState<number>(0);
  const [spotChangePct, setSpotChangePct] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [liveChainData, setLiveChainData] = useState<LiveOptionChainResponse | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [failReason, setFailReason] = useState<string>('');
  const [strikes, setStrikes] = useState<number>(10);

  const config = INSTRUMENT_CONFIG[indexName] || INSTRUMENT_CONFIG.NIFTY;
  const requestId = useRef(0);
  const selectedExpiryRef = useRef(selectedExpiry);
  selectedExpiryRef.current = selectedExpiry;

  const loadLive = useCallback(
    async (opts?: { force?: boolean; expiryOverride?: string }) => {
      const myId = ++requestId.current;
      const force = Boolean(opts?.force);
      const targetExpiry =
        opts?.expiryOverride !== undefined ? opts.expiryOverride : selectedExpiryRef.current;

      setIsLoading(true);
      try {
        const chainRes = await fetchLiveOptionChain(
          indexName,
          targetExpiry || undefined,
          strikes,
          force
        );

        if (myId !== requestId.current) return;

        if (chainRes && chainRes.chain && chainRes.chain.length > 0 && chainRes.spotPrice > 0) {
          setLiveChainData(chainRes);
          setSpot(chainRes.spotPrice);
          setSpotChange(Number.isFinite(chainRes.dayChange) ? chainRes.dayChange : 0);
          setSpotChangePct(Number.isFinite(chainRes.dayChangePerc) ? chainRes.dayChangePerc : 0);
          if (chainRes.currentExpiry && chainRes.currentExpiry !== selectedExpiryRef.current) {
            selectedExpiryRef.current = chainRes.currentExpiry;
            setSelectedExpiry(chainRes.currentExpiry);
          }
          setLastUpdated(nowTime());
          setLoadFailed(false);
          setFailReason('');
          return;
        }

        // Fallback: fetch live underlying quote directly if option chain endpoint returned empty
        setFailReason(stockApi.lastOptionChainError || 'Option chain feed temporarily unavailable');
        const liveData = await fetchLiveQuote(config.ticker, config.market);
        if (myId !== requestId.current) return;

        if (liveData && liveData.latestPrice && liveData.latestPrice > 0) {
          setSpot(liveData.latestPrice);
          setSpotChange(typeof liveData.change === 'number' ? liveData.change : 0);
          setSpotChangePct(typeof liveData.changePct === 'number' ? liveData.changePct : 0);
          setLastUpdated(nowTime());
          setLoadFailed(false);
        } else {
          setLoadFailed(true);
        }
      } catch (e) {
        if (myId !== requestId.current) return;
        console.warn('[OptionAnalyzer] Failed to fetch live option chain:', e);
        setLoadFailed(true);
        setFailReason('Could not reach live option chain API.');
      } finally {
        if (myId === requestId.current) setIsLoading(false);
      }
    },
    [indexName, strikes, config.ticker, config.market]
  );

  // Trigger initial load whenever symbol or strike window changes
  useEffect(() => {
    loadLive({ force: false });
  }, [loadLive]);

  // Clean 10s background auto-refresh when active
  useEffect(() => {
    if (!isLiveActive) return;
    const interval = window.setInterval(() => {
      loadLive({ force: false });
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [isLiveActive, loadLive]);

  const handleSelectSymbol = (sym: string) => {
    if (sym === indexName) return;
    requestId.current += 1;
    selectedExpiryRef.current = '';
    setSelectedExpiry('');
    setLiveChainData(null);
    setSpot(0);
    setSpotChange(0);
    setSpotChangePct(0);
    setLoadFailed(false);
    setFailReason('');
    setIndexName(sym);
  };

  const handleSelectExpiry = (exp: string) => {
    selectedExpiryRef.current = exp;
    setSelectedExpiry(exp);
    loadLive({ force: true, expiryOverride: exp });
  };

  const optionData = useMemo(() => {
    if (
      liveChainData &&
      liveChainData.symbol.toUpperCase() === indexName.toUpperCase() &&
      liveChainData.chain &&
      liveChainData.chain.length > 0
    ) {
      const isActuallyLive = Boolean(
        liveChainData.isLiveFeed ||
          liveChainData.spotSynced ||
          (liveChainData.source && liveChainData.source.includes('Angel One')) ||
          (liveChainData.source && liveChainData.source.includes('Yahoo Finance Live'))
      );
      return {
        chain: liveChainData.chain,
        atmStrike: liveChainData.atmStrike,
        pcr: liveChainData.pcr,
        maxPain: liveChainData.maxPain,
        summary: {
          pcr: liveChainData.pcr,
          maxPain: liveChainData.maxPain,
          totalCallOI: liveChainData.totalCallOI,
          totalPutOI: liveChainData.totalPutOI,
          totalCallChangeOI: liveChainData.totalCallChangeOI,
          totalPutChangeOI: liveChainData.totalPutChangeOI,
          aiSignal: liveChainData.aiSignal,
          source: liveChainData.source,
        },
        isLiveFeed: isActuallyLive,
      };
    }
    if (spot > 0) {
      const m = generateOptionChain(spot, indexName, strikes);
      return {
        chain: m.chain,
        atmStrike: m.atmStrike,
        pcr: m.pcr,
        maxPain: m.maxPain,
        isLiveFeed: false,
        summary: {
          pcr: m.pcr,
          maxPain: m.maxPain,
          totalCallOI: m.totalCallOI,
          totalPutOI: m.totalPutOI,
          totalCallChangeOI: m.totalCallChangeOI,
          totalPutChangeOI: m.totalPutChangeOI,
          aiSignal: m.aiSignal,
          source: 'Live Spot Model',
        },
      };
    }
    return null;
  }, [liveChainData, spot, indexName, strikes]);

  const feedLabel = liveChainData?.source || (config.exchange === 'COMMODITY' ? 'Commodity Futures Feed' : 'Live NSE Feed');

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Live Option Chain ({config.exchange === 'COMMODITY' ? 'Commodities' : `${config.exchange} Derivatives`})
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{feedLabel}</span>
                <span aria-hidden="true">·</span>
                <span>NSE Indices, F&amp;O Stocks &amp; Commodities</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Last Synced</div>
              <div className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                {lastUpdated || 'Connecting...'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLiveActive((prev) => !prev)}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                isLiveActive
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isLiveActive ? 'Pause 10s auto-refresh' : 'Resume 10s auto-refresh'}
            >
              {isLiveActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isLiveActive ? 'Auto 10s' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={() => loadLive({ force: true })}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Force Refresh Live Data"
              aria-label="Force refresh live option chain"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {loadFailed && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{failReason || 'Live option chain feed temporarily delayed.'}</span>
          </div>
          <button
            type="button"
            onClick={() => loadLive({ force: true })}
            className="font-semibold underline whitespace-nowrap cursor-pointer"
          >
            Retry now
          </button>
        </div>
      )}

      {optionData ? (
        <NseOptionChainTable
          symbol={indexName}
          exchange={config.exchange}
          spotPrice={spot}
          dayChange={spotChange}
          dayChangePerc={spotChangePct}
          chain={optionData.chain}
          atmStrike={optionData.atmStrike}
          expiries={liveChainData?.expiries || []}
          currentExpiry={selectedExpiry || liveChainData?.currentExpiry || ''}
          onSelectExpiry={handleSelectExpiry}
          onSelectSymbol={handleSelectSymbol}
          availableSymbols={AVAILABLE_SYMBOLS}
          isLiveFeed={optionData.isLiveFeed}
          lotSize={liveChainData?.expiryLotSize || config.lotSize}
          pcr={optionData.pcr}
          maxPain={optionData.maxPain}
          summary={optionData.summary}
          strikes={strikes}
          onChangeStrikes={setStrikes}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {isLoading ? `Syncing live ${config.name} option chain...` : `Could not load ${config.name} option chain.`}
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={() => loadLive({ force: true })}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              Retry Live Sync
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OptionAnalyzerPage;
