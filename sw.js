
const CACHE = "nexus-shell-v6";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // API calls: network first; app itself keeps structured Canvas cache in localStorage.
  if(new URL(req.url).pathname.startsWith("/api/")){
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ok:false,offline:true}),{
          status:503,
          headers:{"Content-Type":"application/json"}
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(response => {
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
        return response;
      }).catch(()=>caches.match("/index.html"))
    )
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus" in client){
          client.focus();
          if(target && "navigate" in client) client.navigate(target);
          return;
        }
      }
      if(clients.openWindow) return clients.openWindow(target);
    })
  );
});
