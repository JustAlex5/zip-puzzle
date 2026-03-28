export const environment = {
  production: true,
  /**
   * Same origin (empty): UI and API share one host (Docker gateway / reverse proxy). Uses https + wss automatically.
   * Or set a full base URL if the API is on another host (must be https for wss).
   */
  apiUrl: '',
  /** SignalR hub path; nginx must proxy this prefix to the API WebSocket endpoint. */
  gameHubPath: '/hubs/game',
};
