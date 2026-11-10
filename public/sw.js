// Minimal service worker so Android offers "Install app".
// It caches nothing: customer data and passwords never stay on the device, and every
// update to the site shows up straight away. With no connection, pages show a short
// "You're offline" message instead of the browser's error page.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#020617;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;padding:12px 22px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font:inherit;font-weight:600}</style>
</head><body><div><h1 style="font-size:22px;margin:0 0 8px">You're offline</h1>
<p style="margin:0;color:#94a3b8">Connect to the internet or the office network, then try again.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else: normal browser behaviour
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
