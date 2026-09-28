/**
 * Выбор сканера: текстовый или синтаксический.
 *
 * Логика выбора живёт здесь, а не в плагинах, по конкретной причине: механизм,
 * реализованный в одном плагине, в остальных молча отсутствует. Так было с
 * `classVarSuffixes` — он работал только в vite до 2026-09-25, и проекты на
 * webpack, rollup и esbuild теряли токены из переменных, ничего не сообщая.
 * Плагин должен уметь одно: позвать `createScanner` и передать имя файла.
 *
 * @module scanner
 */
import {
  scanTokens,
} from './extractTokens';
import type {
  ScanTokensOptions,
} from './extractTokens';

/** Расширения, которые умеет разбирать синтаксический сканер. */
const SYNTAX_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
];

/**
 * Годится ли файл для синтаксического разбора.
 *
 * Проверка расширения отделена от самого сканера намеренно: она нужна ДО того,
 * как загружен парсер, иначе `typescript` тянулся бы и в проектах, где
 * синтаксический режим выключен.
 *
 * Остальные форматы (`.html`, `.vue`, `.svelte`, `.astro`) разбирает текстовый
 * сканер: у них свои парсеры, то есть свои зависимости — отдельный разговор.
 */
export function isSyntaxScannable(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  const query = fileName.indexOf('?', dot);
  // `id` из сборщика приходит с хвостом: `App.tsx?used&lang.tsx`.
  const ext = query < 0 ? fileName.slice(dot) : fileName.slice(dot, query);
  return SYNTAX_EXTENSIONS.indexOf(ext) > -1;
}

/** Опции {@link createScanner}. */
export interface ScannerOptions extends ScanTokensOptions {
  /**
   * `true` — разбирать JS/TS/JSX/TSX парсером вместо текстового поиска.
   *
   * Включается явно: цена — зависимость от `typescript` (необязательная
   * peer-зависимость) и примерно шестикратное время разбора. Платит тот, кому
   * это нужно. Файлы прочих форматов сканируются текстом в любом случае.
   */
  syntax?: boolean;
  /**
   * Куда сообщить, что синтаксический режим включён, а парсера нет.
   * По умолчанию — `console.warn`; сообщение выводится один раз.
   */
  onWarning?: (message: string) => void;
}

/** Сканер файла: текст плюс имя, по которому выбирается способ разбора. */
export type Scanner = (source: string, fileName?: string) => string[];

/** Тип функции синтаксического сканера — ровно то, что нужно здесь. */
type SyntaxScan = (source: string, options: ScanTokensOptions & {
  fileName?: string;
}) => string[];

/**
 * Возвращает функцию сканирования файла по настройкам.
 *
 * Парсер загружается лениво и только при первом подходящем файле: включённая
 * опция сама по себе не должна стоить загрузки `typescript`, а в проекте могут
 * оказаться одни `.html`.
 *
 * @example
 * const scan = createScanner({ attr: 'class', syntax: true });
 * scan(source, '/src/App.tsx');   // разбором
 * scan(source, '/index.html');    // текстом
 */
export function createScanner(options: ScannerOptions): Scanner {
  if (!options.syntax) {
    return (source: string) => scanTokens(source, options);
  }
  // 0 — ещё не пробовали, иначе функция или 1 (парсера нет, больше не пробуем).
  let syntaxScan: SyntaxScan | 0 | 1 = 0;
  return (source: string, fileName?: string): string[] => {
    if (!fileName || !isSyntaxScannable(fileName)) {
      return scanTokens(source, options);
    }
    if (!syntaxScan) {
      syntaxScan = loadSyntaxScan(options) || 1;
    }
    if (syntaxScan === 1) {
      return scanTokens(source, options);
    }
    return syntaxScan(source, {
      ...options,
      fileName,
    });
  };
}

/**
 * Загружает синтаксический сканер, если парсер доступен.
 *
 * `typescript` — необязательная peer-зависимость: его отсутствие не повод
 * ронять сборку, но и молчать нельзя — потребитель включил режим и вправе
 * знать, что тот не работает.
 */
function loadSyntaxScan(options: ScannerOptions): SyntaxScan | undefined {
  try {
    // Через `require` и внутри функции: статический импорт затянул бы парсер
    // в каждую сборку, включая те, где синтаксический режим выключен.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./syntaxScan') as { scanTokensSyntax: SyntaxScan }).scanTokensSyntax;
  } catch (ex) {
    const warn = options.onWarning || ((message: string) => {
      console.warn(message);
    });
    warn('[minotation] syntax: true, но парсер недоступен ('
      + (ex as Error).message + '). Файлы сканируются текстом. '
      + 'Установите typescript — он объявлен необязательной peer-зависимостью.');
    return undefined;
  }
}
