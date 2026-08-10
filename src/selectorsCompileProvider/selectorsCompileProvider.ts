/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  escapeCss,
  escapeQuote,
  extend,
  mapIn,
  push,
  reduce,
  reduceIn,
  repeat,
  unslash,
  variants,
} from 'fundamentool';
import {
  selectorNormalize,
} from '../selectorNormalize';
import type {
  AltMap,
  ParseComboNameFn,
  StrMap,
} from './types';
import {
  extractSuffix,
  REGEXP_MULTIPLIER,
  REGEXP_SCOPE_SUFFIX,
  SCOPE_END,
  SCOPE_START,
  splitChild,
  splitParent,
  splitState,
} from './constants';
import {
  scopeSplit2,
  type ScopeNode,
} from './scopeSplit2';
import {
  extractMedia,
  mediaFilterIteratee,
} from './extractMedia';
import {
  getCombinator,
} from './getCombinator';
import {
  joinMapsWithFirstValue,
  joinPrefixWithFirstValue,
} from './joinMaps';

/**
 * Разворачивает `(a|b)`-группы в comboName в список плоских вариантов (глубина не нужна).
 *
 * `applyUnslash: false` — экранирования (`\.` и т.п.) должны дожить до {@link suffixesReduce}/
 * `extractSuffix`, чей собственный escape-механизм (`splitSelector`/`extractSuffix`'s
 * `/\\.|[.+]\d/`) как раз и защищает их от трактовки как границы селектора; сняты они будут
 * позже, явным `unslash()` в `suffixesReduce`. Раньше здесь снимался unslash преждевременно
 * (`variants(comboName)[0]`, без `false`) — экранирование терялось до того, как
 * `extractSuffix` успевал его увидеть, из-за чего `\.` в значении (например, `maski_a\.png`)
 * не защищало точку от трактовки как self-class-границы. Найдено и исправлено 2026-08-10
 * вместе со связанным багом regex в `constants.ts` (`splitSelector`/`extractSuffix`).
 */
function variantsBase(comboName: string): string[] {
  return variants(comboName, false)[0];
}

/**
 * Группирует один вариант comboName (`altComboName`) по его нормализованному суффиксу
 * (контекст `<parent`/`>child`/`:state`/`@media`).
 *
 * Несколько эссенций с БУКВАЛЬНО одинаковым суффиксом (например разные значения одного
 * префикса, `w50:hover` и `w100:hover`) попадают в один и тот же `suffixes[suffix]`, чтобы
 * их общий контекст (`getParents`/`getSynonyms`) вычислялся один раз на всех, а не на
 * каждую эссенцию отдельно.
 *
 * @param suffixes — аккумулятор `нормализованный суффикс → { имя эссенции: 1 }`
 * @param altComboName — один вариант comboName после разворота `(a|b)`
 * @returns тот же `suffixes` (мутируется in-place, как редьюсер)
 */
function suffixesReduce(suffixes: StrMap<StrMap<number>>,
  altComboName: string): StrMap<StrMap<number>> {
  const extract = extractSuffix(altComboName);
  const suffix = selectorNormalize(extract[1]);
  (suffixes[suffix] || (suffixes[suffix] = {} as StrMap<number>))[unslash(extract[0])] = 1;
  return suffixes;
}

/**
 * Провайдер компиляции селекторов Minotation.
 *
 * Разбирает MN-комбо-имя (значение атрибута `class`, `id`, etc.) на
 * карту селекторов с медиа-привязками.
 *
 * ## Возвращаемый объект
 *
 * - `parseComboName(comboName, targetName)` — разобрать одно имя
 * - `parseComboNameProvider(attrName)` — получить парсер для атрибута
 * - `parseClass(comboName)` — разбор класса
 * - `parseId(comboName)` — разбор id
 * - `states` — состояния (синонимы сущностей)
 * - `_synonyms` — синонимы селекторов
 *
 * ## Формат результата parseComboName
 *
 * `Array<[StrMap<number>, AltMap]>` — массив пар:
 * - `StrMap<number>` — карта имён сущностей → 1
 * - `AltMap` — карта селекторов → массив `[медиа-приоритет, медиа-имя]`
 *
 * @param instance — существующий экземпляр для расширения
 * @returns расширенный экземпляр с методами парсинга
 *
 * @example
 * const scp = selectorsCompileProvider();
 * const result = scp.parseClass('w50');
 * // → [[{ w50: 1 }, { '.w50': [[0, undefined]] }]]
 */
