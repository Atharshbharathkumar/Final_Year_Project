import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, UserX, ExternalLink, Clock } from 'lucide-react';
import { monitoringApi } from '../../services/api';
import websocketService from '../../services/websocket';

export const AlertPanel = ({ sessionId = 1, contextType = 'CLASSROOM' }) => {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch persisted alerts. A session with no incidents shows none — it must
    // not be padded with sample incidents naming real-looking students.
    monitoringApi
      .getAlerts(sessionId, contextType)
      .then((res) => {
        setAlerts(res.data || []);
        setError(null);
      })
      .catch(() => {
        setAlerts([]);
        setError('Alert feed unavailable — could not reach the server.');
      });

    // Subscribe to STOMP WebSocket alert topic
    const topic = `/topic/alerts/${contextType}/${sessionId}`;
    const sub = websocketService.subscribe(topic, (alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    return () => {
      websocketService.unsubscribe(topic);
    };
  }, [sessionId, contextType]);

  return (
    <div className="rounded-2xl glass-card border border-dark-border p-4 flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Proctoring incidents</h3>
            <span className="text-[11px] text-slate-400">Rule-triggered, pushed live over STOMP</span>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-xs">
          {alerts.length} Incidents
        </span>
      </div>

      <div className="space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
        {error && (
          <p className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[11px] font-semibold text-rose-200">
            {error}
          </p>
        )}
        {!error && alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No incidents recorded for this session.
          </div>
        ) : (
          alerts.map((alert, index) => {
            const isCritical = alert.severity === 'CRITICAL' || alert.alertType === 'MULTIPLE_FACES';
            const isHigh = alert.severity === 'HIGH' || alert.alertType === 'TAB_SWITCH';

            return (
              <div
                key={alert.id || index}
                className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                  isCritical
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : isHigh
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {isCritical ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{alert.studentName || 'Student'}</span>
                  </span>

                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-slate-300 leading-tight">{alert.message}</p>

                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-800/60">
                  <span className="uppercase tracking-wider font-bold text-rose-400 font-mono">
                    {alert.alertType}
                  </span>
                  <span className="font-medium text-indigo-400 hover:underline cursor-pointer">
                    View Snapshot
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
