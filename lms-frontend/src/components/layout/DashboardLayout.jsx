import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const DashboardLayout = ({ children }) => {
  const { user, token, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mx-auto animate-pulse shadow-lg shadow-brand-500/25">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Initializing EduVerse AI...</p>
            <div className="mt-3 w-48 h-1 bg-dark-card rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full animate-[gradientX_2s_ease_infinite]" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto w-full page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
