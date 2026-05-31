import { Button, Panel } from '@/shared/ui';
import styles from './OfflinePage.module.css';

export interface OfflinePageProps {
  readonly onBack: () => void;
}

/** Shown when the user tries online play without a network connection. */
export function OfflinePage({ onBack }: OfflinePageProps) {
  return (
    <Panel className={styles.panel}>
      <h2 className={styles.title}>You are offline</h2>
      <p className={styles.body}>
        Online rooms need an internet connection. Local games still work when the app shell is
        cached. Reconnect and try again.
      </p>
      <Button variant="ghost" onClick={onBack}>
        Back to home
      </Button>
    </Panel>
  );
}
