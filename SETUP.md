# Smart LMS — running the project

Two applications: `lms-backend` (Spring Boot) and `lms-frontend` (React + Vite).

## Prerequisites

| Requirement | Notes |
|---|---|
| **JDK 17 or 21** | **Not JDK 26.** See the warning below. |
| Maven | Not currently on this machine's PATH. |
| Node.js + npm | Already present. |

### JDK version warning

This machine has **JDK 26** installed, and the backend **cannot compile with it**.
Lombok 1.18.30 (the version Spring Boot 3.2.3 pins) crashes on JDK 26 with
`NoSuchFieldException: com.sun.tools.javac.code.TypeTag :: UNKNOWN`.

Two ways to fix it, either is fine:

1. **Install JDK 21** and point `JAVA_HOME` at it. The `pom.xml` targets Java 17,
   so 17 or 21 both work. This is the safer option for a demo.
2. **Bump Lombok** in `pom.xml` to a release that supports JDK 26 (1.18.36+),
   by adding a `<lombok.version>` property. This needs network access to fetch
   the new jar.

A JDK 21 already exists on this machine, bundled with the VS Code Java extension:

```
%USERPROFILE%\.vscode\extensions\redhat.java-1.55.0-win32-x64\jre\21.0.11-win32-x86_64
```

Setting `JAVA_HOME` to that path is enough to build and run.

## 1. Face detection models — required

The vision features do not work until the model weights are present. `public/models/`
originally contained a single 85-byte placeholder and no weight files, which meant
face detection never ran.

```powershell
cd lms-frontend
powershell -ExecutionPolicy Bypass -File scripts\fetch-face-models.ps1
```

The script verifies file sizes afterwards. Each `*-shard1` file must be **over 100 KB** —
a small one means the download returned an error page rather than weights.

**How to confirm it worked:** start the app, open a classroom or exam, and look at the
badge on the camera panel.

| Badge | Meaning |
|---|---|
| `CNN face detection` (green) | Models loaded. Face count, head pose, EAR and expression are being measured and recorded. |
| `⚠ DEGRADED — no face model` (amber) | Models missing. **Nothing is measured or recorded.** No attention score, no head pose, no face count. |

The degraded state is deliberately loud. It is never silently substituted with
plausible-looking numbers.

## 2. Backend

```powershell
cd lms-backend
mvn spring-boot:run
```

Runs on `http://localhost:8080`. Uses an **in-memory H2 database** — all data is lost
on restart, and `DataInitializer` reseeds demo accounts each time.

Seeded accounts (all use password `password`):

| Email | Role | Notes |
|---|---|---|
| `teacher@lms.com` | TEACHER | Owns both courses |
| `student@lms.com` | STUDENT | John Doe — has marks, attendance, achievements |
| `student2@lms.com` | STUDENT | Emma Watson |
| `parent@lms.com` | PARENT | Mary Doe — linked to John **only** |
| `admin@lms.com` | ADMIN | |

The parent link is deliberately partial. Signing in as Mary and requesting Emma's
report returns **403** — holding the PARENT role grants nothing on its own, only a
`ParentLink` row does. That is worth demonstrating.

### Configuration

| Setting | Default | Override |
|---|---|---|
| JWT secret | committed dev value | `APP_JWT_SECRET` env var |
| Allowed CORS origins | `localhost:5173`, `localhost:3000` | `app.cors.allowed-origins` |

The committed JWT secret is a development default and should be treated as public.

## 3. Frontend

