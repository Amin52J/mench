import { withCors, corsHeaders } from './cors.ts';
import type { Env } from './env.ts';
import { generateJoinCode } from './joinCode.ts';
import { GameRoom } from './room.ts';

export { GameRoom };

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return withCors(
    request,
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function buildWsUrl(request: Request, roomId: string): string {
  const url = new URL(request.url);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/api/rooms/${roomId}/ws`;
  url.search = '';
  return url.toString();
}

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const roomId = crypto.randomUUID();
  const joinCode = generateJoinCode(8);
  const id = env.GAME_ROOM.idFromName(roomId);
  const stub = env.GAME_ROOM.get(id);

  const initRes = await stub.fetch(
    new Request('http://game-room/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, joinCode }),
    }),
  );

  if (!initRes.ok) {
    return jsonResponse(request, { error: 'room_init_failed' }, 500);
  }

  return jsonResponse(
    request,
    {
      roomId,
      joinCode,
      wsUrl: buildWsUrl(request, roomId),
    },
    201,
  );
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);

  if (!url.pathname.startsWith('/api')) {
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return jsonResponse(request, { error: 'not_found' }, 404);
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return jsonResponse(request, { ok: true, service: 'mench' });
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms') {
    return handleCreateRoom(request, env);
  }

  const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
  if (wsMatch) {
    return handleWebSocket(request, env, wsMatch[1]!);
  }

  return jsonResponse(request, { error: 'not_found' }, 404);
}

function handleWebSocket(request: Request, env: Env, roomId: string): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return Promise.resolve(new Response('Expected websocket', { status: 426 }));
  }
  const id = env.GAME_ROOM.idFromName(roomId);
  const stub = env.GAME_ROOM.get(id);
  return stub.fetch(
    new Request(`http://game-room/ws`, {
      headers: request.headers,
      method: 'GET',
    }),
  );
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
