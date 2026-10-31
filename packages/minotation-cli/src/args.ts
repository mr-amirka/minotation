const DOUBLE_QUOTE = '"';

/**
 * Разбор аргументов командной строки.
 *
 * Своими руками, а не `commander`: у CLI должно быть как можно меньше
 * зависимостей — его ставят одной командой ради одной задачи (скомпилировать
 * CSS без сборщика), и тянуть за собой дерево пакетов незачем. Набор опций
 * здесь маленький и стабильный, разбор умещается в сотню строк.
 *
 * @module args
 */

/**
 * Разобранные аргументы командной строки.
 *
 * Поля, у которых есть значение по умолчанию (путь, вывод, атрибут),
 * необязательны и остаются `undefined`, если опция не указана: иначе
 * «умолчание» перекрывало бы то же поле из конфига, и конфиг молча не работал
 * бы. Сами умолчания подставляет {@link mergeSettings}.
 */
export interface CliArgs {
  /** Изоляция областей пакетов: `none`, `class`, `where` (D-075). */
  isolateMode?: 'none' | 'class' | 'where';
  /** Класс задан из JS в файле изолированной области: `warn`, `silent`, `strict` (D-076). */
  unreachableClassMode?: 'warn' | 'silent' | 'strict';
  /** Каталог для исходников с классом области (D-079). */
  isolateOut?: string;
  /** Шаблон неизменённых файлов для копирования в `isolateOut` (glob или путь, D-081). */
  isolateCopy?: string;
  /** Не копировать неизменённые файлы в `isolateOut`. */
  noIsolateCopy?: boolean;
  /** Что сканировать: путь к файлу или директории. */
  input?: string;
  /** Куда писать CSS. */
  output?: string;
  /** Следить за изменениями и пересобирать. */
  watch: boolean;
  /** Путь к файлу конфигурации. */
  config?: string;
  /** Какие атрибуты сканировать и во что разворачивать (`class, className:class`). */
  attrs?: string;
  /** Запасное непрозрачное объявление рядом с `rgba`. */
  altColor: boolean;
  /** Что делать с предупреждением: `log`, `silent`, `error` (D-035). */
  warningMode?: 'log' | 'silent' | 'error';
  /** Что делать с накруткой специфичности `**N`: `warn`, `silent`, `strict` (D-039). */
  specificityMode?: 'warn' | 'silent' | 'strict';
  /** Что делать с `!important` (`-i`): `warn`, `silent`, `strict` (D-039). */
  importantMode?: 'warn' | 'silent' | 'strict';
  /** Что делать с дочерними селекторами `>`: `warn`, `silent`, `strict` (D-041). */
  childSelectorMode?: 'warn' | 'silent' | 'strict';
  /** Неизвестное имя медиа (`p10@zz`): `warn`, `silent`, `strict` (D-058). */
  unknownMediaMode?: 'warn' | 'silent' | 'strict';
  /** Класс другой CSS-системы (`fw-bold`): `warn`, `silent`, `strict` (D-065). */
  suspectClassMode?: 'warn' | 'silent' | 'strict';
  /** Одно имя от двух пресетов: `warn`, `silent`, `strict` (D-067). */
  handlerConflictMode?: 'warn' | 'silent' | 'strict';
  /** Пресеты несовместимых экосистем: `warn`, `silent`, `strict` (D-067). */
  presetConflictMode?: 'warn' | 'silent' | 'strict';
  /** Группа скобок даёт битый CSS (`cF:is(.a|.b)`): `warn`, `silent`, `strict` (D-077). */
  groupSuspectMode?: 'warn' | 'silent' | 'strict';
  /** Скобки: `groups` — группы вариантов, `css` — скобки как в CSS (D-077). */
  groupMode?: 'groups' | 'css';
  /** Режим синтаксиса нотации: `context-qualified`, `tw4-compatible` (D-045). */
  notationMode?: 'context-qualified' | 'tw4-compatible' | 'breakpoint-prefixed' | 'property-value';
  /** Конфликт режимов синтаксиса между файлами: `warn`, `strict` (D-045). */
  notationConflictMode?: 'warn' | 'strict';
  /** Контекст селектора в `:where()` (D-049). */
  contextWhere: boolean;
  /** Вложенные `@media` вместо `and` (D-070). */
  mediaNesting: boolean;
  /** Не разбирать JS/TS парсером — только текстовый поиск. */
  noSyntax: boolean;
  /** Пропускать файлы-партиалы `_*` (D-027). */
  skipPartials: boolean;
  /** Не писать `mn-manifest.json` рядом с CSS. */
  noManifest: boolean;
  /** Не писать статистику употребления токенов. */
  noMetrics: boolean;
  /** Куда писать статистику употребления токенов. */
  metrics?: string;
  /** Какие файлы сканировать — регулярное выражение по имени. */
  include?: string;
  /** Какие пропускать — регулярное выражение по пути. */
  exclude?: string;
  /** Показать справку и выйти. */
  help: boolean;
  /** Показать версию и выйти. */
  version: boolean;
  /**
   * Опции присваиваются по имени, вычисленному из таблиц {@link FLAGS} и
   * {@link OPTIONS}, — отсюда индексная сигнатура. Без неё каждое присваивание
   * требовало бы приведения к `Record<string, unknown>`, то есть отключало бы
   * проверку заодно и у известных полей.
   */
  [key: string]: string | boolean | undefined;
}

