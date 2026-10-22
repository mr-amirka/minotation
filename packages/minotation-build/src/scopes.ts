/**
 * Правила областей со стороны потребителя — опция `scopes` (D-080…D-082): что принять для пакета
 * или пути, которые сами ничего не объявили.
 *
 * Собственная декларация пакета или файла важнее правила: правило только заполняет пробелы
 * (D-082). Исключение — аварийный `override: true`: правило перекрывает декларацию.
 *
 * Холодный путь: правила компилируются один раз на накопитель, проверка — один раз на файл.
 */
import {
  relative,
  sep,
} from 'node:path';
import {
  checkOptions,
  isBoolean,
} from 'minotation';
import type {
  MnNotationMode,
  OptionCheck,
  OptionSchema,
} from 'minotation';
import {
  DIRECTIVE_KEYS,
  DIRECTIVE_SCHEMA,
  STRICTNESS_KEYS,
  readPackageName,
} from './directives';
import type {
  MnNotationDirective,
} from './directives';

const SLASH = '/';
const ASTERISK = '*';

/** Чему соответствует правило: имя пакета, путь или шаблон пути, RegExp — или массив из них. */
export type MnScopeMatch = string | RegExp | Array<string | RegExp>;

/**
 * Правило области: `match` и настройки для подошедших файлов.
 *
 * @example
 * scopes: [
 *   { match: '@acme/ui', requires: ['presetTw4'], notationMode: 'tw4-compatible' },
 *   { match: 'src/legacy/**', notationMode: 'tw4-compatible' },
 *   { match: /\.tw\.tsx$/, notationMode: 'tw4-compatible' },
 * ]
 */
export interface MnScopeRule extends Omit<MnNotationDirective, 'notationMode' | 'requires' | 'groupMode' | 'contextWhere'> {
  /**
   * Имя пакета (`'@acme/ui'` — по полю `"name"` ближайшего `package.json`), путь или шаблон пути
   * от рабочего каталога (`'./src/legacy'`, `'src/**\/*.tw.tsx'`), RegExp по абсолютному пути
   * (`/\.tw\.tsx$/`) — или массив из них. Подходит первое правило по порядку.
   */
  match: MnScopeMatch;
  /**
   * Аварийно перекрыть собственную декларацию пакета или файла (D-082). Нарушает согласованность
   * пакета: его классы будут разобраны не так, как задумал автор.
   */
  override?: boolean;
  /** Пресеты, без которых классы не работают (семейство, D-076). */
  requires?: string[];
  /** Режим синтаксиса классов. */
  notationMode?: MnNotationMode;
  /** Круглые скобки: группы вариантов или CSS (D-077). */
  groupMode?: 'groups' | 'css';
  /** Контекст селектора в `:where()` (D-049). */
  contextWhere?: boolean;
}

const isScopeMatch: OptionCheck = (value) => {
  const items = Array.isArray(value) ? value : [value];
  return items.length && items.every((item) => typeof item === 'string' && item || item instanceof RegExp)
    ? undefined : 'a package name, a path pattern, a RegExp or an array of them';
};

const RULE_SCHEMA: OptionSchema = {
  ...DIRECTIVE_SCHEMA,
  match: isScopeMatch,
  override: isBoolean,
};

/** Проверка опции `scopes` (D-038): массив правил, у каждого — `match`. */
export const isScopeRules: OptionCheck = (
  value, where, path,
) => {
  if (!Array.isArray(value)) {
    return 'an array of scope rules';
  }
  value.forEach((rule, index) => {
    const at = path + '[' + index + ']';
    if (Object.prototype.toString.call(rule) !== '[object Object]') {
      throw new Error('[minotation] ' + where + ': option "' + at + '" expects an object with "match"');
    }
    checkOptions(
      rule, RULE_SCHEMA, where, at,
    );
    (rule as MnScopeRule).match === undefined
      && fail(where + ': option "' + at + '" needs "match" — a package name, a path pattern or a RegExp');
  });
  return undefined;
};

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

