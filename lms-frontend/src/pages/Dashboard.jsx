import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Video, ShieldAlert, TrendingUp, Brain, Activity,
  BrainCircuit, ArrowRight, Cpu, Eye
} from 'lucide-react';
import { courseApi, classroomApi } from '../services/api';
import { AttentionMeter } from '../components/monitoring/AttentionMeter';
import { AiAnalyticsRadar } from '../components/monitoring/AiAnalyticsRadar';

export const Dashboard = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    courseApi.getAll().then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-8 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-950 shadow-2xl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-600/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Camera-based engagement monitoring</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {isTeacher
              ? 'Attention samples from students who have joined a session appear in your monitoring panel. Each student must grant camera access for their engagement to be measured.'
              : 'While you are in a class or exam, your camera is used to record attention samples. The monitoring panel tells you at any time whether measurement is actually running.'}
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link to="/classroom/1" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2">
              <Video className="w-4 h-4" /> Join Live Classroom
            </Link>
            <Link to="/exam/1" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Enter Proctored Exam Room
            </Link>
            {isTeacher && (
              <Link to="/teacher/monitoring/1" className="px-5 py-2.5 rounded-xl bg-rose-900/50 hover:bg-rose-900/70 text-rose-200 font-bold text-xs border border-rose-500/30 flex items-center gap-2">
                <Eye className="w-4 h-4 text-rose-400" /> Open Monitoring Control Panel
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ML Radar + Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              {isTeacher ? 'Managed Courses' : 'Enrolled Courses'}
            </h2>
            <Link to="/courses" className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.slice(0, 2).map((course) => (
              <div key={course.id} className="p-5 rounded-2xl glass-card border border-dark-border space-y-3 group hover:border-indigo-500/40 transition-all">
                <div className="h-36 rounded-xl overflow-hidden relative">
                  <img
                    src={course.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-900/85 backdrop-blur font-mono text-[10px] font-bold text-indigo-300 border border-slate-700">
                    {course.courseCode}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100">{course.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{course.description}</p>
                <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
                  <span className="text-slate-400 font-medium">Prof. {course.teacher?.fullName?.split(' ')[0]}</span>
                  <Link to={`/classroom/${course.id}`} className="font-bold text-indigo-400 flex items-center gap-1 hover:underline">
                    Join <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monitoring status. Live telemetry is shown by the camera panel inside a
            classroom or exam; there is nothing to measure from this page, so this
            explains that rather than displaying placeholder readings. */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Monitoring status
          </h2>

          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Attention is measured only while you are inside a classroom or exam
              with your camera running. Your live readings, and whether the face
              model is loaded, are shown on the camera panel there.
            </p>
            <Link
              to="/classroom/1"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:underline"
            >
              Open a session <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recorded summary for this user, fetched from the server. */}
      {user?.id && <AiAnalyticsRadar studentId={user.id} />}
    </div>
  );
};
