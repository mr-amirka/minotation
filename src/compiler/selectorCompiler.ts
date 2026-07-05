import {
  ParsedLexeme, ParentSegment, ChildSegment, StateSegment, 
} from '../types';

/**
 * CSS-escape символов для использования в селекторах.
 *
 * Экранирует ВСЕ спецсимволы внутри имени класса.
 * Контекстные селекторы (>.+~# и т.д.) НЕ проходят через эту функцию —
 * они вставляются как есть, потому что это валидный CSS.
 *
 * Основано на mn-utils/escapeCss.js из MN 1.x.
 */
export function escapeCss(raw: string): string {
  // eslint-disable-next-line no-useless-escape
  return raw.replace(/([[\]\#.*^$()><+~=|:;,"'`\s@%\\\!\/])/g, '\\$1');
}

// Кеш комбинаторов (§6.3): depth → компактная CSS-строка (для join(''))
// depth=0: ' ' (пробел — сам является потомковым комбинатором)
// depth=1: '>' (прямой потомок, без пробелов — минификация)
// depth=2: '>*>', depth=3: '>*>*>' и т.д.
const combinatorCache: string[] = [];
function getCombinator(depth: number): string {
  if (combinatorCache[depth] !== undefined) {
    return combinatorCache[depth];
  }
  if (depth === 0) {
    return combinatorCache[0] = ' ';
  }
  let s = '>';
  let d = 1;
  while (d < depth) {
    s += '*>'; d++; 
  }
  return combinatorCache[depth] = s;
}

/**
 * Генерирует полное имя класса элемента (экранированная запись лексемы).
 */
export function compileClassName(lexeme: ParsedLexeme): string {
  return '.' + escapeCss(lexeme.raw);
}

/**
 * Генерирует ID-селектор для атрибута `id`.
 * `id="p10"` → `#p10`, `id="p10*2"` → `#p10\*2`.
 */
export function compileIdSelector(lexeme: ParsedLexeme): string {
  return '#' + escapeCss(lexeme.raw);
}

/**
 * Генерирует CSS-селектор для лексемы.
 *
 * Правила (из SPEC 04-grammar-02 §12):
 * - Родительские `<` — влево от класса элемента
 * - Дочерние `>` — вправо от класса элемента
 * - Первый сегмент задаёт сторону; после смены типа всё вправо
 */
export function compileSelector(lexeme: ParsedLexeme,
  targetName: string): string {
  const context = lexeme.context;
  const ctxLen = context.length;
  if (ctxLen === 0) {
    return targetName;
  }

  // §6.2: переменные до цикла
  const leftParts: (ParentSegment | ChildSegment)[] = [];
  const rightParts: (ParentSegment | ChildSegment)[] = [];
  let currentSide: 0 | 1 | null = null; // 0=left, 1=right
  let i = 0;
  let seg: (typeof context)[0];

  for (; i < ctxLen; i++) {
    seg = context[i];
    if (seg.kind === 'state') {
      continue;
    }

    if (seg.kind === 'parent') {
      if (currentSide === null) {
        currentSide = 0;
      }
      if (currentSide === 0) {
        leftParts.push(seg);
      } else {
        rightParts.push(seg);
      }
    } else if (seg.kind === 'child') {
      if (currentSide === null) {
        currentSide = 1;
      }
      currentSide = 1;
      rightParts.push(seg);
    }
  }

  // Строим результат без лишних аллокаций
  const parts: string[] = [];
  let li = leftParts.length;
  let body: string;

  // Левая часть: дальний предок → ближайший
  while (li--) {
    seg = leftParts[li];
    body = seg.selector || '*';
    parts.push(body, getCombinator(seg.depth));
  }

  // Элемент
  parts.push(targetName);

  // Правая часть: ближайший потомок → дальний
  const rl = rightParts.length;
  i = 0;
  for (; i < rl; i++) {
    seg = rightParts[i];
    body = seg.selector || '*';
    parts.push(getCombinator(seg.depth), body);
  }

  return parts.join('').trim();
}

/**
 * Добавляет состояния к селектору (псевдоклассы после target).
 */
export function compileStates(lexeme: ParsedLexeme,
  synonyms?: Record<string, string>): string {
  const context = lexeme.context;
  const ctxLen = context.length;
  // §6.2: переменные до цикла, §6.3: кешируем synonyms
  let i = 0;
  let seg: (typeof context)[0];
  let stateName: string;
  let args: string | null;
  let resolved: string | undefined;
  let result = '';

  for (; i < ctxLen; i++) {
    seg = context[i];
    if (seg.kind !== 'state') {
      continue;
    }

    stateName = (seg as StateSegment).name;
    args = (seg as StateSegment).args;

    resolved = synonyms ? synonyms[stateName] : undefined;
    if (resolved) {
      result += (args !== null)
        ? resolved + '(' + args + ')'
        : resolved;
    } else {
      result += (args !== null)
        ? ':' + stateName + '(' + args + ')'
        : ':' + stateName;
    }
  }

  return result;
}
