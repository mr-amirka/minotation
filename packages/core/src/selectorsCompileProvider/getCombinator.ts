/**
 * Утилиты для разбора комбинаторов в MN-селекторах.
 *
 * ## Комбинаторы
 *
 * MN поддерживает числовые префиксы глубины:
 * - `2Parent` → `>*>Parent` (2 уровня вложенности)
 * - `1Child` → `>Child` (прямой потомок)
 * - `Child` → ` Child` (пробел = потомок любой глубины)
 *
 * @module getCombinator
 */

import {
  repeat,
} from 'fundamentool';
import {
  REGEXP_DEPTH,
} from './constants';
import {
  MnParseError, 
} from '../core/types';

/**
 * Жёсткий потолок глубины контекстного селектора — НЕ настраивается опциями
 * инстанса, применяется всегда и безусловно (см. `AGENT_DRAFT/SPEC/10-error-warnings.md`
 * и решение пользователя 2026-09-03: «лимит всегда может резаться до 30»).
 * Защищает от патологически длинных/дорогих селекторов (`>*>*>...`) независимо
 * от того, настроен ли мягкий {@link MnDepthCheck.maxDepth} вообще.
 */
export const MN_MAX_DEPTH_HARD_LIMIT = 30;

/**
 * Генерирует CSS-комбинатор по глубине вложенности. Глубина всегда клэмпится
 * к {@link MN_MAX_DEPTH_HARD_LIMIT} — безусловно, без исключений.
 *
 * @param depth — глубина (0 = пробел, 1 = `>`, 2+ = `>*>...`)
 * @returns CSS-комбинаторная строка
 *
 * @example
 * getCombinatorByDepth(0)  // → ''
 * getCombinatorByDepth(1)  // → '>'
 * getCombinatorByDepth(2)  // → '>*>'
 */
export function getCombinatorByDepth(depth: number): string {
  const clamped = depth < MN_MAX_DEPTH_HARD_LIMIT ? depth : MN_MAX_DEPTH_HARD_LIMIT;
  return clamped < 1 ? '' : ('>' + repeat('*>', clamped - 1));
}

/** Опциональная проверка мягкого лимита глубины — {@link MnOptions.maxDepth}/`maxDepthMode`. */
export interface MnDepthCheck {
  /** Мягкий лимит; `undefined` — проверка пропускается (действует только жёсткий потолок). */
  maxDepth: number | undefined;
  /** `'block'` — бросает {@link MnParseError} (токен не даёт CSS); иначе — предупреждение, компиляция продолжается. */
  maxDepthMode: 'warn' | 'block' | undefined;
  /** Вызывается при превышении в режиме `'warn'` (в `'block'` вместо этого бросается `MnParseError`). */
  onExceed: (depth: number, maxDepth: number) => void;
  /** Исходный токен — для контекста в {@link MnParseError}/warning. */
  token: string;
}

/**
 * Разбирает имя на комбинатор и остаток.
 *
 * Формат: `(\d+)(.*)` — число = глубина, остаток = имя.
 *
 * @param name — имя с опциональным числовым префиксом (например `2Parent`)
 * @param depthCheck — опциональная проверка мягкого `maxDepth` (жёсткий потолок 30 — всегда, см. {@link getCombinatorByDepth})
 * @returns `[комбинатор, имя]` (например `['> *>', 'Parent']`)
 *
 * @example
 * getCombinator('Parent')    // → [' ', 'Parent']
 * getCombinator('1Child')    // → ['>', 'Child']
 * getCombinator('2Parent')   // → ['>*>', 'Parent']
 */
/**
 * Вырожденная форма контекстного сегмента — §13/§14 спеки
 * (`AGENT_DRAFT/SPEC/04-grammar-02-parent-selectors.md`).
 *
 * Все они в v1 «работали», но давали не то, что имел в виду автор токена:
 * пустой `<` и `<N` без селектора разворачивались в универсальный `*`
 * (правило цеплялось ко всему подряд), `<0` склеивал классы на одном элементе,
 * а отрицательная глубина молча ИНВЕРТИРОВАЛА направление (`<-1` вёл себя как
 * `>1`). Поэтому решение владельца 2026-09-24 — «выдаёт предупреждение и не
 * компилирует ничего в этих кейсах»: бросаем {@link MnParseError}, ядро
 * превращает его в warning `parse-error`, и токен не даёт CSS-правила вовсе.
 *
 * Контекст заполняется не полностью — имя хендлера и сам токен подставит
 * `__initEssence` (`core/index.ts`), там они известны.
 */
function throwDegenerate(
  message: string, name: string, token: string,
): never {
  throw new MnParseError(message, {
    token: token,
    handler: '',
    arg: name,
    utility: 'getCombinator',
  });
}

/** Отрицательная глубина: `<-1`, `>-2`. В v1 инвертировала направление. */
const REGEXP_NEGATIVE_DEPTH = /^-\d/;

export function getCombinator(name: string, depthCheck?: MnDepthCheck): [combinator: string, selector: string] {
  // Единственная проверка существования на весь вызов: дальше идёт уже готовая
  // строка токена, а блок мягкого лимита ниже заходит внутрь `if (depthCheck)`.
  // Параметр опционален только ради публичного API — внутри провайдера он
  // передаётся всегда (`$$depthCheck` в `selectorsCompileProvider`).
  const token = depthCheck ? depthCheck.token : '';
  const depthMatchs = REGEXP_DEPTH.exec(name);
  if (!depthMatchs) {
    if (!name) {
      throwDegenerate(
        'Пустой контекстный сегмент: укажите конкретный селектор вместо голого "<"/">"',
        name, token,
      );
    }
    if (REGEXP_NEGATIVE_DEPTH.test(name)) {
      throwDegenerate(
        'Отрицательная глубина контекстного селектора ("' + name
          + '") запрещена: в v1 она незаметно инвертировала направление',
        name, token,
      );
    }
    return [' ', name];
  }
  // Основание явно: без него `parseInt` формально зависит от формы строки.
  const depth = parseInt(depthMatchs[1], 10);
  if (depth === 0) {
    throwDegenerate(
      'Глубина 0 запрещена: она склеивает оба класса на одном элементе — '
        + 'используйте прямой селектор без "<"/">"',
      name, token,
    );
  }
  const selector = depthMatchs[2];
  if (!selector) {
    throwDegenerate(
      'Глубина (' + depth + ') без селектора запрещена: правило цеплялось бы '
        + 'к любому предку ("*")',
      name, token,
    );
  }
  if (depthCheck) {
    // §6.3: `depthCheck.maxDepth` читался до трёх раз за вызов — кешируем.
    const maxDepth = depthCheck.maxDepth;
    if (maxDepth !== undefined && depth > maxDepth) {
      if (depthCheck.maxDepthMode === 'block') {
        throw new MnParseError('Глубина контекстного селектора (' + depth
            + ') превышает maxDepth (' + maxDepth + ')',
        {
          token: token,
          handler: '',
          arg: name,
          utility: 'getCombinator',
          warningType: 'max-depth-exceeded',
        });
      }
      depthCheck.onExceed(depth, maxDepth);
    }
  }
  return [getCombinatorByDepth(depth), selector];
}
