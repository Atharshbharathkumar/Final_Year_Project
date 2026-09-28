import React, { useState, useRef, useCallback } from 'react';
import { GlassCard, ProgressBar, Button, Badge, LoadingState, EmptyState } from '../components/ui/Components';
import {
  FileSearch, UploadCloud, FileText, Briefcase,
  Sparkles, ClipboardPaste
} from 'lucide-react';
import { resumeApi, errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

/** Share of characters that are ordinary printable text. */
const printableRatio = (text) => {
  if (!text) return 0;
  const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length;
  return printable / text.length;
};

const ResumeScoring = () => {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const fetchLatest = useCallback(() => resumeApi.latest(), []);
  const { data: result, loading, setData } = useApi(fetchLatest, []);

  const [analyzing, setAnalyzing] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const runAnalysis = async (fileName, text) => {
    if (!text || text.trim().length < 50) {
      addToast('That resume looks too short to analyse. Paste at least a few lines.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const { data } = await resumeApi.analyze(fileName, text);
      setData(data);
      addToast(`Resume scored ${data.overallScore}/100.`, 'success');
      setShowPaste(false);
      setPastedText('');
    } catch (err) {
      addToast(errorMessage(err, 'Analysis failed.'), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    // Binary formats (PDF/DOCX) do not survive a plain text read in the browser.
    if (printableRatio(text) < 0.7) {
      addToast('That file is not plain text. Export as .txt or paste the contents instead.', 'error');
      setShowPaste(true);
      event.target.value = '';
      return;
    }
    await runAnalysis(file.name, text);
    event.target.value = '';
  };

  if (loading) return <LoadingState label="Loading your last analysis…" />;

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileSearch size={24} className="text-violet-400" /> AI Resume Intelligence
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Your resume text is scored on the server for section coverage, keyword density, quantified impact and industry fit.
        </p>
      </div>

      {/* Upload */}
      <GlassCard hover={false} className="border-dashed border-2 border-slate-700/50 hover:border-violet-500/50 transition-colors text-center p-10 relative overflow-hidden">
        {analyzing ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto animate-pulse">
              <Sparkles size={28} className="text-white" />
            </div>
            <p className="text-lg font-semibold text-white">Analyzing Resume…</p>
            <p className="text-sm text-slate-400">Extracting skills, evaluating formatting, and matching against industry profiles.</p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center mx-auto mb-4">
              <UploadCloud size={28} className="text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Upload your Resume</h3>
            <p className="text-sm text-slate-400 mb-6">Plain-text formats (.txt, .md) are read directly — or paste the contents below.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.rtf,text/*" onChange={handleFile} className="hidden" />
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
              <Button variant="secondary" onClick={() => setShowPaste(s => !s)} className="inline-flex items-center gap-2">
                <ClipboardPaste size={16} /> {showPaste ? 'Hide' : 'Paste'} Text
              </Button>
            </div>

            {showPaste && (
              <div className="mt-6 max-w-2xl mx-auto text-left space-y-3">
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  rows={10}
                  placeholder="Paste the full text of your resume here…"
                  className="w-full p-4 rounded-xl bg-dark-bg border border-dark-border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                />
                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => runAnalysis('pasted-resume.txt', pastedText)}>
                    Analyze Text
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Results */}
      {!result && !analyzing && (
        <EmptyState
          icon={FileSearch}
          title="No analysis yet"
          description="Upload or paste your resume to get an ATS compatibility score."
        />
      )}

      {result && !analyzing && (
        <div className="animate-fade-in space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <GlassCard hover={false} className="flex flex-col items-center justify-center text-center p-8 lg:col-span-1 border-brand-500/20">
              <h3 className="text-sm font-semibold text-white mb-6 w-full text-left">ATS Compatibility Score</h3>
              <div className="relative mb-4">
                <svg width="160" height="160" className="-rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle cx="80" cy="80" r="70" fill="none" stroke="url(#scoreGrad)" strokeWidth="12"
                    strokeDasharray="439.8"
                    strokeDashoffset={439.8 - (result.overallScore / 100) * 439.8}
                    strokeLinecap="round" />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold gradient-text">{result.overallScore}</span>
                  <span className="text-xs text-slate-400">/ 100</span>
                </div>
              </div>
              <p className="text-sm text-slate-300">{result.verdict}</p>
              <p className="text-[10px] text-slate-500 mt-3">{result.fileName} · {result.analyzedAt}</p>
            </GlassCard>

            <GlassCard hover={false} className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-white mb-4">Detailed Breakdown</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(result.breakdown || {}).map(([key, data]) => (
                  <div key={key} className="p-4 rounded-xl bg-dark-bg/50 border border-dark-border/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-white capitalize">{key}</span>
                      <span className={`text-xs font-bold ${data.score >= 80 ? 'text-emerald-400' : data.score >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {data.score}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-dark-border rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${data.score >= 80 ? 'bg-emerald-500' : data.score >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${data.score}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{data.feedback}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-white">AI Recommendations to Improve</h3>
              </div>
              <div className="space-y-3">
                {(result.suggestions || []).map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-xs font-bold">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5">{suggestion}</p>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="w-full mt-4 flex items-center justify-center gap-2"
                onClick={() => setShowPaste(true)}>
                <FileText size={16} /> Re-analyze Updated Resume
              </Button>
            </GlassCard>

            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Industry Fit Analysis</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Keyword overlap between your resume and each role profile.</p>
              <div className="space-y-4">
                {(result.industryMatch || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-1/3 text-sm text-slate-300">{item.industry}</div>
                    <div className="flex-1 -mt-1">
                      <ProgressBar
                        value={item.match}
                        color={item.match >= 80 ? 'from-emerald-500 to-teal-500' : item.match >= 65 ? 'from-brand-500 to-indigo-500' : 'from-rose-500 to-pink-500'}
                      />
                    </div>
                    <div className="w-12 text-right">
                      <Badge variant={item.match >= 80 ? 'success' : item.match >= 65 ? 'brand' : 'danger'}>{item.match}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeScoring;