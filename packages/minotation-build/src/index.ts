/**
 * Общий каркас плагинов сборщиков: накопитель токенов и обход файлов.
 *
 * Сканер уже был общим (`createScanner`), но всё остальное продолжало
 * дублироваться между `minotation-vite`, `-rollup`, `-esbuild`, `-webpack`:
 * учёт токенов по файлам, снятие файла с учёта, создание mn-инстанса,
 * применение пресетов, генерация CSS, кеш и проброс предупреждений. Три
 * реализации `walkFiles` совпадали побайтово.
 *
 * Цена дублирования известна по опыту: механизм, доработанный в одном плагине,
 * в остальных молча отсутствует (`classVarSuffixes` жил только в vite до
 * 2026-09-25), а баг, исправленный в одном, остаётся в четырёх.
 *
 * Отдельный пакет, а не подпуть ядра: здесь `node:fs`, а `minotation` работает
 * и в браузере — тащить туда файловую систему нельзя. Подпуть (`minotation/build`)
 * пробовался первым и уперся в инструменты: ts-jest подменяет `module` на
 * CommonJS, связка с `moduleResolution: Node16` распадается, TS откатывается на
 * классический резолвер и полей `exports` не читает. Обычный пакет резолвится
 * везде одинаково и не требует настроек в каждом потребителе.
 *
 * @module minotation-build
 */
import {
  readdirSync, statSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  createScanner, minotationProvider,
} from 'minotation';
import type {
  MnInstance, MnOptions, MnWarning, ScannerOptions,
} from 'minotation';

/** Пресет — функция, донастраивающая mn-инстанс. */
export type MnPreset = (mn: MnInstance) => void;

/**
 * Какие атрибуты сканировать и во что разворачивать их селекторы (D-025, как в v1).
 *
 * Ключ — атрибут в разметке, значение — атрибут, в который компилируется селектор:
 * `class` → `.ws`, любой другой → `[name~="ws"]`. Имя без `:` разворачивается в себя.
 *
 * - строка: `'class, className:class'` (разделители — пробел, `|`, `,`, `;`);
 * - массив: `['class', 'className:class']`;
 * - объект: `{ class: 'class', className: 'class' }`.
 *
 * `attrs: ['class', 'className']` даёт `.ws` и `[className~="ws"]` — чтобы React-
 * `className` давал классы, его нужно развернуть в `class`: `'className:class'`.
 */
export type MnAttrs = string | string[] | Record<string, string>;

const REGEXP_ATTRS_SPLIT = /[\s|,;]+/;

/**
 * Разбирает {@link MnAttrs} в карту «сканируемый атрибут → целевой».
 *
 * @param attrs — опция `attrs`; пусто — `{ class: 'class' }`
 * @returns непустая карта
 * @throws если после разбора не осталось ни одного атрибута — иначе сборка
 *   молча не нашла бы ни одного токена
 *
 * @example
 * parseAttrs('class, className:class')   // → { class: 'class', className: 'class' }
 * parseAttrs(['m', 'm-n'])               // → { m: 'm', 'm-n': 'm-n' }
 */
export function parseAttrs(attrs?: MnAttrs): Record<string, string> {
  if (attrs === undefined || attrs === null) {
    return { class: 'class' };
  }
  const out: Record<string, string> = {};
  let found = 0;
  if (typeof attrs === 'string' || Array.isArray(attrs)) {
    const items = typeof attrs === 'string' ? attrs.split(REGEXP_ATTRS_SPLIT) : attrs;
    for (const item of items) {
      const at = item.indexOf(':');
      const from = (at > -1 ? item.slice(0, at) : item).trim();
      const to = (at > -1 ? item.slice(at + 1) : item).trim();
      from && to && (out[from] = to, found++);
    }
  } else {
    for (const from of Object.keys(attrs)) {
      const to = attrs[from];
      from && typeof to === 'string' && to && (out[from] = to, found++);
    }
  }
  if (!found) {
    throw new Error('[minotation] attrs is empty: ' + JSON.stringify(attrs)
      + '. Expected e.g. "class", "class, className:class" or { className: "class" }');
  }
  return out;
}

