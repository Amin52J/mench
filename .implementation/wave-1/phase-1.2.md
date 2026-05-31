### Phase 1.2 — Board model & move graph ✅ `[composer]`

**Gate:** `pnpm test` covers board indexing, starting squares, home paths, and distance helpers. Verified 2026-05-31 (`pnpm test` exit 0, 16 board tests).

**Goal:** Static board representation and piece positions without full turn rules.

- [x] Types: `PlayerColor`, `PieceId`, `BoardState`, `PiecePosition` (yard | track | home)
- [x] 52-space shared track + per-color home column indices (`src/game/board.ts`)
- [x] Safe square set; map track index → render order for UI later
- [x] Helpers: `advanceAlongTrack`, `isInHomeStretch`, `stepsToFinish`
- [x] Unit tests for edge indices and each color's entry offset

**Notes:** Zero React imports. Coordinate system documented in `board.ts` header. Types in `src/game/types.ts`; board constants/helpers in `src/game/board.ts`. Home entry after `afterTrack === 52` from start (gate at `along === 51`). `TRACK_RENDER_ORDER` is identity (clockwise track index = draw order). `createInitialBoardState` added for tests and phase 1.3.
