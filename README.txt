NEXUS v6 — MOBILE / PWA

PRIORITY 5 BUILD

NEW
---
MOBILE
- mobile-first stacking
- larger tap targets
- fixed bottom command navigation
- compact mobile status strip
- Media Dock collapsed by default on phones

PWA
- improved standalone manifest
- install prompt button when supported
- upgraded service-worker cache
- offline shell support

OFFLINE
- latest successful Canvas dashboard is cached locally
- NEXUS can show last-known mission data if Canvas cannot be reached

DEADLINE ALERTS
- tap ALERTS and allow browser notifications
- local checks at:
  24 hours
  6 hours
  1 hour
  before an assignment deadline
- reminder state is stored locally to prevent duplicate spam

IMPORTANT LIMITATION
--------------------
This version does NOT yet provide true server-originated push notifications
while the app/device is fully closed for long periods.

For that, NEXUS will eventually need:
- a small backend database
- Web Push subscriptions
- scheduled server checks / cron
- Canvas polling on the server

That infrastructure belongs in a later backend pass and should not be faked
with unreliable browser-only behavior.

DEPLOY
------
Replace your repo files with these files, commit, and let Vercel redeploy.

Keep Vercel environment variables:
CANVAS_URL
CANVAS_TOKEN
YOUTUBE_API_KEY

NEXT ROADMAP ITEM
-----------------
Priority 6 — Media Dock.
