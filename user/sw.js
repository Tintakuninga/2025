const CACHE_NAME = 'lpg-pwa-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  '../icon-192.png',
  '../icon-512.png'
];

// Install Service Worker dan simpan file ke Cache (Untuk Offline)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Hapus cache lama jika ada update versi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Baris ini penting agar halaman langsung dikendalikan oleh versi baru
      return self.clients.claim(); 
    })
  );
});

// Strategi: Buka dari Cache dulu (biar cepat/offline), lalu fallback ke Internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Mendengarkan perintah untuk mengaktifkan update baru
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});