import React, { useCallback } from 'react';
import { GlassCard, Badge, Button, ProgressBar, LoadingState, ErrorState } from '../components/ui/Components';
import { FileBarChart, Calendar, Users, Brain, Target, ShieldAlert, Download, Share2 } from 'lucide-react';
import { classroomApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

const AIReportsPage = () => {
  const { addToast } = useToast();
  const fetchReport = useCallback(() => classroomApi.report(), []);
  const { data: report, loading, error, refetch } = useApi(fetchReport, []);

  if (loading) return <LoadingState label="Generating session report…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const handleExport = () => {
    // Uses the browser's print pipeline so the rendered report is the artefact.
    addToast('Opening the print dialog — choose "Save as PDF".', 'info');
    window.print();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Report link copied to clipboard.', 'success');
    } catch {
      addToast('Could not access the clipboard.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileBarChart size={24} className="text-emerald-400" /> AI Classroom Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">Automated post-session analysis and engagement insights.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleShare}><Share2 size={14} className="mr-2 inline" /> Share</Button>
          <Button variant="primary" size="sm" onClick={handleExport}><Download size={14} className="mr-2 inline" /> Export PDF</Button>
        </div>
      </div>

      <GlassCard hover={false} className="p-8 pb-12">
        <div className="text-center mb-10 pb-10 border-b border-dark-border">
          <h2 className="text-2xl font-bold text-white mb-2">Session Engagement Report</h2>
          <p className="text-sm text-slate-400">{report?.courseName} • {report?.sessionTitle}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs font-medium flex-wrap">
            <span className="px-3 py-1 bg-dark-bg border border-dark-border rounded-lg text-slate-300 flex items-center gap-1.5">
              <Calendar size={12} /> {report?.date}
            </span>
            <span className="px-3 py-1 bg-dark-bg border border-dark-border rounded-lg text-slate-300 flex items-center gap-1.5">
              <Users size={12} /> {report?.attendees}/{report?.totalStudents} Attendees
            </span>
            <span className="px-3 py-1 bg-dark-bg border border-dark-border rounded-lg text-slate-300">
              {report?.sessionMinutes} min session
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-10">
          <div className="md:col-span-1 text-center md:border-r border-dark-border flex flex-col justify-center">
            <p className="text-sm text-slate-400 font-medium mb-2">Overall Engagement</p>
            <p className="text-6xl font-bold text-emerald-400 mb-2">{report?.overallEngagement ?? 0}%</p>
            <div className="px-4">
              <ProgressBar value={report?.overallEngagement ?? 0} color="from-emerald-500 to-teal-500" showValue={false} />
            </div>
            <p className="text-xs text-slate-500 mt-4 px-4">
              Platform average is {report?.classAverage ?? 0}% — this session was{' '}
              {(report?.overallEngagement ?? 0) >= (report?.classAverage ?? 0) ? 'above' : 'below'} average.
            </p>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain size={16} className="text-violet-400" /> Key Insights Synthesized
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {(report?.insights || []).map((insight, i) => (
                <div key={i} className={`p-4 rounded-xl border flex gap-3 ${
                  insight.type === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  insight.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-dark-bg border-dark-border'
                }`}>
                  <div className="mt-0.5 shrink-0">
                    {insight.type === 'positive' ? <Target size={16} className="text-emerald-400" /> :
                      insight.type === 'warning' ? <ShieldAlert size={16} className="text-amber-400" /> :
                      <Brain size={16} className="text-slate-400" />}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{insight.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-xl bg-dark-bg border border-dark-border text-center">
            <p className="text-xs text-slate-400 mb-1">Average Focus Time</p>
            <p className="text-xl font-bold text-white">{report?.avgFocusMinutes ?? 0} min</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-bg border border-dark-border text-center">
            <p className="text-xs text-slate-400 mb-1">Course-Related Screen</p>
            <p className="text-xl font-bold text-white">{report?.screenCourseRelated ?? 0}%</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-bg border border-dark-border text-center">
            <p className="text-xs text-slate-400 mb-1">Session Host</p>
            <p className="text-sm font-bold text-white mt-1.5">{report?.teacherName}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          <Badge variant="brand" className="mb-3">Responsible AI Notice</Badge>
          <p className="text-xs text-brand-300 leading-relaxed">{report?.disclaimer}</p>
        </div>
      </GlassCard>
    </div>
  );
};

export default AIReportsPage;