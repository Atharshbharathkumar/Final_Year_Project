import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/ui/Navbar';
import { Sidebar } from './components/ui/Sidebar';
import { AiCopilotWidget } from './components/monitoring/AiCopilotWidget';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { ExamRoom } from './pages/ExamRoom';
import { ClassroomRoom } from './pages/ClassroomRoom';
import { TeacherMonitoring } from './pages/TeacherMonitoring';
import { TeacherReports } from './pages/TeacherReports';
import { Assignments } from './pages/Assignments';
import { Attendance } from './pages/Attendance';
import { Achievements } from './pages/Achievements';
import { ParentDashboard } from './pages/ParentDashboard';

const ProtectedLayout = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-indigo-400 text-xl">🧠</span>
          </div>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <AiCopilotWidget />
    </div>
  );
};

/** Parents have no course dashboard, so send them to their own view. */
const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user?.role === 'PARENT' ? '/parent' : '/dashboard'} replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedLayout>
                <Courses />
              </ProtectedLayout>
            }
          />
          <Route
            path="/exam/:examId"
            element={
              <ProtectedLayout>
                <ExamRoom />
              </ProtectedLayout>
            }
          />
          <Route
            path="/classroom/:sessionId"
            element={
              <ProtectedLayout>
                <ClassroomRoom />
              </ProtectedLayout>
            }
          />
          <Route
            path="/teacher/monitoring/:sessionId"
            element={
              <ProtectedLayout>
                <TeacherMonitoring />
              </ProtectedLayout>
            }
          />
          <Route
            path="/teacher/reports"
            element={
              <ProtectedLayout>
                <TeacherReports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/assignments"
            element={
              <ProtectedLayout>
                <Assignments />
              </ProtectedLayout>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedLayout>
                <Attendance />
              </ProtectedLayout>
            }
          />
          <Route
            path="/achievements"
            element={
              <ProtectedLayout>
                <Achievements />
              </ProtectedLayout>
            }
          />
          <Route
            path="/parent"
            element={
              <ProtectedLayout>
                <ParentDashboard />
              </ProtectedLayout>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
