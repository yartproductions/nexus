NEXUS // LIVE CANVAS BUILD

FILES
-----
index.html
api/canvas.js

WHAT THIS VERSION DOES
----------------------
- Reads active student courses from Canvas
- Reads assignments for every active course
- Includes the current student's submission status
- Sorts unfinished assignments by urgency / points
- Shows the highest-priority assignment in the center
- Populates the Mission Queue from live Canvas data
- Shows overdue / due-this-week items in Alerts
- Provides one-tap links to the real Canvas assignment
- Refreshes Canvas automatically every 5 minutes
- Does NOT expose the Canvas access token to the browser

DEPLOY
------
1. Unzip this package.
2. Replace your existing repository files with:
       index.html
       api/canvas.js
3. Commit/push to GitHub.
4. Vercel should redeploy automatically.
5. Confirm these Vercel Environment Variables exist:
       CANVAS_URL
       CANVAS_TOKEN
6. Open:
       https://YOUR-VERCEL-SITE.vercel.app/api/canvas
   You should see JSON containing:
       "ok": true
7. Then open the main site.

IMPORTANT
---------
Never put CANVAS_TOKEN in GitHub, index.html, screenshots, or messages.
The API route reads it privately from Vercel.

IF /api/canvas RETURNS ZERO COURSES
-----------------------------------
Check that CANVAS_URL is your exact Canvas base domain and that the token belongs
to the same account. Some schools restrict personal API tokens or API scopes.

The Break Down button is intentionally simple in this first version. It displays
a basic action sequence plus the original Canvas assignment description. AI task
decomposition can be added later without changing the Canvas connector.
