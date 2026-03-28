import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  concat,
  map,
  of,
  tap,
  throwError,
} from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { getApiBaseUrl } from '../utils/api-base-url.util';
import { LevelDto, NumberCellDto, WallBarrierDto } from '../models/level.model';

const LIST_CACHE_KEY = 'zip-puzzle.levels-list.v1';

@Injectable({ providedIn: 'root' })
export class LevelService {
  private readonly http = inject(HttpClient);

  /** Drop list cache (e.g. after logout if you want fresh user-scoped data). */
  invalidateLevelsListCache(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(LIST_CACHE_KEY);
    } catch {
      /* private mode / quota */
    }
  }

  /**
   * Level list with localStorage: cached snapshot first (instant UI), then network refresh.
   * Network failure after a cache hit falls back to the last good list.
   */
  getAll(): Observable<LevelDto[]> {
    const cached = this.readListCache();
    const network$ = this.http
      .get<ApiResponse<LevelDto[]>>(`${getApiBaseUrl()}/levels`)
      .pipe(
        map((res) => res.data ?? []),
        tap((list) => this.writeListCache(list)),
        catchError((err) => {
          if (cached !== null) {
            return of(cached);
          }
          return this.handleError(err);
        })
      );

    if (cached !== null) {
      return concat(of([...cached]), network$);
    }
    return network$;
  }

  getById(id: number): Observable<LevelDto> {
    return this.http
      .get<ApiResponse<LevelDto>>(`${getApiBaseUrl()}/levels/${id}`)
      .pipe(
        map((res) => {
          const data = res.data;
          if (data == null) {
            throw new Error('Level not found');
          }
          return data;
        }),
        catchError((err) => this.handleError(err))
      );
  }

  createLevel(dto: {
    name: string;
    size: number;
    numbers: NumberCellDto[];
    barriers: WallBarrierDto[];
  }): Observable<LevelDto> {
    return this.http
      .post<ApiResponse<LevelDto>>(`${getApiBaseUrl()}/levels`, dto)
      .pipe(
        map((res) => {
          const data = res.data;
          if (data == null) {
            throw new Error(res.message ?? 'Could not create level');
          }
          return data;
        }),
        tap(() => this.invalidateLevelsListCache()),
        catchError((err) => this.handleError(err))
      );
  }

  deleteLevel(id: number): Observable<void> {
    return this.http
      .delete(`${getApiBaseUrl()}/levels/${id}`, { observe: 'response' })
      .pipe(
        map(() => undefined),
        tap(() => this.invalidateLevelsListCache()),
        catchError((err) => this.handleError(err))
      );
  }

  /** Records a solve with time (seconds); updates your best time if better. */
  recordSolve(levelId: number, timeSeconds: number): Observable<LevelDto> {
    return this.http
      .post<ApiResponse<LevelDto>>(`${getApiBaseUrl()}/levels/${levelId}/solve`, {
        timeSeconds,
      })
      .pipe(
        map((res) => {
          const data = res.data;
          if (data == null) {
            throw new Error(res.message ?? 'Could not record solve');
          }
          return data;
        }),
        tap((dto) => this.mergeLevelIntoListCache(dto)),
        catchError((err) => this.handleError(err))
      );
  }

  private readListCache(): LevelDto[] | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(LIST_CACHE_KEY);
      if (raw == null || raw === '') {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return null;
      }
      return parsed as LevelDto[];
    } catch {
      return null;
    }
  }

  private writeListCache(levels: LevelDto[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(levels));
    } catch {
      /* quota / private mode */
    }
  }

  private mergeLevelIntoListCache(updated: LevelDto): void {
    const cur = this.readListCache();
    if (cur === null) {
      return;
    }
    const idx = cur.findIndex((l) => l.id === updated.id);
    if (idx < 0) {
      return;
    }
    const next = [...cur];
    next[idx] = updated;
    this.writeListCache(next);
  }

  private handleError(err: unknown): Observable<never> {
    return throwError(() => new Error(this.errorMessage(err)));
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object') {
        const top = body as Record<string, unknown>;
        if (typeof top['message'] === 'string' && top['message']) {
          return top['message'] as string;
        }
        const data = top['data'];
        if (data && typeof data === 'object' && 'error' in data) {
          const inner = (data as { error?: string }).error;
          if (typeof inner === 'string') {
            return inner;
          }
        }
        if (typeof top['error'] === 'string') {
          return top['error'];
        }
      }
      if (err.status === 0) {
        return 'Cannot reach the server. Is the API running and CORS configured?';
      }
      return err.message || `HTTP ${err.status}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Request failed';
  }
}