```powershell
cd lms-frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. Point it at a non-local backend with a `.env` file:

```
VITE_API_BASE=http://your-host:8080
```

## What is and is not implemented

Worth knowing before demonstrating it.

**Implemented and working:**
- JWT authentication with role-gated write endpoints
- Course catalog, enrollment, exam creation
- Exam attempts with MCQ auto-grading
- Tab-switch proctoring with auto-submit at the configured limit
- Camera attention sampling, recorded server-side every 2 seconds
- Proctoring snapshots on face-absence and multi-face events
- Rule-triggered alerts, debounced to one per type per student per minute
- Live teacher monitoring grid over STOMP
- Session analytics computed from recorded samples
- Keyword search over course and exam descriptions
- **Assignments** — teachers set work, students submit text plus an optional link,
  teachers grade with feedback. Re-submission is allowed until graded, then locked.
- **Attendance** — a manual register, plus a mode that derives the register from
  the attention samples recorded during a live session (see caveat below)
- **Achievements** — academic, sports, project and extracurricular records, awarded
  by staff only, with a points total per student
- **Parent role** — guardians see per-child summaries of attendance, achievements
  and assignment marks

- **Peer-to-peer video** in the classroom, using the native browser WebRTC API
  (see below)

Note: `simple-peer` was removed from `package.json` but is still listed in
`package-lock.json` and present in `node_modules`, because removing it cleanly needs
network access. Run `npm install` once you are online to prune it. Nothing imports it —
WebRTC uses the native browser API.

### Derived attendance — read before demonstrating

"Derive from session attention" marks a student PRESENT only if the server recorded
at least **30 measured attention samples** for them in that session — roughly a
minute of verified camera presence at one sample per two seconds.

It cannot distinguish *did not attend* from *attended with no working camera*. A
student whose camera was denied, or who ran in DEGRADED mode, is marked ABSENT.
The API returns that caveat in its response and the UI displays it. Manual marks are
never overwritten by the automatic pass, and overriding an inferred mark flips its
source to MANUAL.

Treat it as a first pass a teacher reviews, not an authoritative register.

**Not implemented — say so plainly if asked:**
- **Any model trained by us.** The only neural network in the system is
  face-api.js's pretrained CNN running in the browser. Engagement scoring and
  exam integrity scoring are explicit weighted rules over measured telemetry —
  no training, fully explainable from their inputs. This is defensible
  engineering; calling it machine learning is not.
- **File uploads on assignments.** Submissions are text plus an optional link.
  Accepting binaries needs a storage and scanning strategy this project lacks.
- **TURN server for WebRTC.** STUN only, so cross-NAT calls may fail.
- **An SFU.** Video is a full mesh, practical to roughly ten participants.
- **Persistent storage.** H2 is in-memory; a restart wipes everything.

## Peer-to-peer video

The classroom uses the browser's native `RTCPeerConnection` directly. Media travels
browser-to-browser; the server relays only SDP offers/answers and ICE candidates
through the existing STOMP topic and never sees the video.

**Topology:** full mesh — every participant holds one connection to every other.
That is O(n²) connections, fine for a classroom of roughly ten. Beyond that it needs
an SFU, which is not implemented.

**Join handshake** (`lms-frontend/src/services/webrtc.js`) is deliberately asymmetric
so two peers can never offer simultaneously and cause SDP glare:

1. The newcomer broadcasts `PEER_JOIN`, then only ever answers.
2. Each peer already in the room creates the offer toward the newcomer.
3. The newcomer answers; both sides trickle ICE candidates as they gather.

Candidates arriving before the remote description are buffered and applied once it
is set, rather than being dropped.

### Testing it

You need two participants. One browser window is not enough.

1. Start the backend and frontend.
2. Open `http://localhost:5173/classroom/1` and log in as `teacher@lms.com`.
3. In a **different browser** (or an incognito window, so the session differs),
   open the same URL and log in as `student@lms.com`.
4. Grant camera and microphone in both.

Each window should show the other as a tile, and the badge should read
`1 peer connected`. Tiles show the live connection state while negotiating.

### NAT limitation

Only public STUN servers are configured — no TURN. Two machines on the same network,
or on the same machine, will connect. Two machines behind different restrictive NATs
may fail to establish a route, and the tile will stay in `connecting` or go to
`failed`. Adding a TURN server is the fix; it needs credentials and is not free, so
it was left out.

If you demo across networks, test the exact setup beforehand.

## Test accounts and demo caveat

Because H2 is in-memory, a restart wipes every recorded attention sample. Run the
session you intend to demonstrate without restarting the backend part-way through,
or the analytics pages will correctly report that nothing was measured.
