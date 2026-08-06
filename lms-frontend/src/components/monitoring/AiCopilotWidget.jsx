import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, MessageSquare, HelpCircle, ChevronUp } from 'lucide-react';
import { aiApi } from '../../services/api';

export const AiCopilotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Search your course material. I look through the course and exam descriptions your teachers have entered and show you what matches — I do not answer from general knowledge.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await aiApi.askCopilot(userText);
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: res.data.answer, sources: res.data.sources || [] },
      ]);
    } catch (err) {
      // Report the outage. Previously this printed a canned paragraph that read
      // like a successful answer even though nothing had been searched.
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Search unavailable — could not reach the server.', error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText) => {
    setInput(promptText);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center gap-2 shadow-2xl shadow-indigo-600/40 hover:scale-105 transition-all group"
        >
          <div className="p-1 rounded-lg bg-white/20">
            <Bot className="w-4 h-4" />
          </div>
          <span>Search course material</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      ) : (
        <div className="w-80 sm:w-96 rounded-3xl glass-card border border-indigo-500/40 shadow-2xl overflow-hidden flex flex-col h-[480px]">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border-b border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Course material search <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </h3>
                <span className="text-[10px] text-indigo-200">Keyword search over your courses</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 flex gap-1.5 overflow-x-auto text-[10px]">
            <button
              onClick={() => handleQuickPrompt('proctoring camera')}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-indigo-300 whitespace-nowrap hover:bg-slate-800"
            >
              🔍 proctoring camera
            </button>
            <button
              onClick={() => handleQuickPrompt('neural networks')}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-indigo-300 whitespace-nowrap hover:bg-slate-800"
            >
              🔍 neural networks
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-slate-900/90">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[80%] leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : msg.error
                      ? 'bg-rose-950/70 border border-rose-500/40 text-rose-200 rounded-bl-none'
                      : 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Every result carries the record it came from, so a reader can
                      check the source rather than trusting the answer. */}
                  {msg.sources?.map((src, i) => (
                    <div key={i} className="p-2 rounded-xl bg-slate-950/70 border border-slate-700/70 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {src.sourceType}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300">{src.sourceLabel}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{src.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-[11px] text-indigo-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                Searching…
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search your courses…"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