/** Значения по умолчанию. */
const DEFAULTS: CliArgs = {
  watch: false,
  altColor: false,
  noSyntax: false,
  skipPartials: false,
  noManifest: false,
  noMetrics: false,
  contextWhere: false,
  mediaNesting: false,
  help: false,
  version: false,
};

/** Опции без значения. */
const FLAGS: Record<string, keyof CliArgs> = {
  '--context-where': 'contextWhere',
  '--media-nesting': 'mediaNesting',
  '-w': 'watch',
  '--watch': 'watch',
  '--alt-color': 'altColor',
  '--no-syntax': 'noSyntax',
  '--skip-partials': 'skipPartials',
  '--no-manifest': 'noManifest',
  '--no-metrics': 'noMetrics',
  '--no-isolate-copy': 'noIsolateCopy',
  '-h': 'help',
  '--help': 'help',
  '-v': 'version',
  '--version': 'version',
};

/** Опции со значением следующим аргументом. */
const OPTIONS: Record<string, keyof CliArgs> = {
  '-o': 'output',
  '--output': 'output',
  '-c': 'config',
  '--config': 'config',
  '-a': 'attrs',
  '--attrs': 'attrs',
  '-m': 'metrics',
  '--metrics': 'metrics',
  '--warning-mode': 'warningMode',
  '--isolate-mode': 'isolateMode',
  '--unreachable-class-mode': 'unreachableClassMode',
  '--isolate-out': 'isolateOut',
  '--isolate-copy': 'isolateCopy',
  '--specificity-mode': 'specificityMode',
  '--important-mode': 'importantMode',
  '--child-selector-mode': 'childSelectorMode',
  '--unknown-media-mode': 'unknownMediaMode',
  '--suspect-class-mode': 'suspectClassMode',
  '--handler-conflict-mode': 'handlerConflictMode',
  '--preset-conflict-mode': 'presetConflictMode',
  '--group-suspect-mode': 'groupSuspectMode',
  '--group-mode': 'groupMode',
  '--notation-mode': 'notationMode',
  '--notation-conflict-mode': 'notationConflictMode',
  '--include': 'include',
  '--exclude': 'exclude',
};