/** Опция `attr` заменена на `attrs` (D-025) — подсказка, как переписать. */
function throwRenamedAttr(attr: unknown): never {
  const names = Array.isArray(attr) ? attr : [attr];
  const hint = names.map((name) => (name === 'className' ? 'className:class' : String(name)))
    .join(', ');
  throw new Error('[minotation] option "attr" was replaced by "attrs": use attrs: \''
    + hint + '\'. A name without ":" compiles into its own attribute selector '
    + '([className~="p10"]); "className:class" makes React className produce classes.');
}

/** Сканер с разворачиванием атрибутов: записи `'<целевой атрибут> <токен>'`. */
export type AttrsScanner = (source: string, fileName?: string) => string[];

/**
 * Сканер файла по опции `attrs`: токен помечается атрибутом, в который он
 * разворачивается.
 *
 * Сканируемые атрибуты группируются по целевому, и на группу — один проход
 * обычного сканера (`attr` списком имён). Обычно цель одна (`class`), и проход
 * тоже один. Токены из переменных `*Class` и вызовов `mne`/`mnClass` — это
 * значения классов, поэтому они идут в группу `class`, а если её нет — в первую.
 *
 * Запись — `'<цель> <токен>'`: в токене пробела не бывает, так что разбор
 * однозначен, а набор записей можно класть в `Set` как обычные строки.
 *
 * @param options — опции сканера и `attrs`
 */
export function createAttrsScanner(
  options: Omit<ScannerOptions, 'attr'> & { attrs?: MnAttrs },
): AttrsScanner {
  // Конфиги часто на JS, где типов нет: забытый `attr` проигнорировался бы
  // молча, и токены из второго атрибута пропали бы без единого сообщения.
  'attr' in options && throwRenamedAttr((options as { attr?: unknown }).attr);
  const map = parseAttrs(options.attrs);
  const byTarget: Record<string, string[]> = {};
  for (const from of Object.keys(map)) {
    (byTarget[map[from]] || (byTarget[map[from]] = [])).push(from);
  }
  const targets = Object.keys(byTarget);
  const classTarget = byTarget.class ? 'class' : targets[0];
  const scanners = targets.map((target) => createScanner({
    ...options,
    attr: byTarget[target],
    // Переменные и вызовы сканируются один раз — в группе классов.
    classVarSuffixes: target === classTarget ? options.classVarSuffixes : [],
    mergeFnNames: target === classTarget ? options.mergeFnNames : [],
  }));
  const l = targets.length;
  return (source: string, fileName?: string): string[] => {
    const out: string[] = [];
    let i = 0;
    for (; i < l; i++) {
      const prefix = targets[i] + ' ';
      for (const token of scanners[i](source, fileName)) {
        out.push(prefix + token);
      }
    }
    return out;
  };
}

/**
 * Компилирует записи {@link AttrsScanner} в инстансе: каждый токен — своим
 * `getCompiler(цель)`.
 *
 * @param mn — инстанс с применёнными пресетами
 * @param entries — записи `'<цель> <токен>'`
 */
export function compileEntries(
  mn: Pick<ReturnType<typeof minotationProvider>, 'getCompiler'>, entries: Iterable<string>,
): void {
  const compilers: Record<string, (value: string) => void> = {};
  for (const entry of entries) {
    const at = entry.indexOf(' ');
    const target = entry.slice(0, at);
    (compilers[target] || (compilers[target] = mn.getCompiler(target)))(entry.slice(at + 1));
  }
}

/** Опции {@link createTokenCollector}. */
export interface TokenCollectorOptions extends Omit<ScannerOptions, 'attr'> {
  /** Какие атрибуты сканировать и во что разворачивать — {@link MnAttrs}. По умолчанию `'class'`. */
  attrs?: MnAttrs;
  /** Токены, которые нужны всегда, даже если в файлах не встретились; компилируются как классы. */
  safelist?: string[];
  /** Статические пресеты; их набор задаёт потребитель. */
  presets?: MnPreset[];
  /**
   * Опции mn-инстанса.
   *
   * `onWarning` здесь особый: предупреждения перехватываются всегда, потому
   * что ядро по умолчанию пишет в `console`, а у сборщика свой канал вывода.
   * Явный `'silent'` уважается — тогда не копим и не отдаём; своя функция
   * вызывается как есть, дополнительно к накоплению.
   */
  mn?: MnOptions;
}

