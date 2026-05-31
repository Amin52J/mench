import { useCallback, useMemo, useState } from 'react';
import {
  BoardView,
  Dice,
  formatMoveLabel,
  useAnimationPlayground,
  useDevBoardFixture,
} from '@/features/board';
import { HomeView, OfflinePage, OnlineJoinGate, OnlineRoomView } from '@/features/lobby';
import { buildOnlineCredentials, parseJoinLink } from '@/features/online';
import type { OnlineRoomCredentials } from '@/features/online';
import { GameSetupView, LocalGameView, useLocalGame } from '@/features/session';
import { pieceKey } from '@game/types';
import { useNetworkStatus } from '@/shared/hooks';
import { Button, Panel } from '@/shared/ui';
import styles from './App.module.css';

type AppScreen = 'home' | 'local' | 'online';

function isPlaygroundMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location.search).get('play') === '1';
}

function isFixtureMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('fixture');
}

export default function App() {
  const online = useNetworkStatus();
  const session = useLocalGame();
  const playground = useAnimationPlayground();
  const fixture = useDevBoardFixture();
  const play = isPlaygroundMode();
  const fixtureOnly = isFixtureMode() && !play;

  const linkJoin = useMemo(() => parseJoinLink(), []);
  const [screen, setScreen] = useState<AppScreen>(() =>
    linkJoin ? 'online' : 'home',
  );
  /** Invite links show {@link OnlineJoinGate} first; host/manual join set this immediately. */
  const [onlineCredentials, setOnlineCredentials] = useState<OnlineRoomCredentials | null>(
    null,
  );

  const handleHostRoom = useCallback(
    (room: { roomId: string; joinCode: string; wsUrl: string }) => {
      const url = new URL(globalThis.location.href);
      url.searchParams.set('room', room.roomId);
      url.searchParams.set('join', room.joinCode);
      globalThis.history.replaceState({}, '', url);
      setOnlineCredentials(buildOnlineCredentials(room.roomId, room.joinCode));
      setScreen('online');
    },
    [],
  );

  const handleJoinRoom = useCallback(
    (room: {
      roomId: string;
      joinCode: string;
      wsUrl: string;
      displayName?: string;
    }) => {
      setOnlineCredentials(room);
      setScreen('online');
    },
    [],
  );

  const leaveOnline = useCallback(() => {
    setOnlineCredentials(null);
    setScreen('home');
    const url = new URL(globalThis.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('join');
    globalThis.history.replaceState({}, '', url);
  }, []);

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
        <FixtureBoardView fixture={fixture} />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      {screen === 'home' ? (
        <HomeView
          online={online}
          onLocalGame={() => setScreen('local')}
          onHostRoom={handleHostRoom}
          onJoinRoom={handleJoinRoom}
          initialJoinCode={linkJoin?.joinCode}
          initialRoomId={linkJoin?.roomId}
        />
      ) : null}
      {screen === 'local' ? (
        session.screen === 'setup' ? (
          <>
            <GameSetupView
              setup={session.setup}
              onPlayerCount={session.setPlayerCount}
              onSeatKind={session.setSeatKind}
              onStart={session.startGame}
            />
            <Button variant="ghost" onClick={() => setScreen('home')} className={styles.backButton}>
              Back
            </Button>
          </>
        ) : (
          <LocalGameView session={session} />
        )
      ) : null}
      {screen === 'online' && !online ? <OfflinePage onBack={leaveOnline} /> : null}
      {screen === 'online' && online && linkJoin && onlineCredentials === null ? (
        <OnlineJoinGate
          roomId={linkJoin.roomId}
          joinCode={linkJoin.joinCode}
          onJoin={setOnlineCredentials}
          onCancel={leaveOnline}
        />
      ) : null}
      {screen === 'online' && online && onlineCredentials !== null ? (
        <OnlineRoomView credentials={onlineCredentials} onLeave={leaveOnline} />
      ) : null}
    </main>
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
