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


function extractRequirements(a, description) {
  const lower = String(description || "").toLowerCase();
  const name = String(a.name || "").toLowerCase();
  const types = a.submission_types || [];

  const req = {
    wordCount: null,
    replies: null,
    upload: types.includes("online_upload"),
    textEntry: types.includes("online_text_entry"),
    onPaper: types.includes("on_paper"),
    reading: name.includes("reading") || lower.includes("read chapter") || lower.includes("read the "),
    quiz: name.includes("quiz"),
    exam: name.includes("exam") || name.includes("midterm") || name.includes("final"),
    discussion: name.includes("discussion") || lower.includes("discussion"),
  };

  const wordRange = description.match(/(\d{2,4})\s*[-–]\s*(\d{2,4})\s*words?/i);
  const wordSingle = description.match(/(?:at least|minimum of|minimum)?\s*(\d{2,4})\s*words?/i);

  if (wordRange) {
    req.wordCount = `${wordRange[1]}–${wordRange[2]} words`;
  } else if (wordSingle) {
    req.wordCount = `${wordSingle[1]} words`;
  }

  const replyNumeric = description.match(/(?:reply|respond)\s+(?:to\s+)?(\d+)\s+(?:classmates?|peers?|students?|posts?)/i);
  const replyWord = description.match(/(?:reply|respond)\s+(?:to\s+)?(two|three|four|five)\s+(?:classmates?|peers?|students?|posts?)/i);

  if (replyNumeric) req.replies = replyNumeric[1];
  if (replyWord) {
    const map = { two: 2, three: 3, four: 4, five: 5 };
    req.replies = map[replyWord[1].toLowerCase()] || null;
  }

  return req;
}

function estimateMinutes(a, description, req) {
  const name = String(a.name || "").toLowerCase();

  if (req.exam) return 90;
  if (req.quiz) return 30;
  if (name.includes("essay") || name.includes("paper")) return 120;
  if (req.discussion) return req.replies ? 45 + (req.replies * 10) : 45;
  if (name.includes("response")) return 45;
  if (req.reading) return 40;
  if (name.includes("lab")) return 75;
  if (req.onPaper) return 60;

  if (req.wordCount) {
    const nums = req.wordCount.match(/\d+/g)?.map(Number) || [];
    const words = nums.length ? Math.max(...nums) : 0;
    if (words >= 1500) return 150;
    if (words >= 1000) return 120;
    if (words >= 750) return 90;
    if (words >= 500) return 60;
    if (words >= 250) return 40;
  }

  return 45;
}

function makeSummary(a, req) {
  const name = String(a.name || "").toLowerCase();

  if (req.exam) return "Study the required material and complete the exam.";
  if (req.quiz) return "Review the assigned material and complete the quiz.";
  if (req.reading && !req.textEntry && !req.upload) return "Complete the assigned reading.";
  if (req.onPaper) return "Complete this assignment in person / on paper.";
  if (req.discussion && req.wordCount && req.replies) return `Write ${req.wordCount} and reply to ${req.replies} classmates.`;
  if (req.discussion && req.replies) return `Write the discussion response and reply to ${req.replies} classmates.`;
  if (req.wordCount && req.upload) return `Write ${req.wordCount}, prepare the file, and upload it.`;
  if (req.wordCount) return `Write ${req.wordCount} and submit it.`;
  if (req.upload) return "Complete the assignment and upload the required file.";
  if (req.textEntry) return "Write the required response and submit it in Canvas.";
  if (name.includes("essay") || name.includes("paper")) return "Write the paper, review it, and submit it.";
  if (name.includes("response")) return "Write the response and submit it.";
  return "Open the assignment, complete the required work, and submit it.";
}

function makeSteps(a, description, req) {
  const steps = [];

  if (req.reading) steps.push("Complete the assigned reading.");

  if (req.quiz) {
    steps.push("Review the required material.");
    steps.push("Take the quiz.");
  } else if (req.exam) {
    steps.push("Review the exam material.");
    steps.push("Complete the exam.");
  } else if (req.wordCount) {
    steps.push(`Write ${req.wordCount}.`);
  } else if (
    req.textEntry ||
    req.discussion ||
    String(a.name || "").toLowerCase().includes("response")
  ) {
    steps.push("Write the required response.");
  }

  if (req.replies) steps.push(`Reply to ${req.replies} classmates.`);
  if (req.upload) steps.push("Upload the required file.");
  if (req.onPaper) steps.push("Complete it in person / on paper.");

  if (
    !req.onPaper &&
    !req.quiz &&
    !req.exam &&
    !req.upload &&
    (req.textEntry || req.wordCount || req.discussion)
  ) {
    steps.push("Submit it in Canvas.");
  }

  if (steps.length === 0) {
    steps.push("Open the assignment.");
    steps.push("Complete the required work.");
    if (!req.onPaper) steps.push("Submit it in Canvas.");
  }

  return [...new Set(steps)].slice(0, 5);
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
  const requirements = extractRequirements(a, description);
  const estimatedMinutes = estimateMinutes(a, description, requirements);

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
    summary: makeSummary(a, requirements),
    requirements,
    steps: makeSteps(a, description, requirements),
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
