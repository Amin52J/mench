### Phase 5.1 — PWA shell ✅ `[composer]`

**Gate:** Lighthouse installable PWA; app opens standalone on mobile emulator.

**Goal:** Installable mobile experience per `decisions.mdc` O10.

- [x] Web app manifest (name Mench, icons, theme_color, display standalone) — `vite-plugin-pwa` manifest; `pnpm build` emits `dist/manifest.webmanifest`
- [x] Service worker caches app shell; network-first for API/WebSocket — Workbox precache + `NetworkFirst` for `/api/*`; WebSockets bypass SW (browser direct)
- [x] Offline page when online play unavailable — `public/offline.html` + `OfflinePage` / home hints when `navigator.onLine` is false
- [x] Viewport + safe-area CSS; touch-action on board — `viewport-fit=cover`, safe-area on `.shell`, `touch-action: manipulation` on `.boardWrap`

**Notes:** Placeholder icons OK; replace before public launch.

### Notes (implementation)

- Added `vite-plugin-pwa` + `workbox-window` (O10). Placeholder PNGs in `public/`.
- `registerSW` in `main.tsx`; `pnpm check:pwa` validates manifest, SW, offline page (run against `pnpm preview`).
- **Gate (2026-05-31):** Lighthouse **11.7.1** PWA category score **1.0** on `http://127.0.0.1:4173/` with `--form-factor=mobile` — `installable-manifest`, `maskable-icon`, `splash-screen`, `themed-omnibox` all PASS. `pnpm check:pwa` exit 0.
