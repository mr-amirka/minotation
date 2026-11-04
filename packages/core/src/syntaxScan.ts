/**
 * Сканер токенов с синтаксическим разбором — альтернатива текстовому.
 *
 * Текстовый сканер (`extractTokens.ts`) остаётся основным: он работает с любым
 * диалектом, не тянет зависимостей и переживает любой синтаксис. Но там, где
 * формат файла известен точно, разбор снимает целый класс проблем — примеры
 * разметки в комментариях и JSDoc, закомментированный код, чужие строки.
 * Вырезание комментариев (2026-09-28) закрыло основную массу случаев, но
 * текстом, а не по правилам языка: `stripComments` не знает ни про JSX, ни про
 * регулярные литералы (`/"/`), ни про вложенные шаблонные строки.
 *
 * ## Почему парсер именно TypeScript
 *
 * Он уже стоит в каждом пакете лаборатории, разбирает JS, TS, JSX и TSX одним
 * API, не требует настройки под диалект и не бросает на битом файле — отдаёт
 * дерево и список диагностик. Babel или oxc дали бы то же самое ценой ещё
 * одной зависимости.
 *
 * `typescript` объявлен необязательной peer-зависимостью, а модуль вынесен в
 * отдельную точку входа `minotation/syntax`: кто импортирует `minotation`, тот
 * парсер не тянет.
 *
 * ## Что собирается (то же, что текстовым сканером, плюс условные выражения)
 *
 * 1. JSX-атрибут: `class="p10"`, `class={'p10'}`, `` class={`p10 ${x} w50`} ``,
 *    а также литералы, которые могут стать значением: `class={v ? 'a' : 'b'}`,
 *    `class={on && 'a'}`, `class={x || 'a'}` (так же — в свойствах и переменных
 *    из пунктов 2–3). Текстовый сканер таких выражений не видит.
 * 2. Свойство объекта с тем же именем: `{ className: 'p10' }` — в том числе
 *    вложенное (`slotProps={{ paper: { className: 'p10' } }}`).
 * 3. Переменная из `varNames`: `const rowClass = 'p10'`, `{ rowClass: 'p10' }`.
 * 4. Строковые аргументы вызовов из `fnNames`: `mne(base, 'p10')`, включая вложенные,
 *    и `thClass('w150')` — функции из `mnClass` (шаблон `*Class`).
 * 5. Разметка внутри строкового литерала (`` html`<div class="p10">` ``) —
 *    текстовым разбором уже самого литерала: для парсера это просто строка,
 *    а токены в ней настоящие.
 *
 * Подстановки `${…}` читаются по тем же правилам, что и выражение атрибута (D-074):
 * `` `p10 ${on ? 'cF' : 'c0'}` `` → `p10 cF c0`; переменная или вызов в подстановке
 * токенов не дают — их значение на этапе сборки неизвестно.
 *
 * @module syntaxScan
 */
import ts from 'typescript';
import {
  applyEdits,
  blankSpan,
  parseSource,
  sfcParts,
  syntaxStringsProvider,
  syntaxValueRanges,
} from 'fundamentool/source';
import type {
  TSourceEdit,
  TSyntaxStrings,
} from 'fundamentool/source';
import {
  pushLiteralTokens,
  readMarkers,
  scanTokensByPlanInto,
} from './extractTokens';
import type {
  ScanTokensOptions,
} from './extractTokens';
import {
  MN_GROUP_ATTR,
  MN_GROUP_FNS,
  MN_GROUP_SYNTAX,
  MN_GROUP_TARGET,
  MN_GROUP_VARS,
  MN_PLAN_GROUPS,
  MN_PLAN_MARKER_TARGET,
  cachedScanPlanOf,
} from './scanPlan';
import type {
  ScanGroup,
  ScanPlan,
  ScannedTokens,
} from './scanPlan';
import {
  isWrapped,
  startsWithClass,
  wrapExpression,
} from './scopeClass';

/** Опции {@link scanTokensSyntax}. */
export interface SyntaxScanOptions extends ScanTokensOptions {
  /**
   * Имя файла — по нему выбирается диалект (`.tsx` → JSX + TS, `.ts` → TS без
   * JSX, и так далее). По умолчанию разбор идёт как `.tsx`: он принимает
   * надмножество остальных.
   */
  fileName?: string;
}

/**
 * Собирает токены, разбирая файл как исходник JS/TS.
 *
 * На файле с синтаксической ошибкой откатывается к текстовому сканеру: сборка
 * не должна срываться из-за того, что автор не дописал скобку — редактор и
 * компилятор скажут об этом внятнее, а стили нужны и на недописанном файле.
 *
 * @param source — полный текст файла
 * @param options — см. {@link SyntaxScanOptions}
 * @returns токены по цели (с возможными повторами)
 *
 * @example
 * scanTokensSyntax('<div class="p10" />', {})     // → { class: ['p10'] }
 * scanTokensSyntax('// class="p10"', {})          // → { class: [] }
 */
export function scanTokensSyntax(source: string, options: SyntaxScanOptions): ScannedTokens {
  return scanSyntaxByPlan(
    source, cachedScanPlanOf(options), options.fileName,
  );
}

/**
 * {@link scanTokensSyntax} по готовому плану: файл разбирается один раз, дерево обходится на каждую группу.
 *
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 * @param fileName — имя файла (диалект); по умолчанию `.tsx`
 * @returns токены по цели
 */
export function scanSyntaxByPlan(
  source: string, plan: ScanPlan, fileName = 'source.tsx',
): ScannedTokens {
  const out: ScannedTokens = {};
  scanSyntaxInto(
    out, source, plan, fileName,
  );
  return out;
}

