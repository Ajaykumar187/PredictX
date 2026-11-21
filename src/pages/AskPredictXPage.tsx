import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Target,
  Copy,
  Check,
  Zap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnalysisResult, MarketType } from '../types';
import { formatCurrencyValue } from '../utils/marketData';
import { generateHinglishResponse } from '../utils/hinglishBot';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  describeSpeechError,
  isSpeechRecognitionSupported,
} from '../utils/voiceAi';
import { ParsedCommand, PAGE_LABELS, parseVoiceCommand } from '../utils/voiceCommands';
import { resolveStockRef } from '../utils/voiceResolve';
import type { PageId } from '../components/Sidebar';
import { ExpertAdvicePanel } from '../components/ExpertAdvicePanel';

interface AskPredictXPageProps {
  data?: AnalysisResult | null;
  theme?: 'Light' | 'Dark';
  onSelectStock?: (symbol: string, market: MarketType) => void;
  onNavigate?: (page: PageId) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  badge?: string;
}

export const AskPredictXPage: React.FC<AskPredictXPageProps> = ({
  data,
  theme: _theme = 'Dark',
  onSelectStock,
  onNavigate,
}) => {
  if (data && typeof data.currencyFmt !== 'function') {
    (data as any).currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }

  const [activeMode, setActiveMode] = useState<'expert' | 'chat'>('expert');

  const defaultStock = data?.displaySymbol || '';
  const defaultMarket = data?.market || 'NSE';
  const formattedPrice = data
    ? typeof data.currencyFmt === 'function'
      ? data.currencyFmt(data.latestPrice)
      : formatCurrencyValue(data.latestPrice, defaultMarket)
    : '';

  const initialBotWelcome = defaultStock
    ? `Hello! I am your **PredictX AI Financial Assistant**.
Currently active stock: **${defaultStock}** (${defaultMarket})${formattedPrice ? ` @ ${formattedPrice}` : ''}.
Ask about support/resistance levels, buy/sell zones, multi-year (1Y–5Y) returns, or tap the mic to use voice commands.`
    : `Hello! I am your **PredictX AI Financial Assistant**.
No stock is currently selected. Ask about any company (e.g., "Support resistance and buy level for Reliance", "How much return can TCS give in 3 years?", or "Show Apple stock") and I will load and analyze it automatically.`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      sender: 'bot',
      text: initialBotWelcome,
      timestamp: 'Just now',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'hi-IN'>(() => {
    try { return localStorage.getItem('predictx_voice_lang') === 'hi-IN' ? 'hi-IN' : 'en-IN'; } catch { return 'en-IN'; }
  });
  const pendingRef = useRef<{ prev: string; cmd: ParsedCommand; text: string; fromVoice: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const scrollToBottom = () => {
    const box = messagesEndRef.current?.parentElement;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  };

  const firstScroll = useRef(true);
  useEffect(() => {
    if (firstScroll.current) {
      firstScroll.current = false;
      return;
    }
    scrollToBottom();
  }, [messages, isTyping, isListening]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      stopSpeaking();
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    } else {
      setIsSpeaking(true);
      setSpeakingMsgId(msgId);
      speakText(
        text,
        () => {
          setIsSpeaking(true);
          setSpeakingMsgId(msgId);
        },
        () => {
          setIsSpeaking(false);
          setSpeakingMsgId(null);
        },
        () => {
          setIsSpeaking(false);
          setSpeakingMsgId(null);
        }
      );
    }
  };

  const stamp = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const addBot = (text: string, speak = false) => {
    const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [...prev, { id, sender: 'bot', text, timestamp: stamp() }]);
    if (speak) handleToggleSpeak(id, text);
    return id;
  };

  const toggleLang = () => {
    const next = voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    setVoiceLang(next);
    try { localStorage.setItem('predictx_voice_lang', next); } catch { /* ignore */ }
  };

  const stopListening = () => {
    recognizerRef.current?.stop();
    setIsListening(false);
    setInterim('');
  };

  const startListening = () => {
    if (!isSpeechRecognitionSupported()) {
      addBot('Voice recognition is not supported in this browser. Please use Chrome or Edge (desktop/Android), or type your question below.');
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }

    stopSpeaking();
    setIsSpeaking(false);
    setSpeakingMsgId(null);
    setInputVal('');
    setInterim('');
    setIsListening(true);

    let handled = false;
    recognizerRef.current = createSpeechRecognizer(
      (transcript, isFinal) => {
        setInterim(transcript);
        setInputVal(transcript);
        if (isFinal && transcript.trim().length > 1 && !handled) {
          handled = true;
          setIsListening(false);
          setInterim('');
          handleSend(transcript, true);
        }
      },
      (code) => {
        setIsListening(false);
        setInterim('');
        const msg = describeSpeechError(String(code));
        if (msg) addBot(msg);
      },
      () => {
        setIsListening(false);
        setInterim('');
      },
      voiceLang
    );

    if (recognizerRef.current) {
      recognizerRef.current.start();
    } else {
      setIsListening(false);
      addBot('Could not start voice recognition. Please try again.');
    }
  };

  const finishCommand = (cmd: ParsedCommand, text: string, fromVoice: boolean, d: AnalysisResult | null | undefined) => {
    const speak = autoVoice || fromVoice;
    if (cmd.page && onNavigate) {
      addBot(`Opening ${PAGE_LABELS[cmd.page] || cmd.page}…`, false);
      setIsTyping(false);
      setTimeout(() => onNavigate(cmd.page!), 350);
      return;
    }
    const sym = d?.displaySymbol || '';
    const query = cmd.isQuestion || !(cmd.alias || cmd.stockPhrase) ? text : `What is the expert outlook for ${sym} — support resistance, buy sell levels, and 1 to 5 year return?`;
    const reply = generateHinglishResponse(query, d, sym);
    setIsTyping(false);
    addBot(reply, speak);
  };

  const processInput = async (text: string, fromVoice: boolean) => {
    const cmd = parseVoiceCommand(text);
    const wantsStock = !!(cmd.alias || cmd.stockPhrase);

    if (wantsStock) {
      const ref = await resolveStockRef(cmd);
      if (!ref) {
        setIsTyping(false);
        addBot(`Could not find any stock matching "${cmd.stockPhrase || text}". Please say or type a valid company name or ticker symbol (e.g. "Tata Power" or "TCS").`, fromVoice);
        return;
      }
      const sameAsCurrent = !!data && data.displaySymbol.toUpperCase() === ref.symbol.toUpperCase();
      if (!sameAsCurrent) {
        if (!onSelectStock) {
          setIsTyping(false);
          addBot(`Cannot load ${ref.name || ref.symbol} here — please search for it from the Expert Advice bar or sidebar.`);
          return;
        }
        addBot(`Loading ${ref.name || ref.symbol} (${ref.market})…`);
        if (pendingRef.current) clearTimeout(pendingRef.current.timer);
        const timer = setTimeout(() => {
          pendingRef.current = null;
          setIsTyping(false);
          addBot(`Could not fetch live data for ${ref.name || ref.symbol}. Please check the symbol and try again.`);
        }, 15000);
        pendingRef.current = { prev: data?.displaySymbol || '', cmd, text, fromVoice, timer };
        onSelectStock(ref.symbol, ref.market);
        return;
      }
    }
    setTimeout(() => finishCommand(cmd, text, fromVoice, data), 350);
  };

  useEffect(() => {
    const p = pendingRef.current;
    if (!p || !data) return;
    if (data.displaySymbol !== p.prev) {
      clearTimeout(p.timer);
      pendingRef.current = null;
      finishCommand(p.cmd, p.text, p.fromVoice, data);
    }
  }, [data]);

  useEffect(() => () => { if (pendingRef.current) clearTimeout(pendingRef.current.timer); }, []);

  const handleSend = (textToSend?: string, fromVoice = false) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    if (isListening) stopListening();

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text, timestamp: stamp(), badge: fromVoice ? 'voice' : undefined },
    ]);
    setInputVal('');
    setIsTyping(true);
    processInput(text, fromVoice);
  };

  const VOICE_EXAMPLES = [
    { label: 'Support & Resistance for Infosys', query: 'What are support and resistance levels for Infosys?' },
    { label: '1Y–5Y Return Outlook for Reliance', query: 'How much return can Reliance give in 1, 3, and 5 years?' },
    { label: 'Buy & Sell Levels for TCS', query: 'What are the buy sell levels and target for TCS?' },
    { label: 'Show Apple stock', query: 'Show Apple stock' },
    { label: 'Open quarterly results', query: 'open quarterly results' },
  ];

  const QUICK_PROMPTS = [
    { label: 'Support & Resistance Levels', query: `What are the support and resistance levels for ${defaultStock}?` },
    { label: 'Buy/Sell Levels & Stop Loss', query: `What are the buy sell levels, stop loss, and targets for ${defaultStock}?` },
    { label: '1Y / 3Y / 5Y Return Outlook', query: `How much return can ${defaultStock} give over 1, 3, and 5 years?` },
    { label: 'RSI & Trend Momentum', query: `How are RSI and moving average trends looking for ${defaultStock}?` },
    { label: 'PCR & Option Chain Rules', query: `How should I use Put Call Ratio (PCR) and Max Pain in the live market?` },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Ask PredictX — Expert Advice & AI Assistant
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Support & Resistance</span>
              <span aria-hidden="true">·</span>
              <span>Buy/Sell Zones</span>
              <span aria-hidden="true">·</span>
              <span>1Y–5Y Return Estimates</span>
              <span aria-hidden="true">·</span>
              <span>Voice AI Chat</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary Segmented Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveMode('expert')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeMode === 'expert'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Expert Advice & Returns</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('chat')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeMode === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Chat & Voice</span>
            </button>
          </div>

          {activeMode === 'chat' && (
            <>
              <button
                onClick={toggleLang}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Switch voice recognition language (English / Hindi)"
                aria-label="Voice language"
              >
                Mic: {voiceLang === 'hi-IN' ? 'Hindi' : 'English'}
              </button>
              <button
                onClick={() => setAutoVoice(!autoVoice)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  autoVoice
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title={autoVoice ? 'Auto Voice Speak: ON' : 'Auto Voice Speak: OFF'}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{autoVoice ? 'Auto-Voice: ON' : 'Auto-Voice'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeMode === 'expert' ? (
        <ExpertAdvicePanel
          data={data}
          onSelectStock={onSelectStock}
          onAskAiPrompt={(prompt) => {
            setActiveMode('chat');
            handleSend(prompt);
          }}
        />
      ) : (
        <>
          {isListening && (
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm">Listening... speak now</span>
                <span className="text-blue-100 text-xs truncate max-w-[40vw]">{interim ? `"${interim}"` : "(e.g. 'What is the target for Reliance?')"}</span>
              </div>
              <button
                onClick={stopListening}
                className="px-3 py-1 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold text-xs cursor-pointer"
              >
                Cancel Mic
              </button>
            </div>
          )}

          {isSpeaking && (
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="font-semibold text-xs">Voice AI is speaking...</span>
              </div>
              <button
                onClick={() => {
                  stopSpeaking();
                  setIsSpeaking(false);
                  setSpeakingMsgId(null);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-black/25 hover:bg-black/40 text-xs font-bold cursor-pointer"
              >
                Mute (Stop)
              </button>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <span className="text-[11px] font-semibold text-slate-500 pl-1 flex items-center gap-1 whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Prompts:
            </span>
            {(defaultStock ? QUICK_PROMPTS : VOICE_EXAMPLES).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(item.query)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px]">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isThisSpeaking = speakingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 relative group ${
                        isUser
                          ? 'bg-blue-600 text-white font-medium rounded-br-xs shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/60 shadow-xs'
                      }`}
                    >
                      <div className="whitespace-pre-line font-sans">
                        {msg.text}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] opacity-60">
                        <span>{msg.timestamp}</span>
                        <div className="flex items-center gap-2">
                          {!isUser && (
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(msg.id, msg.text)}
                              className={`hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer ${
                                isThisSpeaking ? 'text-cyan-400 font-bold' : ''
                              }`}
                              title={isThisSpeaking ? 'Stop voice' : 'Listen aloud'}
                            >
                              {isThisSpeaking ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                              <span>{isThisSpeaking ? 'Stop' : 'Listen'}</span>
                            </button>
                          )}

                          {!isUser && (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="opacity-0 group-hover:opacity-100 hover:text-cyan-400 transition-opacity flex items-center gap-1 cursor-pointer"
                              title="Copy Response"
                            >
                              {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
                  <Bot className="w-4 h-4 text-cyan-500 animate-pulse" />
                  <span className="italic">PredictX AI is preparing analysis...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 rounded-b-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={startListening}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice AI: Tap to speak'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Ask: 'Support resistance and buy level for TCS', '5 year return for Reliance', or 'Open quarterly results'..."
                  className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition-all disabled:opacity-40 cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 flex-shrink-0"
                  title="Send question"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
                Voice & text assistant backed by live technical indicators and pivot/return models. Switch to Expert Advice above for full visual level tables.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AskPredictXPage;
