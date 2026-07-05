import {
  Stem, 
} from '../types';

/**
 * Разделяет стем на тег, аргумент и флаг !important.
 *
 * **Тег** — начальная последовательность строчных латинских букв.
 * **Аргумент** — всё после тега, без `-i` и без self-class суффиксов.
 * **Self-class суффиксы** (.WORD / +WORD) отделяются здесь из аргумента,
 * но возвращаются отдельно через {@link extractSelfClasses} и собираются
 * в `ParsedLexeme.selfClasses` — это CSS-селекторный концерн, не часть Stem.
 *
 * @example
 * splitStem('ph10')         // { tag:'ph', arg:'10', important:false }
 * splitStem('cF.38')        // { tag:'c',  arg:'F.38', important:false }
 * splitStem('cF.active')    // { tag:'c',  arg:'F', important:false }
 * splitStem('cF.38.active') // { tag:'c',  arg:'F.38', important:false }
 * splitStem('cF-i.active')  // { tag:'c',  arg:'F', important:true }
 *
 * Флаг !important: -i идёт ДО self-class суффиксов.
 * splitStem('cF.active-i')  // { tag:'c',  arg:'F', important:false }
 *   ↑ -i после self-class — часть имени класса .active-i, НЕ флаг important
 */
export function splitStem(raw: string): Stem {
  const len = raw.length;
  let i = 0;
  let ch = '';
  for (; i < len; i++) {
    ch = raw[i];
    if (ch < 'a' || ch > 'z') {
      break;
    }
  }
  if (i === 0) {
    throw new Error(`Invalid stem: "${raw}"`);
  }
  const tag = raw.slice(0, i);
  let arg = raw.slice(i);
  let important = false;

  // Шаг 1: извлекаем trailing self-class суффиксы .WORD / +WORD / .*WORD / #*WORD.
  // §6.2: переменные до цикла
  let end = arg.length;
  let j: number;
  let firstAfterSep: string;
  let sep: string;
  while (end > 0) {
    j = end - 1;
    while (j >= 0 && arg[j] !== '.' && arg[j] !== '+' && arg[j] !== '#') {
      j--;
    }
    if (j < 0) {
      break;
    }
    sep = arg[j];
    firstAfterSep = arg[j + 1];
    if (firstAfterSep
        && ((firstAfterSep >= 'a' && firstAfterSep <= 'z')
          || (firstAfterSep >= 'A' && firstAfterSep <= 'Z'))) {
      // .WORD / +WORD — обычный self-class (WORD начинается с буквы)
      end = j;
    } else if ((sep === '.' || sep === '#') && firstAfterSep === '*') {
      // .*WORD / #*WORD — wildcard self-class → [class*=WORD] / [id*=WORD]
      const wordStart = arg[j + 2];
      if (wordStart && (
        (wordStart >= 'a' && wordStart <= 'z') || (wordStart >= 'A' && wordStart <= 'Z') ||
        (wordStart >= '0' && wordStart <= '9') ||
        wordStart === '-' || wordStart === '_' || wordStart === '$'
      )) {
        end = j;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  arg = arg.slice(0, end);

  // Шаг 2: извлекаем -i из конца оставшегося arg
  const aLen = arg.length;
  if (aLen >= 2 && arg[aLen - 2] === '-' && arg[aLen - 1] === 'i') {
    arg = arg.slice(0, -2);
    important = true;
  }

  return {
    raw,
    tag,
    arg,
    important, 
  };
}

/**
 * Извлекает trailing self-class суффиксы (.WORD / +WORD) из строки аргумента стема.
 * Симметрична логике в {@link splitStem}: то, что `splitStem` отрезает от `arg`,
 * это и возвращает.
 *
 * Вызывается из `parseLexeme` — self-class условия принадлежат `ParsedLexeme`,
 * не `Stem`.
 *
 * `.DIGIT` и `+DIGIT` — часть аргумента (opacity, числовые суффиксы), НЕ self-class.
 *
 * @example
 * extractSelfClasses('cF.active')    // ['.active']
 * extractSelfClasses('cF.38.active') // ['.active']      ← .38 — аргумент
 * extractSelfClasses('cF+active')    // ['+active']
 * extractSelfClasses('cF.38')        // []
 * extractSelfClasses('ph10')         // []
 */
export function extractSelfClasses(stemRaw: string): string[] {
  // Находим конец тега
  const len = stemRaw.length;
  let i = 0;
  while (i < len && stemRaw[i] >= 'a' && stemRaw[i] <= 'z') {
    i++;
  }
  // Сканируем суффикс аргумента с конца, как в splitStem
  const selfClasses: string[] = [];
  let end = len;
  let j: number;
  let firstAfterSep: string;
  let sep: string;
  while (end > i) {
    j = end - 1;
    while (j >= i && stemRaw[j] !== '.' && stemRaw[j] !== '+' && stemRaw[j] !== '#') {
      j--;
    }
    if (j < i) {
      break;
    }
    sep = stemRaw[j];
    firstAfterSep = stemRaw[j + 1];
    if (firstAfterSep
        && ((firstAfterSep >= 'a' && firstAfterSep <= 'z')
          || (firstAfterSep >= 'A' && firstAfterSep <= 'Z'))) {
      // .WORD / +WORD — обычный self-class
      selfClasses.unshift(stemRaw.slice(j, end));
      end = j;
    } else if ((sep === '.' || sep === '#') && firstAfterSep === '*') {
      // .*WORD / #*WORD — wildcard self-class
      const wordStart = stemRaw[j + 2];
      if (wordStart && (
        (wordStart >= 'a' && wordStart <= 'z') || (wordStart >= 'A' && wordStart <= 'Z') ||
        (wordStart >= '0' && wordStart <= '9') ||
        wordStart === '-' || wordStart === '_' || wordStart === '$'
      )) {
        selfClasses.unshift(stemRaw.slice(j, end));
        end = j;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return selfClasses;
}
