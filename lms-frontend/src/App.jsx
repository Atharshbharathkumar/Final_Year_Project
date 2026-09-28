import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CoursesPage from './pages/CoursesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import EngagementAnalytics from './pages/EngagementAnalytics';
import AcademicCreditsPage from './pages/AcademicCreditsPage';
import AIMonitoringPage from './pages/AIMonitoringPage';
import AIReportsPage from './pages/AIReportsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import ArchitecturePage from './pages/ArchitecturePage';
import ResumeScoring from './pages/ResumeScoring';
import OnlineClassroom from './pages/OnlineClassroom';
import EventsPage from './pages/EventsPage';
import NotificationsPage from './pages/NotificationsPage';
import ExamsPage from './pages/ExamsPage';
import ExamTakingPage from './pages/ExamTakingPage';
import GradingPage from './pages/GradingPage';
import PlaceholderPage from './pages/PlaceholderPage';

// New ALSE Pages
import AdaptiveLearningState from './pages/AdaptiveLearningState';
import DigitalTwin from './pages/DigitalTwin';
import AIInterventionCenter from './pages/AIInterventionCenter';
import LearningSimulator from './pages/LearningSimulator';
import ResponsibleAICenter from './pages/ResponsibleAICenter';

// Icons for the not-yet-built placeholder screens
import { ClipboardCheck, User, Settings, Users } from 'lucide-react';

const App = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/architecture" element={<DashboardLayout><ArchitecturePage /></DashboardLayout>} />

            {/* Dashboards */}
            <Route path="/student/dashboard" element={<DashboardLayout><StudentDashboard /></DashboardLayout>} />
            <Route path="/teacher/dashboard" element={<DashboardLayout><TeacherDashboard /></DashboardLayout>} />
            <Route path="/parent/dashboard" element={<DashboardLayout><ParentDashboard /></DashboardLayout>} />
            <Route path="/admin/dashboard" element={<DashboardLayout><AdminDashboard /></DashboardLayout>} />

            {/* Core Features */}
            <Route path="/courses" element={<DashboardLayout><CoursesPage /></DashboardLayout>} />
            <Route path="/assignments" element={<DashboardLayout><AssignmentsPage /></DashboardLayout>} />
            <Route path="/engagement" element={<DashboardLayout><EngagementAnalytics /></DashboardLayout>} />
            <Route path="/credits" element={<DashboardLayout><AcademicCreditsPage /></DashboardLayout>} />
            <Route path="/resume-scoring" element={<DashboardLayout><ResumeScoring /></DashboardLayout>} />

            {/* AI & Classroom */}
            <Route path="/classroom/live" element={<DashboardLayout><OnlineClassroom /></DashboardLayout>} />
            <Route path="/ai-monitoring" element={<DashboardLayout><AIMonitoringPage /></DashboardLayout>} />
            <Route path="/ai-reports" element={<DashboardLayout><AIReportsPage /></DashboardLayout>} />
            <Route path="/ai-assistant" element={<DashboardLayout><AIAssistantPage /></DashboardLayout>} />
            
            {/* ALSE & Intelligence Loop */}
            <Route path="/learning-states" element={<DashboardLayout><AdaptiveLearningState /></DashboardLayout>} />
            <Route path="/digital-twin" element={<DashboardLayout><DigitalTwin /></DashboardLayout>} />
            <Route path="/interventions" element={<DashboardLayout><AIInterventionCenter /></DashboardLayout>} />
            <Route path="/simulator" element={<DashboardLayout><LearningSimulator /></DashboardLayout>} />
            <Route path="/responsible-ai" element={<DashboardLayout><ResponsibleAICenter /></DashboardLayout>} />

            {/* Campus */}
            <Route path="/exams" element={<DashboardLayout><ExamsPage /></DashboardLayout>} />
            <Route path="/exams/:id/take" element={<DashboardLayout><ExamTakingPage /></DashboardLayout>} />
            <Route path="/grading" element={<DashboardLayout><GradingPage /></DashboardLayout>} />
            <Route path="/events" element={<DashboardLayout><EventsPage /></DashboardLayout>} />
            <Route path="/notifications" element={<DashboardLayout><NotificationsPage /></DashboardLayout>} />
            <Route path="/grades" element={<DashboardLayout><EngagementAnalytics /></DashboardLayout>} />
            <Route path="/admin/reports" element={<DashboardLayout><AIReportsPage /></DashboardLayout>} />

            {/* Not yet built */}
            <Route path="/attendance" element={<DashboardLayout><PlaceholderPage title="Attendance" icon={ClipboardCheck} description="Attendance is recorded and drives your dashboard figures, but this detailed register view is not built yet." /></DashboardLayout>} />
            <Route path="/profile" element={<DashboardLayout><PlaceholderPage title="User Profile" icon={User} description="Profile editing is not built yet." /></DashboardLayout>} />
            <Route path="/settings" element={<DashboardLayout><PlaceholderPage title="System Settings" icon={Settings} description="Platform preferences are not built yet." /></DashboardLayout>} />
            <Route path="/admin/users" element={<DashboardLayout><PlaceholderPage title="User Management" icon={Users} description="User administration is not built yet." /></DashboardLayout>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
