import React, { useEffect, useState } from 'react';
import { courseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Plus, Users, ArrowRight, Video, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Courses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = () => {
    courseApi.getAll().then((res) => setCourses(res.data)).catch(() => {});
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await courseApi.create({
        title: newTitle,
        courseCode: newCode,
        description: newDesc,
        coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
      });
      setShowModal(false);
      setNewTitle('');
      setNewCode('');
      setNewDesc('');
      loadCourses();
    } catch (err) {
      alert('Could not create course');
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await courseApi.enroll(courseId);
      alert('Successfully enrolled!');
      loadCourses();
    } catch (err) {
      alert(err.response?.data?.message || 'Enrolled successfully');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            <span>Course Management</span>
          </h1>
          <p className="text-xs text-slate-400">Explore modules, enroll, and launch virtual classrooms</p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="rounded-2xl glass-card border border-dark-border overflow-hidden flex flex-col justify-between group"
          >
            <div className="space-y-3 p-5">
              <div className="h-40 rounded-xl overflow-hidden relative">
                <img
                  src={course.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur font-mono text-xs font-bold text-indigo-300 border border-slate-700">
                  {course.courseCode}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-100">{course.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {course.description}
              </p>
            </div>

            <div className="p-5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                Prof. {course.teacher?.fullName || 'Turing'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEnroll(course.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  Enroll
                </button>
                <Link
                  to={`/classroom/${course.id}`}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Video className="w-3.5 h-3.5" /> Class
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card p-6 rounded-2xl border border-indigo-500/30 space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold">Course Code</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="CS501"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold">Course Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Neural Networks & WebRTC"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Course summary..."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
