NEXUS REAL PLAYLIST FIX

WHAT CHANGED
------------
The previous version used a fake local playlist array. This version loads a real
YouTube playlist and renders its actual tracks.

FILES
-----
index.html
api/youtube-playlist.js

VERCEL ENVIRONMENT VARIABLE
---------------------------
Create:
YOUTUBE_API_KEY

This should be a YouTube Data API v3 key from Google Cloud.

Then redeploy Vercel.

HOW TO USE
----------
1. Open NEXUS.
2. Paste a normal YouTube playlist URL in Media Dock.
3. Click LOAD PLAYLIST.
4. NEXUS fetches real playlist titles + durations.
5. Click any track to play that exact video.

NOTE
----
Some YouTube videos disable embedding. Those individual tracks may still refuse
to play inside an iframe even though they appear in the playlist. That is a
YouTube/video-owner restriction, not a NEXUS bug.
