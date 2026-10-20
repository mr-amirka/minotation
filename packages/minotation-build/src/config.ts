/**
 * Общий файл настроек `minotation.config.*` (D-080, D-081): альтернатива опциям в коде для всех
 * плагинов и CLI. Один файл на проект; каждый инструмент берёт из него общие опции и свои,
 * опции из кода сливаются поверх.
 *
 * Холодный путь: файл читается один раз на каталог.
 */
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import {
  createRequire,
} from 'node:module';
import {
  join,
  relative,
} from 'node:path';
import {
  checkOptions,
} from 'minotation';
import type {
  OptionCheck,
  OptionSchema,
} from 'minotation';

/** Имена файла по порядку поиска. */
export const CONFIG_FILE_NAMES = [
  'minotation.config.js',
  'minotation.config.cjs',
  'minotation.config.mjs',
  'minotation.config.json',
];

/**
 * Ключи, которые есть только у отдельных инструментов: в общем файле они допустимы, а значение
 * проверяет сам инструмент — у `inject` в Vite и Astro разные типы.
 */
export const TOOL_OPTION_KEYS: Record<string, string[]> = {
  mnVite: ['inject'],
  mnAstro: ['inject'],
  withMn: ['enabled'],
  cli: [
    'input',
    'output',
    'ignore',
  ],
};

/**
 * `require`, а не динамический `import`: пакет собирается в CommonJS, а `require` читает и
 * `.json`, и (Node 22.12+) модули ESM.
 */
const requireConfig = createRequire(__filename);

/** Путь файла → его настройки и время правки: в watch файл правят, и он перечитывается. */
const cache = new Map<string, [config: LoadedConfig, mtime: number]>();

/** Найденный файл настроек. */
export interface LoadedConfig {
  /** Полный путь файла. */
  path: string;
  /** Его настройки — все ключи, как записаны. */
  options: Record<string, unknown>;
}

/**
 * Ищет и читает `minotation.config.*` в каталоге.
 *
 * Нет файла — `undefined`, это не ошибка. Битый файл или опечатка в ключе — ошибка: собрать с
 * умолчаниями не то, что просили, хуже, чем не собрать.
 *
 * @param dir — каталог проекта; по умолчанию рабочий
 * @param schema — допустимые опции: общий набор плагинов; ключи отдельных инструментов
 *   ({@link TOOL_OPTION_KEYS}) добавляются к нему без проверки значения
 * @param path — явный путь файла (CLI `--config`); тогда он обязан существовать
 */
export function loadConfigFile(
  schema: OptionSchema, dir: string = process.cwd(), path?: string,
): LoadedConfig | undefined {
  const full = path || CONFIG_FILE_NAMES.map((name) => join(dir, name)).find((file) => existsSync(file));
  if (!full) {
    return undefined;
  }
  if (!existsSync(full)) {
    throw new Error('[minotation] Config not found: "' + full + '"');
  }
  const mtime = statSync(full).mtimeMs;
  const cached = cache.get(full);
  if (cached && cached[1] === mtime) {
    return cached[0];
  }
  let loaded: { default?: Record<string, unknown> } & Record<string, unknown>;
  try {
    loaded = full.endsWith('.json') ? JSON.parse(readFileSync(full, 'utf8')) : freshRequire(full);
  } catch (ex) {
    throw new Error('[minotation] Failed to read config "' + full + '": ' + (ex as Error).message, {
      cause: ex,
    });
  }
  const options = (loaded.default || loaded) as Record<string, unknown>;
  checkOptions(
    options, withToolKeys(schema), relative(process.cwd(), full),
  );
  const out: LoadedConfig = {
    path: full,
    options,
  };
  cache.set(full, [
    out,
    mtime,
  ]);
  return out;
}

/** `require` без кеша модуля: в watch файл правят, и правка должна быть видна. */
function freshRequire(path: string): { default?: Record<string, unknown> } & Record<string, unknown> {
  delete requireConfig.cache[requireConfig.resolve(path)];
  return requireConfig(path);
}

/** Значение ключа другого инструмента проверяет сам инструмент. */
const anyValue: OptionCheck = () => undefined;

function withToolKeys(schema: OptionSchema): OptionSchema {
  const out: OptionSchema = {
    ...schema,
  };
  for (const tool in TOOL_OPTION_KEYS) { // eslint-disable-line
    for (const key of TOOL_OPTION_KEYS[tool]) {
      out[key] || (out[key] = anyValue);
    }
  }
  return out;
}

/**
 * Опции инструмента из файла настроек, под ними — опции из кода.
 *
 * Из файла берутся общие опции и ключи этого инструмента; ключи других инструментов (`input` у
 * CLI, `inject` у Vite) пропускаются. Опция из кода заменяет опцию из файла целиком.
 *
 * @param options — опции из кода
 * @param tool — имя инструмента, как в сообщениях (`mnVite`, `cli`)
 * @param validate — общий набор опций всех плагинов: по нему проверяется файл
 * @param pick — опции этого инструмента: только они берутся из файла
 * @param dir — каталог проекта; по умолчанию рабочий
 * @param path — явный путь файла (CLI `--config`)
 *
 * @example
 * // minotation.config.js: module.exports = { attrs: 'className:class', metrics: false };
 * withConfigFile({ metrics: true }, 'mnVite', BUILD_OPTIONS_SCHEMA, BUILD_OPTIONS_SCHEMA);
 * // => { attrs: 'className:class', metrics: true }
 */
export function withConfigFile<T extends object>(
  options: T, tool: string, validate: OptionSchema, pick: OptionSchema, dir?: string, path?: string,
): T {
  const loaded = loadConfigFile(
    validate, dir, path,
  );
  if (!loaded) {
    return options;
  }
  const own = TOOL_OPTION_KEYS[tool] || [];
  const picked: Record<string, unknown> = {};
  for (const key in loaded.options) { // eslint-disable-line
    (pick[key] || own.indexOf(key) > -1) && (picked[key] = loaded.options[key]);
  }
  return {
    ...picked,
    ...options,
  } as T;
}

/** Сбрасывает кеш файлов настроек — для тестов и watch. */
export function clearConfigFileCache(): void {
  cache.clear();
}
