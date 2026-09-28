import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  courseApi: { my: vi.fn(), create: vi.fn() },
  assignmentApi: { my: vi.fn(), create: vi.fn() },
  classroomApi: { create: vi.fn() },
  errorMessage: (err, fallback) => err?.response?.data?.message || err?.message || fallback,
}));

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

import CoursesPage from './CoursesPage';
import { courseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const asStudent = () => useAuth.mockReturnValue({ user: { id: 1, name: 'Student', role: 'student' } });
const asTeacher = () => useAuth.mockReturnValue({ user: { id: 2, name: 'Teacher', role: 'teacher' } });

const COURSES = [
  {
    id: 1, name: 'Machine Learning', code: 'CS401', instructor: 'Dr. Rajesh Kumar',
    progress: 65, enrolled: 12, grade: 'A', semester: 'Semester Odd 2026',
    credits: 4, color: '#8b5cf6', icon: '🤖',
  },
  {
    id: 2, name: 'Computer Networks', code: 'CS303', instructor: 'Dr. Vikram Patel',
    progress: 40, enrolled: 7, grade: 'B+', semester: 'Semester Odd 2026',
    credits: 3, color: '#10b981', icon: '🌐',
  },
];

describe('CoursesPage', () => {
  beforeEach(() => {
    asStudent();
  });

  it('shows a loading state while the request is in flight', () => {
    courseApi.my.mockReturnValue(new Promise(() => {}));
    render(<CoursesPage />);

    expect(screen.getByText(/loading courses/i)).toBeInTheDocument();
  });

  it('renders each course returned by the server', async () => {
    courseApi.my.mockResolvedValue({ data: COURSES });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText('Machine Learning')).toBeInTheDocument());
    expect(screen.getByText('Computer Networks')).toBeInTheDocument();
    expect(screen.getByText('CS401')).toBeInTheDocument();
    expect(screen.getByText('Dr. Rajesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('renders values from the response rather than any built-in defaults', async () => {
    courseApi.my.mockResolvedValue({
      data: [{ ...COURSES[0], name: 'Quantum Basket Weaving', progress: 3, grade: 'D' }],
    });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText('Quantum Basket Weaving')).toBeInTheDocument());
    expect(screen.getByText('3%')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('shows an empty state, not a blank page, when the student has no courses', async () => {
    courseApi.my.mockResolvedValue({ data: [] });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText(/no courses yet/i)).toBeInTheDocument());
    expect(screen.getByText(/not enrolled in any courses/i)).toBeInTheDocument();
  });

  it('surfaces the server error and offers a retry that re-issues the request', async () => {
    courseApi.my.mockRejectedValue({ response: { data: { message: 'Service unavailable.' } } });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText(/unable to load this view/i)).toBeInTheDocument());
    expect(screen.getByText('Service unavailable.')).toBeInTheDocument();

    courseApi.my.mockResolvedValue({ data: COURSES });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(screen.getByText('Machine Learning')).toBeInTheDocument());
    expect(courseApi.my).toHaveBeenCalledTimes(2);
  });

  it('hides the course-authoring control from students', async () => {
    courseApi.my.mockResolvedValue({ data: COURSES });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText('Machine Learning')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /new course/i })).not.toBeInTheDocument();
    expect(screen.getByText(/my courses/i)).toBeInTheDocument();
  });

  it('offers course authoring to a teacher and opens the form', async () => {
    asTeacher();
    courseApi.my.mockResolvedValue({ data: COURSES });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText('Machine Learning')).toBeInTheDocument());
    expect(screen.getByText(/courses you teach/i)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /new course/i });
    await userEvent.click(button);

    expect(await screen.findByText(/create a course/i)).toBeInTheDocument();
  });

  it('refuses to submit a course without a title and code', async () => {
    asTeacher();
    courseApi.my.mockResolvedValue({ data: COURSES });
    render(<CoursesPage />);

    await waitFor(() => expect(screen.getByText('Machine Learning')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new course/i }));
    await userEvent.click(await screen.findByRole('button', { name: /create course/i }));

    expect(courseApi.create).not.toHaveBeenCalled();
  });
});