/** Накопитель токенов одной сборки. */
export interface TokenCollector {
  /**
   * Учитывает токены файла. Набор файла ЗАМЕНЯЕТСЯ целиком, а не дополняется:
   * иначе токен, убранный при редактировании, оставался бы в CSS до перезапуска.
   *
   * @returns изменился ли набор токенов — по этому признаку решают, нужна ли
   *   пересборка CSS
   */
  add(id: string, source: string): boolean;
  /**
   * То же, что {@link TokenCollector.add}, но записи уже готовы — в формате
   * {@link AttrsScanner} (`'<цель> <токен>'`).
   *
   * Нужен там, где сканирует не сам каркас: в webpack файл читает лоадер, а
   * CSS собирает плагин — между ними только общий стейт.
   */
  set(id: string, tokens: Iterable<string>): boolean;
  /** Снимает файл с учёта (удалён, перестал подходить под фильтр). */
  remove(id: string): boolean;
  /** Регистрирует динамический пресет из файла (`*.mn.ts`). */
  setPreset(id: string, preset: MnPreset): void;
  /** Снимает пресет с учёта. */
  removePreset(id: string): boolean;
  /** Есть ли у файла учтённые токены. */
  has(id: string): boolean;
  /**
   * Готовый CSS из всех учтённых токенов и пресетов.
   *
   * Результат кешируется по слепку набора: повторный вызов без изменений
   * ничего не пересчитывает. Сборщики зовут это на каждый цикл, а компиляция
   * всего набора — самая дорогая часть плагина.
   */
  css(): string;
  /**
   * Предупреждения последней компиляции; вызов их забирает и очищает очередь.
   * Пустой массив при `onWarning: 'silent'`.
   */
  takeWarnings(): MnWarning[];
  /** Забывает всё: и токены, и пресеты. Нужен на старте пересборки. */
  clear(): void;
}

/**
 * Создаёт накопитель токенов для плагина сборщика.
 *
 * @example
 * const collector = createTokenCollector({ attr: 'class' });
 * collector.add(id, source);        // → изменился ли набор
 * collector.remove(id);
 * const css = collector.css();      // готовый CSS, с кешем
 * for (const w of collector.takeWarnings()) ctx.warn(w.message);
 */
