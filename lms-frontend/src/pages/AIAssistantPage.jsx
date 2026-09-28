import React, { useState, useRef, useEffect } from 'react';
import { GlassCard } from '../components/ui/Components';
import { Bot, Send, User, Sparkles, Paperclip, FileText, Bookmark, BookOpen } from 'lucide-react';
import { aiApi, errorMessage } from '../services/api';

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Renders the assistant's lightweight **bold** and bullet markup. */
const RichText = ({ text }) => (
  <>
    {text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i} className="block">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          )}
        </span>
      );
    })}
  </>
);

const AIAssistantPage = () => {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hello! I am your EduVerse AI Learning Assistant. I can see your courses, deadlines, grades, attendance and engagement — ask me anything about them.',
    timestamp: now(),
    suggestions: ['What is due next?', 'Show my grades', 'How is my engagement?', 'Build me a study plan'],
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const ask = async (question) => {
    if (!question.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: question, timestamp: now() }]);
    setInput('');
    setIsTyping(true);

    try {
      const { data } = await aiApi.askCopilot(question);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer,
        timestamp: now(),
        suggestions: data.suggestions || [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `I could not reach the server just now — ${errorMessage(err)}`,
        timestamp: now(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg">
            <Bot size={18} className="text-white" />
          </div>
          EduVerse <span className="gradient-text">Learning Assistant</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Answers are grounded in your own academic record.</p>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Chat */}
        <GlassCard hover={false} className="flex-1 flex flex-col p-0 overflow-hidden" padding="p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                  msg.role === 'user' ? 'bg-dark-card border border-dark-border' : 'bg-gradient-to-br from-brand-500 to-violet-500'
                }`}>
                  {msg.role === 'user' ? <User size={16} className="text-slate-400" /> : <Bot size={16} className="text-white" />}
                </div>
                <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-dark-bg/80 border border-dark-border text-slate-300 rounded-tl-none'
                  }`}>
                    <RichText text={msg.text} />
                  </div>
                  {msg.suggestions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.suggestions.map((sug, i) => (
                        <button key={i} onClick={() => ask(sug)}
                          className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs hover:bg-brand-500/20 transition-colors">
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 flex justify-end px-1">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4 max-w-[85%]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0 shadow-lg">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-dark-bg/80 border border-dark-border rounded-tl-none flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="p-4 border-t border-dark-border bg-dark-bg/50 backdrop-blur-sm">
            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <button type="button" className="p-2.5 text-slate-400 hover:text-white bg-dark-card rounded-xl border border-dark-border">
                <Paperclip size={18} />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your courses, assignments, or concepts..."
                  className="w-full pl-4 pr-12 py-3 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                />
                <Sparkles size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-400 opacity-50" />
              </div>
              <button type="submit" disabled={!input.trim() || isTyping} className="p-3 rounded-xl gradient-btn text-white disabled:opacity-50 disabled:cursor-not-allowed">
                <Send size={18} />
              </button>
            </form>
          </div>
        </GlassCard>

        {/* Sidebar */}
        <div className="w-80 hidden lg:flex flex-col gap-4">
          <GlassCard hover={false} className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-4">Suggested Actions</h3>
            <div className="space-y-3">
              {[
                { icon: FileText, title: 'What is due next?', desc: 'Your outstanding coursework, ordered by deadline' },
                { icon: BookOpen, title: 'Show my grades', desc: 'GPA, strongest and weakest courses' },
                { icon: Bookmark, title: 'Build me a study plan', desc: 'Based on your peak focus window' },
              ].map((act, i) => (
                <button key={i} onClick={() => ask(act.title)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl bg-dark-bg/50 border border-dark-border hover:border-brand-500/30 transition-colors text-left group">
                  <span className="p-2 rounded-lg bg-dark-card text-brand-400 group-hover:bg-brand-500/10"><act.icon size={16} /></span>
                  <div>
                    <p className="text-xs font-semibold text-white">{act.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{act.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-brand-600/10 to-violet-600/10 border border-brand-500/20 text-center">
              <p className="text-xs font-medium text-brand-300 mb-2">How this works</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                The assistant queries your live record on the server — enrolments, submissions, attendance and attention telemetry — and answers from that data.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;