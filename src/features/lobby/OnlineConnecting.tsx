import type { ConnectionStatus } from '@/features/online/connection.ts';
import { Button, Panel } from '@/shared/ui';
import styles from './OnlineConnecting.module.css';

export interface OnlineConnectingProps {
  readonly status: ConnectionStatus;
  readonly error: string | null;
  readonly onLeave: () => void;
  readonly onRetry?: () => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Opening connection…',
  open: 'Waiting for lobby…',
  closed: 'Connection closed',
  error: 'Connection failed',
};

export function OnlineConnecting({
  status,
  error,
  onLeave,
  onRetry,
}: OnlineConnectingProps) {
  return (
    <Panel className={styles.panel}>
      <p className={styles.status} role="status">
        {STATUS_LABEL[status]}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {(status === 'error' || status === 'closed') && (
        <p className={styles.hint}>
          Make sure <code>pnpm dev:worker</code> is running, then restart <code>pnpm dev</code>{' '}
          (WebSocket proxy needs a Vite restart after config changes).
        </p>
      )}
      <div className={styles.actions}>
        {onRetry && (status === 'error' || status === 'closed') ? (
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </Panel>
  );
}
