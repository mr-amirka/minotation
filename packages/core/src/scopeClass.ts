/**
 * Класс области в разметке (D-075, D-076): сборка дописывает класс изолированной области (`_l`) в
 * каждый атрибут класса файлов пакета, правила области привязаны к нему (`.p-4._l{…}`).
 *
 * Два способа, как у сканера: JS/TS/JSX — по синтаксическому дереву (`minotation/syntax`), всё
 * остальное (`.html`, `.vue`, `.svelte`, `.astro`, файл с синтаксической ошибкой) — текстом.
 *
 * Что переписывается:
 *
 * | Было | Стало |
 * |---|---|
 * | `class="p-4"`, `className='p-4'` | `class="_l p-4"` |
 * | `className={'p-4'}`, `` className={`p-4 ${x}`} `` | `className={'_l p-4'}`, `` className={`_l p-4 ${x}`} `` |
 * | `className={expr}`, `class={expr}` | `className={"_l " + ((expr) \|\| "")}` |
 * | `{ className: 'p-4' }` | `{ className: '_l p-4' }` |
 *
 * `|| ""`, а не `?? ""`: `cond && 'a'` при ложном условии иначе дал бы класс `false`. Привязка `:class`
 * Vue и классы, заданные из JS (`classList`, `el.className =`), не переписываются — о вторых
 * сообщается как о недостижимых (`unreachable`).
 *
 * Холодный путь: файл переписывается один раз на сборку.
 *
 * @module scopeClass
 */
import {
  stripComments,
} from './extractTokens';
import {
  syntaxKindOf,
} from './scanner';

const SPACE = ' ';

/** Опции {@link createScopeClassWriter}. */
export interface ScopeClassWriterOptions {
  /** Имена атрибутов, чьи значения — классы (цель `class`): `['class', 'className']`. */
  attr: string[];
  /** `false` — только текстом, даже для JS/TS. По умолчанию — разбором, если `typescript` доступен. */
  syntax?: boolean;
}

/** Результат: переписанный код и места, где класс задан из JS и класса области не получит. */
export interface ScopeClassResult {
  code: string;
  /** `[строка (с 1), фрагмент]` — `el.className = …`, `classList.add(…)`, `setAttribute('class', …)`. */
  unreachable: Array<[line: number, text: string]>;
}

/** Писатель класса области: исходник, имя файла (по нему — способ), класс. */
export type ScopeClassWriter = (source: string, fileName: string, className: string) => ScopeClassResult;

/** Правка исходника: `[начало, конец, текст]` — вставка, если начало и конец совпадают. */
export type SourceEdit = [from: number, to: number, text: string];

/** Синтаксический писатель — из `minotation/syntax`, загружается лениво. */
type SyntaxWriter = (source: string, options: {
  attr: string[];
  className: string;
  fileName: string;
}) => string | undefined;

