import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Maximize2,
  X,
  RefreshCw,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { PageId } from './Sidebar';
import { generateHinglishResponse } from '../utils/hinglishBot';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../utils/voiceAi';

interface StockChatbotProps {
  data?: AnalysisResult | null;
  onNavigate: (page: PageId) => void;
  mode?: 'embedded' | 'floating';
  theme?: 'Light' | 'Dark';
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export const StockChatbot: React.FC<StockChatbotProps> = ({
  data,
  onNavigate,
  mode = 'embedded',
  theme: _theme = 'Dark',
  onClose,
}) => {
  const stockSymbol = data?.displaySymbol || '';
  const stockMarket = data?.market || 'NSE';
  const priceDisplay =
    data && typeof data.currencyFmt === 'function'
      ? data.currencyFmt(data.latestPrice)
      : data ? `₹${data.latestPrice}` : '';

  const initialBotWelcome = `Namaste! Main hoon aapka **PredictX AI Chatbot** 🚀.
${stockSymbol ? `Abhi active stock: **${stockSymbol}** (${stockMarket})${priceDisplay ? ` @ ${priceDisplay}` : ''}.` : 'Abhi koi stock select nahi hai — pehle sidebar se koi stock search karein.'}
Aap mujhse Hinglish me poochh sakte hain ya **Voice AI (Mic)** daba kar bol sakte hain!`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'bot-init',
      sender: 'bot',
      text: initialBotWelcome,
      timestamp: 'Just now',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const startListening = () => {
    if (!isSpeechRecognitionSupported()) {
      alert('Aapke browser me speech recognition supported nahi hai. Kripya Chrome ya Edge use karein.');
      return;
    }

    if (isListening && recognizerRef.current) {
      recognizerRef.current.stop();
      setIsListening(false);
      return;
    }

    stopSpeaking();
    setIsListening(true);

    recognizerRef.current = createSpeechRecognizer(
      (transcript, isFinal) => {
        setInputVal(transcript);
        if (isFinal && transcript.trim().length > 1) {
          setIsListening(false);
          handleSend(transcript);
        }
      },
      () => {
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (recognizerRef.current) {
      recognizerRef.current.start();
    }
  };

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    if (isListening && recognizerRef.current) {
      recognizerRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    setTimeout(() => {
      const reply = generateHinglishResponse(text, data, stockSymbol);
      const newBotId = `bot-${Date.now()}`;
      const botMsg: ChatMessage = {
        id: newBotId,
        sender: 'bot',
        text: reply,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      if (autoVoice) {
        handleToggleSpeak(newBotId, reply);
      }
    }, 450);
  };

  const QUICK_QUESTIONS = [
    stockSymbol ? `Bhai ${stockSymbol} ka kya view hai?` : `RSI kya hota hai?`,
    stockSymbol ? `${stockSymbol} ka target aur stop loss batao?` : `Stop loss kaise lagate hain?`,
    `RSI aur momentum kaisa hai?`,
    `Next 7 days me kahan tak ja sakta hai?`,
  ];

  return (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden transition-all ${
        mode === 'floating'
          ? 'w-[92vw] sm:w-[420px] h-[560px] max-h-[85vh]'
          : 'w-full h-[520px] max-h-[600px]'
      }`}
    >
      <div className="bg-gradient-to-r from-[#0a2540] via-[#10325c] to-[#18427a] p-3.5 sm:p-4 text-white flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold relative flex-shrink-0">
            <Bot className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse"></span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-white truncate">
                PredictX AI Chatbot
              </h3>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                VOICE AI
              </span>
            </div>
            <p className="text-[10px] text-blue-200/80 truncate">
              {stockSymbol ? `${stockSymbol} (${stockMarket})` : 'Koi stock select nahi'} {priceDisplay ? `• ${priceDisplay}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setAutoVoice(!autoVoice)}
            className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              autoVoice
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-blue-200 border-white/15'
            }`}
            title={autoVoice ? 'Auto Voice Speak: ON (AI khud bol kar answer dega)' : 'Auto Voice Speak: OFF'}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{autoVoice ? 'Voice ON' : 'Voice'}</span>
          </button>

          <button
            onClick={() => onNavigate('ask')}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Full Screen Ask PredictX page kholein"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {mode === 'floating' && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Chatbot band karein"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isListening && (
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-3.5 py-2 text-xs flex items-center justify-between gap-2 animate-pulse flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
            <span className="font-bold">🎤 Sun raha hoon... boliye!</span>
          </div>
          <button
            onClick={() => {
              if (recognizerRef.current) recognizerRef.current.stop();
              setIsListening(false);
            }}
            className="text-[10px] bg-black/25 px-2 py-0.5 rounded font-bold hover:bg-black/40"
          >
            Stop
          </button>
        </div>
      )}

      {isSpeaking && (
        <div className="bg-indigo-600 text-white px-3.5 py-1.5 text-xs flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 animate-bounce" />
            <span className="text-[11px] font-semibold">🔊 Voice AI bol raha hai...</span>
          </div>
          <button
            onClick={() => {
              stopSpeaking();
              setIsSpeaking(false);
              setSpeakingMsgId(null);
            }}
            className="text-[10px] bg-black/25 px-2 py-0.5 rounded font-bold hover:bg-black/40"
          >
            Mute
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 custom-scrollbar text-xs">
        {messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          const isThisSpeaking = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
            >
              {isBot && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                  isBot
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed text-[11px] sm:text-xs">
                  {msg.text.split('\n').map((line, lIdx) => {
                    const isBullet = line.trim().startsWith('-') || line.trim().startsWith('•');
                    const isBoldHeading = line.trim().startsWith('**') && line.trim().endsWith('**');

                    return (
                      <p
                        key={lIdx}
                        className={`${isBullet ? 'pl-2 text-slate-600 dark:text-slate-300' : ''} ${
                          isBoldHeading ? 'font-bold mt-1 text-slate-900 dark:text-white' : ''
                        } ${line === '' ? 'h-1.5' : 'mb-1'}`}
                      >
                        {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                      </p>
                    );
                  })}
                </div>

                <div
                  className={`flex items-center justify-between gap-2 mt-2 pt-1 border-t ${
                    isBot
                      ? 'border-slate-200/60 dark:border-slate-700/60 text-slate-400'
                      : 'border-white/20 text-blue-100'
                  } text-[10px]`}
                >
                  <span>{msg.timestamp}</span>

                  <div className="flex items-center gap-1.5">
                    {isBot && (
                      <button
                        onClick={() => handleToggleSpeak(msg.id, msg.text)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          isThisSpeaking
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                        title={isThisSpeaking ? 'Awaaz rokein (Stop)' : 'Voice me sunein (Listen)'}
                      >
                        {isThisSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {!isBot && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-500 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="flex items-center gap-1 font-medium text-[11px]">
              AI analyze kar raha hai
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce"></span>
                <span className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-shrink-0 text-xs">
        <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">Poochho:</span>
        {QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="flex-shrink-0 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-shrink-0"
      >
        <button
          type="button"
          onClick={startListening}
          className={`p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700'
          }`}
          title={isListening ? 'Bolna rokein (Listening...)' : 'Voice AI: Bol kar poochhein (Mic On)'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={stockSymbol ? `Poochho ${stockSymbol} ke baare me (ya mic dabayein)...` : 'Kuch bhi poochho (ya mic dabayein)...'}
          className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
    </div>
  );
};

export default StockChatbot;
