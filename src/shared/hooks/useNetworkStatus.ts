import { useEffect, useState } from 'react';

/** Tracks `navigator.onLine` and browser online/offline events. */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = (): void => setOnline(true);
    const onOffline = (): void => setOnline(false);
    globalThis.addEventListener('online', onOnline);
    globalThis.addEventListener('offline', onOffline);
    return () => {
      globalThis.removeEventListener('online', onOnline);
      globalThis.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
