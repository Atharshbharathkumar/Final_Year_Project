# EduVerse AI — Smart LMS with Engagement Intelligence

A full-stack learning management system: a Spring Boot API with a JWT-secured
REST + STOMP WebSocket surface, and a React dashboard that renders entirely
from that API. There is no mock data in the frontend — every number on every
screen is computed on the server from rows in the database.

---

## Running it

Two processes. Start the backend first.

### Backend — `lms-backend`

```bash
cd lms-backend
mvn spring-boot:run          # http://localhost:8080
```

Requires JDK 17+ and Maven. On first start it seeds a complete demonstration
term (see below) into a file-backed H2 database at `lms-backend/data/lmsdb.mv.db`.

To wipe and re-seed:

```bash
rm -rf lms-backend/data       # Windows: rmdir /s /q lms-backend\data
```

**You must do this after any change that adds a value to a database enum.**
Hibernate runs with `ddl-auto=update`, which creates a CHECK constraint listing
an enum's values when the table is first made but never alters it afterwards.
Inserting a newly added constant against an old database fails with
`Check constraint violation: CONSTRAINT_7`. Dropping `data/` rebuilds it.

### Frontend — `lms-frontend`

```bash
cd lms-frontend
npm install
npm run dev                   # http://localhost:5173
```

### Demo accounts

All four use the password `password`:

| Role    | Email             | Lands on               |
|---------|-------------------|------------------------|
| Student | `student@edu.in`  | `/student/dashboard`   |
| Teacher | `teacher@edu.in`  | `/teacher/dashboard`   |
| Parent  | `parent@edu.in`   | `/parent/dashboard`    |
| Admin   | `admin@edu.in`    | `/admin/dashboard`     |

The role selector on the login screen only prefills these credentials — the
server decides the actual role from the authenticated user.

---

## How the numbers are produced

`AnalyticsService` is the single source of truth. Every figure is a documented
function of real rows; nothing is hard-coded or randomised at read time.

**Engagement score** — a weighted blend, renormalised over whatever data
exists so a new student is not punished for an empty history:

| Component | Weight | Source |
|---|---|---|
| Attendance rate | 0.30 | `attendance_records` |
| Assignment completion | 0.25 | `submissions` vs assigned work |
| Measured attention | 0.25 | `attention_logs` |
| Assessment performance | 0.20 | `exam_attempts` |
| Alert penalty | −3 per alert, capped at −15 | `alerts` |

**GPA** — mean percentage across graded submissions and submitted exam
attempts, mapped onto a 4.0 scale.

**Risk band** — `high` under 60 engagement or 75% attendance; `medium` under
75 / 85; otherwise `low`.

**Course progress** — 50% syllabus coverage (distinct sessions held against
the planned total) + 50% that student's completion of the course's work.

**Adaptive Learning State Engine** (`AlseService`) — classifies each attention
reading into a pedagogical state (Deep Learning / Focused / Collaborative /
Passive Learning / Distracted / Struggling), stores only the *transitions*
along with the evidence that caused them, and builds the Digital Twin,
intervention queue and what-if simulator from that history.

**Interventions** — raised automatically for any student in the high-risk band
who does not already have an open action, with a 7-day cooldown after one is
resolved. Approving marks it delivered and the outcome is then measured live
against the engagement baseline captured when it was raised.

**Joining a live class** (`ClassroomLobby` + `useClassGuard`) — students never
enter a session implicitly. The lobby shows what the class is and what will be
monitored, and the Join button stays disabled until the student shares their
screen. A single tab or window is rejected: the share is only accepted when
`displaySurface` reports `monitor`, because sharing one tab would defeat the
point.

Once inside, leaving the class window or stopping the share is reported to the
server, which owns the count so a client cannot wind it back. Enforcement
escalates: first strike blocks the room with a warning, second is a final
warning, third removes the student from the session. Every strike raises an
alert on the teacher's live feed with rising severity.

Removal survives a rejoin: the client checks its standing on entering the room,
so a removed student cannot escape the block by reloading.

The host teacher gets a **Class Focus** panel listing everyone with strikes, and
can readmit a removed student with one click. Readmission marks the offending
alerts `resolved` rather than deleting them — the strikes stop counting, but the
session report still shows what happened and who forgave it. The readmitted
student's block lifts immediately over `/topic/classroom/{sessionId}`, with no
reload. Only the teacher hosting that session (or an admin) can see the panel or
readmit anyone.

What this deliberately does **not** claim: a web page cannot see which
application a student switched to, and cannot close it. Both are browser
security boundaries. Enforcement here means blocking our own room, reporting to
the teacher, and removing the student — not terminating anything on their
machine.

