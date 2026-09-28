import { useState, useEffect, useCallback, useRef } from 'react';
import { errorMessage } from '../services/api';

/**
 * Runs an API call on mount and exposes { data, loading, error, refetch }.
 *
 * `request` must be stable (wrap it in useCallback, or declare it outside the
 * component) — it is used directly as the effect dependency.
 */
export const useApi = (request, deps = [], { immediate = true, initialData = null } = {}) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await request();
      // 204 No Content comes back with an empty body.
      if (mounted.current) setData(response?.data ?? null);
      return response?.data ?? null;
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) run();
  }, [run, immediate]);

  return { data, loading, error, refetch: run, setData };
};

/**
 * Polls an endpoint on an interval. Used for the live classroom and alert
 * panels, which must keep updating while a session is running.
 */
export const usePolledApi = (request, intervalMs = 15000, deps = []) => {
  const result = useApi(request, deps);
  const { refetch } = result;

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(refetch, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return result;
};