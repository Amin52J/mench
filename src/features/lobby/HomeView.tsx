import { useState } from 'react';
import { createRoom } from '@/features/online/api.ts';
import { Button, Panel } from '@/shared/ui';
import styles from './HomeView.module.css';

export interface HomeViewProps {
  readonly online: boolean;
  readonly onLocalGame: () => void;
  readonly onHostRoom: (room: {
    roomId: string;
    joinCode: string;
    wsUrl: string;
  }) => void;
  readonly onJoinRoom: (room: {
    roomId: string;
    joinCode: string;
    wsUrl: string;
    displayName?: string;
  }) => void;
  readonly initialJoinCode?: string;
  readonly initialRoomId?: string;
}

export function HomeView({
  online,
  onLocalGame,
  onHostRoom,
}: HomeViewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (): Promise<void> => {
    if (!online) {
      setError('You are offline. Online play needs a network connection.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
      onHostRoom(room);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create room');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className={styles.panel}>
      {!online ? (
        <p className={styles.offlineHint} role="status">
          You are offline. Local games work; online rooms need a connection.
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button onClick={onLocalGame}>Local game</Button>
        <Button onClick={() => void handleCreate()} disabled={busy || !online}>
          {busy ? 'Creating…' : 'Create online game'}
        </Button>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
