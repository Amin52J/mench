import { BoardView, devFixtureOptions, useDevBoardFixture } from '@/features/board';
import { Button, Panel } from '@/shared/ui';
import styles from './App.module.css';

export default function App() {
  const { board, fixtureId, activeColor, isDev } = useDevBoardFixture();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mench</h1>
        <p className={styles.subtitle}>منچ — standard Ludo</p>
      </header>

      <Panel className={styles.boardPanel}>
        <p className={styles.turnHint}>
          Active seat: <strong data-color={activeColor}>{activeColor}</strong>
        </p>
        <BoardView board={board} activeColor={activeColor} />
      </Panel>

      {isDev ? (
        <Panel className={styles.devPanel} aria-label="Development fixtures">
          <p className={styles.devLabel}>Dev fixtures (append ?fixture=… to URL)</p>
          <div className={styles.devActions}>
            {devFixtureOptions().map((id) => (
              <Button
                key={id}
                variant={id === fixtureId ? 'primary' : 'ghost'}
                onClick={() => {
                  const url = new URL(globalThis.location.href);
                  url.searchParams.set('fixture', id);
                  globalThis.location.assign(url);
                }}
              >
                {id}
              </Button>
            ))}
          </div>
        </Panel>
      ) : null}
    </main>
  );
}
