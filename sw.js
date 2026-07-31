/**
 * 宝宝照护工作台 - Service Worker
 * 实现离线缓存，添加到主屏幕后无需网络也能使用
 */

const CACHE_NAME = 'baby-care-v1';
const BASE_PATH = '/baby-care-workbench';

// 需要缓存的资源列表
const CACHE_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/css/style.css`,
  `${BASE_PATH}/js/app.js`,
  `${BASE_PATH}/assets/icon.png`,
];

// 安装时缓存所有核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch((err) => {
        // 单个文件失败不影响其他文件
        console.log('部分资源缓存失败:', err);
        return Promise.all(
          CACHE_URLS.map((url) =>
            cache.add(url).catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：优先使用缓存，缓存没有时才请求网络
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 有缓存就直接返回缓存
      if (cachedResponse) {
        // 后台静默更新缓存
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // 没有缓存，尝试从网络获取
      return fetch(event.request)
        .then((response) => {
          // 成功获取且是有效响应，存入缓存
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络也失败了，返回缓存的 index.html 作为兜底
          return caches.match(`${BASE_PATH}/index.html`);
        });
    })
  );
});