/**
 * Разбирает `process.argv.slice(2)`.
 *
 * Путь ко входу можно передать и позиционно (`mn ./src`), и опцией
 * (`mn --compile ./src`) — вторая форма перенесена из v1, где она была
 * единственной.
 *
 * @throws {Error} если у опции нет значения или она неизвестна
 */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    ...DEFAULTS,
  };
  const l = argv.length;
  let i = 0;
  let arg: string;
  let flag: keyof CliArgs | undefined;
  let option: keyof CliArgs | undefined;
  let positional = 0;
  for (; i < l; i++) {
    arg = argv[i];
    if ((flag = FLAGS[arg])) {
      args[flag] = true;
      continue;
    }
    // `--compile` из v1 — синоним позиционного пути.
    if (arg === '-C' || arg === '--compile') {
      option = 'input';
    } else {
      option = OPTIONS[arg];
    }
    if (option) {
      i + 1 < l || raise('Option "' + arg + '" requires a value');
      args[option] = argv[++i];
      continue;
    }
    arg[0] === '-' && raise('Unknown option: "' + arg + DOUBLE_QUOTE);
    positional++ && raise('Path given twice: "' + args.input + '" and "' + arg + DOUBLE_QUOTE);
    args.input = arg;
  }
  args.isolateMode === undefined || args.isolateMode === 'none' || args.isolateMode === 'class'
    || args.isolateMode === 'where'
    || raise('Option "--isolate-mode" expects none, class or where, got "' + args.isolateMode + DOUBLE_QUOTE);
  args.unreachableClassMode === undefined || RAISE_MODES[args.unreachableClassMode]
    || raise('Option "--unreachable-class-mode" expects warn, silent or strict, got "' + args.unreachableClassMode + DOUBLE_QUOTE);
  args.warningMode === undefined || WARNING_MODES[args.warningMode]
    || raise('Option "--warning-mode" expects log, silent or error, got "' + args.warningMode + DOUBLE_QUOTE);
  args.specificityMode === undefined || RAISE_MODES[args.specificityMode]
    || raise('Option "--specificity-mode" expects warn, silent or strict, got "' + args.specificityMode + DOUBLE_QUOTE);
  args.importantMode === undefined || RAISE_MODES[args.importantMode]
    || raise('Option "--important-mode" expects warn, silent or strict, got "' + args.importantMode + DOUBLE_QUOTE);
  args.childSelectorMode === undefined || RAISE_MODES[args.childSelectorMode]
    || raise('Option "--child-selector-mode" expects warn, silent or strict, got "' + args.childSelectorMode + DOUBLE_QUOTE);
  args.unknownMediaMode === undefined || RAISE_MODES[args.unknownMediaMode]
    || raise('Option "--unknown-media-mode" expects warn, silent or strict, got "' + args.unknownMediaMode + DOUBLE_QUOTE);
  args.suspectClassMode === undefined || RAISE_MODES[args.suspectClassMode]
    || raise('Option "--suspect-class-mode" expects warn, silent or strict, got "' + args.suspectClassMode + DOUBLE_QUOTE);
  args.handlerConflictMode === undefined || RAISE_MODES[args.handlerConflictMode]
    || raise('Option "--handler-conflict-mode" expects warn, silent or strict, got "' + args.handlerConflictMode + DOUBLE_QUOTE);
  args.presetConflictMode === undefined || RAISE_MODES[args.presetConflictMode]
    || raise('Option "--preset-conflict-mode" expects warn, silent or strict, got "' + args.presetConflictMode + DOUBLE_QUOTE);
  args.groupSuspectMode === undefined || RAISE_MODES[args.groupSuspectMode]
    || raise('Option "--group-suspect-mode" expects warn, silent or strict, got "' + args.groupSuspectMode + DOUBLE_QUOTE);
  args.groupMode === undefined || args.groupMode === 'groups' || args.groupMode === 'css'
    || raise('Option "--group-mode" expects groups or css, got "' + args.groupMode + DOUBLE_QUOTE);
  args.notationMode === undefined || NOTATION_MODES[args.notationMode]
    || raise('Option "--notation-mode" expects context-qualified, tw4-compatible, breakpoint-prefixed or property-value, got "'
      + args.notationMode + DOUBLE_QUOTE);
  args.notationConflictMode === undefined || args.notationConflictMode === 'warn' || args.notationConflictMode === 'strict'
    || raise('Option "--notation-conflict-mode" expects warn or strict, got "' + args.notationConflictMode + DOUBLE_QUOTE);
  return args;
}

/** Допустимые значения `--warning-mode`. */
const WARNING_MODES: Record<string, 1> = {
  log: 1,
  silent: 1,
  error: 1,
};