**Camera proctoring** (`faceDetection.js` + `ProctoringCamera`) — MediaPipe
FaceLandmarker runs entirely in the browser, producing 478 landmarks, 52
blendshapes and a facial transformation matrix per face. Head pose is read from
that matrix rather than approximated; eye state comes from the blink blendshapes
cross-checked against a geometric eye aspect ratio; gaze drift comes from the
eye-look blendshapes, which catches a candidate reading from a second screen
even when their head stays still. Scores are smoothed with an exponential moving
average so a blink does not read as disengagement.

The camera never opens without an explicit click, consent is revocable with one
control, and **no image or video ever leaves the device** — only the derived
numbers in the reading are posted. When the model or camera is unavailable the
component says so and posts nothing; there is no fallback that invents a score.
The WASM runtime and the 3.7 MB model are served from `public/`, so this works
with no internet connection.

**Proctored exams** (`ExamService`) — the candidate's paper is served through a
DTO that has no `correctAnswer` field, so the answer key never reaches the
browser; `GET /api/exams/{id}` (which does carry it) is restricted to staff.
Answers autosave as the candidate works, the countdown runs on the server clock,
and tab switches are counted server-side — a client that declines to report them
cannot lower the count. Reaching the limit auto-submits the attempt, raises a
CRITICAL proctoring alert and marks the result `AUTO_SUBMITTED_VIOLATION`. Every
attempt operation verifies the attempt belongs to the caller.

**Grading** — a mark recorded by a teacher writes straight back into
`AnalyticsService`, so the student's GPA, assignment completion and engagement
score all move on their next page load, and they are notified over WebSocket.

**Resume scoring** (`ResumeService`) — actually reads the submitted text:
section coverage, ATS keyword density, action-verb usage, and the share of
bullet points carrying a measurable number. Editing the resume changes the
score.

---

## What the seed creates

`DataInitializer` generates a self-consistent 8-week term from a fixed random
seed, so the demo is identical on every fresh database:

- 6 departments, 6 teachers, 12 students (with behaviour profiles from
  excellent to at-risk), 1 guardian linked to a student, 1 admin
- 6 courses with enrolments, 8 assignments with per-student submissions and grades
- ~570 attendance records across the term
- 2 proctored exams: an ML midterm every student has already sat (so the
  analytics have history), and an un-attempted Data Structures class test so the
  exam flow can be demonstrated live
- 3 classroom sessions (one live) with chat history
- ~400 attention readings over the last 7 days, and the alerts they trigger
- Campus events, notifications and co-curricular credit activities

Because the profiles drive every signal, the derived dashboards, risk bands
and learning states all agree with each other.

---

## API surface

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `/register`, `GET /api/auth/me` |
| Public | `GET /api/public/stats` |
| Dashboards | `GET /api/dashboard/{student,teacher,parent,admin}`, `/engagement-breakdown` |
| Analytics | `GET /api/analytics/{weekly,monthly,departments,roster}` |
| Courses | `GET /api/courses/my`, `/{id}`, `POST /api/courses` (create), `/{id}/enroll` |
| Assignments | `GET /api/assignments/my`, `POST /api/assignments` (create), `/{id}/{start,submit}` |
| Grading | `GET /api/assignments/submissions`, `POST /api/assignments/submissions/{id}/grade` |
| Exams | `GET /api/exams/{id}/paper` (no answer key), `/{id}/my-attempt`, `/attempts/{id}`, `/attempts/{id}/result`; `POST /api/exams/{id}/start`, `/attempts/{id}/answer`, `/attempts/{id}/tab-switch`, `/submit` |
| ALSE | `GET /api/alse/{learning-state,digital-twin,interventions,simulator}`, `POST /api/alse/interventions/{id}/{approve,reject}` |
| Classroom | `GET /api/classroom/{live,report}`, `GET/POST /api/classroom/{id}/chat`, `POST /api/classroom/{id}/focus-event`, `GET /api/classroom/{id}/my-standing`, `GET /api/classroom/{id}/standings` and `POST /api/classroom/{id}/readmit/{studentId}` (host teacher only) |
| Campus | `GET /api/events`, `/notifications`, `/credits/my`, `/exams/my-exams` |
| Monitoring | `POST /api/monitoring/attention` (attributed to the authenticated caller, never to a `studentId` in the body); `GET /api/monitoring/alerts/all`, `/alerts/{sessionId}`, `/logs/{sessionId}` — all staff only |
| AI | `POST /api/ai/copilot/ask`, `GET /api/ai/predict-risk/{id}`, `/exam-integrity/{id}` |
| Resume | `POST /api/resume/analyze`, `GET /api/resume/latest` |