/** Строка — шаблон или путь, а не имя пакета: есть `* ? {`, или начинается с `.`/`/`. */
function isPathPattern(value: string): boolean {
  return /[*?{]/.test(value) || value[0] === '.' || value[0] === SLASH;
}

/**
 * Шаблон пути → RegExp по пути от корня: `**` — любые каталоги, `*` — любое имя без `/`, `?` —
 * один символ, `{a,b}` — варианты. Путь без шаблона — он сам или всё под ним.
 */
export function globToRegExp(pattern: string): RegExp {
  const source = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  if (!/[*?{]/.test(source)) {
    return new RegExp('^' + escape(source) + '(?:/.*)?$');
  }
  const l = source.length;
  let out = '';
  let i = 0;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === ASTERISK && source[i + 1] === ASTERISK) {
      // `**/` — ноль и больше каталогов; `**` в конце — что угодно.
      const anyDirectories = source[i + 2] === SLASH;
      out += anyDirectories ? '(?:.*/)?' : '.*';
      i += anyDirectories ? 2 : 1;
    } else if (ch === ASTERISK) {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else if (ch === '{') {
      out += '(?:';
    } else if (ch === '}') {
      out += ')';
    } else if (ch === ',') {
      out += '|';
    } else {
      out += escape(ch);
    }
  }
  return new RegExp('^' + out + '$');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Одна часть `match` → проверка файла. */
function partMatcher(part: string | RegExp, root: string): (id: string) => boolean {
  if (part instanceof RegExp) {
    return (id) => {
      // `g`/`y` двигают `lastIndex` — без сброса второй файл проверялся бы не с начала.
      part.lastIndex = 0;
      return part.test(id);
    };
  }
  if (isPathPattern(part)) {
    const pattern = globToRegExp(part);
    return (id) => pattern.test(relative(root, id).split(sep).join(SLASH));
  }
  return (id) => readPackageName(id) === part;
}

/** Скомпилированное правило: проверка файла и само правило. */
type CompiledRule = [test: (id: string) => boolean, rule: MnScopeRule];

/**
 * Применяет правила `scopes` к декларации файла (D-082).
 *
 * @param rules — опция `scopes`
 * @param root — корень путей и шаблонов (рабочий каталог)
 * @returns функция `(файл, его декларация) → итоговая декларация`
 *
 * @example
 * const resolve = createScopeResolver([{ match: '@acme/ui', notationMode: 'tw4-compatible' }], cwd);
 * resolve('/repo/node_modules/@acme/ui/Button.tsx', undefined);   // → { notationMode: 'tw4-compatible' }
 * resolve(file, { notationMode: 'context-qualified' });            // → своя декларация важнее
 */
export function createScopeResolver(rules: MnScopeRule[] | undefined, root: string): (id: string, own: MnNotationDirective | undefined) => MnNotationDirective | undefined {
  const compiled: CompiledRule[] = (rules || []).map((rule) => {
    const parts = (Array.isArray(rule.match) ? rule.match : [rule.match]).map((part) => partMatcher(part, root));
    return [
      (id: string) => parts.some((test) => test(id)),
      rule,
    ];
  });
  if (!compiled.length) {
    return (_id, own) => own;
  }
  return (id, own) => {
    const found = compiled.find((item) => item[0](id));
    if (!found) {
      return own;
    }
    const rule = found[1];
    const out: MnNotationDirective = {
      ...own,
    };
    for (const key of DIRECTIVE_KEYS) {
      // Правила разбора: своя декларация важнее правила, `override` — аварийно наоборот (D-082).
      // Строгость: правило потребителя важнее — чинить чужой пакет не в его власти (D-081).
      rule[key] === undefined
        || own && own[key] !== undefined && !rule.override && STRICTNESS_KEYS.indexOf(key) < 0
        || ((out as Record<string, unknown>)[key] = rule[key]);
    }
    return out;
  };
}
