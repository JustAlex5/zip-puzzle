import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LevelDto } from '../../core/models/level.model';
import { AuthService } from '../../core/services/auth.service';
import {
  GameHubService,
  type MatchFoundPayload,
} from '../../core/services/game-hub.service';
import { LevelService } from '../../core/services/level.service';
import { GridCanvasComponent } from '../../shared/components/grid-canvas/grid-canvas.component';

type PvpPhase =
  | 'lobby'
  | 'queued'
  | 'waiting_private'
  | 'countdown'
  | 'playing'
  | 'ended';

@Component({
  selector: 'app-pvp',
  standalone: true,
  imports: [RouterLink, FormsModule, GridCanvasComponent],
  templateUrl: './pvp.component.html',
  styleUrl: './pvp.component.scss',
})
export class PvpComponent implements OnInit, OnDestroy {
  private readonly levelService = inject(LevelService);
  private readonly gameHub = inject(GameHubService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);

  readonly levels = signal<LevelDto[]>([]);
  readonly levelsLoading = signal(true);
  readonly levelsError = signal<string | null>(null);

  readonly phase = signal<PvpPhase>('lobby');
  readonly hubConnecting = signal(true);
  readonly hubError = signal<string | null>(null);

  readonly selectedLevelId = signal<number | null>(null);
  readonly joinCodeInput = signal('');

  readonly matchInfo = signal<MatchFoundPayload | null>(null);
  readonly roomCode = signal<string | null>(null);
  readonly level = signal<LevelDto | null>(null);
  readonly levelLoadError = signal<string | null>(null);

  readonly inviteCode = signal<string | null>(null);
  readonly statusLine = signal<string | null>(null);
  readonly countdown = signal<number | null>(null);
  readonly outcome = signal<string | null>(null);

  /** When true, the puzzle accepts pointer/keyboard input (independent of `phase` for CD reliability). */
  readonly boardUnlocked = signal(false);

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.levelService.getAll().subscribe({
      next: (list) => {
        this.levels.set(list);
        this.levelsLoading.set(false);
        if (list.length > 0) {
          this.selectedLevelId.set(list[0].id);
        }
      },
      error: (err: unknown) => {
        this.levelsError.set(this.formatHttpError(err));
        this.levelsLoading.set(false);
      },
    });

