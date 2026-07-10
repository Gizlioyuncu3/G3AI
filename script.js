const CACHE_NAME = 'g3-ai-v1';

// Sadece kendi sunucumuzdaki zorunlu ve statik dosyaları ilk kurulumda önbelleğe alıyoruz
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Install - İlk Kurulum
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Önbellek açılıyor');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate - Eski önbellekleri temizle
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eski önbellek siliniyor:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Dinamik Önbellekleme (CDN ve Yazı Tipleri Dahil)
self.addEventListener('fetch', event => {
    // API veya dış yapay zeka isteklerini kesinlikle önbelleğe alma, doğrudan ağa gönder
    if (event.request.url.includes('api.groq.com') || event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Önbellekte varsa hemen onu döndür
                if (response) {
                    return response;
                }

                // Önbellekte yoksa internetten çek
                return fetch(event.request).then(networkResponse => {
                    // Geçersiz veya hatalı yanıtları önbelleğe alma
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }

                    // Dinamik olarak gelen CSS, JS ve CDN dosyalarını arka planda önbelleğe ekle
                    // (response.type kontrolü esnetildi, böylece CDN kaynakları da kaydedilebilir)
                    if (event.request.url.startsWith(self.location.origin) || 
                        event.request.url.includes('cdnjs.cloudflare.com') || 
                        event.request.url.includes('fonts.googleapis.com') || 
                        event.request.url.includes('cdn.jsdelivr.net')) {
                        
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }

                    return networkResponse;
                }).catch(() => {
                    // İnternet tamamen yoksa (çevrimdışıysa) ana sayfayı göster
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});
