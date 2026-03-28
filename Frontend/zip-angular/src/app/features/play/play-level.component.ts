import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LevelDto } from '../../core/models/level.model';
import { levelPoints } from '../../core/utils/level-display.util';
import { LevelService } from '../../core/services/level.service';
import { GridCanvasComponent } from '../../shared/components/grid-canvas/grid-canvas.component';

@Component({
  selector: 'app-play-level',
  standalone: true,
  imports: [RouterLink, GridCanvasComponent],
  templateUrl: './play-level.component.html',
  styleUrl: './play-level.component.scss',
})
export class PlayLevelComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly levelService = inject(LevelService);
  readonly auth = inject(AuthService);

  @ViewChild(GridCanvasComponent) grid?: GridCanvasComponent;

  readonly level = signal<LevelDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly solveMessage = signal<string | null>(null);

  readonly progressPct = signal(0);
  readonly elapsedLabel = signal('00:00');
  readonly showCompleteModal = signal(false);
  readonly lastSolveSeconds = signal<number | null>(null);

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private playStartAt: number | null = null;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('levelId');
    const id = idParam != null ? Number.parseInt(idParam, 10) : NaN;
    if (Number.isNaN(id) || id < 1) {
      this.error.set('Invalid level.');
      this.loading.set(false);
      return;
    }

    this.levelService.getById(id).subscribe({
      next: (level) => {
        this.level.set(level);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.formatError(err));
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.clearTick();
  }

  onGridState(ev: {
    pathLength: number;
    totalCells: number;
    completed: boolean;
    elapsedSeconds: number;
  }): void {
    this.progressPct.set(
      ev.totalCells > 0 ? Math.round((ev.pathLength / ev.totalCells) * 100) : 0
    );

    if (ev.pathLength === 0) {
      this.clearTick();
      this.playStartAt = null;
      this.elapsedLabel.set('00:00');
      if (!ev.completed) {
        this.showCompleteModal.set(false);
      }
      return;
    }

    if (this.playStartAt === null) {
      this.playStartAt = Date.now() - ev.elapsedSeconds * 1000;
      this.clearTick();
      this.tickTimer = setInterval(() => this.tickClock(), 250);
    }

    this.elapsedLabel.set(this.formatClock(ev.elapsedSeconds));

    if (ev.completed) {
      this.clearTick();
    }
  }

  private tickClock(): void {
    if (this.playStartAt === null) {
      return;
    }
    const sec = Math.max(0, Math.floor((Date.now() - this.playStartAt) / 1000));
    this.elapsedLabel.set(this.formatClock(sec));
  }

  private formatClock(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private clearTick(): void {
    if (this.tickTimer != null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  onSolved(ev: { timeSeconds: number }): void {
    const lv = this.level();
    if (!lv) {
      return;
    }
    this.lastSolveSeconds.set(ev.timeSeconds);
    this.showCompleteModal.set(true);

    if (!this.auth.isLoggedIn()) {
      this.solveMessage.set(`Completed in ${ev.timeSeconds}s. Log in to save your time.`);
      return;
    }
    this.solveMessage.set(null);
    this.levelService.recordSolve(lv.id, ev.timeSeconds).subscribe({
      next: (updated) => {
        this.level.set(updated);
        this.solveMessage.set(
          `Saved: ${ev.timeSeconds}s` +
            (updated.myBestTimeSeconds != null
              ? ` · your best: ${updated.myBestTimeSeconds}s`
              : '')
        );
      },
      error: (e: unknown) => {
        this.solveMessage.set(e instanceof Error ? e.message : 'Could not save score');
      },
    });
  }

  pointsFor(lv: LevelDto): number {
    return levelPoints(lv);
  }

  playAgain(): void {
    this.showCompleteModal.set(false);
    this.solveMessage.set(null);
    this.grid?.reset();
    this.progressPct.set(0);
    this.elapsedLabel.set('00:00');
    this.playStartAt = null;
    this.clearTick();
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message?: string }).message;
        if (m) {
          return m;
        }
      }
      if (err.status === 404) {
        return 'Level not found.';
      }
      return err.message || `HTTP ${err.status}`;
    }
    return 'Failed to load level';
  }
}
