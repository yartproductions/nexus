NEXUS v3 — DAILY COMMAND SYSTEM

This build keeps the working Canvas + YouTube playlist integrations and adds the
next roadmap item: Priority 2 — Daily Command System.

NEW
---
- Automatically selects up to 5 daily missions
- Prefers today, then this week, then highest-priority actionable tasks
- Shows total estimated workload
- Warns above 4 hours of planned work
- DONE / UNDO tracking
- DEFER button
- FOCUS button
- Automatically moves the next unfinished daily mission into the center objective
- Daily completion/defer state is stored locally and resets naturally by date

DEPLOY
------
Replace/add these in your GitHub repo root:
index.html
ROADMAP.md
api/canvas.js
api/youtube-playlist.js
manifest.json
sw.js
icon-192.png
icon-512.png

Keep your existing Vercel environment variables:
CANVAS_URL
CANVAS_TOKEN
YOUTUBE_API_KEY