const REGEXP_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Класс, заданный из JS: элемент класса области не получит (D-076). */
const REGEXP_UNREACHABLE = /\.className\s*=(?!=)|\.classList\s*\.\s*(?:add|toggle|replace)\s*\(|setAttribute\s*\(\s*['"]class['"]/g;

/**
 * Возвращает писатель класса области по опциям — как {@link createScanner} для сканера.
 *
 * @example
 * const write = createScopeClassWriter({ attr: ['class', 'className'] });
 * write('<b className="p-4" />', 'Button.tsx', '_l').code;   // → '<b className="_l p-4" />'
 */
export function createScopeClassWriter(options: ScopeClassWriterOptions): ScopeClassWriter {
  // 0 — ещё не пробовали, иначе функция или 1 (парсера нет).
  let syntax: SyntaxWriter | 0 | 1 = options.syntax === false ? 1 : 0;
  return (
    source, fileName, className,
  ) => {
    const typescriptLike = syntaxKindOf(fileName) === 1;
    if (!syntax && typescriptLike) {
      syntax = loadSyntaxWriter() || 1;
    }
    const code = syntax !== 0 && syntax !== 1 && typescriptLike && syntax(source, {
      attr: options.attr,
      className,
      fileName,
    });
    return {
      code: typeof code === 'string' ? code : addScopeClassText(
        source, options.attr, className,
      ),
      unreachable: unreachableClasses(source),
    };
  };
}

function loadSyntaxWriter(): SyntaxWriter | undefined {
  try {
    // Лениво и через `require`: парсер не нужен, пока не встретился JS/TS-файл.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./syntaxScan') as { addScopeClassSyntax: SyntaxWriter }).addScopeClassSyntax;
  } catch {
    return undefined;
  }
}

/**
 * Дописывает класс области текстом: атрибуты в кавычках, `attr={…}`, свойство объекта `attr: '…'`.
 *
 * @param source — исходник
 * @param attr — имена атрибутов класса
 * @param className — класс области
 * @returns переписанный исходник
 */
export function addScopeClassText(
  source: string, attr: string[], className: string,
): string {
  const edits: SourceEdit[] = [];
  for (const name of attr) {
    textEditsFor(
      source, name, className, edits,
    );
  }
  return applyEdits(source, edits);
}

function textEditsFor(
  source: string, name: string, className: string, edits: SourceEdit[],
): void {
  const escaped = name.replace(REGEXP_ESCAPE, '\\$&');
  // Слева — не продолжение другого имени и не `:` (`:class` Vue — привязка, а не атрибут).
  const re = new RegExp('(?<![\\w$:.-])' + escaped + '\\s*([=:])\\s*(["\'`{])', 'g');
  let match: RegExpExecArray | null;
  let at: number;
  let end: number;
  while ((match = re.exec(source))) {
    at = re.lastIndex;
    if (match[2] === '{') {
      // `attr={…}` — выражение: оборачивается целиком. `attr: {…}` — объект, не класс.
      if (match[1] === ':') {
        continue;
      }
      end = closingBrace(source, at - 1);
      // Уже обёрнуто прошлым проходом — не трогаем.
      isWrapped(source.slice(at, end).trim(), className) || edits.push([
        at,
        end,
        wrapExpression(source.slice(at, end).trim(), className),
      ]);
      re.lastIndex = end;
      continue;
    }
    startsWithClass(
      source, at, className,
    ) || edits.push([
      at,
      at,
      className + SPACE,
    ]);
  }
}

/** `{` в `at` → позиция парной `}`; строки внутри пропускаются. */
function closingBrace(source: string, at: number): number {
  const l = source.length;
  let depth = 0;
  let i = at;
  let ch: string;
  let quote: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      for (i++; i < l && source[i] !== quote; i++) {
        source[i] === '\\' && i++;
      }
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && !--depth) {
      return i;
    }
  }
  return l;
}

/** Значение уже начинается с класса области — второй проход ничего не меняет. */
function startsWithClass(
  source: string, at: number, className: string,
): boolean {
  const next = source[at + className.length];
  return source.startsWith(className, at) && (next === SPACE || next === '"' || next === '\'' || next === '`');
}

/**
 * Выражение класса → строка с классом области: `"_l " + ((expr) || "")`.
 *
 * @param expression — текст выражения
 * @param className — класс области
 */
export function wrapExpression(expression: string, className: string): string {
  return JSON.stringify(className + SPACE) + ' + ((' + expression + ') || "")';
}

/**
 * Выражение уже обёрнуто классом области: `"_l " + (…)`.
 *
 * @param expression — текст выражения
 * @param className — класс области
 */
export function isWrapped(expression: string, className: string): boolean {
  return expression.startsWith(JSON.stringify(className + SPACE) + ' + ');
}

/**
 * Применяет правки с конца — позиции остальных не сдвигаются.
 *
 * @param source — исходник
 * @param edits — правки по позициям исходника; пересекающиеся не допускаются
 */
export function applyEdits(source: string, edits: SourceEdit[]): string {
  const sorted = edits.slice().sort((a, b) => b[0] - a[0]);
  let out = source;
  for (const edit of sorted) {
    out = out.slice(0, edit[0]) + edit[2] + out.slice(edit[1]);
  }
  return out;
}

/** Классы, заданные из JS (не в комментариях): строка и фрагмент. */
function unreachableClasses(source: string): Array<[line: number, text: string]> {
  // Комментарии вырезаются с сохранением переводов строк — номера строк те же.
  const code = stripComments(source);
  const out: Array<[line: number, text: string]> = [];
  let match: RegExpExecArray | null;
  REGEXP_UNREACHABLE.lastIndex = 0;
  while ((match = REGEXP_UNREACHABLE.exec(code))) {
    out.push([
      code.slice(0, match.index).split('\n').length,
      match[0].replace(/\s+/g, ''),
    ]);
  }
  return out;
}
