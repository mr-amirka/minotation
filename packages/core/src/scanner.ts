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

/**
 * Однофайловые компоненты: скрипт в них разбирается парсером, шаблон — текстом.
 *
 * Целиком такой файл парсером JS не разобрать, у каждого формата свой
 * компилятор. Но ложные токены берутся из скриптовой части — её и хватает.
 */
const SFC_EXTENSIONS = [
  '.vue',
  '.svelte',
  '.astro',
];

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
 * Как разбирать файл: `0` — текстом, `1` — целиком парсером, `2` — по блокам
 * (скрипт парсером, шаблон текстом).
 *
 * Проверка расширения отделена от самого сканера намеренно: она нужна ДО того,
 * как загружен парсер, иначе `typescript` тянулся бы и в проектах, где нет ни
 * одного подходящего файла.
 */
export function syntaxKindOf(fileName: string): 0 | 1 | 2 {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return 0;
  }
  const query = fileName.indexOf('?', dot);
  // `id` из сборщика приходит с хвостом: `App.tsx?used&lang.tsx`.
  const ext = query < 0 ? fileName.slice(dot) : fileName.slice(dot, query);
  if (SYNTAX_EXTENSIONS.indexOf(ext) > -1) {
    return 1;
  }
  return SFC_EXTENSIONS.indexOf(ext) > -1 ? 2 : 0;
}

/** Годится ли файл для синтаксического разбора — целиком или по блокам. */
export function isSyntaxScannable(fileName: string): boolean {
  return syntaxKindOf(fileName) > 0;
}

/** Опции {@link createScanner}. */
export interface ScannerOptions extends ScanTokensOptions {
  /**
   * Разбирать ли JS/TS/JSX/TSX парсером вместо текстового поиска.
   *
   * По умолчанию (`undefined`) — автоматически: если парсер доступен, файлы
   * JS-семейства идут через него, иначе текстом и молча. Точный разбор — это
   * не дополнительная возможность, а отсутствие ложных токенов, и просить о
   * нём отдельно незачем. Цена, ради которой режим когда-то был явным,
   * измерена: около 64 мкс на файл сверх текстового разбора, то есть меньше
   * десятой доли секунды на тысячу файлов.
   *
   * `true` — то же самое, но отсутствие парсера становится предупреждением:
   * раз режим попросили явно, молчать о том, что он не работает, нельзя.
   *
   * `false` — всегда текстовый разбор. Нужен там, где `typescript` в проекте
   * есть, но тратить на него время сборки не хочется.
   *
   * Файлы прочих форматов (`.html`, `.vue`, `.svelte`, `.astro`) сканируются
   * текстом при любом значении.
   */
  syntax?: boolean;
  /**
   * Куда сообщить, что `syntax: true`, а парсера нет.
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

/** Обе формы разбора: целиком и по блокам SFC. */
interface SyntaxModule {
  scanTokensSyntax: SyntaxScan;
  scanTokensSfc: SyntaxScan;
}

/**
 * Возвращает функцию сканирования файла по настройкам.
 *
 * Парсер загружается лениво и только при первом подходящем файле: ни включённая
 * опция, ни режим по умолчанию не должны стоить загрузки `typescript`, пока не
 * встретился файл, который есть смысл разбирать.
 *
 * @example
 * const scan = createScanner({ attr: 'class' });
 * scan(source, '/src/App.tsx');   // разбором, если парсер доступен
 * scan(source, '/index.html');    // текстом
 */
export function createScanner(options: ScannerOptions): Scanner {
  if (options.syntax === false) {
    return (source: string) => scanTokens(source, options);
  }
  // Явный `true` — о недоступном парсере предупреждаем; в автоматическом
  // режиме молчим: никто о нём не просил, а текстовый разбор работает.
  const required = options.syntax === true;
  // 0 — ещё не пробовали, иначе модуль или 1 (парсера нет, больше не пробуем).
  let parser: SyntaxModule | 0 | 1 = 0;
  return (source: string, fileName?: string): string[] => {
    const kind = fileName ? syntaxKindOf(fileName) : 0;
    if (!kind) {
      return scanTokens(source, options);
    }
    if (!parser) {
      parser = loadSyntaxScan(options, required) || 1;
    }
    if (parser === 1) {
      return scanTokens(source, options);
    }
    const scan = kind === 1 ? parser.scanTokensSyntax : parser.scanTokensSfc;
    return scan(source, {
      ...options,
      fileName,
    });
  };
}

/**
 * Загружает синтаксический сканер, если парсер доступен.
 *
 * `typescript` — необязательная peer-зависимость: его отсутствие не повод
 * ронять сборку. Сообщаем о нём, только когда режим попросили явно.
 */
function loadSyntaxScan(options: ScannerOptions, required: boolean): SyntaxModule | undefined {
  try {
    // Через `require` и внутри функции: статический импорт затянул бы парсер
    // в каждую сборку, включая те, где нет ни одного подходящего файла.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./syntaxScan') as SyntaxModule;
  } catch (ex) {
    if (required) {
      const warn = options.onWarning || ((message: string) => {
        console.warn(message);
      });
      warn('[minotation] syntax: true, but the parser is unavailable ('
        + (ex as Error).message + '). Files are scanned as text. '
        + 'Install typescript — it is an optional peer dependency.');
    }
    return undefined;
  }
}
