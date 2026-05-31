import type { GameIntent } from '@game/rules';
/** Wire intents share the rules-engine union (phase 4.2 will dispatch them). */
export type RoomIntent = GameIntent;

export interface RoomStubState {
  readonly message: string;
  readonly joinCode: string;
  readonly roomId: string;
  readonly echoCount: number;
  readonly lastEcho?: unknown;
}

const DEFAULT_STATE: RoomStubState = {
  message: 'hello',
  joinCode: '',
  roomId: '',
  echoCount: 0,
};

/**
 * One Durable Object per room (`api-design.mdc`).
 * Phase 4.1: init + hello + echo JSON state — no WebSocket game sync yet.
 */
export class GameRoom implements DurableObject {
  private state: RoomStubState = DEFAULT_STATE;

  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith('/init') && request.method === 'POST') {
      const body = (await request.json()) as { joinCode: string; roomId: string };
      this.state = {
        message: 'hello',
        joinCode: body.joinCode,
        roomId: body.roomId,
        echoCount: 0,
      };
      await this.ctx.storage.put('state', this.state);
      return Response.json({ ok: true, state: this.state });
    }

    if (path.endsWith('/hello')) {
      return Response.json({
        message: this.state.message,
        roomId: this.state.roomId,
        joinCode: this.state.joinCode,
      });
    }

    if (path.endsWith('/state') && request.method === 'GET') {
      const stored = await this.ctx.storage.get<RoomStubState>('state');
      if (stored) {
        this.state = stored;
      }
      return Response.json({ state: this.state });
    }

    if (path.endsWith('/echo') && request.method === 'POST') {
      const payload: unknown = await request.json().catch(() => ({}));
      this.state = {
        ...this.state,
        echoCount: this.state.echoCount + 1,
        lastEcho: payload,
      };
      await this.ctx.storage.put('state', this.state);
      return Response.json({ state: this.state });
    }

    return new Response('Not found', { status: 404 });
  }
}
