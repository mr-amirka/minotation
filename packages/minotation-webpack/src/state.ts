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
import { existsSync } from 'fs';
import type { MnInstance } from 'minotation';

/** Общий стейт одной сборки (процесса). */
export interface MnState {
  /**
   * MN-токены по файлам, из которых они извлечены.
   *
   * Раньше это был плоский `Set<string>`, который не очищался между
   * инкрементальными пересборками. Из-за этого токен, однажды попавший в набор,
   * оставался в CSS навсегда: и когда его убирали из разметки, и когда файл
   * удаляли целиком. Ключ по файлу решает оба случая — лоадер ЗАМЕНЯЕТ набор
   * своего файла, а исчезнувшие файлы отсеивает {@link collectTokens}.
   */
  tokensByFile: Map<string, Set<string>>;
  /** Динамические пресеты из *.mn.ts файлов, собранные preset-loader'ом. */
  dynamicPresets: Map<string, (mn: MnInstance) => void>;
}

const singleton: MnState = { tokensByFile: new Map(), dynamicPresets: new Map() };

/** Возвращает общий на процесс стейт с накопленными токенами. */
export function getState(): MnState {
  return singleton;
}

/**
 * Плоский набор токенов со всех файлов, что сейчас на учёте.
 *
 * Попутно вычищает записи файлов, которых больше нет на диске: в watch-режиме
 * webpack просто не вызывает лоадер для удалённого файла, и сам по себе стейт
 * о пропаже не узнаёт. Проверка идёт только в момент сборки CSS, а не на
 * каждый модуль, поэтому стоит она одного `existsSync` на файл за компиляцию.
 */
export function collectTokens(state: MnState): Set<string> {
  const all = new Set<string>();
  for (const [file, tokens] of state.tokensByFile) {
    if (!existsSync(file)) {
      state.tokensByFile.delete(file);
      continue;
    }
    for (const token of tokens) all.add(token);
  }
  return all;
}
