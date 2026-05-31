import {
  BoardView,
  Dice,
  devFixtureOptions,
  formatMoveLabel,
  useAnimationPlayground,
  useDevBoardFixture,
} from '@/features/board';
import { pieceKey } from '@game/types';
import { Button, Panel } from '@/shared/ui';
import styles from './App.module.css';

function isPlaygroundMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location.search).get('play') === '1';
}

export default function App() {
  const playground = useAnimationPlayground();
  const fixture = useDevBoardFixture();
  const play = isPlaygroundMode();

  const board = play ? playground.game.board : fixture.board;
  const activeColor = play ? playground.activeColor : fixture.activeColor;
  const { fixtureId, isDev } = fixture;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mench</h1>
        <p className={styles.subtitle}>منچ — standard Ludo</p>
      </header>

      <Panel className={styles.boardPanel}>
        <div className={styles.playRow}>
          <p className={styles.turnHint} data-pulse="true">
            Active seat: <strong data-color={activeColor}>{activeColor}</strong>
          </p>
          {play ? (
            <Dice
              value={playground.game.dice}
              canRoll={playground.canRoll}
              onRoll={playground.roll}
            />
          ) : null}
        </div>
        <BoardView board={board} activeColor={activeColor} />
        {play && playground.legalMoves.length > 0 ? (
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

      {isDev ? (
        <Panel className={styles.devPanel} aria-label="Development fixtures">
          <p className={styles.devLabel}>
            Dev: use <code>?play=1</code> to roll and move with animations. Fixtures:{' '}
            <code>?fixture=…</code>
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
          </div>
        </Panel>
      ) : null}
    </main>
  );
}
