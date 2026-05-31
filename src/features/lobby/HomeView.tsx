import { useState } from 'react';
import { createRoom } from '@/features/online/api.ts';
import { buildOnlineCredentials } from '@/features/online/joinLink.ts';
import { Button, Input, Panel } from '@/shared/ui';
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
  onJoinRoom,
  initialJoinCode = '',
  initialRoomId = '',
}: HomeViewProps) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [displayName, setDisplayName] = useState('');
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

  const handleJoin = (): void => {
    if (!online) {
      setError('You are offline. Online play needs a network connection.');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    const id = roomId.trim();
    if (!code) {
      setError('Enter a join code');
      return;
    }
    if (!id) {
      setError('Enter the room id from the invite link');
      return;
    }
    setError(null);
    onJoinRoom(
      buildOnlineCredentials(id, code, {
        displayName: displayName.trim() || undefined,
      }),
    );
  };

  return (
    <Panel className={styles.panel}>
      <p className={styles.lead}>Play standard Ludo locally or online with friends.</p>
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
      <div className={styles.joinRow}>
        <h2>Join with code</h2>
        <div className={styles.joinFields}>
          <label>
            Join code
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD1234"
            />
          </label>
          <label>
            Room id
            <Input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="from invite link"
            />
          </label>
          <label>
            Display name (optional)
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={24}
            />
          </label>
        </div>
        <Button variant="ghost" onClick={handleJoin} disabled={!online}>
          Join room
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
