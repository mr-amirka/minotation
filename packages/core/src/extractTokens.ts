import {
  blankComments,
} from 'fundamentool/source';
import {
  MN_GROUP_STRINGS,
  MN_GROUP_TARGET,
  MN_PLAN_COMMENTS,
  MN_PLAN_GROUPS,
  MN_PLAN_MARKER_TARGET,
  cachedScanPlanOf,
} from './scanPlan';
import type {
  ScanGroup,
  ScanPlan,
  ScannedTokens,
} from './scanPlan';
import type {
  TPairsValue,
} from 'fundamentool';

const SPACE = ' ';
const NEWLINE = '\n';
const TAB = '	';

/**
 * Сбор MN-токенов из текста файла — слой над `fundamentool/source` (fundamentool D-097).
 *
 * Строки в местах по имени (атрибуты, переменные, аргументы вызовов) и строки, которыми может стать выражение,
 * читает fundamentool; minotation даёт свои места (план из `scanPlan.ts`) и свой `push` — {@link pushLiteralTokens},
 * который делит строку на токены. Здесь же — маркеры `@mn` в комментариях (D-083): что говорит комментарий, знает
 * minotation, а не ядро.
 *
 * ## Что читается
 *
 * 1. **Атрибут** (`attrs`): `class="p10 w50"`, `class='…'`, `class={'…'}`, `` class={`p10 ${on ? 'cF' : 'c0'}`} ``
 *    (D-074), `class={v ? 'a' : 'b'}`, ключ объекта `{ className: '…' }` (в том числе вложенный, MUI `slotProps`).
 * 2. **Переменная** (`varNames`): `const rowClass = 'p10'`, с аннотацией типа, `{ rowClass: '…' }`.
 * 3. **Вызов** (`fnNames`): `mne(base, 'p10')`, `thClass('w150')` — строковые аргументы, вложенные тоже.
 *
 * Условие и операнды сравнения токенов не дают: в `v === 'splash' ? …` строка `'splash'` — не класс. Вызов,
 * переменная, склейка на этапе сборки неизвестны.
 *
 * @module extractTokens
 */

/** `${...}` — подстановка внутри строки, вырезается перед разбиением на токены. */
const REGEXP_INTERPOLATION = /\$\{[^}]*\}/g;

/**
 * Делит строку на токены, отбрасывая `${…}`-подстановки: это `push` minotation для читателей `fundamentool/source`.
 *
 * Без `split`: он создаёт промежуточный массив на каждую строку, а строк в файле столько же, сколько атрибутов,
 * переменных и вызовов. Границы слов находятся проходом, наружу уходят готовые подстроки; `replace` пропускается,
 * когда подстановок нет, — а их нет в большинстве строк.
 *
 * @param out — аккумулятор токенов
 * @param literal — строка, как она записана между кавычками
 *
 * @example
 * pushLiteralTokens(out, ' p10  w5 ${x} ')   // out: p10, w5
 */
export function pushLiteralTokens(out: string[], literal: string): void {
  const text = literal.indexOf('${') < 0
    ? literal
    : literal.replace(REGEXP_INTERPOLATION, SPACE);
  const l = text.length;
  let i = 0;
  let from = -1;
  let ch: string;
  for (; i < l; i++) {
    ch = text[i];
    if (ch === SPACE || ch === NEWLINE || ch === TAB || ch === '\r') {
      if (from >= 0) {
        out.push(text.slice(from, i));
        from = -1;
      }
      continue;
    }
    if (from < 0) {
      from = i;
    }
  }
  if (from >= 0) {
    out.push(from ? text.slice(from) : text);
  }
}

/** Маркер токенов в комментарии. */
const MARKER = '@mn';
/** Первый `@mn` файла на месте чтения или после него; `-1` — дальше маркеров нет. */
let $$markerAt = -1;

/** Хвост строки маркера: закрытие комментария (звёздочка со слешем, `-->`). */
const REGEXP_MARKER_TAIL = /\s*(?:\*\/|-->)\s*$/;

/**
 * Токены маркеров `@mn` в комментарии `[from, to)` (D-083) — читатель комментария для `blankComments`: после `@mn` и
 * пробела — токены до конца строки или комментария. `@mn` — отдельное слово: `@mnClass`, `x@mn` маркерами не являются.
 *
 * Следующий `@mn` файла найден заранее и переносится дальше: комментарии идут по порядку, поэтому поиск не начинается
 * заново с каждого (иначе файл со многими комментариями просматривался бы до конца на каждый).
 *
 * @example
 * {/* @mn cF00 px10 *\/}      // → cF00, px10
 * // @mn bgF00 bg0F0          // → bgF00, bg0F0
 */
function markerTokens(
  out: string[], source: string, from: number, to: number,
): void {
  let at = $$markerAt;
  if (at >= to) {
    return;
  }
  at < from && (at = source.indexOf(MARKER, from));
  let end: number;
  let next: string;
  while (at > -1 && at < to) {
    next = source[at + 3];
    if ((next === SPACE || next === TAB) && !(at && REGEXP_NAME_CHAR.test(source[at - 1]))) {
      end = at + 4;
      while (end < to && source[end] !== NEWLINE) {
        end++;
      }
      pushLiteralTokens(out, source.slice(at + 4, end).replace(REGEXP_MARKER_TAIL, ''));
    }
    at = source.indexOf(MARKER, at + 3);
  }
  $$markerAt = at;
}

/** Знак имени перед `@mn`: `x@mn` — не маркер. Маркеры редки — проверка регуляркой, холодный путь. */
const REGEXP_NAME_CHAR = /[\w$]/;

