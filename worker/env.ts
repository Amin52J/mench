/** Wrangler bindings (see `wrangler.toml`). */
export interface Env {
  readonly GAME_ROOM: DurableObjectNamespace;
  /** Static SPA (`dist/`) — present when deployed with `[assets]`; omitted in API-only local `wrangler dev`. */
  readonly ASSETS?: Fetcher;
}
