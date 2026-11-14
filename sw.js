/* 請求書PDF取込ツール:オフライン用のキャッシュ
   保存するのはアプリ本体(画面・部品)だけ。PDFや読み取った内容はここを通らず、保存も送信もしない。 */
const CACHE = 'invoice-app-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const CDN = 'https://cdn.jsdelivr.net/'; // 画像PDFのOCR部品(初回だけ通信、以後は端末から)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // 端末にある版をすぐ表示し、裏で最新版を取得(次に開いたとき反映)
    const key = req.mode === 'navigate' ? './' : req;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req.mode === 'navigate' ? new Request('./', { cache: 'no-cache' }) : req)
        .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; });
      if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
      return fresh;
    })());
    return;
  }

  if (req.url.startsWith(CDN)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req.url);
      if (cached) return cached;
      const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    })());
  }
});