export function createTokenCollector(options: TokenCollectorOptions): TokenCollector {
  const scan = createAttrsScanner(options);
  const safelist = (options.safelist || []).map((token) => 'class ' + token);
  const presets = options.presets;
  const userOnWarning = options.mn && options.mn.onWarning;
  const silent = userOnWarning === 'silent';
  /** Токены по файлам — ключ по файлу и снимает файл с учёта, и заменяет набор. */
  const byFile = new Map<string, Set<string>>();
  /** Динамические пресеты из файлов, по пути. */
  const dynamic = new Map<string, MnPreset>();
  let warnings: MnWarning[] = [];
  /** Слепок набора, на котором собран `cachedCss`; пустая строка — кеша нет. */
  let cacheKey = '';
  let cachedCss = '';

  function add(id: string, source: string): boolean {
    return set(id, scan(source, id));
  }

  function set(id: string, tokens: Iterable<string>): boolean {
    const next = new Set<string>(tokens);
    if (!next.size) {
      return remove(id);
    }
    const previous = byFile.get(id);
    if (previous && sameTokens(previous, next)) {
      return false;
    }
    byFile.set(id, next);
    cacheKey = '';
    return true;
  }

  function remove(id: string): boolean {
    if (!byFile.delete(id)) {
      return false;
    }
    cacheKey = '';
    return true;
  }

  function collect(): string[] {
    const all = new Set<string>(safelist);
    for (const tokens of byFile.values()) {
      for (const token of tokens) {
        all.add(token);
      }
    }
    // Порядок фиксирован: иначе слепок набора менялся бы от перестановки, и
    // кеш не срабатывал бы там, где ничего не изменилось.
    return Array.from(all).sort();
  }

  return {
    add,
    set,
    remove,
    has(id: string): boolean {
      return byFile.has(id);
    },
    setPreset(id: string, preset: MnPreset): void {
      dynamic.set(id, preset);
      cacheKey = '';
    },
    removePreset(id: string): boolean {
      if (!dynamic.delete(id)) {
        return false;
      }
      cacheKey = '';
      return true;
    },
    clear(): void {
      byFile.clear();
      dynamic.clear();
      cacheKey = '';
    },
    takeWarnings(): MnWarning[] {
      const out = warnings;
      warnings = [];
      return out;
    },
    css(): string {
      const tokens = collect();
      // В слепок входят и пресеты: их набор меняет CSS не меньше токенов.
      const key = tokens.join(' ') + '\u0000' + Array.from(dynamic.keys()).join(' ');
      if (key === cacheKey) {
        return cachedCss;
      }
      const collected: MnWarning[] = [];
      const mn = minotationProvider({
        ...options.mn,
        // Перехватываем всегда: ядро по умолчанию пишет в console, а у
        // сборщика свой канал вывода — иначе предупреждение либо теряется в
        // потоке сборки, либо дублируется.
        onWarning: (warning: MnWarning) => {
          silent || collected.push(warning);
          typeof userOnWarning === 'function' && userOnWarning(warning);
        },
      });
      presets && mn.setPresets(presets.concat(Array.from(dynamic.values())));
      presets || mn.setPresets(Array.from(dynamic.values()));
      // Каждый токен — в свой целевой атрибут (D-025). До 2026-10-05 всё шло
      // в `class`, и `m="p10"` давал `.p10` вместо `[m~="p10"]` — так в v2
      // потерялась опция `attrs` из v1.
      compileEntries(mn, tokens);
      mn.compile();
      warnings = collected;
      cachedCss = mn.styles$.getValue()
        .map((s: { content: string }) => s.content)
        .join('\n');
      cacheKey = key;
      return cachedCss;
    },
  };
}

/** Одинаковы ли наборы токенов — чтобы не считать пересборку нужной зря. */
function sameTokens(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const token of a) {
    if (!b.has(token)) {
      return false;
    }
  }
  return true;
}

/** Что не обходится никогда: скрытые директории и зависимости. */
function skipDir(name: string): boolean {
  return name.charCodeAt(0) === 46 || name === 'node_modules';
}

/**
 * Рекурсивно обходит директорию и возвращает файлы с заданными расширениями.
 *
 * Нечитаемые пути пропускаются молча: битый симлинк или каталог без прав —
 * не повод ронять сборку, а сказать о них внятнее может только тот, кто их
 * создал.
 *
 * @param dir — корневая директория
 * @param extensions — расширения (`.tsx`, `.html`, …)
 * @param maxDepth — предел рекурсии; защита от циклических симлинков
 */
export function walkFiles(
  dir: string, extensions: string[], maxDepth = 10,
): string[] {
  const out: string[] = [];
  walkInto(
    dir, extensions, maxDepth, out,
  );
  return out;
}

function walkInto(
  dir: string, extensions: string[], maxDepth: number, out: string[],
): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  const l = names.length;
  const el = extensions.length;
  let i = 0;
  let j: number;
  let name: string;
  let full: string;
  let directory: boolean;
  for (; i < l; i++) {
    name = names[i];
    if (skipDir(name)) {
      continue;
    }
    full = join(dir, name);
    try {
      directory = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (directory) {
      maxDepth > 0 && walkInto(
        full, extensions, maxDepth - 1, out,
      );
      continue;
    }
    for (j = 0; j < el; j++) {
      if (name.endsWith(extensions[j])) {
        out.push(full);
        break;
      }
    }
  }
}