/**
 * Текст без комментариев (той же длины) и токены маркеров `@mn` из них. Файл без `@mn` идёт без читателя комментариев.
 *
 * @param source — текст файла
 * @param markers — куда сложить токены маркеров
 * @returns текст, комментарии которого заменены пробелами
 */
function blankWithMarkers(source: string, markers: string[]): string {
  $$markerAt = source.indexOf(MARKER);
  return $$markerAt < 0 ? blankComments(source) : blankComments(
    source, markers, markerTokens,
  );
}

/**
 * Только токены маркеров `@mn` — для разбора парсером и для `comments: false`, где текст без комментариев не нужен.
 * Файл без `@mn` не просматривается.
 *
 * @param source — текст файла
 * @param markers — куда сложить токены маркеров
 */
export function readMarkers(source: string, markers: string[]): void {
  $$markerAt = source.indexOf(MARKER);
  $$markerAt > -1 && blankComments(
    source, markers, markerTokens,
  );
}

/** Опции {@link scanTokens}: записи трёх механизмов и вырезание комментариев (D-146). */
export interface ScanTokensOptions {
  /**
   * Атрибуты и ключи объектов: `'class'`, `'className:class'`, `'*ClassName:class'` (любое имя, которое кончается на
   * `ClassName`; D-131), `'m'` — в `[m~="ws"]`. Имя без цели — само себе цель; у шаблона цель пишется явно. Строка
   * (`'class, className:class'`), массив записей или объект `{ className: 'class' }` (D-147).
   *
   * @default ['class']
   */
  attrs?: TPairsValue;
  /**
   * Переменные и ключи объектов со списком токенов: `'*Class:class'` берёт `const rowClass = 'p10'`. Цель пишется
   * явно. Пустой список (`''`, `[]`, `{}`) отключает механизм.
   *
   * @default ['*Class:class']
   */
  varNames?: TPairsValue;
  /**
   * Вызовы, чьи строковые аргументы — токены: `'mne:class'` и `'*Class:class'` — `mnClass('p10')` и
   * `thClass('w150')` (функция, которую вернул `mnClass`). Цель пишется явно. Пустой список отключает механизм.
   *
   * @default ['mne:class', '*Class:class']
   */
  fnNames?: TPairsValue;
  /**
   * `true` — список, заданный вместо умолчания, теряет его записи намеренно: сканер не предупреждает (D-146).
   *
   * @default false
   */
  replaceDefaults?: boolean;
  /**
   * `false` — не вырезать комментарии перед сканированием.
   *
   * По умолчанию вырезаются: пример разметки в комментарии иначе добавляет
   * свои токены в CSS. Отключать стоит только там, где формат файла заведомо
   * не имеет комментариев, а входные данные велики.
   */
  comments?: boolean;
}

/**
 * Единая точка сбора MN-токенов из текста файла — атрибуты, переменные, аргументы вызовов, по цели.
 *
 * Плагины сборщиков должны вызывать её (через `createScanner`), а не собирать механизмы по отдельности:
 * до 2026-09-25 переменные разбирались только в `minotation-vite`, и проекты на esbuild, rollup и webpack
 * теряли токены из переменных, ничего об этом не сообщая.
 *
 * Опции разбираются один раз на объект опций (план кешируется); сканер с выбором разбора по файлу — `createScanner`.
 *
 * @param source — полный текст файла
 * @param options — см. {@link ScanTokensOptions}
 * @returns токены по цели (с возможными повторами)
 *
 * @example
 * scanTokens('<div class="p10">', {})                                // → { class: ['p10'] }
 * scanTokens("const aClass = 'p10'; mne(base, 'w1')", {})            // → { class: ['p10', 'w1'] }
 * scanTokens('<a className="p10" m="w1">', { attrs: 'className:class, m' })
 * // → { class: ['p10'], m: ['w1'] }
 */
export function scanTokens(source: string, options: ScanTokensOptions): ScannedTokens {
  return scanTokensByPlan(source, cachedScanPlanOf(options));
}

/**
 * {@link scanTokens} по готовому плану: на каждый файл, без разбора опций.
 *
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 * @returns токены по цели
 */
export function scanTokensByPlan(source: string, plan: ScanPlan): ScannedTokens {
  const out: ScannedTokens = {};
  scanTokensByPlanInto(
    out, source, plan,
  );
  return out;
}

/**
 * {@link scanTokensByPlan} в готовый набор: однофайловый компонент складывает шаблон и скрипты в один объект, без
 * промежуточных.
 *
 * Комментарии вырезаются до всех трёх механизмов: токен из примера разметки в комментарии либо раздувает CSS
 * правилами, которые не к чему применить, либо роняет сборку под `strict`. Маркеры `@mn` читаются всегда (D-083),
 * даже с `comments: false`.
 *
 * @param out — набор, куда добавляются токены по цели
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 */
export function scanTokensByPlanInto(
  out: ScannedTokens, source: string, plan: ScanPlan,
): void {
  const groups = plan[MN_PLAN_GROUPS];
  const l = groups.length;
  const markerTarget = plan[MN_PLAN_MARKER_TARGET];
  const markers = out[markerTarget] || (out[markerTarget] = []);
  if (plan[MN_PLAN_COMMENTS]) {
    source = blankWithMarkers(source, markers);
  } else {
    readMarkers(source, markers);
  }
  let i = 0;
  let group: ScanGroup;
  for (; i < l; i++) {
    group = groups[i];
    group[MN_GROUP_STRINGS](
      source, out[group[MN_GROUP_TARGET]] || (out[group[MN_GROUP_TARGET]] = []), pushLiteralTokens,
    );
  }
}
