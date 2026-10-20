import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateOptionChain } from '../utils/greeks';
import * as stockApi from '../utils/stockApi';
import { fetchLiveQuote, fetchLiveOptionChain, LiveOptionChainResponse } from '../utils/stockApi';
import { NseOptionChainTable } from '../components/NseOptionChainTable';
import {
  Layers,
  Radio,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface IndexMeta {
  ticker: string;
  name: string;
  lotSize: number;
  step: number;
  defaultSpot: number;
}

const INDEX_CONFIG: Record<string, IndexMeta> = {
  NIFTY: { ticker: '^NSEI', name: 'NIFTY 50', lotSize: 75, step: 50, defaultSpot: 22622.7 },
  BANKNIFTY: { ticker: '^NSEBANK', name: 'BANK NIFTY', lotSize: 30, step: 100, defaultSpot: 48250.0 },
  FINNIFTY: { ticker: 'NIFTY_FIN_SERVICE.NS', name: 'FIN NIFTY', lotSize: 65, step: 50, defaultSpot: 21450.0 },
  RELIANCE: { ticker: 'RELIANCE.NS', name: 'Reliance Industries', lotSize: 500, step: 20, defaultSpot: 1180.0 },
  TCS: { ticker: 'TCS.NS', name: 'Tata Consultancy Services', lotSize: 175, step: 50, defaultSpot: 3850.0 },
  INFY: { ticker: 'INFY.NS', name: 'Infosys Limited', lotSize: 400, step: 20, defaultSpot: 1520.0 },
};

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const OptionAnalyzerPage: React.FC = () => {
  const [indexName, setIndexName] = useState<string>('NIFTY');
  const [spot, setSpot] = useState<number>(INDEX_CONFIG['NIFTY'].defaultSpot);
  const [spotChange, setSpotChange] = useState<number>(0);
  const [spotChangePct, setSpotChangePct] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>(() => nowTime());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveActive] = useState<boolean>(true);
  const [liveChainData, setLiveChainData] = useState<LiveOptionChainResponse | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [failReason, setFailReason] = useState<string>('');
  const [strikes, setStrikes] = useState<number>(10);

  const config = INDEX_CONFIG[indexName] || INDEX_CONFIG['NIFTY'];
  const requestId = useRef(0);

  const loadLive = useCallback(async () => {
    const myId = ++requestId.current;
    setIsLoading(true);
    try {
      const chainRes = await fetchLiveOptionChain(indexName, selectedExpiry || undefined, strikes);
      if (chainRes && chainRes.chain && chainRes.chain.length > 0) {
        if (myId !== requestId.current) return;
        setLiveChainData(chainRes);
        if (chainRes.spotPrice > 0) setSpot(chainRes.spotPrice);
        setSpotChange(chainRes.dayChange);
        setSpotChangePct(chainRes.dayChangePerc);
        if (chainRes.currentExpiry && chainRes.currentExpiry !== selectedExpiry) setSelectedExpiry(chainRes.currentExpiry);
        setLastUpdated(nowTime());
        setLoadFailed(false);
        return;
      }

      setFailReason(stockApi.lastOptionChainError);
      const liveData = await fetchLiveQuote(config.ticker, 'INDEX' as any);
      if (myId !== requestId.current) return;
      if (liveData && liveData.latestPrice && liveData.latestPrice > 0) {
        setSpot(liveData.latestPrice);
        setSpotChange(typeof liveData.change === 'number' ? liveData.change : 0);
        setSpotChangePct(typeof liveData.changePct === 'number' ? liveData.changePct : 0);
        setLastUpdated(nowTime());
        setLoadFailed(false);
      }
    } catch (e) {
      console.warn('[OptionAnalyzer] Failed to fetch live option chain:', e);
    } finally {
      if (myId === requestId.current) setIsLoading(false);
    }
  }, [indexName, selectedExpiry, strikes, config.ticker]);

  useEffect(() => {
    const initialSpot = INDEX_CONFIG[indexName]?.defaultSpot || 1000;
    setSpot(initialSpot);
    setSelectedExpiry('');
    setLoadFailed(false);
  }, [indexName]);

  useEffect(() => {
    loadLive();
  }, [loadLive]);

  useEffect(() => {
    if (!isLiveActive) return;
    const interval = setInterval(loadLive, 30000);
    return () => clearInterval(interval);
  }, [isLiveActive, loadLive]);

  const optionData = useMemo(() => {
    if (liveChainData && liveChainData.chain && liveChainData.chain.length > 0) {
      return {
        chain: liveChainData.chain,
        atmStrike: liveChainData.atmStrike,
        pcr: liveChainData.pcr,
        maxPain: liveChainData.maxPain,
        summary: {
          pcr: liveChainData.pcr, maxPain: liveChainData.maxPain,
          totalCallOI: liveChainData.totalCallOI, totalPutOI: liveChainData.totalPutOI,
          totalCallChangeOI: liveChainData.totalCallChangeOI, totalPutChangeOI: liveChainData.totalPutChangeOI,
          aiSignal: liveChainData.aiSignal, source: liveChainData.source,
        },
        isLiveFeed: true,
      };
    }
    if (spot && spot > 0) {
      const m = generateOptionChain(spot, indexName, 10);
      return {
        chain: m.chain, atmStrike: m.atmStrike, pcr: m.pcr, maxPain: m.maxPain, isLiveFeed: false,
        summary: {
          pcr: m.pcr, maxPain: m.maxPain, totalCallOI: m.totalCallOI, totalPutOI: m.totalPutOI,
          totalCallChangeOI: m.totalCallChangeOI, totalPutChangeOI: m.totalPutChangeOI, aiSignal: m.aiSignal, source: 'Estimated model',
        },
      };
    }
    return null;
  }, [liveChainData, spot, indexName]);

  const availableSymbols = [
    { symbol: 'NIFTY', name: 'NIFTY 50' },
    { symbol: 'BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy' },
    { symbol: 'INFY', name: 'Infosys' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Live Option Chain (NSE Derivatives)
              </h2>
              {optionData?.isLiveFeed ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ESTIMATED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Authentic Indian F&O option desk with live Volume, Change in OI, LTP, Strike and ITM shading
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Last Synced</div>
            <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {lastUpdated || 'Connecting...'}
            </div>
          </div>
          <button
            onClick={loadLive}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {loadFailed && !optionData && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Option chain feed connect ho rahi hai... Kripya thodi der me refresh karein.
          </span>
        </div>
      )}

      {optionData ? (
        <NseOptionChainTable
          symbol={indexName}
          exchange="NSE"
          spotPrice={spot as number}
          dayChange={spotChange}
          dayChangePerc={spotChangePct}
          chain={optionData.chain}
          atmStrike={optionData.atmStrike}
          expiries={liveChainData?.expiries || []}
          currentExpiry={selectedExpiry || liveChainData?.currentExpiry || ''}
          onSelectExpiry={(exp) => setSelectedExpiry(exp)}
          onSelectSymbol={(sym) => setIndexName(sym)}
          availableSymbols={availableSymbols}
          isLiveFeed={optionData.isLiveFeed}
          lotSize={liveChainData?.expiryLotSize || config.lotSize}
          pcr={optionData.pcr}
          maxPain={optionData.maxPain}
          summary={optionData.summary}
          strikes={strikes}
          onChangeStrikes={setStrikes}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
          {isLoading ? 'Live option chain load ho raha hai…' : 'Option chain load nahi ho paaya. Refresh dabaiye.'}
        </div>
      )}
    </div>
  );
};

export default OptionAnalyzerPage;

