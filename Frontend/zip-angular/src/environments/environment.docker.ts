export const environment = {
  production: true,
  /** Same origin: nginx proxies /auth, /levels, /hubs to the API (see docker/nginx). */
  apiUrl: '',
  gameHubPath: '/hubs/game',
};
