import { useState } from 'react';
import { buildOnlineCredentials } from '@/features/online/joinLink.ts';
import type { OnlineRoomCredentials } from '@/features/online';
import { Button, Input, Panel } from '@/shared/ui';
import styles from './OnlineJoinGate.module.css';

export interface OnlineJoinGateProps {
  readonly roomId: string;
  readonly joinCode: string;
  readonly onJoin: (credentials: OnlineRoomCredentials) => void;
  readonly onCancel: () => void;
}

/** Shown when opening an invite link — collect optional name, then open the socket. */
export function OnlineJoinGate({ roomId, joinCode, onJoin, onCancel }: OnlineJoinGateProps) {
  const [displayName, setDisplayName] = useState('');

  const handleJoin = (): void => {
    onJoin(
      buildOnlineCredentials(roomId, joinCode, {
        displayName: displayName.trim() || undefined,
      }),
    );
  };

  return (
    <Panel className={styles.panel}>
      <h2 className={styles.heading}>Join game</h2>
      <p className={styles.lead}>
        Room code <strong>{joinCode.toUpperCase()}</strong>
      </p>
      <p className={styles.hint}>
        Seats are assigned in join order (blue, then red, …). The host picks how many
        seats are human vs CPU before starting.
      </p>
      <label className={styles.label}>
        Your name (optional)
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="nickname"
          maxLength={24}
          placeholder="shown in the lobby"
        />
      </label>
      <div className={styles.actions}>
        <Button type="button" onClick={handleJoin}>
          Enter lobby
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
