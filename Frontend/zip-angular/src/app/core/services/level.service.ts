import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { LevelDto, NumberCellDto, WallBarrierDto } from '../models/level.model';

@Injectable({ providedIn: 'root' })
export class LevelService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<LevelDto[]> {
    return this.http
      .get<ApiResponse<LevelDto[]>>(`${environment.apiUrl}/levels`)
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) => this.handleError(err))
      );
  }

  getById(id: number): Observable<LevelDto> {
    return this.http
      .get<ApiResponse<LevelDto>>(`${environment.apiUrl}/levels/${id}`)
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
      .post<ApiResponse<LevelDto>>(`${environment.apiUrl}/levels`, dto)
      .pipe(
        map((res) => {
          const data = res.data;
          if (data == null) {
            throw new Error(res.message ?? 'Could not create level');
          }
          return data;
        }),
        catchError((err) => this.handleError(err))
      );
  }

  deleteLevel(id: number): Observable<void> {
    return this.http
      .delete(`${environment.apiUrl}/levels/${id}`, { observe: 'response' })
      .pipe(
        map(() => undefined),
        catchError((err) => this.handleError(err))
      );
  }

  /** Records a solve with time (seconds); updates your best time if better. */
  recordSolve(levelId: number, timeSeconds: number): Observable<LevelDto> {
    return this.http
      .post<ApiResponse<LevelDto>>(`${environment.apiUrl}/levels/${levelId}/solve`, {
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
        catchError((err) => this.handleError(err))
      );
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
