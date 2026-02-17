const CACHE_NAME = 'deonysus-anchor-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './icon.png',
  // 缓存外部的大体积工具库 (CDN)
  'https://cdn.staticfile.org/react/18.2.0/umd/react.production.min.js',
  'https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdn.staticfile.org/babel-standalone/7.23.5/babel.min.js',
  'https://cdn.tailwindcss.com'
];

// 1. 安装阶段：强行缓存所有关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // console.log('Deonysus: 正在搬运家具...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 立即接管，不用等待下次加载
  self.skipWaiting();
});

// 2. 拦截请求：优先从缓存读取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 如果缓存里有，直接返回缓存（这就是秒开的秘密）
      if (response) {
        return response;
      }
      // 否则去网络请求
      return fetch(event.request);
    })
  );
});

// 3. 激活阶段：清理旧缓存（如果有版本更新）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            // console.log('Deonysus: 清理旧记忆...');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 让 Service Worker 立即控制所有页面
  return self.clients.claim();
});