/** Допустимые значения `--notation-mode` (D-045). */
const NOTATION_MODES: Record<string, 1> = {
  'context-qualified': 1,
  'tw4-compatible': 1,
  'breakpoint-prefixed': 1,
  'property-value': 1,
};

/** Допустимые значения `--specificity-mode` и `--important-mode` (D-039). */
const RAISE_MODES: Record<string, 1> = {
  warn: 1,
  silent: 1,
  strict: 1,
};

function raise(message: string): never {
  throw new Error(message);
}

/** Текст справки — он же документация по опциям. */
export const HELP = `
Usage: mn [path] [options]

  Builds CSS from Minimalist Notation tokens found in files.
  The default path is the current directory.
  Presets come from the config file only: no preset is connected by default.

Options:
  -o, --output <file>    where to write CSS (default ./mn.css);
                         [name] = entry name, [hash] = content hash
  -w, --watch            watch for changes and rebuild
  -c, --config <file>    config file (default ./minotation.config.{js,cjs,mjs,json})
  -a, --attrs <list>     attributes to scan and their target, as in v1:
                         "class, className:class" (default class)
      --alt-color        opaque fallback declaration next to rgba
      --warning-mode <m> warnings: log (default), silent, error (fail the build)
      --specificity-mode <m>
                         tokens raising specificity (f10**2): warn (default),
                         silent, strict (no CSS, fail the build)
      --important-mode <m>
                         !important tokens (f10-i): warn (default), silent, strict
      --child-selector-mode <m>
                         child selector tokens (cF00>1): warn (default), silent, strict
      --unknown-media-mode <m>
                         unknown media names (p10@zz): warn (default), silent, strict
      --suspect-class-mode <m>
                         classes of other CSS frameworks (fw-bold): warn (default),
                         silent, strict
      --handler-conflict-mode <m>
                         one name registered by two presets: warn (default), silent, strict
      --preset-conflict-mode <m>
                         presets of incompatible ecosystems: warn (default), silent, strict
      --group-suspect-mode <m>
                         parentheses that give broken CSS (cF:is(.a|.b)): warn (default),
                         silent, strict
      --group-mode <m>   parentheses: groups (default, (a|b) variant groups) or css
                         (plain CSS parentheses, no groups)
      --context-where    wrap selector context in :where() (Tailwind v4 specificity)
      --media-nesting    nested @media instead of "and" (Tailwind v4 output)
      --notation-mode <m>
                         notation syntax: context-qualified (default, bg-blue-500:hover@md)
                         or tw4-compatible (Tailwind-like, md:hover:bg-blue-500)
                         or breakpoint-prefixed (quantum-css-like, SM_px15)
                         or property-value (Master CSS-like, bg:blue:hover@md)
      --notation-conflict-mode <m>
                         a class meaning different things in files with different
                         notation modes: warn (default) or strict (fail the build)
      --no-syntax        do not parse JS/TS, text search only
      --skip-partials    skip partial files whose name starts with _
      --no-manifest      do not write mn-manifest.json next to the CSS
      --no-metrics       do not write token usage statistics
      --isolate-mode <m> isolate package scopes: none (default), class (.p-4._l),
                         where (.p-4:where(._l)) — the scope class goes into their markup
      --isolate-out <dir>
                         write the sources with the scope class there (the input tree is
                         mirrored; originals are not touched)
      --isolate-copy <glob>
                         copy only matching unmodified files to --isolate-out (default: all)
      --no-isolate-copy  copy only modified files to --isolate-out
      --unreachable-class-mode <m>
                         class set from JS in an isolated file: warn (default), silent, strict
  -m, --metrics <file>   where to write token usage statistics
                         (default mn-metrics.json next to the CSS)
      --include <regexp> which files to scan
      --exclude <regexp> which files to skip
  -v, --version          version
  -h, --help             this help

Examples:
  mn ./src -o ./dist/app.css
  mn ./src --watch
  mn ./templates --attrs "class, className:class" --alt-color
`.trim();
