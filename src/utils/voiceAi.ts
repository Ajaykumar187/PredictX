export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1') 
    .replace(/\*(.*?)\*/g, '$1')  
    .replace(/#{1,6}\s+/g, '')     
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .replace(/[🚀🎯🛑📊📈📉🛡️🔮📅⚠️💡🌟🧘✨]/g, '') 
    .replace(/₹/g, 'Rupees ')
    .replace(/\$/g, 'Dollars ')
    .replace(/%/g, ' percent ')
    .replace(/\+/g, ' plus ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    } catch (e) {
      console.warn('[VoiceAI] Speech synthesis cancel error:', e);
    }
  }
}

export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): boolean {
  if (!isSpeechSynthesisSupported()) {
    return false;
  }

  try {
    stopSpeaking();

    const clean = cleanTextForSpeech(text);
    if (!clean) return false;

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
    );
    const indianVoice = voices.find(
      (v) => v.lang === 'en-IN' || v.name.toLowerCase().includes('india')
    );

    if (hindiVoice) {
      utterance.voice = hindiVoice;
      utterance.lang = 'hi-IN';
    } else if (indianVoice) {
      utterance.voice = indianVoice;
      utterance.lang = 'en-IN';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      onStart && onStart();
    };

    utterance.onend = () => {
      currentUtterance = null;
      onEnd && onEnd();
    };

    utterance.onerror = (e) => {
      currentUtterance = null;
      onError && onError(e);
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    console.warn('[VoiceAI] speakText failed:', e);
    onError && onError(e);
    return false;
  }
}

export function createSpeechRecognizer(
  onTranscript: (transcript: string, isFinal: boolean) => void,
  onError: (err: any) => void,
  onEnd: () => void,
  lang: string = 'hi-IN'
): { start: () => void; stop: () => void } | null {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognizer = new SpeechRecognitionClass();

    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    recognizer.lang = lang;

    recognizer.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText) {
        onTranscript(activeText, !!finalTranscript);
      }
    };

    recognizer.onerror = (event: any) => {
      console.warn('[VoiceAI] Speech recognition error:', event.error);
      onError(event.error);
    };

    recognizer.onend = () => {
      onEnd();
    };

    return {
      start: () => {
        try {
          recognizer.start();
        } catch (e) {
          console.warn('[VoiceAI] Recognizer start failed (may already be running):', e);
        }
      },
      stop: () => {
        try {
          recognizer.stop();
        } catch (e) {
        }
      },
    };
  } catch (e) {
    console.warn('[VoiceAI] Failed to create speech recognizer:', e);
    return null;
  }
}

export function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mic ki permission nahi mili. Browser ke address bar mein mic icon par "Allow" karein, phir dobara try karein.';
    case 'no-speech':
      return 'Kuch sunai nahi diya. Mic dabakar thoda paas se bolein.';
    case 'audio-capture':
      return 'Mic nahi mila. Check karein ki koi microphone connected hai.';
    case 'network':
      return 'Speech service tak pahunch nahi paye (internet check karein). Chrome voice ke liye Google ki service use karta hai.';
    case 'language-not-supported':
      return 'Yeh bhasha is browser mein supported nahi hai. Language badal kar dekhein.';
    case 'aborted':
      return '';
    default:
      return 'Voice recognition mein dikkat aayi. Dobara try karein ya type karke poochhein.';
  }
}
