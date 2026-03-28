import { environment } from '../../../environments/environment';

/** API / gateway base (no trailing slash). Empty env → browser origin (same-host deploy + wss). */
export function getApiBaseUrl(): string {
  const raw = environment.apiUrl?.trim() ?? '';
  if (raw) {
    return raw.replace(/\/$/, '');
  }
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const loc = (globalThis as Window).location;
    if (loc?.origin) {
      return loc.origin.replace(/\/$/, '');
    }
  }
  return '';
}

/**
 * Absolute URL for the PvP SignalR hub (negotiate + WebSocket).
 * `environment.gameHubPath` must start with `/` (e.g. `/hubs/game`, `/api/hubs/game`).
 */
export function getGameHubUrl(): string {
  const base = getApiBaseUrl();
  const path = normalizeGameHubPath(environment.gameHubPath);
  return `${base}${path}`;
}

function normalizeGameHubPath(path: string | undefined): string {
  const raw = path?.trim();
  const p = raw && raw.length > 0 ? raw : '/hubs/game';
  const withSlash = p.startsWith('/') ? p : `/${p}`;
  return withSlash.replace(/\/+$/, '');
}
