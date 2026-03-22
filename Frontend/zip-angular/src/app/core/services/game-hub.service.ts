import { Injectable, NgZone, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface MatchFoundPayload {
  roomCode: string;
  levelId: number;
  playerA: string;
  playerB: string;
  startsInSeconds: number;
}

export interface GameHubHandlers {
  onMatchFound?: (payload: MatchFoundPayload) => void;
  onGameStarted?: () => void;
  onPrivateRoomCreated?: (inviteCode: string) => void;
  onQueued?: (message: string) => void;
  onError?: (message: string) => void;
  onSearchCancelled?: () => void;
  onYouWon?: (timeSeconds: number) => void;
  onOpponentSolved?: (username: string, timeSeconds: number) => void;
  onYouFinished?: (timeSeconds: number) => void;
  onOpponentDisconnected?: (message: string) => void;
  onConnectionClosed?: (error?: Error) => void;
}

function normalizeMatchFound(payload: unknown): MatchFoundPayload {
  const o = payload as Record<string, unknown>;
  return {
    roomCode: String(o['roomCode'] ?? o['RoomCode'] ?? ''),
    levelId: Number(o['levelId'] ?? o['LevelId'] ?? 0),
    playerA: String(o['playerA'] ?? o['PlayerA'] ?? ''),
    playerB: String(o['playerB'] ?? o['PlayerB'] ?? ''),
    startsInSeconds: Number(o['startsInSeconds'] ?? o['StartsInSeconds'] ?? 3),
  };
}

@Injectable({ providedIn: 'root' })
export class GameHubService {
  private readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);
  private hub: HubConnection | null = null;
  private handlers: GameHubHandlers | null = null;

  readonly connectionState = signal(HubConnectionState.Disconnected);

  async connect(handlers: GameHubHandlers): Promise<void> {
    const token = this.auth.token();
    if (!token) {
      throw new Error('Sign in to play online.');
    }

    await this.disconnect();

    this.handlers = handlers;
    const url = `${environment.apiUrl}/hubs/game?access_token=${encodeURIComponent(token)}`;

    const connection = new HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    this.hub = connection;

    const run = (fn: () => void) => this.ngZone.run(fn);

    connection.on('MatchFound', (payload: unknown) => {
      run(() => this.handlers?.onMatchFound?.(normalizeMatchFound(payload)));
    });
    connection.on('GameStarted', () => {
      run(() => this.handlers?.onGameStarted?.());
    });
    connection.on('PrivateRoomCreated', (code: string) => {
      run(() => this.handlers?.onPrivateRoomCreated?.(code));
    });
    connection.on('Queued', (message: string) => {
      run(() => this.handlers?.onQueued?.(message));
    });
    connection.on('Error', (message: string) => {
      run(() => this.handlers?.onError?.(message));
    });
    connection.on('SearchCancelled', () => {
      run(() => this.handlers?.onSearchCancelled?.());
    });
    connection.on('YouWon', (timeSeconds: number) => {
      run(() => this.handlers?.onYouWon?.(timeSeconds));
    });
    connection.on('OpponentSolved', (username: string, timeSeconds: number) => {
      run(() => this.handlers?.onOpponentSolved?.(username, timeSeconds));
    });
    connection.on('YouFinished', (timeSeconds: number) => {
      run(() => this.handlers?.onYouFinished?.(timeSeconds));
    });
    connection.on('OpponentDisconnected', (message: string) => {
      run(() => this.handlers?.onOpponentDisconnected?.(message));
    });

    connection.onreconnecting(() => {
      run(() => this.connectionState.set(connection.state));
    });
    connection.onreconnected(() => {
      run(() => this.connectionState.set(connection.state));
    });
    connection.onclose((err) => {
      run(() => {
        this.connectionState.set(HubConnectionState.Disconnected);
        this.handlers?.onConnectionClosed?.(err ?? undefined);
      });
    });

    await connection.start();
    this.connectionState.set(connection.state);
  }

  async disconnect(): Promise<void> {
    if (this.hub) {
      try {
        await this.hub.stop();
      } catch {
        /* noop */
      }
      this.hub = null;
    }
    this.handlers = null;
    this.connectionState.set(HubConnectionState.Disconnected);
  }

  async findMatchRandom(): Promise<void> {
    await this.hub!.invoke('FindMatchRandom');
  }

  async findMatchByLevel(levelId: number): Promise<void> {
    await this.hub!.invoke('FindMatchByLevel', levelId);
  }

  async createPrivateRoom(levelId: number): Promise<void> {
    await this.hub!.invoke('CreatePrivateRoom', levelId);
  }

  async joinPrivateRoom(code: string): Promise<void> {
    await this.hub!.invoke('JoinPrivateRoom', code.trim().toUpperCase());
  }

  async cancelSearch(): Promise<void> {
    await this.hub!.invoke('CancelSearch');
  }

  async solvePuzzle(roomCode: string): Promise<void> {
    await this.hub!.invoke('SolvePuzzle', roomCode);
  }

  isConnected(): boolean {
    return this.hub?.state === HubConnectionState.Connected;
  }
}
