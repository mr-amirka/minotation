/**
 * Shared state между loader и plugin.
 *
 * Один синглтон на процесс, НЕ по отдельному `Compiler`. Раньше стейт был
 * изолирован через `WeakMap<Compiler, MnState>` — это ломало Next.js App
 * Router: там на один `next build` заводится НЕСКОЛЬКО отдельных компиляторов
 * (`server`/`edge-server`/`client`), и Server Component (без `'use client'`)
 * попадает в граф модулей ТОЛЬКО серверного компилятора — токены из его classNames
 * извлекал только серверный проход, а реально отдаваемый браузеру CSS писал
 * клиентский проход с ПУСТЫМ (изолированным) набором токенов. Найдено эмпирически
 * (2026-09-02) — `minotation-next-demo`, сквозная сборка через `next build`,
 * не мок-тестами. Общий синглтон отдаёт корректный CSS во всех трёх проходах,
 * ценой обратного компромисса: если один Node-процесс когда-нибудь соберёт webpack
 * ПРОГРАММНО для нескольких НЕСВЯЗАННЫХ проектов подряд — их токены будут делить
 * один пул. Для `next build`/`webpack` CLI (отдельный процесс на сборку) это не
 * применимо.
 */
import type { MnInstance } from 'minotation';

/** Общий стейт одной сборки (процесса). */
export interface MnState {
  /** Все MN-токены, собранные лоадером из исходников. Не очищается между инкрементальными пересборками. */
  tokens: Set<string>;
  /** Динамические пресеты из *.mn.ts файлов, собранные preset-loader'ом. */
  dynamicPresets: Map<string, (mn: MnInstance) => void>;
}

const singleton: MnState = { tokens: new Set(), dynamicPresets: new Map() };

/** Возвращает общий на процесс стейт с накопленными токенами. */
export function getState(): MnState {
  return singleton;
}
