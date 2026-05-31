/** Vite dev origins (API on :8787, UI on :5173). */
const DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  const requestUrl = new URL(request.url);
  let allowOrigin = 'http://localhost:5173';
  if (origin) {
    if (DEV_ORIGINS.has(origin)) {
      allowOrigin = origin;
    } else {
      try {
        if (new URL(origin).host === requestUrl.host) {
          allowOrigin = origin;
        }
      } catch {
        /* ignore malformed Origin */
      }
    }
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
