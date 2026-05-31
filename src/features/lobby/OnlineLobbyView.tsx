import { useCallback, useMemo, useState } from 'react';
import { GameSetupView, type GameSetup } from '@/features/session';
import { normalizeSetup } from '@/features/session/types.ts';
import { buildJoinUrl } from '@/features/online/joinLink.ts';
import type { useOnlineGame } from '@/features/online/useOnlineGame.ts';
import { Button } from '@/shared/ui';
import { gameSetupFromLobby } from './lobbySetup.ts';
import { OnlineConnecting } from './OnlineConnecting.tsx';
import styles from './OnlineLobbyView.module.css';

type OnlineRoom = ReturnType<typeof useOnlineGame>;

export interface OnlineLobbyViewProps {
  readonly room: OnlineRoom;
  readonly roomId: string;
  readonly onLeave: () => void;
}

export function OnlineLobbyView({ room, roomId, onLeave }: OnlineLobbyViewProps) {
  const { lobby, isHost, disconnected, sendSetup, sendStartGame, error, status } = room;
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const setup = useMemo(
    () => (lobby ? normalizeSetup(gameSetupFromLobby(lobby)) : null),
    [lobby],
  );

  const shareUrl = lobby ? buildJoinUrl(roomId, lobby.joinCode) : '';

  const copyLink = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyHint('Link copied');
    } catch {
      setCopyHint('Copy failed — select the link manually');
    }
  }, [shareUrl]);

  if (!lobby || !setup) {
    return (
      <OnlineConnecting
        status={status}
        error={error}
        onLeave={onLeave}
      />
    );
  }

  const handlePlayerCount = (count: GameSetup['playerCount']): void => {
    const next = normalizeSetup({ ...setup, playerCount: count });
    sendSetup(count, next.seats);
  };

  const handleSeatKind = (seatIndex: number, kind: GameSetup['seats'][number]['kind']): void => {
    const seats = setup.seats.map((seat, index) =>
      index === seatIndex ? { kind } : seat,
    );
    sendSetup(setup.playerCount, seats);
  };

  const canStart = lobby.seats.some((s) => s.kind === 'human');

  return (
    <div className={styles.panel}>
      {disconnected ? (
        <p className={styles.banner} role="status">
          Connection lost — reconnecting…
        </p>
      ) : null}

      <div className={styles.copyRow}>
        <Button type="button" variant="ghost" onClick={() => void copyLink()} className={styles.copyButton}>
          Copy invite link
        </Button>
      </div>
      {copyHint ? <p role="status">{copyHint}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <GameSetupView
        setup={setup}
        onPlayerCount={handlePlayerCount}
        onSeatKind={handleSeatKind}
        onStart={sendStartGame}
        readOnly={!isHost}
        heading="Online lobby"
        startLabel="Start game"
        showStart={isHost}
        canStartOverride={canStart}
      />

      <div className={styles.footer}>
        <Button type="button" variant="ghost" onClick={onLeave} className={styles.leaveButton}>
          Leave
        </Button>
      </div>
    </div>
  );
}
