import axios from 'axios';

// Override with VITE_API_BASE in a .env file when the backend is not on localhost.
export const SERVER_ORIGIN = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const API_BASE_URL = `${SERVER_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
};

export const courseApi = {
  getAll: () => api.get('/courses'),
  getById: (id) => api.get(`/courses/${id}`),
  getMyEnrolled: () => api.get('/courses/student/my-courses'),
  create: (courseData) => api.post('/courses', courseData),
  enroll: (courseId) => api.post(`/courses/${courseId}/enroll`),
  getStudents: (courseId) => api.get(`/courses/${courseId}/students`),
};

export const examApi = {
  getByCourse: (courseId) => api.get(`/exams/course/${courseId}`),
  getById: (id) => api.get(`/exams/${id}`),
  create: (courseId, examData) => api.post(`/exams/course/${courseId}`, examData),
  startAttempt: (examId) => api.post(`/exams/${examId}/start`),
  submitAttempt: (submissionData) => api.post('/exams/submit', submissionData),
  sendSnapshot: (snapshotData) => api.post('/exams/snapshot', snapshotData),
  getMyAttempts: () => api.get('/exams/my-attempts'),
  getAttemptsForTeacher: (examId) => api.get(`/exams/${examId}/attempts`),
};

export const classroomApi = {
  getActiveSessions: () => api.get('/classroom/active'),
  getByCourse: (courseId) => api.get(`/classroom/course/${courseId}`),
  getById: (id) => api.get(`/classroom/${id}`),
  create: (sessionData) => api.post('/classroom/create', sessionData),
  end: (id) => api.post(`/classroom/${id}/end`),
  getChatHistory: (id) => api.get(`/classroom/${id}/chat`),
  sendChatMessage: (id, content) => api.post(`/classroom/${id}/chat`, { content }),
};

export const monitoringApi = {
  logAttention: (attentionData) => api.post('/monitoring/attention', attentionData),
  getAttentionLogs: (sessionId, contextType = 'CLASSROOM') =>
    api.get(`/monitoring/logs/${sessionId}?contextType=${contextType}`),
  getAlerts: (sessionId, contextType = 'CLASSROOM') =>
    api.get(`/monitoring/alerts/${sessionId}?contextType=${contextType}`),
  getAllAlerts: () => api.get('/monitoring/alerts/all'),
};

export const assignmentApi = {
  getByCourse: (courseId) => api.get(`/assignments/course/${courseId}`),
  getMine: () => api.get('/assignments/mine'),
  create: (courseId, data) => api.post(`/assignments/course/${courseId}`, data),
  submit: (assignmentId, data) => api.post(`/assignments/${assignmentId}/submit`, data),
  getSubmissions: (assignmentId) => api.get(`/assignments/${assignmentId}/submissions`),
  getMySubmissions: () => api.get('/assignments/submissions/mine'),
  grade: (submissionId, data) => api.post(`/assignments/submissions/${submissionId}/grade`, data),
};

export const attendanceApi = {
  getMine: () => api.get('/attendance/mine'),
  getForStudent: (studentId) => api.get(`/attendance/student/${studentId}`),
  getSummary: (studentId) => api.get(`/attendance/summary/${studentId}`),
  getRegister: (courseId, date) => api.get(`/attendance/register/${courseId}?date=${date}`),
  mark: (data) => api.post('/attendance/mark', data),
  autoMark: (data) => api.post('/attendance/auto-mark', data),
};

export const achievementApi = {
  getMine: () => api.get('/achievements/mine'),
  getForStudent: (studentId) => api.get(`/achievements/student/${studentId}`),
  getSummary: (studentId) => api.get(`/achievements/summary/${studentId}`),
  getAll: () => api.get('/achievements'),
  award: (studentId, data) => api.post(`/achievements/student/${studentId}`, data),
  remove: (id) => api.delete(`/achievements/${id}`),
};

export const parentApi = {
  getChildren: () => api.get('/parent/children'),
  getChildReport: (studentId) => api.get(`/parent/children/${studentId}/report`),
  link: (data) => api.post('/parent/link', data),
};

export const aiApi = {
  predictRisk: (studentId) => api.get(`/ai/predict-risk/${studentId}`),
  evaluateIntegrity: (attemptId) => api.get(`/ai/exam-integrity/${attemptId}`),
  askCopilot: (question) => api.post('/ai/copilot/ask', { question }),
};

export default api;
