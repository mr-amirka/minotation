/**
 * Режим синтаксиса и требования файла разметки (D-045 этап 3, SPEC 14 §4): комментарий
 * `@minotation` в начале файла и поле `"minotation"` в `package.json` ближайшего пакета.
 * Старшинство — файл → пакет → `notationMode` в конфиге плагина.
 *
 * Холодный путь: директива читается один раз на файл, `package.json` — один раз на каталог.
 */
import {
  existsSync, readFileSync,
} from 'node:fs';
import {
  dirname, isAbsolute, join,
} from 'node:path';
import {
  checkOptions, isStringArray, oneOf,
} from 'minotation';
import type {
  MnNotationMode, OptionSchema,
} from 'minotation';

/** Что файл или пакет объявляет о себе. */
export interface MnNotationDirective {
  /** Режим синтаксиса классов файла. */
  notationMode?: MnNotationMode;
  /** Пресеты, без которых классы файла не работают. */
  requires?: string[];
}

const DIRECTIVE_SCHEMA: OptionSchema = {
  notationMode: oneOf(
    'context-qualified', 'variant-prefixed', 'breakpoint-prefixed',
  ),
  requires: isStringArray,
};

/** Директиву ищем только в начале файла: дальше она уже не «о файле», а случайный текст. */
const HEAD_LENGTH = 2048;

/**
 * `@minotation …` в комментарии: `/* … *\/`, строка блочного комментария ` * …`,
 * `<!-- … -->`, `// …`. `[1]` — тело до конца комментария или строки.
 */
const REGEXP_DIRECTIVE = /(?:\/\*+|<!--|\/\/|^\s*\*)\s*@minotation\b([^\n]*?)\s*(?:\*\/|-->|$)/m;

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

/**
 * Читает директиву из начала файла: `notationMode: variant-prefixed; requires: presetA, presetB`.
 * Неизвестный ключ или значение — ошибка с подсказкой и именем файла (D-038).
 *
 * @param source — текст файла
 * @param where — имя файла для сообщений
 * @returns директива или `undefined`, если её нет
 * @example
 * readNotationDirective('/* @minotation notationMode: variant-prefixed *\/', 'Button.tsx');
 * // => { notationMode: 'variant-prefixed' }
 */
export function readNotationDirective(source: string, where: string): MnNotationDirective | undefined {
  const matchs = REGEXP_DIRECTIVE.exec(source.length > HEAD_LENGTH ? source.slice(0, HEAD_LENGTH) : source);
  if (!matchs) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  let text: string;
  let at: number;
  let key: string;
  let value: string;
  for (const part of matchs[1].split(';')) {
    text = part.trim();
    if (!text) {
      continue;
    }
    at = text.indexOf(':');
    at > 0 || fail(where + ': "@minotation ' + text + '" expects "key: value"');
    key = text.slice(0, at).trim();
    value = text.slice(at + 1).trim();
    out[key] = key === 'requires'
      ? value.split(',').map((name) => name.trim()).filter(Boolean)
      : value;
  }
  checkOptions(
    out, DIRECTIVE_SCHEMA, where + ' @minotation',
  );
  return out as MnNotationDirective;
}

/** Каталог → директива ближайшего `package.json` (`null` — у пакета её нет). */
const packageCache = new Map<string, MnNotationDirective | null>();

/**
 * Поле `"minotation"` в `package.json` ближайшего к файлу пакета. Путь не абсолютный
 * (виртуальный модуль сборщика) — директивы нет.
 *
 * @param file — абсолютный путь файла
 * @returns директива пакета или `undefined`
 */
export function readPackageDirective(file: string): MnNotationDirective | undefined {
  if (!isAbsolute(file)) {
    return undefined;
  }
  const visited: string[] = [];
  let dir = dirname(file);
  let found: MnNotationDirective | null | undefined;
  let parent: string;
  for (;;) {
    found = packageCache.get(dir);
    if (found !== undefined) {
      break;
    }
    visited.push(dir);
    if (existsSync(join(dir, 'package.json'))) {
      found = parsePackage(join(dir, 'package.json'));
      break;
    }
    parent = dirname(dir);
    if (parent === dir) {
      found = null;
      break;
    }
    dir = parent;
  }
  for (const each of visited) {
    packageCache.set(each, found);
  }
  return found || undefined;
}

function parsePackage(path: string): MnNotationDirective | null {
  let json: { minotation?: unknown } | null;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  const field = json && json.minotation;
  if (field === undefined) {
    return null;
  }
  checkOptions(
    field, DIRECTIVE_SCHEMA, path + ' "minotation"',
  );
  return field as MnNotationDirective;
}

/** Сбрасывает кеш `package.json` — для тестов и смены файлов в watch. */
export function clearPackageDirectiveCache(): void {
  packageCache.clear();
}

/**
 * Режим и требования файла по старшинству: директива в файле → `package.json` пакета.
 *
 * @param source — текст файла
 * @param id — путь файла
 * @returns директива или `undefined`, если ни файл, ни пакет ничего не объявляют
 */
export function readFileNotation(source: string, id: string): MnNotationDirective | undefined {
  const own = readNotationDirective(source, id);
  const pkg = readPackageDirective(id);
  if (!own && !pkg) {
    return undefined;
  }
  return {
    notationMode: own && own.notationMode || pkg && pkg.notationMode,
    requires: own && own.requires || pkg && pkg.requires,
  };
}

