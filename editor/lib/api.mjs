import { MAX_IMAGE_BYTES, PostStoreError, createPostStore } from './posts.mjs';

const JSON_LIMIT = MAX_IMAGE_BYTES * 1.5 + 1024 * 1024;

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new PostStoreError(413, '요청 데이터가 너무 큽니다.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new PostStoreError(400, 'JSON 요청 형식이 올바르지 않습니다.');
  }
}

function localRequestOnly(request) {
  const host = String(request.headers.host || '').split(':')[0];
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function localEditorApi(rootDir) {
  const store = createPostStore(rootDir);

  return {
    name: 'local-blog-editor-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next();
        if (!localRequestOnly(request)) return sendJson(response, 403, { error: '로컬 요청만 허용됩니다.' });

        try {
          const url = new URL(request.url, 'http://localhost');
          const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

          if (request.method === 'GET' && url.pathname === '/api/posts') {
            return sendJson(response, 200, { posts: await store.listPosts() });
          }
          if (request.method === 'POST' && url.pathname === '/api/posts') {
            return sendJson(response, 201, await store.createPost(await readJson(request)));
          }
          if (request.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'posts') {
            return sendJson(response, 200, await store.readPost(parts[2]));
          }
          if (request.method === 'PUT' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'posts') {
            return sendJson(response, 200, await store.updatePost(parts[2], await readJson(request)));
          }
          if (
            request.method === 'POST' &&
            parts.length === 4 &&
            parts[0] === 'api' &&
            parts[1] === 'posts' &&
            parts[3] === 'assets'
          ) {
            return sendJson(response, 201, await store.saveImage(parts[2], await readJson(request)));
          }
          return sendJson(response, 404, { error: 'API 경로를 찾을 수 없습니다.' });
        } catch (error) {
          const status = error instanceof PostStoreError ? error.status : 500;
          if (status === 500) console.error(error);
          return sendJson(response, status, { error: status === 500 ? '파일 처리 중 오류가 발생했습니다.' : error.message });
        }
      });
    },
  };
}
