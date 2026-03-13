import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, User, Bot, Loader2, ArrowRight } from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { code: 'en-IN', label: 'English' },
  { code: 'ta-IN', label: 'Tamil' },
];

const normalizeSpeechText = (text, langCode) => {
  let normalized = String(text || '');
  normalized = normalized
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+\|\s+/g, ', ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Make invoice/shipment IDs easier to hear by removing hard separators.
  normalized = normalized.replace(/\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/g, (full) => full.replace(/-/g, ' '));

  // Convert INR marker to spoken currency words.
  normalized = normalized.replace(/INR\s*([0-9,]+(?:\.\d+)?)/gi, (_m, amount) => {
    if ((langCode || '').toLowerCase().startsWith('ta')) {
      return `${amount} ரூபாய்`;
    }
    return `${amount} rupees`;
  });

  return normalized;
};

const Message = ({ role, content }) => {
  const isAI = role === 'ai';
  return (
    <div className={`flex gap-4 mb-8 ${isAI ? '' : 'flex-row-reverse'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
        isAI ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-900 text-white shadow-slate-900/20'
      }`}>
        {isAI ? <Bot size={20} /> : <User size={20} />}
      </div>
      <div className={`max-w-[70%] group`}>
        <div className={`p-5 rounded-3xl shadow-sm text-sm font-semibold leading-relaxed border ${
          isAI 
            ? 'bg-white text-slate-800 rounded-tl-none border-slate-100 hover:shadow-md transition-shadow' 
            : 'bg-indigo-600 text-white rounded-tr-none border-indigo-500'
        }`}>
          {content}
        </div>
        <div className={`text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2 px-2 flex items-center gap-2 ${isAI ? '' : 'flex-row-reverse text-right'}`}>
          {isAI ? 'Trade Intelligent Assistant' : 'Terminal Operator'}
          <div className="w-1 h-3 bg-slate-200 rounded-full"></div>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const AIAssistantView = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I am your Trade Intelligence Assistant. You can speak or type to me in English or Tamil. How can I assist you with your logistics data today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const messagesRef = useRef(messages);
  const selectedLangRef = useRef(selectedLang);
  const continuousVoiceRef = useRef(continuousVoice);
  const micShouldRemainOnRef = useRef(false);
  const restartAfterTurnRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastAssistantAnswerRef = useRef('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
    const lastAi = [...messages].reverse().find((item) => item.role === 'ai');
    if (lastAi?.content) {
      lastAssistantAnswerRef.current = lastAi.content;
    }
  }, [messages]);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  useEffect(() => {
    continuousVoiceRef.current = continuousVoice;
  }, [continuousVoice]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(RecognitionCtor));

    return () => {
      micShouldRemainOnRef.current = false;
      restartAfterTurnRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (_e) {
          // no-op
        }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopRecognition = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    } catch (_e) {
      // no-op
    }
    recognitionRef.current = null;
  };

  const speakAnswer = async (text) => {
    if (!text?.trim()) return;
    const speechText = normalizeSpeechText(text, selectedLangRef.current);

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (_e) {
        // no-op
      }
      audioRef.current = null;
    }

    setIsSpeaking(true);
    setVoiceError('');
    let objectUrl = '';

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: speechText, lang: selectedLangRef.current }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `TTS failed with ${response.status}`);
      }

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('Audio playback failed.'));
        audio.play().catch(reject);
      });
    } catch (error) {
      setVoiceError(error?.message || 'Unable to play voice response.');
    } finally {
      setIsSpeaking(false);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      audioRef.current = null;
    }
  };

  const startRecognition = () => {
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setVoiceError('Speech recognition is not supported in this browser.');
      return;
    }
    if (recognitionRef.current || isLoadingRef.current || isSpeakingRef.current) {
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = selectedLangRef.current;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceError('');
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += `${text} `;
        } else {
          interimTranscript += text;
        }
      }

      const combined = `${finalTranscript}${interimTranscript}`.trim();
      if (combined) {
        setQuery(combined);
      }

      const utterance = finalTranscript.trim();
      if (utterance) {
        restartAfterTurnRef.current = micShouldRemainOnRef.current && continuousVoiceRef.current;
        stopRecognition();
        setIsRecording(false);
        setQuery('');
        void sendQuery(utterance, { restartListening: restartAfterTurnRef.current });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      setVoiceError(`Voice input error: ${event.error}`);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (micShouldRemainOnRef.current && !restartAfterTurnRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
        startRecognition();
      } else if (!micShouldRemainOnRef.current) {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleRecording = () => {
    if (isRecording || micShouldRemainOnRef.current) {
      micShouldRemainOnRef.current = false;
      restartAfterTurnRef.current = false;
      stopRecognition();
      setIsRecording(false);
      setQuery('');
      return;
    }

    micShouldRemainOnRef.current = true;
    restartAfterTurnRef.current = false;
    startRecognition();
  };

  const sendQuery = async (messageOverride, options = {}) => {
    const userMsg = (messageOverride ?? query).trim();
    if (!userMsg) return;

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    setIsLoading(true);
    setVoiceError('');

    try {
      const history = messagesRef.current.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ message: userMsg, lang: selectedLangRef.current, history })
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Assistant request failed with ${response.status}`);
      }

      const data = await response.json();
      const answer = data?.answer || 'No response returned.';
      setMessages((prev) => [...prev, { role: 'ai', content: answer }]);
      await speakAnswer(answer);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'ai', content: 'System error: Unable to connect to inference engine.' }]);
      setVoiceError(e?.message || 'Unable to reach the assistant service.');
    } finally {
      setIsLoading(false);
      if (options.restartListening && micShouldRemainOnRef.current) {
        restartAfterTurnRef.current = false;
        startRecognition();
      }
    }
  };

  const replayLastAnswer = () => {
    if (lastAssistantAnswerRef.current) {
      void speakAnswer(lastAssistantAnswerRef.current);
    }
  };

  const switchLanguage = (nextLang) => {
    setSelectedLang(nextLang);
    if (micShouldRemainOnRef.current) {
      stopRecognition();
      setIsRecording(false);
      startRecognition();
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3 flex items-center gap-3">
            AI <span className="text-indigo-600">Assistant</span> Terminal
            <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-indigo-200">BETA</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium">Multi-modal trade intelligence with English and Tamil voice interaction.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.code}
                onClick={() => switchLanguage(option.code)}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedLang === option.code ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setContinuousVoice((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${continuousVoice ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            {continuousVoice ? 'Extended Voice On' : 'Extended Voice Off'}
          </button>
          <button
            onClick={replayLastAnswer}
            disabled={isSpeaking || !lastAssistantAnswerRef.current}
            className="p-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50 transition-all"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Voice Channel</div>
          <div className="text-sm font-bold text-slate-700">
            {selectedLang === 'ta-IN' ? 'Tamil voice input and speech output are active.' : 'English voice input and speech output are active.'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mic Mode</div>
          <div className="text-sm font-bold text-slate-700">{continuousVoice ? 'Continuous until you switch off mic' : 'Single-turn voice capture'}</div>
        </div>
      </div>

      {voiceError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {voiceError}
        </div>
      )}

      <div className="flex-1 bg-white border border-corp-border rounded-[2.5rem] enterprise-shadow mb-6 flex flex-col overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full -mr-64 -mt-64 blur-[100px] opacity-30 select-none pointer-events-none"></div>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10" ref={scrollRef}>
          {messages.map((m, idx) => (
            <Message key={idx} role={m.role} content={m.content} />
          ))}
          {isLoading && (
            <div className="flex gap-4 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-spin">
                <Loader2 size={20} />
              </div>
              <div className="p-5 rounded-3xl bg-indigo-50 border border-indigo-100 text-sm font-bold text-indigo-400 italic flex items-center gap-3">
                Assistant is thinking in {selectedLang === 'ta-IN' ? 'Tamil' : 'English'}...
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-gray-50/50 border-t border-corp-border relative z-10">
          <div className="flex gap-6 mb-4 overflow-x-auto no-scrollbar pb-2">
            {[
              selectedLang === 'ta-IN' ? 'இந்த மாத invoice-கள்' : 'Invoices this month',
              selectedLang === 'ta-IN' ? 'Shipment anomalies' : 'Shipment anomalies',
              selectedLang === 'ta-IN' ? 'Warehouse status' : 'Warehouse status',
              selectedLang === 'ta-IN' ? 'Pending imports' : 'Pending imports',
            ].map(p => (
              <button 
                key={p} 
                onClick={() => setQuery(p)}
                className="whitespace-nowrap bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 px-4 py-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="relative group/input">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendQuery()}
              placeholder={selectedLang === 'ta-IN' ? 'தரவு களஞ்சியத்தை கேளுங்கள் (தமிழ் அல்லது English)...' : 'Query the Data Lake (English or Tamil supported)...'} 
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 pl-8 pr-32 text-sm font-bold shadow-xl shadow-black/5 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all text-slate-800"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
              <button 
                onClick={toggleRecording}
                disabled={!speechSupported || isLoading || isSpeaking}
                className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${
                  isRecording 
                    ? 'bg-red-500 text-white shadow-red-500/20' 
                    : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600 hover:border-indigo-100 shadow-slate-900/5'
                } disabled:opacity-50`}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={sendQuery}
                disabled={isLoading}
                className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-700/50 transition-all active:scale-90"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantView;