/** Читатель дерева группы — создаётся при первом разборе и остаётся в группе. */
function syntaxStringsOf(group: ScanGroup): TSyntaxStrings {
  return (group[MN_GROUP_SYNTAX] || (group[MN_GROUP_SYNTAX] = syntaxStringsProvider(ts, {
    attrs: group[MN_GROUP_ATTR],
    variables: group[MN_GROUP_VARS],
    calls: group[MN_GROUP_FNS],
  }))) as TSyntaxStrings;
}

/** {@link scanSyntaxByPlan} в готовый набор: скрипты однофайлового компонента пишут в один объект. */
function scanSyntaxInto(
  out: ScannedTokens, source: string, plan: ScanPlan, fileName: string,
): void {
  const file = parseSource(
    ts, source, fileName,
  );
  if (!file) {
    scanTokensByPlanInto(
      out, source, plan,
    );
    return;
  }
  const markerTarget = plan[MN_PLAN_MARKER_TARGET];
  // Маркеры `@mn` в комментариях (D-083) — тем же разбором, что и у текстового сканера: паритет.
  readMarkers(source, out[markerTarget] || (out[markerTarget] = []));
  const groups = plan[MN_PLAN_GROUPS];
  const l = groups.length;
  let i = 0;
  let target: string;
  for (; i < l; i++) {
    target = groups[i][MN_GROUP_TARGET];
    syntaxStringsOf(groups[i])(
      file, out[target] || (out[target] = []), pushLiteralTokens,
    );
  }
}

/**
 * Однофайловые компоненты: `.vue`, `.svelte`, `.astro`.
 *
 * Целиком парсером их не разобрать — это не JS, а свой формат, и у каждого
 * свой компилятор, то есть своя зависимость. Но делится такой файл на две
 * части с разными свойствами:
 *
 * - **скрипт** (`<script>…</script>`, у Astro ещё фронтматтер `---…---`) —
 *   обычный JS/TS, и именно там живут JSDoc с примерами разметки,
 *   закомментированный код и прочее, на чём текстовый сканер ошибается;
 * - **шаблон** — размеченный HTML, где `class="…"` это и есть настоящие
 *   токены, и текстовый разбор для него не хуже любого другого.
 *
 * Поэтому скрипт идёт через парсер, остальное — текстом. Новых зависимостей
 * это не требует, а основной источник ложных токенов закрывает.
 *
 * @param source — полный текст файла
 * @param options — см. {@link SyntaxScanOptions}
 * @returns токены по цели (с возможными повторами)
 */
export function scanTokensSfc(source: string, options: SyntaxScanOptions): ScannedTokens {
  return scanSfcByPlan(source, cachedScanPlanOf(options));
}

/**
 * {@link scanTokensSfc} по готовому плану.
 *
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 * @returns токены по цели
 */
export function scanSfcByPlan(source: string, plan: ScanPlan): ScannedTokens {
  const tokens: ScannedTokens = {};
  const parts = sfcParts(source);
  const l = parts.length;
  // Разметка вне скриптов — её разберёт текстовый сканер одним проходом. Вместо скрипта — пробелы той же длины с
  // его переводами строк: иначе склеились бы соседние строки, и `class=` из-под скрипта попал бы в чужой контекст.
  let rest = '';
  let i = 0;
  let part: [kind: number, from: number, to: number];
  for (; i < l; i++) {
    part = parts[i];
    if (!part[0]) {
      rest += source.slice(part[1], part[2]);
      continue;
    }
    scanSyntaxInto(
      tokens, source.slice(part[1], part[2]), plan, part[0] === 2 ? 'sfc.tsx' : 'sfc.ts',
    );
    rest += blankSpan(
      source, part[1], part[2],
    );
  }
  // Остаток идёт через полный текстовый сканер, а не через один разбор
  // атрибутов: в шаблоне бывают и вызовы `mne`, и комментарии — `<!-- <div
  // class="p99"> -->` иначе добавил бы в CSS правило, которое не к чему
  // применить.
  scanTokensByPlanInto(
    tokens, rest, plan,
  );
  return tokens;
}

/**
 * Класс области по синтаксическому дереву (D-075): JSX-атрибуты и свойства объектов с именами из
 * `attrs`. Литерал — класс вставляется в его начало; выражение — оборачивается
 * (`"_l " + ((expr) || "")`). Битый файл — `undefined`: писатель перейдёт к текстовому способу.
 *
 * @param source — исходник
 * @param options — имена атрибутов, класс области, имя файла (диалект)
 * @returns переписанный исходник или `undefined`
 */
export function addScopeClassSyntax(source: string, options: {
  attrs: string[];
  className: string;
  fileName: string;
}): string | undefined {
  const file = parseSource(
    ts, source, options.fileName,
  );
  if (!file) {
    return undefined;
  }
  const className = options.className;
  const edits: TSourceEdit[] = [];
  let ch: string;
  let expression: string;
  for (const [
    from,
    to,
  ] of syntaxValueRanges(
      ts, file, options.attrs,
    )) {
    ch = source[from];
    if (ch === '"' || ch === '\'' || ch === '`') {
      // Литерал — класс в начало, если его там ещё нет.
      startsWithClass(
        source, from + 1, className,
      ) || edits.push([
        from + 1,
        from + 1,
        className + ' ',
      ]);
      continue;
    }
    // Выражение — обёртка; уже обёрнутое прошлым проходом не трогаем.
    expression = source.slice(from, to);
    isWrapped(expression, className) || edits.push([
      from,
      to,
      wrapExpression(expression, className),
    ]);
  }
  return applyEdits(source, edits);
}
