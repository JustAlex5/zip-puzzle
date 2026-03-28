import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LevelService } from '../../core/services/level.service';
import { LevelDto } from '../../core/models/level.model';
import {
  type LevelDifficulty,
  inferDifficulty,
  levelPoints,
} from '../../core/utils/level-display.util';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './play.component.html',
  styleUrl: './play.component.scss',
})
export class PlayComponent implements OnInit {
  private readonly levelService = inject(LevelService);
  readonly auth = inject(AuthService);

  readonly levels = signal<LevelDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  readonly filter = signal<'all' | LevelDifficulty>('all');

  readonly filteredLevels = computed(() => {
    const f = this.filter();
    const list = this.levels();
    if (f === 'all') {
      return list;
    }
    return list.filter((l) => inferDifficulty(l) === f);
  });

  ngOnInit(): void {
    this.load();
  }

  setFilter(f: 'all' | LevelDifficulty): void {
    this.filter.set(f);
  }

  difficultyOf(level: LevelDto): LevelDifficulty {
    return inferDifficulty(level);
  }

  pointsOf(level: LevelDto): number {
    return levelPoints(level);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.levelService.getAll().subscribe({
      next: (levels) => {
        this.levels.set(levels);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.formatError(err));
        this.loading.set(false);
      },
    });
  }

  isOwner(level: LevelDto): boolean {
    const uid = this.auth.userId();
    return uid != null && level.userId != null && level.userId === uid;
  }

  deleteLevel(level: LevelDto, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isOwner(level)) {
      return;
    }
    if (!confirm(`Delete “${level.name}”?`)) {
      return;
    }
    this.deleteError.set(null);
    this.levelService.deleteLevel(level.id).subscribe({
      next: () => this.load(),
      error: (e: unknown) => {
        this.deleteError.set(e instanceof Error ? e.message : 'Delete failed');
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
      return err.message || `HTTP ${err.status}`;
    }
    return 'Failed to load levels';
  }
}
