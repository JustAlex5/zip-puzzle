/** Standard Konami sequence (keyboard `key` values). */
export const KONAMI_KEYS: string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function normalizeKonamiKey(e: KeyboardEvent): string {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    return e.key;
  }
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}
