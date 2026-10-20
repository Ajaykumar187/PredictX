import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Info,
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
  theme = 'Dark',
  onSelectStock,
  onNavigate,
}) => {
  if (data && typeof data.currencyFmt !== 'function') {
    (data as any).currencyFmt = (v: number) => formatCurrencyValue(v, data.market);
  }
  const isDark = theme === 'Dark';

  const defaultStock = data?.displaySymbol || '';
  const defaultMarket = data?.market || 'NSE';
  const formattedPrice = data
    ? typeof data.currencyFmt === 'function'
      ? data.currencyFmt(data.latestPrice)
      : formatCurrencyValue(data.latestPrice, defaultMarket)
    : '';

  const initialBotWelcome = defaultStock
    ? `Namaste! Main hoon aapka **PredictX AI Financial Assistant** 🚀.
Abhi active stock: **${defaultStock}** (${defaultMarket})${formattedPrice ? ` @ ${formattedPrice}` : ''}.
Mic dabakar bolein ya type karein — jaise "TCS ka target kya hai?", "Apple dikhao", "option chain kholo".`
    : `Namaste! Main hoon aapka **PredictX AI Financial Assistant** 🚀.
Abhi koi stock select nahi hai. Mic dabakar bolein ya type karein — jaise "Reliance ka target kya hai?", "Tesla dikhao", "portfolio kholo". Main stock khud dhoondh ke load kar dunga.`;

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
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-IN'>(() => {
    try { return localStorage.getItem('predictx_voice_lang') === 'en-IN' ? 'en-IN' : 'hi-IN'; } catch { return 'hi-IN'; }
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
      addBot('Is browser mein voice recognition support nahi hai. Chrome ya Edge (desktop/Android) use karein, ya type karke poochhein.');
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
      addBot('Voice recognition shuru nahi ho paya. Dobara try karein.');
    }
  };

  const finishCommand = (cmd: ParsedCommand, text: string, fromVoice: boolean, d: AnalysisResult | null | undefined) => {
    const speak = autoVoice || fromVoice;
    if (cmd.page && onNavigate) {
      addBot(`${PAGE_LABELS[cmd.page] || cmd.page} khol raha hoon…`, false);
      setIsTyping(false);
      setTimeout(() => onNavigate(cmd.page!), 350);
      return;
    }
    const sym = d?.displaySymbol || '';
    const query = cmd.isQuestion || !(cmd.alias || cmd.stockPhrase) ? text : `Bhai ${sym} ka kya view hai, buy karun ya wait karun?`;
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
        addBot(`"${cmd.stockPhrase || text}" naam ka koi stock nahi mila. Naam ya symbol dobara bolein (jaise "Tata Power" ya "TCS").`, fromVoice);
        return;
      }
      const sameAsCurrent = !!data && data.displaySymbol.toUpperCase() === ref.symbol.toUpperCase();
      if (!sameAsCurrent) {
        if (!onSelectStock) {
          setIsTyping(false);
          addBot(`${ref.name || ref.symbol} load nahi kar sakta — sidebar se search karein.`);
          return;
        }
        addBot(`🔍 ${ref.name || ref.symbol} (${ref.market}) load kar raha hoon…`);
        if (pendingRef.current) clearTimeout(pendingRef.current.timer);
        const timer = setTimeout(() => {
          pendingRef.current = null;
          setIsTyping(false);
          addBot(`${ref.name || ref.symbol} ka data nahi mil paya. Symbol check karke dobara try karein.`);
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
    { label: '🎙️ "Infosys ka target kya hai?"', query: 'Infosys ka target kya hai?' },
    { label: '🎙️ "Apple stock dikhao"', query: 'Apple stock dikhao' },
    { label: '🎙️ "TCS ka chart dikhao"', query: 'TCS ka chart dikhao' },
    { label: '🎙️ "Should I buy Zomato?"', query: 'Should I buy Zomato?' },
    { label: '🎙️ "Option chain kholo"', query: 'option chain kholo' },
  ];

  const QUICK_PROMPTS = [
    { label: '🔥 Stock Ka Full View', query: `Bhai ${defaultStock} ka kya view hai, buy karun ya wait karun?` },
    { label: '🎯 Stop Loss & Target', query: `${defaultStock} ka safe stop loss aur 7-day target kya hona chahiye?` },
    { label: '📊 RSI & MACD Momentum', query: `${defaultStock} ka RSI aur moving average trend kaisa hai?` },
    { label: '🔮 7-Day Model Forecast', query: `${defaultStock} aage 7 dino me kahan tak ja sakta hai?` },
    { label: '📈 PCR & Option Chain Rules', query: `Put Call Ratio (PCR) aur Max Pain ko live market me kaise use karein?` },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Ask PredictX (Hinglish Copilot)
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                VOICE AI ENABLED
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Desi Hinglish me technicals, targets, stop-loss, risk management, aur F&O insights with Speech-to-Text & Text-to-Speech.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleLang}
            className="whitespace-nowrap px-3 py-1.5 rounded-xl border text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
            title="Bolne ki bhasha badlein (Hindi / English)"
            aria-label="Voice language"
          >
            🎙️ {voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}
          </button>
          <button
            onClick={() => setAutoVoice(!autoVoice)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              autoVoice
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={autoVoice ? 'Auto Voice Speak: ON (Har answer bol kar sunayega)' : 'Auto Voice Speak: OFF'}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{autoVoice ? 'Auto-Voice: ON' : 'Auto-Voice'}</span>
          </button>

          {data && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-white">{data.displaySymbol}</span>
              <span className="text-slate-400 font-mono">({data.currencyFmt(data.latestPrice)})</span>
              <span className={`font-bold ${data.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {data.change >= 0 ? '+' : ''}{data.changePct}%
              </span>
            </div>
          )}
        </div>
      </div>

      {isListening && (
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-400 animate-ping"></span>
            <span className="font-bold text-sm">🎤 Voice AI Sun raha hoon... boliye!</span>
            <span className="text-blue-100 text-xs truncate max-w-[40vw]">{interim ? `"${interim}"` : "(e.g. 'Reliance ka target kya hai?')"}</span>
          </div>
          <button
            onClick={stopListening}
            className="px-3 py-1 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold text-xs"
          >
            Cancel Mic
          </button>
        </div>
      )}

      {isSpeaking && (
        <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span className="font-semibold text-xs">🔊 Voice AI bol raha hai... Sunein!</span>
          </div>
          <button
            onClick={() => {
              stopSpeaking();
              setIsSpeaking(false);
              setSpeakingMsgId(null);
            }}
            className="px-2.5 py-0.5 rounded-lg bg-black/25 hover:bg-black/40 text-xs font-bold"
          >
            Mute (Stop)
          </button>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider pl-1 flex items-center gap-1 whitespace-nowrap">
          <Zap className="w-3 h-3 text-amber-500" /> Prompts:
        </span>
        {(defaultStock ? QUICK_PROMPTS : VOICE_EXAMPLES).map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(item.query)}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 shadow-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 active:scale-95"
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
                          title={isThisSpeaking ? 'Stop voice' : 'Awaaz me sunein (Listen)'}
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
              <span className="italic">PredictX AI Hinglish analysis likh raha hai...</span>
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
              title={isListening ? 'Bolna rokein (Listening...)' : 'Voice AI: Bol kar poochhein (Mic On)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Bolo ya likho: 'TCS ka target kya hai?', 'Apple dikhao', 'option chain kholo'..."
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
            🎤 <strong>Voice:</strong> mic dabakar kisi bhi stock ka naam lekar poochhein ya "... dikhao" / "... kholo" bolein. Chrome/Edge mein voice Google/Microsoft ki service se samjhi jaati hai, isliye audio unke server par jata hai. Jawab rule-based indicators par based hai.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AskPredictXPage;
