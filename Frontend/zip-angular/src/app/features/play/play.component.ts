import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LevelService } from '../../core/services/level.service';
import { LevelDto } from '../../core/models/level.model';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './play.component.html',
  styleUrl: './play.component.scss',
})
export class PlayComponent implements OnInit {
  private readonly levelService = inject(LevelService);

  readonly levels = signal<LevelDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
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
