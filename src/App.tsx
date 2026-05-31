import {
  BoardView,
  Dice,
  devFixtureOptions,
  formatMoveLabel,
  useAnimationPlayground,
  useDevBoardFixture,
} from '@/features/board';
import { GameSetupView, LocalGameView, useLocalGame } from '@/features/session';
import { pieceKey } from '@game/types';
import { Button, Panel } from '@/shared/ui';
import styles from './App.module.css';

function isPlaygroundMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location.search).get('play') === '1';
}

function isFixtureMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('fixture');
}

export default function App() {
  const session = useLocalGame();
  const playground = useAnimationPlayground();
  const fixture = useDevBoardFixture();
  const play = isPlaygroundMode();
  const fixtureOnly = isFixtureMode() && !play;

  if (play) {
    return (
      <main className={styles.shell}>
        <DevPlaygroundView playground={playground} />
      </main>
    );
  }

  if (fixtureOnly) {
    return (
      <main className={styles.shell}>
        <AppHeader />
        <FixtureBoardView fixture={fixture} />
        <DevTools fixture={fixture} play={false} />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <AppHeader />
      {session.screen === 'setup' ? (
        <GameSetupView
          setup={session.setup}
          onPlayerCount={session.setPlayerCount}
          onSeatKind={session.setSeatKind}
          onApplyPreset={session.applySetup}
          onStart={session.startGame}
        />
      ) : (
        <LocalGameView session={session} />
      )}
      {import.meta.env.DEV ? <DevTools fixture={fixture} play={false} /> : null}
    </main>
  );
}

function AppHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Mench</h1>
      <p className={styles.subtitle}>منچ — standard Ludo</p>
    </header>
  );
}

function FixtureBoardView({
  fixture,
}: {
  readonly fixture: ReturnType<typeof useDevBoardFixture>;
}) {
  return (
    <Panel className={styles.boardPanel}>
      <p className={styles.turnHint}>
        Fixture: <strong>{fixture.fixtureId}</strong>
      </p>
      <BoardView board={fixture.board} activeColor={fixture.activeColor} />
    </Panel>
  );
}

function DevPlaygroundView({
  playground,
}: {
  readonly playground: ReturnType<typeof useAnimationPlayground>;
}) {
  return (
    <>
      <AppHeader />
      <Panel className={styles.boardPanel}>
        <div className={styles.playRow}>
          <p className={styles.turnHint} data-pulse="true">
            Active seat: <strong data-color={playground.activeColor}>{playground.activeColor}</strong>
          </p>
          <Dice
            value={playground.game.dice}
            canRoll={playground.canRoll}
            onRoll={playground.roll}
          />
        </div>
        <BoardView board={playground.game.board} activeColor={playground.activeColor} />
        {playground.legalMoves.length > 0 ? (
          <div className={styles.moveActions} aria-label="Legal moves">
            {playground.legalMoves.map((move) => (
              <Button
                key={pieceKey(move.piece)}
                variant="ghost"
                onClick={() => playground.move(move.piece)}
              >
                {formatMoveLabel(move)}
              </Button>
            ))}
          </div>
        ) : null}
      </Panel>
      <p className={styles.devLabel}>Animation playground (`?play=1`)</p>
    </>
  );
}

function DevTools({
  fixture,
  play,
}: {
  readonly fixture: ReturnType<typeof useDevBoardFixture>;
  readonly play: boolean;
}) {
  const { fixtureId, isDev } = fixture;
  if (!isDev) return null;

  return (
    <Panel className={styles.devPanel} aria-label="Development fixtures">
      <p className={styles.devLabel}>
        Dev: <code>?play=1</code> animation playground · <code>?fixture=…</code> static board
      </p>
      <div className={styles.devActions}>
        {devFixtureOptions().map((id) => (
          <Button
            key={id}
            variant={id === fixtureId && !play ? 'primary' : 'ghost'}
            onClick={() => {
              const url = new URL(globalThis.location.href);
              url.searchParams.delete('play');
              url.searchParams.set('fixture', id);
              globalThis.location.assign(url);
            }}
          >
            {id}
          </Button>
        ))}
        <Button
          variant={play ? 'primary' : 'ghost'}
          onClick={() => {
            const url = new URL(globalThis.location.href);
            url.searchParams.set('play', '1');
            url.searchParams.delete('fixture');
            globalThis.location.assign(url);
          }}
        >
          play
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const url = new URL(globalThis.location.href);
            url.searchParams.delete('play');
            url.searchParams.delete('fixture');
            globalThis.location.assign(url);
          }}
        >
          app
        </Button>
      </div>
    </Panel>
  );
}
