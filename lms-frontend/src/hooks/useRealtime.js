import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that returns an animated count-up value.
 */
export const useCountUp = (target, duration = 1200, decimals = 0) => {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof target !== 'number') return;
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = eased * target;
      setValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, decimals]);

  return value;
};

/**
 * Hook for a live clock that updates every second.
 */
export const useLiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};

/**
 * Hook that simulates a live data stream updating every `interval` ms.
 * Returns `{ data, pulse }` — pulse toggles true/false on each update.
 */
export const useLiveData = (initialData, updater, interval = 5000) => {
  const [data, setData] = useState(initialData);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setData(prev => updater(prev));
      setPulse(p => !p);
    }, interval);
    return () => clearInterval(id);
  }, [interval]);

  return { data, pulse };
};

/**
 * Returns a human-readable countdown string from a due-date string.
 */
export const useCountdown = (dueDateStr) => {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('normal'); // 'urgent' | 'warning' | 'normal' | 'overdue'

  const compute = useCallback(() => {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diffMs = due - now;

    if (diffMs < 0) {
      setLabel('Overdue');
      setStatus('overdue');
      return;
    }
    const diffH = diffMs / (1000 * 60 * 60);
    const diffD = diffH / 24;

    if (diffH < 24) {
      const h = Math.floor(diffH);
      const m = Math.floor((diffH - h) * 60);
      setLabel(`${h}h ${m}m left`);
      setStatus('urgent');
    } else if (diffD <= 3) {
      setLabel(`${Math.ceil(diffD)} days left`);
      setStatus('warning');
    } else {
      setLabel(`${Math.ceil(diffD)} days left`);
      setStatus('normal');
    }
  }, [dueDateStr]);

  useEffect(() => {
    compute();
    const id = setInterval(compute, 60000); // update every minute
    return () => clearInterval(id);
  }, [compute]);

  return { label, status };
};

/**
 * Simulates a live engagement value with small random fluctuations.
 */
export const useLiveEngagement = (base, amplitude = 3, interval = 3000) => {
  const [value, setValue] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setValue(v => {
        const delta = (Math.random() - 0.5) * amplitude * 2;
        return Math.max(0, Math.min(100, Math.round(v + delta)));
      });
    }, interval);
    return () => clearInterval(id);
  }, [base, amplitude, interval]);
  return value;
};
