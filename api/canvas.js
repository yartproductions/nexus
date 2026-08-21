// NEXUS Canvas API bridge
// Vercel reads CANVAS_URL and CANVAS_TOKEN from Project Environment Variables.
// NEVER place the Canvas token in this file.

function cleanBaseUrl(url = "") {
  return url.trim().replace(/\/+$/, "");
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match && match[2] === "next") return match[1];
  }
  return null;
}

async function canvasFetchAll(url, token) {
  const items = [];
  let nextUrl = url;
  let pages = 0;

  while (nextUrl && pages < 20) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Canvas returned ${response.status}`);
      error.status = response.status;
      error.body = body.slice(0, 1000);
      throw error;
    }

    const data = await response.json();
    if (Array.isArray(data)) items.push(...data);
    else items.push(data);

    nextUrl = parseNextLink(response.headers.get("link"));
    pages += 1;
  }

  return items;
}

function getSubmissionState(assignment) {
  const s = assignment.submission || null;
  if (!s) return "not_submitted";

  if (s.workflow_state === "graded") return "graded";
  if (s.workflow_state === "submitted" || s.submitted_at) return "submitted";
  if (s.workflow_state === "pending_review") return "pending_review";
  return s.workflow_state || "not_submitted";
}

function isSubmitted(assignment) {
  const state = getSubmissionState(assignment);
  return ["submitted", "graded", "pending_review"].includes(state);
}

function priorityScore(assignment) {
  const now = Date.now();
  const dueMs = assignment.due_at ? new Date(assignment.due_at).getTime() : null;
  const submitted = isSubmitted(assignment);

  if (submitted) return -1000;

  let score = 0;

  if (dueMs) {
    const hours = (dueMs - now) / 36e5;

    if (hours < 0) score += 140;
    else if (hours <= 6) score += 120;
    else if (hours <= 12) score += 105;
    else if (hours <= 24) score += 90;
    else if (hours <= 48) score += 70;
    else if (hours <= 72) score += 55;
    else if (hours <= 168) score += 35;
    else score += 10;
  } else {
    score += 2;
  }

  const points = Number(assignment.points_possible || 0);
  score += Math.min(points / 4, 25);

  if (assignment.has_submitted_submissions === false) score += 2;
  if (assignment.locked_for_user) score -= 15;

  return Math.round(score * 10) / 10;
}

function normalizeAssignment(a, course) {
  const state = getSubmissionState(a);
  const submitted = isSubmitted(a);
  const due = a.due_at ? new Date(a.due_at) : null;
  const now = new Date();

  return {
    id: a.id,
    courseId: course.id,
    course: course.course_code || course.name || `Course ${course.id}`,
    courseName: course.name || course.course_code || `Course ${course.id}`,
    name: a.name || "Untitled Assignment",
    description: stripHtml(a.description || "").slice(0, 3000),
    dueAt: a.due_at || null,
    unlockAt: a.unlock_at || null,
    lockAt: a.lock_at || null,
    points: a.points_possible ?? null,
    url: a.html_url || null,
    submissionTypes: a.submission_types || [],
    submissionState: state,
    submitted,
    submittedAt: a.submission?.submitted_at || null,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    late: Boolean(a.submission?.late),
    missing: Boolean(a.submission?.missing),
    locked: Boolean(a.locked_for_user),
    overdue: Boolean(due && due < now && !submitted),
    priority: priorityScore(a),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const canvasUrl = cleanBaseUrl(process.env.CANVAS_URL);
  const token = process.env.CANVAS_TOKEN;

  if (!canvasUrl || !token) {
    return res.status(500).json({
      error: "Missing Canvas configuration",
      hint: "Add CANVAS_URL and CANVAS_TOKEN in Vercel Environment Variables.",
    });
  }

  try {
    // Canvas's /courses endpoint returns courses available to the current user.
    const courseUrl =
      `${canvasUrl}/api/v1/courses` +
      `?enrollment_state=active` +
      `&enrollment_type=student` +
      `&per_page=100`;

    const rawCourses = await canvasFetchAll(courseUrl, token);

    const courses = rawCourses
      .filter(c => c && c.id && !c.access_restricted_by_date)
      .map(c => ({
        id: c.id,
        name: c.name || c.course_code || `Course ${c.id}`,
        course_code: c.course_code || c.name || `Course ${c.id}`,
        url: `${canvasUrl}/courses/${c.id}`,
      }));

    const assignmentArrays = await Promise.all(
      courses.map(async course => {
        try {
          const url =
            `${canvasUrl}/api/v1/courses/${course.id}/assignments` +
            `?include[]=submission` +
            `&order_by=due_at` +
            `&per_page=100`;

          const raw = await canvasFetchAll(url, token);
          return raw.map(a => normalizeAssignment(a, course));
        } catch (err) {
          // Keep one restricted/broken course from killing the whole dashboard.
          return [];
        }
      })
    );

    const assignments = assignmentArrays
      .flat()
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return Number(a.submitted) - Number(b.submitted);
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (!a.dueAt && !b.dueAt) return a.name.localeCompare(b.name);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt) - new Date(b.dueAt);
      });

    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

    const active = assignments.filter(a => !a.submitted);
    const submitted = assignments.filter(a => a.submitted);
    const overdue = active.filter(a => a.overdue || a.missing);
    const dueSoon = active.filter(a => {
      if (!a.dueAt) return false;
      const t = new Date(a.dueAt).getTime();
      return t >= now && t <= sevenDays;
    });

    return res.status(200).json({
      ok: true,
      syncedAt: new Date().toISOString(),
      canvasUrl,
      stats: {
        courses: courses.length,
        assignments: assignments.length,
        active: active.length,
        submitted: submitted.length,
        overdue: overdue.length,
        dueThisWeek: dueSoon.length,
      },
      courses,
      assignments,
      active,
      overdue,
      dueSoon,
      next: active[0] || null,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Canvas sync failed",
      details: error.message,
      canvasResponse: error.body || undefined,
    });
  }
}