    void this.connectHub();
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    void this.gameHub.disconnect();
  }

  async findRandom(): Promise<void> {
    this.clearMessages();
    try {
      await this.gameHub.findMatchRandom();
    } catch (e: unknown) {
      this.hubError.set(e instanceof Error ? e.message : 'Could not queue');
    }
  }

  async findByLevel(): Promise<void> {
    const id = this.selectedLevelId();
    if (id == null || id < 1) {
      this.hubError.set('Pick a level.');
      return;
    }
    this.clearMessages();
    try {
      await this.gameHub.findMatchByLevel(id);
    } catch (e: unknown) {
      this.hubError.set(e instanceof Error ? e.message : 'Could not queue');
    }
  }

  async createPrivate(): Promise<void> {
    const id = this.selectedLevelId();
    if (id == null || id < 1) {
      this.hubError.set('Pick a level.');
      return;
    }
    this.clearMessages();
    try {
      await this.gameHub.createPrivateRoom(id);
    } catch (e: unknown) {
      this.hubError.set(e instanceof Error ? e.message : 'Could not create room');
    }
  }

  async joinPrivate(): Promise<void> {
    const raw = this.joinCodeInput().trim();
    if (raw.length < 4) {
      this.hubError.set('Enter the room code.');
      return;
    }
    this.clearMessages();
    try {
      await this.gameHub.joinPrivateRoom(raw);
    } catch (e: unknown) {
      this.hubError.set(e instanceof Error ? e.message : 'Could not join');
    }
  }

  async cancelQueue(): Promise<void> {
    try {
      await this.gameHub.cancelSearch();
    } catch {
      this.phase.set('lobby');
    }
  }

  onSolved(): void {
    if (!this.boardUnlocked() || this.phase() === 'ended') {
      return;
    }
    const code = this.roomCode();
    if (!code) {
      return;
    }
    void this.gameHub.solvePuzzle(code).catch(() => {
      /* hub may ignore if race */
    });
  }

  backToLobby(): void {
    this.clearCountdown();
    this.boardUnlocked.set(false);
    this.phase.set('lobby');
    this.matchInfo.set(null);
    this.roomCode.set(null);
    this.level.set(null);
    this.levelLoadError.set(null);
    this.inviteCode.set(null);
    this.statusLine.set(null);
    this.outcome.set(null);
    this.joinCodeInput.set('');
    this.hubError.set(null);
  }

  initial(name: string | undefined | null): string {
    const n = (name ?? '?').trim();
    return n.length > 0 ? n[0]!.toUpperCase() : '?';
  }

  lobbyDisabled(): boolean {
    const p = this.phase();
    return (
      p === 'queued' ||
      p === 'waiting_private' ||
      p === 'countdown' ||
      p === 'playing'
    );
  }

  private async connectHub(): Promise<void> {
    this.hubConnecting.set(true);
    this.hubError.set(null);
    try {
      await this.gameHub.connect({
        onMatchFound: (p) => this.onMatchFound(p),
        onGameStarted: () => {
          this.unlockBoard();
        },
        onPrivateRoomCreated: (code) => {
          this.inviteCode.set(code);
          this.phase.set('waiting_private');
          this.statusLine.set(`Share code: ${code} — waiting for opponent…`);
        },
        onQueued: (msg) => {
          this.phase.set('queued');
          this.statusLine.set(msg);
        },
        onError: (msg) => {
          this.hubError.set(msg);
          if (this.phase() === 'queued') {
            this.phase.set('lobby');
            this.statusLine.set(null);
          }
        },
        onSearchCancelled: () => {
          this.phase.set('lobby');
          this.statusLine.set(null);
        },
        onYouWon: (timeSeconds) => {
          this.phase.set('ended');
          this.boardUnlocked.set(false);
          this.outcome.set(`You won — ${timeSeconds}s (server time from match start).`);
        },
        onOpponentSolved: (username, timeSeconds) => {
          this.phase.set('ended');
          this.boardUnlocked.set(false);
          this.outcome.set(`${username} finished first (${timeSeconds}s).`);
        },
        onYouFinished: (timeSeconds) => {
          if (this.phase() === 'ended') {
            return;
          }
          this.phase.set('ended');
          this.boardUnlocked.set(false);
          this.outcome.set(`You completed in ${timeSeconds}s — opponent was faster.`);
        },
        onOpponentDisconnected: (msg) => {
          this.phase.set('ended');
          this.boardUnlocked.set(false);
          this.outcome.set(msg);
        },
        onConnectionClosed: (err) => {
          if (err) {
            this.hubError.set(err.message);
          }
        },
      });
    } catch (e: unknown) {
      this.hubError.set(e instanceof Error ? e.message : 'Could not connect');
    } finally {
      this.hubConnecting.set(false);
    }
  }

  private onMatchFound(p: MatchFoundPayload): void {
    this.matchInfo.set(p);
    this.roomCode.set(p.roomCode);
    this.inviteCode.set(null);
    this.outcome.set(null);
    this.boardUnlocked.set(false);
    this.phase.set('countdown');
    this.statusLine.set(`${p.playerA} vs ${p.playerB}`);
    this.startCountdown(Math.max(1, p.startsInSeconds));
    this.loadLevel(p.levelId);
  }

  private loadLevel(id: number): void {
    this.level.set(null);
    this.levelLoadError.set(null);
    this.levelService.getById(id).subscribe({
      next: (lv) => this.level.set(lv),
      error: (err: unknown) => {
        this.levelLoadError.set(this.formatHttpError(err));
      },
    });
  }

  private startCountdown(seconds: number): void {
    this.clearCountdown();
    let n = seconds;
    this.countdown.set(n);
    this.countdownTimer = setInterval(() => {
      this.ngZone.run(() => {
        n -= 1;
        if (n <= 0) {
          this.clearCountdown();
          this.countdown.set(null);
          this.unlockBoard();
          return;
        }
        this.countdown.set(n);
      });
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private clearMessages(): void {
    this.hubError.set(null);
    this.statusLine.set(null);
  }

  private unlockBoard(): void {
    this.phase.set('playing');
    this.boardUnlocked.set(true);
    this.clearCountdown();
    this.countdown.set(null);
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private formatHttpError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message?: string }).message;
        if (m) {
          return m;
        }
      }
      if (err.status === 404) {
        return 'Not found.';
      }
      return err.message || `HTTP ${err.status}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Something went wrong';
  }
}
