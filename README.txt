NEXUS v2 — Deploy Instructions

1. Unzip this package.
2. Replace/add these files in the ROOT of your GitHub repo:
   index.html
   manifest.json
   sw.js
   icon-192.png
   icon-512.png
   ROADMAP.md
   api/canvas.js

3. Commit to GitHub.
4. Let Vercel redeploy automatically.
5. Keep these Vercel Environment Variables:
   CANVAS_URL
   CANVAS_TOKEN

6. Test backend:
   https://YOUR-VERCEL-DOMAIN.vercel.app/api/canvas

7. Open the Vercel root URL.

Important:
- Use the Vercel URL as the real NEXUS app.
- GitHub is the code repository.
- Do not commit CANVAS_TOKEN anywhere.
- The Media Dock accepts normal YouTube video URLs.
- YouTube Music itself does not provide the same simple embeddable player surface, so this build embeds YouTube video URLs and can deep-link to YouTube Music later.
