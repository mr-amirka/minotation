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
 * ## Что собирается (ровно то же, что текстовым сканером)
 *
 * 1. JSX-атрибут: `class="p10"`, `class={'p10'}`, `` class={`p10 ${x} w50`} ``.
 * 2. Свойство объекта с тем же именем: `{ className: 'p10' }` — в том числе
 *    вложенное (`slotProps={{ paper: { className: 'p10' } }}`).
 * 3. Переменная с суффиксом: `const rowClass = 'p10'`, `{ rowClass: 'p10' }`.
 * 4. Строковые аргументы функций слияния: `mne(base, 'p10')`, включая вложенные,
 *    и вызова переменной с суффиксом: `thClass('w150')` — функции из `mnClass`.
 * 5. Разметка внутри строкового литерала (`` html`<div class="p10">` ``) —
 *    текстовым разбором уже самого литерала: для парсера это просто строка,
 *    а токены в ней настоящие.
 *
 * Интерполяции `${…}` отбрасываются, как и в текстовом сканере: динамическое
 * значение на этапе сборки неизвестно.
 *
 * @module syntaxScan
 */
import ts from 'typescript';
import {
  extractTokensInto, pushLiteralTokens, scanTokens,
} from './extractTokens';
import type {
  ScanTokensOptions,
} from './extractTokens';

/** Опции {@link scanTokensSyntax}. */
export interface SyntaxScanOptions extends ScanTokensOptions {
  /**
   * Имя файла — по нему выбирается диалект (`.tsx` → JSX + TS, `.ts` → TS без
   * JSX, и так далее). По умолчанию разбор идёт как `.tsx`: он принимает
   * надмножество остальных.
   */
  fileName?: string;
}

