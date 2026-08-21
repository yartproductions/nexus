const CACHE = "nexus-shell-v8-1";
const SHELL = ["/manifest.json","/icon-192.png","/icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("nexus-shell-")&&k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  const url=new URL(req.url);

  // Always prefer the network for page navigations so deployments update immediately.
  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put("/index.html",copy));
        return res;
      }).catch(()=>caches.match("/index.html"))
    );
    return;
  }

  // API must never be satisfied from an old cache.
  if(url.pathname.startsWith("/api/")){
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      if(req.method==="GET" && url.origin===location.origin){
        const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));
      }
      return res;
    }))
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=event.notification.data?.url||"/";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client){client.focus();return;}}
    if(clients.openWindow) return clients.openWindow(target);
  }));
});
