import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LevelDto } from '../../core/models/level.model';
import { LevelService } from '../../core/services/level.service';
import { GridCanvasComponent } from '../../shared/components/grid-canvas/grid-canvas.component';

@Component({
  selector: 'app-play-level',
  standalone: true,
  imports: [RouterLink, GridCanvasComponent],
  templateUrl: './play-level.component.html',
  styleUrl: './play-level.component.scss',
})
export class PlayLevelComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly levelService = inject(LevelService);
  readonly auth = inject(AuthService);

  readonly level = signal<LevelDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly solveMessage = signal<string | null>(null);

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

  onSolved(ev: { timeSeconds: number }): void {
    const lv = this.level();
    if (!lv) {
      return;
    }
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
