import {
  ParsedLexeme, ContextSegment, ParentSegment, ChildSegment, StateSegment, 
} from '../types';
import {
  splitStem, extractSelfClasses, 
} from './splitStem';
import {
  normalizeSelectorStr, 
} from '../preset/MnInstance/helpers';

// §6.3: кешированные regex
const RE_DIGITS_ONLY = /^[0-9]+$/;

// Служебные символы: < > : @
// Бенчмарк: прямые === в 3.7× быстрее indexOf (см. AGENT_DRAFT/BENCHMARKS/context-marker.md)
function isContextMarker(ch: string): boolean {
  return ch === '<' || ch === '>' || ch === ':' || ch === '@';
}

// Типы для внутренних кортежей (§2)
type MultResult = [withoutMult: string, multiplier: number | null];
type ParentChildResult = [segment: ParentSegment | ChildSegment, nextIndex: number];
type StateResult = [segment: StateSegment, nextIndex: number];
type ContextResult = [mediaName: string | null, segments: ContextSegment[]];

/**
 * Извлекает multiplier `*N` из конца лексемы.
 * Возвращает кортеж [лексема_без_множителя, множитель | null] (§2).
 */
function extractMultiplier(raw: string): MultResult {
  let i = raw.length;
  let numStr: string;
  let mult: number;
  // §6.4: обратный цикл — ищем * с конца
  while (i--) {
    if (raw[i] === '*') {
      numStr = raw.slice(i + 1);
      if (RE_DIGITS_ONLY.test(numStr)) {
        mult = parseInt(numStr, 10);
        return [raw.slice(0, i), mult > 1 ? mult : null];
      }
      break;
    }
  }
  return [raw, null];
}

/**
 * Разбирает лексему MN на стем, медиа и контекстные сегменты.
 *
 * Пример: `cF00@m<1.p:h` →
 *   stem: { raw: 'cF00', tag: 'c', arg: 'F00' }
 *   stemMedia: 'm'
 *   context: [
 *     { kind: 'parent', depth: 1, selector: '.p' },
 *     { kind: 'state', name: 'h', args: null },
 *   ]
 */
export function parseLexeme(raw: string): ParsedLexeme {
  // 1. Извлекаем multiplier
  const [withoutMult, multiplier] = extractMultiplier(raw);

  // 2. Находим границу стема: первый контекстный маркер
  // §6.2: переменные до цикла; §6.3: кешируем длину
  const len = withoutMult.length;
  let i = 0;
  let ch = '';
  let stemEnd = 0;

  for (; i < len; i++) {
    ch = withoutMult[i];
    // Экранирование: \x → пропускаем следующий символ
    if (ch === '\\') {
      i++;
      continue;
    }
    // Guard: .цифра не считается маркером
    if (i > 0 && withoutMult[i - 1] === '.'
      && ch >= '0' && ch <= '9') {
      continue;
    }
    if (isContextMarker(ch)) {
      stemEnd = i;
      break;
    }
  }

  const stemRaw = stemEnd > 0 ? withoutMult.slice(0, stemEnd) : withoutMult;
  const contextRaw = stemEnd > 0 ? withoutMult.slice(stemEnd) : '';

  // 3. Разбираем стем и извлекаем selfClasses (CSS-селекторный концерн, не часть Stem)
  const stem = splitStem(stemRaw);
  const selfClasses = extractSelfClasses(stemRaw);

  // 4. Разбираем контекст (§2: кортеж)
  const [mediaName, segments] = parseContext(contextRaw);

  return {
    raw,
    stem,
    selfClasses,
    stemMedia: mediaName,
    context: segments,
    multiplier,
  };
}

/**
 * Разбирает контекстную часть лексемы (всё после стема).
 * Возвращает кортеж [mediaName, segments] (§2).
 */
function parseContext(raw: string): ContextResult {
  if (!raw) {
    return [null, []];
  }

  const segments: ContextSegment[] = [];
  let mediaName: string | null = null;
  const len = raw.length;
  let i = 0;
  let ch = '';

  while (i < len) {
    ch = raw[i];

    // Экранирование
    if (ch === '\\') {
      i += 2;
      continue;
    }

    switch (ch) {
      case '@': {
        i++;
        const start = i;
        while (i < len && !isContextMarker(raw[i])) {
          if (raw[i] === '\\') {
            i++; 
          }
          i++;
        }
        mediaName = raw.slice(start, i);
        break;
      }
      case '<': {
        const [seg, next] = parseParentOrChild(
          raw, i, 'parent',
        );
        segments.push(seg);
        i = next;
        break;
      }
      case '>': {
        const [seg, next] = parseParentOrChild(
          raw, i, 'child',
        );
        segments.push(seg);
        i = next;
        break;
      }
      case ':': {
        const [seg, next] = parseState(raw, i);
        segments.push(seg);
        i = next;
        break;
      }
      default: {
        i++;
      }
    }
  }

  return [mediaName, segments];
}

/**
 * Парсит сегмент вида `<[depth]selector` или `>[depth]selector`.
 * Возвращает кортеж [segment, nextIndex] (§2).
 */
function parseParentOrChild(
  raw: string,
  startIndex: number,
  kind: 'parent' | 'child',
): ParentChildResult {
  let i = startIndex + 1;
  const len = raw.length;

  // Парсим опциональный depth — charCodeAt - 48: проверка 0-9 + значение
  let depth = 0;
  let code = 0;
  while (i < len && (code = raw.charCodeAt(i) - 48) >= 0 && code <= 9) {
    depth = depth * 10 + code;
    i++;
  }

  // Парсим selector-body до следующего маркера
  const selStart = i;
  while (i < len && !isContextMarker(raw[i])) {
    if (raw[i] === '\\') {
      i++; 
    }
    i++;
  }
  const selRaw = raw.slice(selStart, i);

  const seg: ParentSegment | ChildSegment = {
    kind,
    depth,
    selector: selRaw ? normalizeSelectorStr(selRaw) : '*',
  } as ParentSegment | ChildSegment;

  return [seg, i];
}

/**
 * Парсит сегмент состояния: `:name[args]`.
 * Возвращает кортеж [segment, nextIndex] (§2).
 */
function parseState(raw: string,
  startIndex: number): StateResult {
  let i = startIndex + 1;
  const len = raw.length;

  // Имя состояния (до [ или до маркера)
  const nameStart = i;
  let ch = '';
  while (i < len && (ch = raw[i]) !== '[' && !isContextMarker(ch)) {
    if (ch === '\\') {
      i++; 
    }
    i++;
  }
  const name = raw.slice(nameStart, i);

  // Аргументы в [...]
  let args: string | null = null;
  if (i < len && raw[i] === '[') {
    i++;
    let depth = 1;
    const argsStart = i;
    while (i < len && depth > 0) {
      ch = raw[i];
      if (ch === '\\') {
        i += 2; continue; 
      }
      if (ch === '[') {
        depth++;
      }
      if (ch === ']') {
        depth--;
      }
      if (depth > 0) {
        i++;
      }
    }
    args = raw.slice(argsStart, i);
    if (depth === 0) {
      i++;
    }
  }

  return [{
    kind: 'state',
    name,
    args, 
  }, i];
}