Unauthenticated requests get `401`; authenticated-but-wrong-role gets `403`.

### Realtime (STOMP over SockJS at `/ws`)

| Topic | Carries |
|---|---|
| `/topic/alerts/all` | every proctoring alert, platform-wide |
| `/topic/alerts/{context}/{sessionId}` | alerts scoped to one session |
| `/topic/monitoring/{context}/{sessionId}` | attention updates |
| `/topic/chat/{sessionId}` | classroom chat |
| `/topic/notifications/{userId}` | that user's notifications |
| `/topic/classroom/{sessionId}` | WebRTC signalling |

---

## Tests

```bash
cd lms-backend  && mvn test          # 151 tests
cd lms-frontend && npm test          #  56 tests
cd lms-frontend && npm run test:e2e  # needs both servers running
```

**Backend — 124 unit + 27 integration.** The unit tests mock every repository and
build their own fixtures (`src/test/java/com/lms/TestFixtures.java`), so they
never depend on the demonstration seed. They cover the arithmetic that every
dashboard rests on:

| Suite | What it pins down |
|---|---|
| `AnalyticsServiceTest` | engagement weight renormalisation when components have no data, the 15-point alert-penalty cap, GPA mapping, risk-band boundaries at 60/75/85, every letter-grade boundary, course-progress blending |
| `ExamServiceTest` | that the paper DTO cannot carry an answer key, attempt ownership on every operation, resume-not-restart, one sitting per candidate, server-side tab-switch termination, MCQ and written marking, submission idempotency |
| `AlseServiceTest` | all ten classification branches, transition-only recording, the watermark, the seven-factor explainable score, the intervention cooldown, live outcome measurement |
| `AcademicServiceGradingTest` | grading scoped to the course owner, mark bounds, notification on grade, assignment-creation validation |
| `ResumeServiceTest` | that a strong resume outscores a weak one, and that scoring is deterministic |

`SecurityBoundaryTest` runs the real filter chain with real tokens against an
in-memory database (seeding is disabled by `lms.seed.enabled=false` in
`application-test.properties`). It asserts 401 for anonymous, 403 for the wrong
role, and — the ones that matter most — that a student cannot read a peer's
record by passing `?studentId=`, and a guardian cannot reach past their own
child.

**Frontend — 56 tests** (Vitest + Testing Library): the `useApi` contract every
page depends on, `CoursesPage` in all four states (loading, populated, empty,
error-with-retry), and 39 tests over the proctoring maths in `faceScoring.js` —
eye aspect ratio, Euler extraction from the transformation matrix, the
eye-status decision order, attention penalties and their caps, and the smoothing
window. Those are pure functions precisely so they can be tested without a
browser, a camera or a WebGL context.

The E2E script drives a real browser through all four role logins using a
browser already installed on the machine — no browser download.

### Not covered

Controllers are exercised only through `SecurityBoundaryTest`; there are no
per-endpoint response-shape tests. `ClassroomInsightService`, `DashboardService`
and the WebSocket paths have no unit tests. On the frontend only `CoursesPage`
has component tests — the other pages are covered only by the E2E smoke run.
`ProctoringCamera` has no component test: its behaviour is camera and WebGL
bound, so it is covered by the manual browser run described under *Not built*
rather than by an assertion.

## Configuration

Everything has a working default; override via environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` | file-backed H2 in `./data` | Point at MySQL to move off H2 |
| `APP_JWT_SECRET` | dev literal in `application.properties` | **Set this before deploying anywhere real** |
| `APP_JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `APP_CORS_ORIGINS` | `localhost:5173,4173` | Allowed browser origins |
| `lms.seed.enabled` | `true` | Set false to skip the demonstration seed entirely |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | Frontend API base |
| `VITE_WS_URL` | `http://localhost:8080/ws` | Frontend WebSocket base |

---

## Not built

These routes render an honest "not built yet" placeholder rather than fake
content: `/attendance` (the register view — the underlying attendance data is
real and drives the dashboards), `/profile`, `/settings`, `/admin/users`.

See the Tests section above for what is and is not covered by the suite.

**Camera proctoring is verified only for the negative case.** The pipeline was
driven end to end against Chromium's synthetic capture device, which emits a
pattern containing no face: the model loads, inference runs, `NO_FACE` readings
post, and the backend raises `HIGH NO_FACE` alerts onto the invigilator feed.
Positive detection — a real face producing landmarks, head pose and an attention
score — has not been machine-verified here, because a headless browser has no
face to look at. Open the class test on a machine with a webcam to confirm it.

The overlay drawing, the WebRTC peer connection in the live classroom (the
signalling backend exists; the media path does not), and snapshot capture on
violation are also unverified.