export function selectorsCompileProvider(instance?: ParseComboNameFn) {
  let $$states: StrMap<string[]>;
  let $$synonyms: StrMap<AltMap>;

  const $$parsers: StrMap<ParseComboNameFn> = {
    'id': parseId,
    'class': parseClass,
  };

  /**
   * Возвращает (и кэширует) парсер для произвольного HTML-атрибута.
   *
   * `'id'`/`'class'` уже зарегистрированы в `$$parsers` как {@link parseId}/{@link parseClass};
   * любой другой атрибут (`'data-mn'` и т.п.) получает парсер лениво через {@link parseAttrProvider}.
   *
   * @param attrName — имя HTML-атрибута
   * @returns функция разбора значения этого атрибута
   */
  function parseComboNameProvider(attrName: string): ParseComboNameFn {
    return $$parsers[attrName]
      || ($$parsers[attrName] = parseAttrProvider(attrName));
  }

  /**
   * Разбирает значение атрибута `id`. Целевой CSS-селектор — `#значение`.
   *
   * @param comboName — сырое значение атрибута `id`
   */
  function parseId(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, '#' + escapeCss(comboName));
  }

  /**
   * Разбирает значение атрибута `class`. Целевой CSS-селектор — `.значение`.
   *
   * @param comboName — одно слово из атрибута `class`
   */
  function parseClass(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, '.' + escapeCss(comboName));
  }

  /**
   * Фабрика парсера для произвольного атрибута (не `id`/`class`).
   * Целевой CSS-селектор — `[attrName~="значение"]` (word-match, как у `class`).
   *
   * @param attrName — имя атрибута
   * @returns функция разбора значения этого атрибута
   */
  function parseAttrProvider(attrName: string): ParseComboNameFn {
    const prefix = '[' + attrName + '~="';
    return (comboName: string) => parseComboName(comboName,
      prefix + escapeQuote(comboName) + '"]');
  }

  /**
   * Редьюсер для `>child`-сегментов суффикса (см. {@link parseComboName}).
   *
   * Каждый `childName` — самостоятельная `<parent`-цепочка (см. {@link getParents}),
   * без явного целевого селектора (`alt: '*'` — если сам сегмент не задаёт класс/id,
   * подставляется wildcard). Она пристыковывается к уже накопленным `alts`
   * (более ранний, «внешний» селектор) через комбинатор из числового depth-префикса
   * (`getCombinator`) — то есть `alts` становится предком, а разобранный `childName` —
   * более глубоким потомком в итоговом CSS-селекторе.
   *
   * @param alts — селектор(ы), накопленные до этого `>`-сегмента
   * @param childName — один `>`-сегмент суффикса (может нести свой depth-префикс и `<`-цепочку)
   */
  function childsIteratee(alts: AltMap, childName: string): AltMap {
    const part = getCombinator(childName);
    return joinMapsWithFirstValue(
      alts,
      getParents(
        part[1], 0 as any, '*',
      ),
      part[0],
    );
  }

  /**
   * Разбирает одно MN-комбо-имя (значение `class`/`id`/атрибута) в карту CSS-селекторов.
   *
   * Конвейер: `(a|b)`-варианты → группировка по общему суффиксу-контексту
   * (`<parent`/`>child`/`:state`/`@media`, {@link suffixesReduce}) → для каждой группы —
   * `<`-цепочка предков через {@link getParents}, затем последовательные `>`-сегменты
   * через {@link childsIteratee} → схлопывание медиа-дублей ({@link mediaFilterIteratee}).
   * Полная грамматика контекстов — `AGENT_DRAFT/SPEC/04-grammar-02-parent-selectors.md`.
   *
   * Хвостовой множитель `*N` (см. `REGEXP_MULTIPLIER`) дублирует `targetName` N раз
   * ПОДРЯД без разделителя — это буст CSS-специфичности (`.el*3` → `.el.el.el`), а не
   * повтор правила.
   *
   * @param comboName — сырое имя (например `w50:hover<Parent`)
   * @param targetName — уже готовый целевой CSS-селектор (`.w50`, `#id`, `[attr~="..."]`)
   * @returns массив пар `[карта имён эссенций → 1, карта селектор → медиа-альтернативы]`
   */
  function parseComboName(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    $$states = (instance as any).states || {};
    $$synonyms = (instance as any)._synonyms || {};

    let name = comboName;
    let tgt = targetName;
    let multiplier: number;

    const multiplierMatch = REGEXP_MULTIPLIER.exec(name);
    if (multiplierMatch) {
      name = multiplierMatch[1];
      multiplier = parseInt(multiplierMatch[2]);
      if (multiplier > 1) {
        tgt = repeat(tgt, multiplier);
      }
    }

    const suffixes = reduceIn(
      variantsBase(name), suffixesReduce, {} as StrMap<StrMap<number>>,
    );
    return (reduceIn as any)(
      suffixes,
      (
        items: Array<[StrMap<number>, AltMap]>, essences: StrMap<number>, suffix: string,
      ) => {
        const childs = splitChild(suffix as any as string);
        const first = getParents(
          childs.shift(), tgt, '',
        );
        return push(items, [essences, mapIn(reduce(
          childs, childsIteratee as any, first,
        ), mediaFilterIteratee as any)]);
      },
      [],
    );
  }

  /**
   * Разбирает `<`-цепочку предков (`Child<1Parent<2GrandParent`) в AltMap готовых CSS-селекторов.
   *
   * Части, разделённые `<`, идут от цели к самому дальнему предку. Первая часть
   * склеивается с `targetName` (или `alt`, если `targetName` пуст); каждая следующая —
   * с накопленным результатом через комбинатор, определяемый её собственным числовым
   * depth-префиксом (`getCombinator`: `0`/нет → пробел-потомок, `1` → `>`, `2+` → `> *> ...`).
   * Каждая часть может нести собственный `:state`-суффикс, разворачиваемый в
   * {@link getEssence}/{@link getSynonyms}, и `@media`-суффикс ({@link extractMedia}).
   *
   * @param name — `<`-цепочка (без ведущего разделителя)
   * @param targetName — готовый селектор самого элемента (пусто — используется рекурсивно из {@link childsIteratee})
   * @param alt — запасной селектор, если `targetName` пуст (`'*'` — любой элемент)
   * @returns AltMap итоговых селекторов предковой цепочки
   */
  function getParents(
    name: string,
    targetName: string,
    alt: string,
  ): AltMap {
    const parts = splitParent(name);
    const l = parts.length;
    let i = 1;
    let mediaNames: string[] = [];
    let essence = getEssence(extractMedia(mediaNames, parts[0]));
    let alts = joinPrefixWithFirstValue(
      ((targetName || '') + essence[0]) || alt,
      essence[1],
      mediaNames[0],
    );
    let part: [string, string];

    for (; i < l; i++) {
      mediaNames = [];
      part = getCombinator(extractMedia(mediaNames, parts[i]));
      essence = getEssence(part[1]);
      alts = joinMapsWithFirstValue(
        joinPrefixWithFirstValue(
          essence[0] || '*',
          essence[1],
          mediaNames[0],
        ),
        alts,
        part[0],
      );
    }
    return alts;
  }

  /**
   * Разбирает `:state`-часть суффикса (после первого `:` в {@link getEssence}) в AltMap.
   *
   * `value` сначала делится на вложенные scope через `scopeSplit2(value, SCOPE_START, SCOPE_END)`
   * (границы `[`/`]`; локальный порт `mn-utils/scopeSplit2` из v1 — `fundamentool.scopeSplit`
   * возвращает другую, несовместимую форму, см. `scopeSplit2.ts`), затем на каждом уровне
   * текст сегмента — на `:`-разделённые токены ({@link StrMap} `splitState`). Первый токен
   * уровня — литеральный префикс (не ищется как состояние), остальные разрешаются по приоритету:
   * 1. `mn.synonyms(...)`-регистрация (`$$synonyms[state]`) — раскрывается в её AltMap;
   * 2. именованная группа состояний из `instance.states` (`$$states[state]`, публичный,
   *    но ничем в этом пакете не заполняется — точка расширения для потребителя);
   * 3. иначе — как обычный CSS-псевдокласс, литерально `:state`.
   * Вложенный scope (потомок в дереве `scopeSplit2`) оборачивается в `(...)` на верхнем
   * уровне и в `[...]` глубже — механика унаследована из v1.
   *
   * @param value — `:state`-суффикс (например `:hover`, `:(hover|focus)`)
   * @returns AltMap раскрытых состояний
   */
  function getSynonyms(value: string): AltMap {
    let alts: AltMap = {
      '': [], 
    };
    base(scopeSplit2(
      value, SCOPE_START, SCOPE_END,
    ), 1);
    return alts;

    function base(scopes: ScopeNode[], hasTop: number): void {
      const scopesL = scopes.length;
      let scopesI = 0;
      let scope: ScopeNode;
      let state: string;
      let _state: string;
      let states: string[];
      let childs: ScopeNode[] | undefined;
      let ns: string[];
      let si: number;
      let statesL: number;
      let statesI: number;
      let head: string;
      let matches: RegExpExecArray | null;
      let suffix: string;
      let synonyms: AltMap;

      for (; scopesI < scopesL; scopesI++) {
        scope = scopes[scopesI];
        states = splitState(scope[0]);
        head = states.shift();
        if (head) {
          _pushSuffix(head);
        }
        statesL = states.length;
        statesI = 0;

        for (; statesI < statesL; statesI++) {
          _state = state = unslash(states[statesI]);
          matches = REGEXP_SCOPE_SUFFIX.exec(_state);
          if (matches) {
            state = matches[1];
            suffix = matches[2];
          } else {
            suffix = '';
          }

          synonyms = $$synonyms[state];
          if (synonyms) {
            alts = joinMapsWithFirstValue(
              alts, synonyms, 0 as any, suffix,
            );
          } else {
            ns = $$states[state];
            if (ns && (si = ns.length)) {
              synonyms = {};
              for (; si--;) {
                synonyms[ns[si] + suffix] = [];
              }
              alts = joinMapsWithFirstValue(alts, synonyms);
            } else {
              _pushSuffix(':' + _state);
            }
          }
        }

        childs = scope[1];
        if (childs) {
          _pushSuffix(hasTop ? '(' : '[');
          base(childs, 0);
          _pushSuffix(hasTop ? ')' : ']');
        }
      }
    }

    function _pushSuffix(suffix: string): void {
      const prefixes = alts;
      let prefix: string;
      alts = {};
      for (prefix in prefixes) {
        alts[prefix + suffix] = prefixes[prefix];
      }
    }
  }

  /**
   * Делит одну часть `<`-цепочки на имя эссенции и её `:state`-суффикс.
   *
   * @param name — часть цепочки (например `Parent:hover`)
   * @returns `[имя без суффикса, AltMap состояний]` — без `:` в имени AltMap состоит
   *   из одной пустой альтернативы `{ '': [] }` (нечего раскрывать)
   */
  function getEssence(name: string): [string, AltMap] {
    const i = name.indexOf(':');
    return i < 0
      ? [name, {
        '': [], 
      }]
      : [unslash(name.substr(0, i)), getSynonyms(name.substr(i))];
  }

  return extend(instance || (instance = parseComboName as ParseComboNameFn),
    {
      states: {} as StrMap<string[]>,
      parseComboName,
      parseComboNameProvider,
      parseId,
      parseClass,
    });
}
