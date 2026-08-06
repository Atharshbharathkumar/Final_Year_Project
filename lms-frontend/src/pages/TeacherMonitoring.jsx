import React from 'react';
import { useParams } from 'react-router-dom';
import { StudentGrid } from '../components/monitoring/StudentGrid';
import { AlertPanel } from '../components/monitoring/AlertPanel';

export const TeacherMonitoring = () => {
  const { sessionId } = useParams();
  const currentSessionId = sessionId || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Teacher Control Panel</h1>
          <p className="text-xs text-slate-400">Live AI proctoring, student camera grid & automated incident alert stream</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <StudentGrid sessionId={currentSessionId} contextType="CLASSROOM" />
        </div>
        <div>
          <AlertPanel sessionId={currentSessionId} contextType="CLASSROOM" />
        </div>
      </div>
    </div>
  );
};
