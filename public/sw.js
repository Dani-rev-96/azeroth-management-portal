/*
 * Kill-switch service worker.
 *
 * Earlier releases shipped a PWA service worker (@vite-pwa/nuxt) at /sw.js
 * whose navigation route could hijack /api/downloads/* links. The module was
 * removed; browsers that still have the old worker registered will fetch this
 * file on their next update check. It clears all caches and unregisters
 * itself; open tabs are deliberately NOT reloaded (that would kill uploads in
 * progress) — after unregistration, their next navigation goes straight to
 * the network.
 *
 * Safe to delete a few releases after the PWA removal, once old registrations
 * have had time to update.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
    await self.registration.unregister()
  })())
})
