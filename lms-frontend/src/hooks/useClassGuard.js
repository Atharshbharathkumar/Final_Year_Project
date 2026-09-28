import { useState, useEffect, useRef, useCallback } from 'react';
import { classroomApi } from '../services/api';
import websocket from '../services/websocket';

/**
 * Focus enforcement for a live class.
 *
 * What the browser actually lets us observe:
 *   - our own window losing focus (`visibilitychange` / `blur`)
 *   - the shared screen track ending
 *
 * What it does not: the name of the application the student switched to, or
 * any way to close it. So "stopping" an off-task student means blocking this
 * room, reporting to the teacher, and eventually removing them.
 *
 * The violation count is authoritative on the server — this hook only reports
 * events and renders the decision that comes back.
 */
export const useClassGuard = ({ sessionId, active, screenTrack, studentId, onRemoved, onReadmitted }) => {
  const [state, setState] = useState({
    offTask: false,
    violations: 0,
    limit: 3,
    action: 'NONE',
    message: null,
    removed: false,
  });

  const awaySince = useRef(null);
  const reporting = useRef(false);
  const removedRef = useRef(false);

  const report = useCallback(async (type, awaySeconds) => {
    if (!sessionId || removedRef.current || reporting.current) return;
    reporting.current = true;
    try {
      const { data } = await classroomApi.focusEvent(sessionId, { type, awaySeconds });
      setState(prev => ({
        ...prev,
        violations: data.violations,
        limit: data.limit,
        action: data.action,
        message: data.message,
        removed: data.removed,
      }));
      if (data.removed) {
        removedRef.current = true;
        onRemoved?.(data);
      }
      return data;
    } catch {
      // A dropped report must not break the class.
      return null;
    } finally {
      reporting.current = false;
    }
  }, [sessionId, onRemoved]);

  // Removal has to survive a rejoin. Without this the block would only last
  // until the student reloaded the page, which is no enforcement at all.
  useEffect(() => {
    if (!active || !sessionId) return undefined;
    let cancelled = false;

    classroomApi.myStanding(sessionId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        removedRef.current = !!data.removed;
        setState(prev => ({
          ...prev,
          violations: data.violations ?? prev.violations,
          limit: data.limit ?? prev.limit,
          removed: !!data.removed,
          offTask: !!data.removed,
          action: data.removed ? 'REMOVED' : prev.action,
          message: data.removed
            ? 'You were removed from this class earlier. Your teacher must readmit you.'
            : prev.message,
        }));
        if (data.removed) onRemoved?.(data);
      })
      .catch(() => { /* if we cannot check, do not lock the student out */ });

    return () => { cancelled = true; };
  }, [active, sessionId, onRemoved]);

  // Leaving the class window is the reliable off-task signal.
  useEffect(() => {
    if (!active || !sessionId) return undefined;

    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        if (awaySince.current == null) awaySince.current = Date.now();
        setState(prev => ({ ...prev, offTask: true }));
      } else {
        const away = awaySince.current ? Math.round((Date.now() - awaySince.current) / 1000) : 0;
        awaySince.current = null;
        // Only count an absence long enough to be a real switch, not an
        // accidental alt-tab or a notification stealing focus for a moment.
        if (away >= 2) {
          report('WINDOW_BLUR', away);
        } else {
          setState(prev => ({ ...prev, offTask: false }));
        }
      }
    };

    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [active, sessionId, report]);

  // Ending the screen share mid-class is treated the same way.
  useEffect(() => {
    if (!active || !screenTrack) return undefined;

    const onEnded = () => {
      setState(prev => ({ ...prev, offTask: true }));
      report('SCREEN_SHARE_STOPPED');
    };

    screenTrack.addEventListener('ended', onEnded);
    return () => screenTrack.removeEventListener('ended', onEnded);
  }, [active, screenTrack, report]);

  // A teacher clearing the strikes must lift the block immediately, without
  // the student needing to reload.
  useEffect(() => {
    if (!sessionId || !studentId) return undefined;
    const topic = `/topic/classroom/${sessionId}`;

    websocket.connect(() => {
      websocket.subscribe(topic, (event) => {
        if (event?.type !== 'READMITTED') return;
        if (String(event.studentId) !== String(studentId)) return;

        removedRef.current = false;
        awaySince.current = null;
        setState({
          offTask: false,
          violations: 0,
          limit: 3,
          action: 'NONE',
          message: null,
          removed: false,
        });
        onReadmitted?.(event);
      });
    });

    return () => websocket.unsubscribe(topic);
  }, [sessionId, studentId, onReadmitted]);

  /** Called when the student acknowledges the block and returns. */
  const acknowledge = useCallback(async () => {
    if (removedRef.current) return;
    setState(prev => ({ ...prev, offTask: false }));
    await report('RETURNED');
  }, [report]);

  return { ...state, acknowledge };
};
