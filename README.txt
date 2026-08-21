NEXUS v7 FIXED — MEDIA DOCK

IMPORTANT
---------
This is the corrected v7 build.

The original v7 build accidentally replaced part of the main dashboard HTML
while inserting the Media Dock. That removed elements required by the Canvas
rendering code and left NEXUS stuck on CONNECTING.

This build starts from the last working v6 codebase and modifies ONLY the
existing Media Dock.

MEDIA DOCK ADDED
----------------
- artwork / thumbnails
- PREV / NEXT
- COMPACT / EXPAND
- remembers selected track
- YouTube Music deep-link

PRESERVED
---------
- Canvas assignments
- Daily Command
- Priority Objective
- Task Intelligence
- Schedule / Calendar
- Mobile / PWA
- Alerts
- existing Vercel APIs

DEPLOY
------
Replace the repo files with this corrected build and redeploy through Vercel.

Environment variables remain unchanged:
CANVAS_URL
CANVAS_TOKEN
YOUTUBE_API_KEY
