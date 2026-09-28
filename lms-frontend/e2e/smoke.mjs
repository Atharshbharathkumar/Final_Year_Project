/**
 * End-to-end smoke test.
 *
 * Signs in as each of the four seeded roles and asserts their dashboard renders
 * real values from the backend, then reports any console error or failed
 * request seen along the way. Exits non-zero on the first hard failure so it can
 * gate a build.
 *
 *   Prerequisites: backend on :8080 and frontend on :5173, seeded database.
 *   Run with: npm run test:e2e
 *
 * Uses playwright-core against a browser already installed on the machine, so
 * there is no multi-hundred-megabyte browser download.
 */
import { chromium } from 'playwright-core';

const APP = process.env.E2E_APP_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:8080';
const PASSWORD = 'password';

const ROLES = [
  {
    role: 'student',
    email: 'student@edu.in',
    path: '/student/dashboard',
    // Labels that only appear once real data has arrived.
    expect: ['Overall GPA', 'Attendance', 'Engagement Score', 'Academic Credits'],
  },
  {
    role: 'teacher',
    email: 'teacher@edu.in',
    path: '/teacher/dashboard',
    expect: ['Total Students', 'Avg Engagement', 'Student Roster'],
  },
  {
    role: 'parent',
    email: 'parent@edu.in',
    path: '/parent/dashboard',
    expect: ['Parent Dashboard', 'Attendance', 'Academic Overview'],
  },
  {
    role: 'admin',
    email: 'admin@edu.in',
    path: '/admin/dashboard',
    expect: ['Admin Dashboard', 'Total Students', 'Department Performance'],
  },
];

const failures = [];
const notes = [];

const ok = (msg) => console.log(`  [32m✓[0m ${msg}`);
const bad = (msg) => { failures.push(msg); console.log(`  [31m✗[0m ${msg}`); };

async function assertServersUp() {
  for (const [name, url] of [['frontend', APP], ['backend', `${API}/api/public/stats`]]) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.error(`\nThe ${name} is not reachable at ${url} (${err.message}).`);
      console.error('Start both servers first:');
      console.error('  cd lms-backend  && mvn spring-boot:run');
      console.error('  cd lms-frontend && npm run dev\n');
      process.exit(2);
    }
  }
}

async function launch() {
  // Prefer whichever Chromium-based browser this machine already has.
  for (const channel of ['msedge', 'chrome', 'chromium']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      // try the next one
    }
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    console.error('\nNo Chromium-based browser found. Install Edge or Chrome, or run:');
    console.error('  npx playwright install chromium\n');
    process.exit(2);
  }
}

await assertServersUp();

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => failures.push(`uncaught exception on ${page.url()}: ${String(e).slice(0, 200)}`));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

try {
  for (const { role, email, path, expect } of ROLES) {
    console.log(`\n${role} (${email})`);

    await context.clearCookies();
    await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL(new RegExp(path.replace(/\//g, '\\/')), { timeout: 20000 });
      ok(`signed in and landed on ${path}`);
    } catch {
      bad(`${role} did not reach ${path} after signing in`);
      continue;
    }

    await page.waitForTimeout(2500);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

    for (const label of expect) {
      if (text.includes(label)) ok(`renders "${label}"`);
      else bad(`${role} dashboard is missing "${label}"`);
    }

    if (/Unable to load this view|Could not reach the server/i.test(text)) {
      bad(`${role} dashboard rendered an error state`);
    }
    if (text.length < 400) {
      bad(`${role} dashboard rendered almost nothing (${text.length} chars)`);
    }

    // A dashboard full of zeroes usually means the API answered but with nothing.
    const numbers = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m => Number(m[1]));
    if (numbers.filter(n => n > 0).length < 3) {
      bad(`${role} dashboard shows no non-zero figures — is the database seeded?`);
    } else {
      ok('shows non-zero figures from the database');
    }
  }

  // The candidate's exam paper must never carry the answer key.
  console.log('\nexam paper');
  const token = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edu.in', password: PASSWORD }),
  })).json().then(j => j.accessToken);

  const exams = await (await fetch(`${API}/api/exams/my-exams`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  if (Array.isArray(exams) && exams.length > 0) {
    const paperResponse = await fetch(`${API}/api/exams/1/paper`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await paperResponse.text();
    if (body.includes('correctAnswer')) bad('the exam paper leaked the answer key to the candidate');
    else ok('the exam paper carries no answer key');
  } else {
    notes.push('no exams available to check the paper endpoint');
  }
} catch (err) {
  bad(`driver failure: ${err.message}`);
} finally {
  await browser.close();
}

console.log('\n─────────────────────────────────────────────');
if (consoleErrors.length) {
  console.log(`console errors (${consoleErrors.length}):`);
  consoleErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  failures.push(`${consoleErrors.length} console error(s)`);
}
const uniqueFailedRequests = [...new Set(failedRequests)];
if (uniqueFailedRequests.length) {
  console.log(`failed requests (${uniqueFailedRequests.length}):`);
  uniqueFailedRequests.slice(0, 10).forEach(r => console.log(`  ${r}`));
  failures.push(`${uniqueFailedRequests.length} failed request(s)`);
}
notes.forEach(n => console.log(`note: ${n}`));

if (failures.length) {
  console.log(`\n[31mFAILED[0m — ${failures.length} problem(s):`);
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}

console.log('\n[32mPASSED[0m — all four roles signed in and rendered live data.');