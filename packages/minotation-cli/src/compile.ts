/**
 * Сбор токенов из файлов и компиляция в CSS.
 *
 * Сканирование берётся из ядра (`scanTokens`), а не пишется здесь заново: свой
 * разбор в плагине уже приводил к тому, что возможность работала в одном
 * сборщике и молча отсутствовала в остальных (`classVarSuffixes` был только в
 * vite до 2026-09-25).
 *
 * @module compile
 */
import {
  readdirSync, readFileSync, statSync,
} from 'node:fs';
import {
  join, extname, resolve,
} from 'node:path';
import {
  minotationProvider,
  scanTokens,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type {
  MnInstance, MnOptions, MnWarning,
} from 'minotation';

/** Расширения, которые сканируются, если не задано иное. */
const DEFAULT_EXTENSIONS = [
  '.html',
  '.htm',
  '.php',
  '.vue',
  '.svelte',
  '.astro',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
];

/** Что не сканируется никогда. */
const DEFAULT_EXCLUDE = /[\\/](?:node_modules|\.git|dist|build)[\\/]/;

/** Настройки сборки — то, что CLI собирает из аргументов и конфига. */
export interface CompileSettings {
  /** Файл или директория для сканирования. */
  input: string;
  /** Атрибут с токенами. */
  attr?: string;
  /** Префикс селекторов. */
  prefix?: string;
  /** Запасное непрозрачное объявление рядом с `rgba`. */
  altColor?: boolean;
  /** Прерывать работу на первом битом токене. */
  strict?: boolean;
  /** Регулярное выражение: какие файлы брать. */
  include?: RegExp;
  /** Регулярное выражение: какие пропускать. */
  exclude?: RegExp;
  /**
   * Пути, которые не сканируются, как бы ни были настроены фильтры.
   *
   * Сюда попадает файл конфигурации: он лежит в корне проекта, подходит под
   * расширение `.js` и иначе сканировался бы как исходник.
   */
  ignore?: string[];
  /** Пресеты; по умолчанию стандартный набор. */
  presets?: Array<(mn: MnInstance) => void>;
  /** Токены, которые нужны всегда, даже если их нет в файлах. */
  safelist?: string[];
  /** Остальные опции ядра. */
  mn?: MnOptions;
}

/** Результат сборки. */
export interface CompileResult {
  /** Готовый CSS. */
  css: string;
  /** Сколько файлов просканировано. */
  files: number;
  /** Сколько уникальных токенов найдено. */
  tokens: number;
  /** Предупреждения ядра. */
  warnings: MnWarning[];
}

/**
 * Рекурсивно обходит путь и возвращает файлы, подходящие под фильтры.
 *
 * Одиночный файл тоже принимается: `mn ./index.html` — рабочий случай, и
 * заставлять указывать директорию ради одного файла незачем.
 */
export function collectFiles(
  input: string, include?: RegExp, exclude?: RegExp, ignore?: string[],
): string[] {
  const out: string[] = [];
  const skip = exclude || DEFAULT_EXCLUDE;
  const ignored = new Set<string>();
  const l = ignore ? ignore.length : 0;
  let i = 0;
  for (; i < l; i++) {
    ignored.add(resolve(ignore![i]));
  }
  walk(
    input, out, include, skip, ignored, 1,
  );
  return out;
}

/**
 * @param root — `1` для пути, указанного пользователем. Такой файл берётся без
 *   фильтра по расширению: автор уже выбрал его сам, и `mn ./page.tmpl` должен
 *   работать. Фильтр нужен только при обходе директории.
 */
function walk(
  path: string,
  out: string[],
  include: RegExp | undefined,
  exclude: RegExp,
  ignored: Set<string>,
  root?: 1,
): void {
  if (exclude.test(path) || ignored.has(resolve(path))) {
    return;
  }
  const stat = statSync(path, {
    throwIfNoEntry: false,
  });
  if (!stat) {
    return;
  }
  if (stat.isFile()) {
    (root || accepted(path, include)) && out.push(path);
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  const names = readdirSync(path);
  const l = names.length;
  let i = 0;
  for (; i < l; i++) {
    walk(
      join(path, names[i]), out, include, exclude, ignored,
    );
  }
}

function accepted(path: string, include?: RegExp): boolean {
  return include
    ? include.test(path)
    : DEFAULT_EXTENSIONS.indexOf(extname(path)) > -1;
}

/**
 * Собирает CSS из файлов по указанному пути.
 *
 * Предупреждения ядра собираются и возвращаются, а не печатаются: решение,
 * что с ними делать (вывести, посчитать, уронить сборку), принимает
 * вызывающий — у CLI это зависит от `--strict`.
 */
export function compile(settings: CompileSettings): CompileResult {
  const files = collectFiles(
    settings.input, settings.include, settings.exclude, settings.ignore,
  );
  const scanOptions = {
    attr: settings.attr || 'class',
  };
  const tokens = new Set<string>(settings.safelist || []);
  const l = files.length;
  let i = 0;
  let found: string[];
  let j: number;
  let n: number;
  for (; i < l; i++) {
    found = scanTokens(readFileSync(files[i], 'utf8'), scanOptions);
    n = found.length;
    for (j = 0; j < n; j++) {
      tokens.add(found[j]);
    }
  }
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    ...settings.mn,
    selectorPrefix: settings.prefix,
    altColor: settings.altColor,
    strict: settings.strict,
    onWarning: (warning: MnWarning) => {
      warnings.push(warning);
    },
  });
  mn.setPresets(settings.presets || [
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetNormalize,
    presetMain,
  ]);
  // Все токены компилируются как class-селекторы независимо от того, из какого
  // атрибута извлечены: это одно и то же DOM-свойство, разница только в
  // синтаксисе разметки.
  const compileToken = mn.getCompiler('class');
  for (const token of tokens) {
    compileToken(token);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n'),
    files: l,
    tokens: tokens.size,
    warnings,
  };
}
