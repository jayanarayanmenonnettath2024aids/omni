import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, User, Bot, Sparkles, Loader2, ArrowRight } from 'lucide-react';

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
    { role: 'ai', content: 'Hello! I am your Trade Intelligence Assistant. You can speak or type to me. I support English, Tamil, and Hindi. How can I assist you with your logistics data today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendQuery = async () => {
    if (!query.trim()) return;
    const userMsg = query;
    setMessages([...messages, { role: 'user', content: userMsg }]);
    setQuery('');
    setIsLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ message: userMsg, lang: 'en-IN', history })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: 'System error: Unable to connect to inference engine.' }]);
    } finally {
      setIsLoading(false);
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
          <p className="text-sm text-gray-500 font-medium">Multi-modal trade intelligence powered by neural NLP engines.</p>
        </div>
      </div>

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
                Assistant is thinking...
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
            {['Invoices this month', 'Shipment anomalies', 'Warehouse status', 'Pending imports'].map(p => (
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
              placeholder="Query the Data Lake (English, Tamil, Hindi supported)..." 
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 pl-8 pr-32 text-sm font-bold shadow-xl shadow-black/5 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all text-slate-800"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
              <button 
                onClick={() => setIsRecording(!isRecording)}
                className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${
                  isRecording 
                    ? 'bg-red-500 text-white shadow-red-500/20' 
                    : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600 hover:border-indigo-100 shadow-slate-900/5'
                }`}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={sendQuery}
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
