import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export const TOKEN_KEY = 'lms_token';
export const USER_KEY = 'lms_user';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// A rejected token means the session is gone — clear it and bounce to login
// rather than letting every page render a permission error.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

/** Pulls a human-readable message out of an axios failure. */
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.message || error?.message || fallback;

/** Unauthenticated figures for the landing and login pages. */
export const publicApi = {
  stats: () => api.get('/public/stats'),
};

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
};

export const dashboardApi = {
  student: (studentId) => api.get('/dashboard/student', { params: { studentId } }),
  teacher: () => api.get('/dashboard/teacher'),
  parent: () => api.get('/dashboard/parent'),
  admin: () => api.get('/dashboard/admin'),
  engagementBreakdown: (studentId) => api.get('/dashboard/engagement-breakdown', { params: { studentId } }),
};

export const analyticsApi = {
  weekly: () => api.get('/analytics/weekly'),
  monthly: () => api.get('/analytics/monthly'),
  departments: () => api.get('/analytics/departments'),
  roster: () => api.get('/analytics/roster'),
};

export const courseApi = {
  my: () => api.get('/courses/my'),
  getAll: () => api.get('/courses'),
  getById: (id) => api.get(`/courses/${id}`),
  create: (payload) => api.post('/courses', payload),
  enroll: (courseId) => api.post(`/courses/${courseId}/enroll`),
  students: (courseId) => api.get(`/courses/${courseId}/students`),
};

export const assignmentApi = {
  my: () => api.get('/assignments/my'),
  start: (id) => api.post(`/assignments/${id}/start`),
  submit: (id, fileName) => api.post(`/assignments/${id}/submit`, { fileName }),
  create: (payload) => api.post('/assignments', payload),
  submissions: (includeGraded = false) => api.get('/assignments/submissions', { params: { includeGraded } }),
  grade: (submissionId, grade, feedback) =>
    api.post(`/assignments/submissions/${submissionId}/grade`, { grade, feedback }),
};

export const examApi = {
  mine: (studentId) => api.get('/exams/my-exams', { params: { studentId } }),
  getByCourse: (courseId) => api.get(`/exams/course/${courseId}`),
  /** Candidate view — carries no answer key. */
  paper: (id) => api.get(`/exams/${id}/paper`),
  startAttempt: (examId) => api.post(`/exams/${examId}/start`),
  /** 204 when this candidate has not started the exam. */
  myAttempt: (examId) => api.get(`/exams/${examId}/my-attempt`),
  attemptState: (attemptId) => api.get(`/exams/attempts/${attemptId}`),
  saveAnswer: (attemptId, questionId, answer) =>
    api.post(`/exams/attempts/${attemptId}/answer`, { questionId, answer }),
  reportTabSwitch: (attemptId) => api.post(`/exams/attempts/${attemptId}/tab-switch`),
  submitAttempt: (submissionData) => api.post('/exams/submit', submissionData),
  result: (attemptId) => api.get(`/exams/attempts/${attemptId}/result`),
  getMyAttempts: () => api.get('/exams/my-attempts'),
  getAttemptsForTeacher: (examId) => api.get(`/exams/${examId}/attempts`),
};

export const classroomApi = {
  live: (sessionId) => api.get('/classroom/live', { params: { sessionId } }),
  report: (sessionId) => api.get('/classroom/report', { params: { sessionId } }),
  getActiveSessions: () => api.get('/classroom/active'),
  getById: (id) => api.get(`/classroom/${id}`),
  create: (sessionData) => api.post('/classroom/create', sessionData),
  end: (id) => api.post(`/classroom/${id}/end`),
  getChatHistory: (id) => api.get(`/classroom/${id}/chat`),
  sendChatMessage: (id, content) => api.post(`/classroom/${id}/chat`, { content }),
  /** Reports leaving the class window or stopping the screen share. */
  focusEvent: (id, payload) => api.post(`/classroom/${id}/focus-event`, payload),
  myStanding: (id) => api.get(`/classroom/${id}/my-standing`),
  /** Host-teacher view of who has focus strikes in this session. */
  standings: (id) => api.get(`/classroom/${id}/standings`),
  readmit: (id, studentId) => api.post(`/classroom/${id}/readmit/${studentId}`),
};

export const alseApi = {
  learningState: (studentId) => api.get('/alse/learning-state', { params: { studentId } }),
  digitalTwin: (studentId) => api.get('/alse/digital-twin', { params: { studentId } }),
  interventions: () => api.get('/alse/interventions'),
  approve: (id) => api.post(`/alse/interventions/${id}/approve`),
  reject: (id) => api.post(`/alse/interventions/${id}/reject`),
  simulator: () => api.get('/alse/simulator'),
};

export const campusApi = {
  events: () => api.get('/events'),
  notifications: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  credits: (studentId) => api.get('/credits/my', { params: { studentId } }),
};

export const monitoringApi = {
  logAttention: (attentionData) => api.post('/monitoring/attention', attentionData),
  getAttentionLogs: (sessionId, contextType = 'CLASSROOM') =>
    api.get(`/monitoring/logs/${sessionId}`, { params: { contextType } }),
  getAlerts: (sessionId, contextType = 'CLASSROOM') =>
    api.get(`/monitoring/alerts/${sessionId}`, { params: { contextType } }),
  getAllAlerts: () => api.get('/monitoring/alerts/all'),
};

export const aiApi = {
  predictRisk: (studentId) => api.get(`/ai/predict-risk/${studentId}`),
  evaluateIntegrity: (attemptId) => api.get(`/ai/exam-integrity/${attemptId}`),
  askCopilot: (question) => api.post('/ai/copilot/ask', { question }),
};

export const resumeApi = {
  analyze: (fileName, text) => api.post('/resume/analyze', { fileName, text }),
  latest: () => api.get('/resume/latest'),
};

export default api;