/** `.ts` и `.mts`/`.cts` разбираются без JSX: там `<T>` — это приведение типа. */
function scriptKindOf(fileName: string): ts.ScriptKind {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > -1 ? fileName.slice(dot) : '';
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.TSX;
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
 * @returns массив токенов (с возможными повторами)
 *
 * @example
 * scanTokensSyntax('<div class="p10" />', { attr: 'class' })     // → ['p10']
 * scanTokensSyntax('// class="p10"', { attr: 'class' })          // → []
 */
export function scanTokensSyntax(source: string, options: SyntaxScanOptions): string[] {
  const fileName = options.fileName || 'source.tsx';
  const file = ts.createSourceFile(
    fileName,
    source,
    // Разбор без проверки типов: нужна только форма кода, а `Latest` избавляет
    // от вопроса «какой синтаксис уже можно».
    ts.ScriptTarget.Latest,
    // Ссылки на родителей не нужны: обход идёт сверху вниз, а их простановка
    // стоит отдельного прохода по дереву.
    false,
    scriptKindOf(fileName),
  );
  // `parseDiagnostics` нет в публичных типах, но это единственный способ
  // узнать про синтаксическую ошибку, не строя программу: `createSourceFile`
  // на битом файле возвращает дерево как ни в чём не бывало.
  const broken = (file as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics;
  if (broken && broken.length) {
    return scanTokens(source, options);
  }
  const tokens: string[] = [];
  const attr = options.attr || 'class';
  const suffixes = options.classVarSuffixes === undefined
    ? ['Class']
    : options.classVarSuffixes;
  const mergeFnNames = options.mergeFnNames === undefined
    ? ['mne', 'mnClass']
    : options.mergeFnNames;
  // Маркер разметки внутри строки: без него пришлось бы гонять текстовый
  // разбор по каждому литералу файла, а `class=` есть в единицах из них.
  const markup = attr + '=';
  const state: ScanState = [
    tokens,
    attr,
    suffixes,
    mergeFnNames,
    markup,
  ];
  visit(file, state);
  return tokens;
}

/**
 * Состояние обхода кортежем, а не объектом (§2): оно прокидывается в каждый
 * узел дерева, а узлов в файле тысячи.
 */
type ScanState = [
  tokens: string[],
  attr: string,
  suffixes: string[],
  mergeFnNames: string[],
  markup: string,
];

const MN_SCAN_TOKENS = 0;
const MN_SCAN_ATTR = 1;
const MN_SCAN_SUFFIXES = 2;
const MN_SCAN_MERGE_FNS = 3;
const MN_SCAN_MARKUP = 4;

function visit(node: ts.Node, state: ScanState): void {
  switch (node.kind) {
    case ts.SyntaxKind.JsxAttribute:
      jsxAttribute(node as ts.JsxAttribute, state);
      break;
    case ts.SyntaxKind.PropertyAssignment:
      propertyAssignment(node as ts.PropertyAssignment, state);
      break;
    case ts.SyntaxKind.VariableDeclaration:
      variableDeclaration(node as ts.VariableDeclaration, state);
      break;
    case ts.SyntaxKind.CallExpression:
      callExpression(node as ts.CallExpression, state);
      break;
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      markupInside((node as ts.StringLiteralLike).text, state);
      break;
    case ts.SyntaxKind.TemplateExpression:
      templateMarkup(node as ts.TemplateExpression, state);
      break;
    default:
      break;
  }
  ts.forEachChild(node, (child) => {
    visit(child, state);
  });
}

/** Имя узла как строка; вычисляемые и служебные имена нас не интересуют. */
function nameOf(node: ts.Node): string {
  if (node.kind === ts.SyntaxKind.Identifier) {
    return (node as ts.Identifier).text;
  }
  if (node.kind === ts.SyntaxKind.StringLiteral) {
    return (node as ts.StringLiteral).text;
  }
  return '';
}

/** `class="p10"`, `class={'p10'}`, `` class={`p10 ${x}`} ``. */
function jsxAttribute(node: ts.JsxAttribute, state: ScanState): void {
  if (nameOf(node.name) !== state[MN_SCAN_ATTR]) {
    return;
  }
  const value = node.initializer;
  if (!value) {
    return;
  }
  if (value.kind === ts.SyntaxKind.JsxExpression) {
    pushExpression((value as ts.JsxExpression).expression, state);
    return;
  }
  pushExpression(value, state);
}

/** `{ className: 'p10' }` и `{ rowClass: 'p10' }`. */
function propertyAssignment(node: ts.PropertyAssignment, state: ScanState): void {
  const name = nameOf(node.name);
  if (name === state[MN_SCAN_ATTR] || hasSuffix(name, state[MN_SCAN_SUFFIXES])) {
    pushExpression(node.initializer, state);
  }
}

/** `const rowClass = 'p10'`, в том числе с аннотацией типа. */
function variableDeclaration(node: ts.VariableDeclaration, state: ScanState): void {
  if (hasSuffix(nameOf(node.name), state[MN_SCAN_SUFFIXES])) {
    pushExpression(node.initializer, state);
  }
}

/**
 * `mne(base, 'p10')` и `thClass('w150')` — берутся все строковые литералы
 * вызова, включая вложенные.
 *
 * Как и в текстовом сканере, имя должно быть самостоятельным идентификатором:
 * `obj.mne(...)` — чужой метод, а не наш.
 */
function callExpression(node: ts.CallExpression, state: ScanState): void {
  const callee = node.expression;
  if (callee.kind !== ts.SyntaxKind.Identifier) {
    return;
  }
  const name = (callee as ts.Identifier).text;
  // `thClass('w150')` — вызов функции, которую вернул `mnClass(base)`: её
  // аргументы — такие же токены, как у самой `mnClass`.
  if (state[MN_SCAN_MERGE_FNS].indexOf(name) < 0 && !hasSuffix(name, state[MN_SCAN_SUFFIXES])) {
    return;
  }
  const args = node.arguments;
  const l = args.length;
  let i = 0;
  for (; i < l; i++) {
    pushEveryLiteral(args[i], state);
  }
}

/** Оканчивается ли имя на один из суффиксов. */
function hasSuffix(name: string, suffixes: string[]): boolean {
  const l = suffixes.length;
  let i = 0;
  for (; i < l; i++) {
    if (name.length > suffixes[i].length && name.endsWith(suffixes[i])) {
      return true;
    }
  }
  return false;
}

/** Литеральное значение выражения — строка, шаблон или ничего. */
function pushExpression(node: ts.Node | undefined, state: ScanState): void {
  if (!node) {
    return;
  }
  const tokens = state[MN_SCAN_TOKENS];
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      pushLiteralTokens(tokens, (node as ts.StringLiteralLike).text);
      break;
    case ts.SyntaxKind.TemplateExpression:
      pushTemplate(node as ts.TemplateExpression, state);
      break;
    default:
      // Вычисляемое значение (`cond ? a : b`, вызов, переменная) на этапе
      // сборки неизвестно — ровно как и у текстового сканера.
      break;
  }
}

/** Литеральные куски шаблонной строки; `${…}` отбрасываются. */
function pushTemplate(node: ts.TemplateExpression, state: ScanState): void {
  const tokens = state[MN_SCAN_TOKENS];
  pushLiteralTokens(tokens, node.head.text);
  const spans = node.templateSpans;
  const l = spans.length;
  let i = 0;
  for (; i < l; i++) {
    pushLiteralTokens(tokens, spans[i].literal.text);
  }
}

/** Все строковые литералы поддерева — для аргументов функций слияния. */
function pushEveryLiteral(node: ts.Node, state: ScanState): void {
  pushExpression(node, state);
  ts.forEachChild(node, (child) => {
    pushEveryLiteral(child, state);
  });
}

/** Разметка внутри шаблонной строки — по каждому литеральному куску. */
function templateMarkup(node: ts.TemplateExpression, state: ScanState): void {
  markupInside(node.head.text, state);
  const spans = node.templateSpans;
  const l = spans.length;
  let i = 0;
  for (; i < l; i++) {
    markupInside(spans[i].literal.text, state);
  }
}

/**
 * Разметка внутри строки: `` html`<div class="p10">` ``, строка с HTML,
 * шаблон для `innerHTML`.
 *
 * Для парсера это просто строка, но токены в ней настоящие — текстовый сканер
 * их находит, и без этого два сканера расходились бы на ровном месте.
 */
function markupInside(text: string, state: ScanState): void {
  if (text.indexOf(state[MN_SCAN_MARKUP]) < 0) {
    return;
  }
  extractTokensInto(
    state[MN_SCAN_TOKENS], text, state[MN_SCAN_ATTR],
  );
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
 * @returns массив токенов (с возможными повторами)
 */
export function scanTokensSfc(source: string, options: SyntaxScanOptions): string[] {
  const tokens: string[] = [];
  // Куски вне скриптов — их разберёт текстовый сканер одним проходом.
  const rest: string[] = [];
  let i = 0;
  let open: number;
  let body: number;
  let close: number;
  let front: number;
  // Фронтматтер Astro: `---` в самом начале файла и до следующего `---`.
  if (source.startsWith('---')) {
    front = source.indexOf('\n---', 3);
    if (front > -1) {
      pushSyntax(
        tokens, source.slice(3, front), options, '.ts',
      );
      rest.push(newlinesOf(
        source, 0, front,
      ));
      i = front;
    }
  }
  while ((open = source.indexOf('<script', i)) > -1) {
    body = source.indexOf('>', open);
    if (body < 0) {
      break;
    }
    close = source.indexOf('</script', body);
    if (close < 0) {
      break;
    }
    rest.push(source.slice(i, open));
    pushSyntax(
      tokens,
      source.slice(body + 1, close),
      options,
      extensionOf(source.slice(open, body)),
    );
    // Вместо вырезанного — только переводы строк: иначе склеились бы соседние
    // строки, и `class=` из-под скрипта попал бы в чужой контекст.
    rest.push(newlinesOf(
      source, open, close,
    ));
    i = close;
  }
  rest.push(source.slice(i));
  // Остаток идёт через полный текстовый сканер, а не через один разбор
  // атрибутов: в шаблоне бывают и вызовы `mne`, и комментарии — `<!-- <div
  // class="p99"> -->` иначе добавил бы в CSS правило, которое не к чему
  // применить.
  const outside = scanTokens(rest.join(''), options);
  const n = outside.length;
  let j = 0;
  for (; j < n; j++) {
    tokens.push(outside[j]);
  }
  return tokens;
}

/** Разбирает кусок кода парсером и складывает токены в общий массив. */
function pushSyntax(
  tokens: string[],
  code: string,
  options: SyntaxScanOptions,
  extension: string,
): void {
  const found = scanTokensSyntax(code, {
    ...options,
    fileName: 'sfc' + extension,
  });
  const l = found.length;
  let i = 0;
  for (; i < l; i++) {
    tokens.push(found[i]);
  }
}

/**
 * Расширение по атрибутам тега `<script>`.
 *
 * `lang="tsx"` и `lang="jsx"` — единственные, где нужен разбор с JSX: в
 * обычном `<script lang="ts">` символ `<` это сравнение или generic, и
 * TSX-режим спотыкался бы о него.
 */
function extensionOf(tag: string): string {
  if (tag.indexOf('sx"') > -1 || tag.indexOf("sx'") > -1) {
    return '.tsx';
  }
  return '.ts';
}

/** Только переводы строк из диапазона — остальное отбрасывается. */
function newlinesOf(
  source: string, from: number, to: number,
): string {
  let out = '';
  let i = from;
  for (; i < to; i++) {
    source[i] === '\n' && (out += '\n');
  }
  return out;
}
