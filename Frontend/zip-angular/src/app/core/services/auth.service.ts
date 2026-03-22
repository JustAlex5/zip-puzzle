import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse } from '../models/auth.model';

const TOKEN_KEY = 'zip_token';
const USERNAME_KEY = 'zip_username';
const USERID_KEY = 'zip_userid';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly username = signal<string | null>(this.readStoredUsername());
  readonly userId = signal<number | null>(this.readStoredUserId());

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.token();
  }

  login(username: string, password: string) {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, {
        username,
        password,
      })
      .pipe(tap((res) => this.persistAuth(res.data)));
  }

  register(username: string, password: string) {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/register`, {
        username,
        password,
      })
      .pipe(tap((res) => this.persistAuth(res.data)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(USERID_KEY);
    this.username.set(null);
    this.userId.set(null);
  }

  private persistAuth(data: AuthResponse | null | undefined): void {
    if (!data?.token) {
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USERNAME_KEY, data.username);
    localStorage.setItem(USERID_KEY, String(data.userId));
    this.username.set(data.username);
    this.userId.set(data.userId);
  }

  private readStoredUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
  }

  private readStoredUserId(): number | null {
    const s = localStorage.getItem(USERID_KEY);
    if (!s) {
      return null;
    }
    const n = Number.parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }
}
