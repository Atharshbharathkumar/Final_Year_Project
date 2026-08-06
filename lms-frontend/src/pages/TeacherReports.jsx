import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalyticsDashboard } from '../components/dashboard/AnalyticsDashboard';
import { BarChart3 } from 'lucide-react';

export const TeacherReports = () => {
  const [params] = useSearchParams();
  const sessionId = Number(params.get('sessionId')) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          <span>Session reports</span>
        </h1>
        <p className="text-xs text-slate-400">
          Attention trends and alerts computed from the samples recorded for this session
        </p>
      </div>

      {/* The PDF export button was removed: it called alert() claiming a report
          had been exported, and no export exists. */}
      <AnalyticsDashboard sessionId={sessionId} contextType="CLASSROOM" />
    </div>
  );
};
