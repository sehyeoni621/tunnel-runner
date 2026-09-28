// 꿀잠 러너 서비스 워커 — 설치형(PWA)으로 돌 때 오프라인 실행을 담당한다.
//
// 전략
//  - 문서(내비게이션): 네트워크 우선 → 실패하면 캐시된 index.html (새 빌드를 바로 받되, 오프라인이면 실행)
//  - 그 외 동일 출처 GET: 캐시 우선 → 없으면 받아서 캐싱 (JS/CSS는 파일명에 해시가 붙어 갱신이 안전)
// 캐시 이름을 바꾸면 이전 캐시는 activate에서 정리된다.

const CACHE = 'kkuljam-v1';
const SHELL = ['./', './index.html', './site.webmanifest', './icon.svg', './manifest.json'];

self.addEventListener('install', (e) => {
  // 아이콘·매니페스트처럼 이름이 고정된 것만 미리 담는다 (하나 실패해도 설치는 진행)
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 폰트 등 외부 자원은 브라우저에 맡긴다

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // 정상 응답만 캐싱 (opaque·에러 응답은 그대로 흘려보낸다)
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
