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

  const copyCode = useCallback(async (): Promise<void> => {
    if (!lobby) return;
    try {
      await navigator.clipboard.writeText(lobby.joinCode);
      setCopyHint('Code copied');
    } catch {
      setCopyHint('Copy failed');
    }
  }, [lobby]);

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

  const handlePreset = (preset: GameSetup): void => {
    const next = normalizeSetup(preset);
    sendSetup(next.playerCount, next.seats);
  };

  const canStart = lobby.seats.some((s) => s.kind === 'human');

  return (
    <div className={styles.panel}>
      {disconnected ? (
        <p className={styles.banner} role="status">
          Connection lost — reconnecting…
        </p>
      ) : null}

      <div className={styles.codeBlock} aria-label="Join code">
        <span>Join code</span>
        <strong className={styles.code}>{lobby.joinCode}</strong>
      </div>

      <div className={styles.copyRow}>
        <Button type="button" variant="ghost" onClick={() => void copyCode()}>
          Copy code
        </Button>
        <Button type="button" variant="ghost" onClick={() => void copyLink()}>
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
        onApplyPreset={handlePreset}
        onStart={sendStartGame}
        readOnly={!isHost}
        heading="Online lobby"
        lead={
          isHost
            ? 'Configure seats, then start when everyone is ready.'
            : 'Waiting for the host to configure and start the game.'
        }
        startLabel="Start game"
        showStart={isHost}
        canStartOverride={canStart}
      />

      <ul className={styles.roster} aria-label="Connected players">
        {lobby.seats.slice(0, lobby.playerCount).map((seat) => (
          <li key={seat.color}>
            <span data-color={seat.color}>{seat.color}</span>
            <span>
              {seat.kind === 'cpu'
                ? 'CPU'
                : seat.claimed
                  ? (seat.displayName ?? 'Human') +
                    (room.seat?.color === seat.color ? ' (you)' : '')
                  : 'Open'}
            </span>
            {seat.disconnected ? <span>(away)</span> : null}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <Button type="button" variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </div>
  );
}
