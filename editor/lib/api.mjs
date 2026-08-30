import { MAX_IMAGE_BYTES, PostStoreError, createPostStore } from './posts.mjs';
import { createDocumentStore } from './documents.mjs';

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
  const documents = createDocumentStore(rootDir);

  async function validatePostSeries(payload, currentSlug) {
    const seriesId = String(payload?.metadata?.series || '').trim();
    if (!seriesId) return;
    const order = Number(payload.metadata.seriesOrder);
    const [series, posts] = await Promise.all([documents.listSeries(), store.listPosts()]);
    if (!series.some((item) => item.id === seriesId)) throw new PostStoreError(400, '존재하지 않는 시리즈입니다.');
    if (posts.some((post) => post.slug !== currentSlug && post.series === seriesId && post.seriesOrder === order)) {
      throw new PostStoreError(409, '같은 시리즈에서 이미 사용 중인 순서입니다.');
    }
  }

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
          if (request.method === 'GET' && url.pathname === '/api/resume') {
            return sendJson(response, 200, await documents.readResume());
          }
          if (request.method === 'PUT' && url.pathname === '/api/resume') {
            return sendJson(response, 200, await documents.updateResume(await readJson(request)));
          }
          if (request.method === 'GET' && url.pathname === '/api/series') {
            return sendJson(response, 200, { series: await documents.listSeries() });
          }
          if (request.method === 'POST' && url.pathname === '/api/series') {
            return sendJson(response, 201, await documents.createSeries(await readJson(request)));
          }
          if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'series') {
            if (request.method === 'PUT') return sendJson(response, 200, await documents.updateSeries(parts[2], await readJson(request)));
            if (request.method === 'DELETE') {
              await documents.deleteSeries(parts[2], await store.listPosts());
              return sendJson(response, 200, { ok: true });
            }
          }
          if (request.method === 'POST' && url.pathname === '/api/posts') {
            const payload = await readJson(request);
            await validatePostSeries(payload);
            return sendJson(response, 201, await store.createPost(payload));
          }
          if (request.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'posts') {
            return sendJson(response, 200, await store.readPost(parts[2]));
          }
          if (request.method === 'PUT' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'posts') {
            const payload = await readJson(request);
            await validatePostSeries(payload, parts[2]);
            return sendJson(response, 200, await store.updatePost(parts[2], payload));
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
