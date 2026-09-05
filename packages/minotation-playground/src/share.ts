/**
 * Шаринг сниппетов без бэкенда — состояние кодируется в hash самого URL
 * (`encodeURIComponent(JSON.stringify(...))`, без base64 — `btoa` ломается
 * на не-ASCII содержимом HTML, plain percent-encoding работает всегда).
 */
export interface PlaygroundState {
  html: string;
  presetIds: string[];
}

export function encodeStateToHash(state: PlaygroundState): string {
  return '#' + encodeURIComponent(JSON.stringify(state));
}

export function decodeStateFromHash(hash: string): PlaygroundState | undefined {
  const raw = hash.replace(/^#/, '');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return typeof parsed.html === 'string' && Array.isArray(parsed.presetIds) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
