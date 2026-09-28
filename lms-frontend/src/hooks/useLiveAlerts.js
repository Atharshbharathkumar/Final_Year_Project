import { useEffect, useState, useCallback } from 'react';
import websocket from '../services/websocket';
import { monitoringApi } from '../services/api';

/**
 * Loads the alert history once, then keeps it current by subscribing to the
 * platform-wide STOMP alert feed. New alerts arrive without polling.
 */
export const useLiveAlerts = ({ limit = 20, onAlert } = {}) => {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);

  const prepend = useCallback((alert) => {
    setAlerts(prev => {
      if (prev.some(a => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, limit);
    });
    if (onAlert) onAlert(alert);
  }, [limit, onAlert]);

  useEffect(() => {
    let active = true;

    monitoringApi.getAllAlerts()
      .then(({ data }) => { if (active) setAlerts((data || []).slice(0, limit)); })
      .catch(() => { /* history is optional — the live feed still works */ });

    websocket.connect(() => {
      if (!active) return;
      setConnected(true);
      websocket.subscribe('/topic/alerts/all', prepend);
    });

    return () => {
      active = false;
      websocket.unsubscribe('/topic/alerts/all');
    };
  }, [limit, prepend]);

  return { alerts, connected };
};