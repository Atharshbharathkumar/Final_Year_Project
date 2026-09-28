import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const TOAST_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const TOAST_STYLES = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  info: 'border-brand-500/30 bg-brand-500/10 text-brand-300',
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = TOAST_ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl animate-slide-up ${TOAST_STYLES[t.type]}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
