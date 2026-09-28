import React, { useState, useCallback } from 'react';
import { GlassCard, Badge, Button, EmptyState } from '../ui/Components';
import { ShieldCheck, ShieldOff, UserCheck, AlertTriangle, Clock } from 'lucide-react';
import { classroomApi, errorMessage } from '../../services/api';
import { usePolledApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';

/**
 * Host-teacher control panel for focus enforcement.
 *
 * Shows who has picked up strikes, who has been removed, and lets the teacher
 * readmit them. Readmission forgives the outstanding strikes but leaves the
 * alerts on the record, so the session report still shows what happened.
 */
const FocusStandings = ({ sessionId }) => {
  const { addToast } = useToast();
  const [busyId, setBusyId] = useState(null);

  const fetchStandings = useCallback(
    () => (sessionId ? classroomApi.standings(sessionId) : Promise.resolve({ data: [] })),
    [sessionId]
  );
  const { data: standings, refetch } = usePolledApi(fetchStandings, 10000, [sessionId]);

  const readmit = async (student) => {
    setBusyId(student.studentId);
    try {
      await classroomApi.readmit(sessionId, student.studentId);
      await refetch();
      addToast(`${student.studentName} has been readmitted.`, 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Could not readmit this student.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rows = standings || [];
  const removed = rows.filter(s => s.removed);

  return (
    <GlassCard hover={false} padding="p-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Class Focus</h3>
        </div>
        {removed.length > 0 && <Badge variant="danger">{removed.length} removed</Badge>}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Everyone is on task"
          description="Students who leave the class window will appear here."
          className="py-6"
        />
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {rows.map(student => (
            <div
              key={student.studentId}
              className={`p-3 rounded-xl border transition-colors ${
                student.removed
                  ? 'bg-rose-500/5 border-rose-500/20'
                  : student.violations >= 2
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-dark-bg border-dark-border'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-lg shrink-0">{student.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{student.studentName}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock size={9} />
                    {student.lastEvent === 'SCREEN_SHARE_STOPPED' ? 'stopped sharing' : 'left window'}
                    {student.lastEventAt ? ` · ${student.lastEventAt}` : ''}
                  </p>
                </div>
                {student.removed
                  ? <Badge variant="danger">Removed</Badge>
                  : <Badge variant="warning">{student.violations}/{student.limit}</Badge>}
              </div>

              {/* Strike meter */}
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: student.limit }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < student.violations
                        ? student.removed ? 'bg-rose-500' : 'bg-amber-500'
                        : 'bg-dark-border'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500">
                  {student.forgiven > 0 ? `${student.forgiven} previously forgiven` : ' '}
                </span>
                {student.violations > 0 && (
                  <Button
                    variant={student.removed ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={busyId === student.studentId}
                    onClick={() => readmit(student)}
                    className="flex items-center gap-1.5 !px-2.5 !py-1 !text-[10px]"
                  >
                    <UserCheck size={11} />
                    {busyId === student.studentId
                      ? 'Clearing…'
                      : student.removed ? 'Readmit' : 'Clear strikes'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/15 flex items-start gap-2">
          <ShieldOff size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-200/80 leading-relaxed">
            Removed students cannot rejoin until you readmit them. Their alerts stay on
            the session report either way.
          </p>
        </div>
      )}

      {rows.some(s => !s.removed && s.violations >= 2) && (
        <div className="mt-2 flex items-start gap-2 px-1">
          <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-200/70 leading-relaxed">
            One more off-task event will remove the highlighted students.
          </p>
        </div>
      )}
    </GlassCard>
  );
};

export default FocusStandings;
