NEXUS v8 — PERSONAL LIFE MODULES

Priority 7 is now built.

OPEN
----
Use the new LIFE button in the NEXUS navigation.

MODULES
-------
MONEY
- current balance
- upcoming bills
- protected savings
- savings target
- automatic safe-to-spend calculation

CAR
- fuel percentage
- odometer
- next maintenance/service
- notes

WORK
- next shift
- hours this week
- work notes

GYM / BODY
- sessions this week
- weekly target
- weight
- progress

FOOD
- meals today
- daily target
- food notes

PRAYER / ROUTINE
- completed today
- target
- routine notes

APPOINTMENTS / ERRANDS
- create items
- when
- type
- remove items

STORAGE
-------
All of these values persist locally in the browser using localStorage.

This means closing and reopening NEXUS does NOT erase them on the same browser/device.
Cross-device sync belongs in a later backend/cloud pass.

GESTURE CONTROL LATER
---------------------
Camera-based gesture control is feasible using browser camera access plus hand tracking.
That should be added later after the core roadmap is complete.

NEXT
----
Priority 8 — NEXUS Intelligence.


V8.1 CANVAS/PWA RECOVERY
------------------------
This build changes the service worker from cache-first navigation to NETWORK-FIRST navigation.
Old NEXUS shell caches are deleted automatically when the new worker activates.

IMPORTANT FOR THE FIRST DEPLOY AFTER A BROKEN CACHED BUILD:
1. Deploy these files to Vercel.
2. Open the live Vercel URL.
3. Hard refresh once (Cmd+Shift+R on Mac / Ctrl+Shift+R on Windows).
4. If installed as a home-screen PWA, close it completely and reopen after the hard refresh.

You should see "PERSONAL COMMAND OS // V8.1" at the top.
If you do not see V8.1, the browser is still showing the old cached page.
