// NEXUS Canvas API bridge — v2
// Required Vercel Environment Variables:
//   CANVAS_URL
//   CANVAS_TOKEN
// NEVER commit the Canvas token to GitHub.

function cleanBaseUrl(url = "") {
  return url.trim().replace(/\/+$/, "");
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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
  if (!s) return "unsubmitted";
  if (s.workflow_state === "graded") return "graded";
  if (s.workflow_state === "submitted" || s.submitted_at) return "submitted";
  if (s.workflow_state === "pending_review") return "pending_review";
  return s.workflow_state || "unsubmitted";
}

function isSubmitted(assignment) {
  return ["submitted", "graded", "pending_review"].includes(getSubmissionState(assignment));
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function estimateMinutes(a, description) {
  const name = String(a.name || "").toLowerCase();
  const types = a.submission_types || [];

  if (name.includes("exam") || name.includes("midterm") || name.includes("final")) return 90;
  if (name.includes("quiz")) return 30;
  if (name.includes("essay") || name.includes("paper")) return 120;
  if (name.includes("discussion") || name.includes("response")) return 45;
  if (name.includes("reading") || name.includes("readings")) return 40;
  if (name.includes("lab")) return 75;
  if (types.includes("on_paper")) return 60;

  const wordMatch = description.match(/(\d{3,4})\s*[-–to]*\s*(\d{3,4})?\s*words?/i);
  if (wordMatch) {
    const words = Number(wordMatch[2] || wordMatch[1]);
    return Math.max(30, Math.round(words / 10));
  }

  return 45;
}

function makeSteps(a, description) {
  const steps = [];
  const lower = description.toLowerCase();
  const types = a.submission_types || [];
  const name = String(a.name || "").toLowerCase();

  if (name.includes("reading") || lower.includes("read chapter") || lower.includes("read the")) {
    steps.push("Complete the assigned reading or source material.");
  }

  const wordMatch = description.match(/(\d{3,4})(?:\s*[-–]\s*(\d{3,4}))?\s*words?/i);
  if (wordMatch) {
    const range = wordMatch[2] ? `${wordMatch[1]}–${wordMatch[2]} words` : `${wordMatch[1]} words`;
    steps.push(`Draft the required response (${range}).`);
  } else if (
    types.includes("online_text_entry") ||
    name.includes("essay") ||
    name.includes("response") ||
    name.includes("discussion")
  ) {
    steps.push("Draft the written response.");
  }

  const replyMatch = description.match(/(?:reply|respond)\s+(?:to\s+)?(\d+|two|three|four)\s+(?:classmates?|peers?|students?)/i);
  if (replyMatch) {
    steps.push(`Complete the required peer replies (${replyMatch[1]}).`);
  } else if (lower.includes("reply to") || lower.includes("respond to your classmates")) {
    steps.push("Complete the required peer replies.");
  }

  if (types.includes("online_upload")) {
    steps.push("Prepare and upload the required file.");
  }

  if (types.includes("on_paper")) {
    steps.push("Complete this assignment in person / on paper as instructed.");
  }

  if (name.includes("quiz")) {
    steps.push("Review the relevant material, then take the quiz.");
  }

  if (name.includes("exam") || name.includes("midterm") || name.includes("final")) {
    steps.push("Review the exam scope and prepare the required material.");
  }

  if (steps.length === 0) {
    steps.push("Open the assignment and review the full instructions.");
    steps.push("Complete the required work.");
  } else {
    steps.unshift("Open the Canvas assignment and confirm the requirements.");
  }

  if (!types.includes("on_paper") && !types.includes("not_graded")) {
    steps.push("Review your work and submit it through Canvas.");
  }

  return [...new Set(steps)].slice(0, 6);
}

function priorityScore(a, nowMs) {
  if (a.submitted) return -10000;
  if (a.locked && a.unlockAt && new Date(a.unlockAt).getTime() > nowMs) return -500;

  let score = 0;

  if (a.missing || a.overdue) score += 300;
  if (!a.locked) score += 45;

  if (a.dueAt) {
    const hours = (new Date(a.dueAt).getTime() - nowMs) / 36e5;

    if (hours < 0) score += 250;
    else if (hours <= 6) score += 220;
    else if (hours <= 12) score += 190;
    else if (hours <= 24) score += 160;
    else if (hours <= 48) score += 130;
    else if (hours <= 72) score += 105;
    else if (hours <= 168) score += 75;
    else if (hours <= 336) score += 35;
    else if (hours <= 720) score += 12;
  } else if (!a.locked) {
    score += 20;
  }

  // Points matter, but never enough to make a distant exam outrank an imminent assignment.
  const points = Number(a.points || 0);
  score += Math.min(points / 10, 12);

  // Small preference for shorter jobs when urgency is otherwise similar.
  score += Math.max(0, 15 - (a.estimatedMinutes / 15));

  return Math.round(score * 10) / 10;
}

function normalizeAssignment(a, course, nowMs) {
  const description = stripHtml(a.description || "");
  const state = getSubmissionState(a);
  const submitted = isSubmitted(a);
  const due = a.due_at ? new Date(a.due_at) : null;
  const unlock = a.unlock_at ? new Date(a.unlock_at) : null;
  const lockedByDate = Boolean(unlock && unlock.getTime() > nowMs);
  const locked = Boolean(a.locked_for_user || lockedByDate);
  const estimatedMinutes = estimateMinutes(a, description);

  const item = {
    id: a.id,
    courseId: course.id,
    course: course.course_code || course.name || `Course ${course.id}`,
    courseName: course.name || course.course_code || `Course ${course.id}`,
    name: a.name || "Untitled Assignment",
    description: description.slice(0, 5000),
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
    locked,
    overdue: Boolean(due && due.getTime() < nowMs && !submitted),
    estimatedMinutes,
    steps: makeSteps(a, description),
  };

  item.priority = priorityScore(item, nowMs);
  return item;
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
    const now = new Date();
    const nowMs = now.getTime();
    const sevenDays = nowMs + 7 * 86400000;
    const thirtyDays = nowMs + 30 * 86400000;

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
          return raw.map(a => normalizeAssignment(a, course, nowMs));
        } catch {
          return [];
        }
      })
    );

    const assignments = assignmentArrays.flat();

    const actionable = assignments
      .filter(a => !a.submitted && !a.locked)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (!a.dueAt && !b.dueAt) return a.name.localeCompare(b.name);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt) - new Date(b.dueAt);
      });

    const lockedFuture = assignments
      .filter(a => !a.submitted && a.locked)
      .sort((a, b) => {
        const au = a.unlockAt ? new Date(a.unlockAt).getTime() : Infinity;
        const bu = b.unlockAt ? new Date(b.unlockAt).getTime() : Infinity;
        return au - bu;
      });

    const today = actionable.filter(a => {
      if (!a.dueAt) return false;
      return sameLocalDay(new Date(a.dueAt), now);
    });

    const thisWeek = actionable.filter(a => {
      if (!a.dueAt) return false;
      const t = new Date(a.dueAt).getTime();
      return t > nowMs && t <= sevenDays && !sameLocalDay(new Date(a.dueAt), now);
    });

    const later = actionable.filter(a => {
      if (!a.dueAt) return true;
      const t = new Date(a.dueAt).getTime();
      return t > sevenDays;
    });

    const overdue = actionable.filter(a => a.overdue || a.missing);
    const dueSoon = actionable.filter(a => {
      if (!a.dueAt) return false;
      const t = new Date(a.dueAt).getTime();
      return t >= nowMs && t <= sevenDays;
    });

    const visibleLocked = lockedFuture.filter(a => {
      const unlock = a.unlockAt ? new Date(a.unlockAt).getTime() : Infinity;
      const due = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      return unlock <= thirtyDays || due <= thirtyDays;
    });

    return res.status(200).json({
      ok: true,
      syncedAt: new Date().toISOString(),
      canvasUrl,
      stats: {
        courses: courses.length,
        assignments: assignments.length,
        actionable: actionable.length,
        locked: lockedFuture.length,
        overdue: overdue.length,
        dueToday: today.length,
        dueThisWeek: thisWeek.length,
      },
      courses,
      assignments,
      actionable,
      today,
      thisWeek,
      later,
      overdue,
      dueSoon,
      lockedFuture: visibleLocked,
      next: actionable[0] || null,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Canvas sync failed",
      details: error.message,
      canvasResponse: error.body || undefined,
    });
  }
}
