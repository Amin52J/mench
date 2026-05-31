import { useOnlineGame, type OnlineRoomCredentials } from '@/features/online/useOnlineGame.ts';
import { OnlineGameView } from '@/features/online/OnlineGameView.tsx';
import { clearRoomSession } from '@/features/online/joinLink.ts';
import { Button, Panel } from '@/shared/ui';
import { OnlineLobbyView } from './OnlineLobbyView.tsx';

export interface OnlineRoomViewProps {
  readonly credentials: OnlineRoomCredentials;
  readonly onLeave: () => void;
}

export function OnlineRoomView({ credentials, onLeave }: OnlineRoomViewProps) {
  const room = useOnlineGame(credentials);
  const { lobby, state, roomClosedReason, disconnected } = room;

  const handleLeave = (): void => {
    room.disconnect();
    clearRoomSession(credentials.roomId);
    onLeave();
  };

  if (roomClosedReason) {
    return (
      <Panel>
        <p role="alert">Room closed: {roomClosedReason}</p>
        <Button type="button" onClick={handleLeave}>
          Back to home
        </Button>
      </Panel>
    );
  }

  const started = lobby?.started === true || state !== null;

  if (!started) {
    return (
      <OnlineLobbyView room={room} roomId={credentials.roomId} onLeave={handleLeave} />
    );
  }

  if (state === null) {
    return (
      <Panel>
        {disconnected ? (
          <p role="status">Connection lost — reconnecting…</p>
        ) : (
          <p role="status">Loading game…</p>
        )}
        <Button type="button" variant="ghost" onClick={handleLeave}>
          Leave
        </Button>
      </Panel>
    );
  }

  return <OnlineGameView room={room} onLeave={handleLeave} />;
}
