/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  escapeCss,
  escapeQuote,
  extend,
  mapIn,
  push,
  reduceIn,
  repeat,
  unslash,
  variants,
} from 'fundamentool';
import {
  assertMediaNames,
  assertVariantGroups,
  assertTrailingSeparator,
  REGEXP_MATCH_IMPORTANT,
  REGEXP_MATCH_NAME,
} from '../core/utils';
import {
  selectorNormalize,
} from '../selectorNormalize';
import {
  MnParseError,
} from '../core/types';
import type {
  AltMap,
  MnChain,
  MnContext,
  MnSegment,
  MnStateNode,
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
  childSelectorMessage, importantMessage, maxDepthMessage, specificityMessage,
} from './raiseMessages';
import {
  getCombinator,
} from './getCombinator';
import type {
  MnDepthCheck,
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
 * позже, явным `unslash` в `suffixesReduce`. Раньше здесь снимался unslash преждевременно
 * (`variants(comboName)[0]`, без `false`) — экранирование терялось до того, как
 * `extractSuffix` успевал его увидеть, из-за чего `\.` в значении (например, `maski_a\.png`)
 * не защищало точку от трактовки как self-class-границы. Найдено и исправлено 2026-08-10
 * вместе со связанным багом regex в `constants.ts` (`splitSelector`/`extractSuffix`).
 */
/**
 * Похоже ли имя на MN-токен, то есть стоит ли вообще придираться к его
 * структуре.
 *
 * Критерий: имя начинается со строчной буквы, и этот префикс зарегистрирован
 * как тег. Чужие классы в разметке сплошь и рядом начинаются с букв
 * (`sr-only`, `my-widget`) или вовсе не являются классами (`...` из образца
 * в комментарии), и придираться к ним не за что — автор их писал не в нотации.
 *
 * До 2026-09-26 порядок был обратный: структура проверялась раньше, чем
 * выяснялось, есть ли у имени тег. `sr-only` давало `Parameter is invalid`
 * (тег `s` существует, а `-only` не разбирается), `...` — «висячий
 * сепаратор», и со `strict: true` любой из них ронял сборку. Решение
 * владельца: падать не должно (трек `scanner-robustness`, задача 1; уточняет
 * D-014, где такую границу оставляли как есть).
 *
 * Настоящие ошибки в токенах это не затрагивает: у `w50@`, `p10:`, `cF00.`
 * тег зарегистрирован, предупреждение остаётся.
 */
function looksLikeToken(comboName: string, handlerMap: Record<string, unknown>): boolean {
  const matched = REGEXP_MATCH_NAME.exec(comboName);
  return !!matched && !!handlerMap[matched[1]];
}

function variantsBase(comboName: string, handlerMap: Record<string, unknown>): string[] {
  // Вырожденная группа (скобки без `|`) молча съедала бы сами скобки — см.
  // JSDoc `assertVariantGroups`. Бросается MnParseError: `parseComboName`
  // обёрнут перехватчиком, который превращает её в warning `parse-error`,
  // и токен не даёт CSS вовсе — как и у вырожденных контекстных сегментов.
  //
  // Проверки структуры — только для того, что похоже на MN-токен: иначе
  // чужой класс из разметки роняет сборку под `strict`.
  if (!looksLikeToken(comboName, handlerMap)) {
    return variants(comboName, false)[0];
  }
  // Структуру скобок проверяем по записи: непарная или пустая скобка видна
  // только в ней, после развёртки её уже нет.
  assertVariantGroups(
    comboName, 'variants', 1,
  );
  const alts = variants(comboName, false)[0];
  // А вырожденный вариант — по РЕЗУЛЬТАТУ развёртки. Пустая альтернатива сама
  // по себе не дефект: `w(|max)150` даёт законные `w150` и `wmax150`. Дефект —
  // когда вариант остаётся без части контекста: `p10@(sm|)` даёт `p10@`
  // (висячий `@`), `p10@(|sm):h` — `p10@:h` (пустое имя медиа). Проверка по
  // результату ловит ровно это и заодно закрывает те же формы, записанные
  // напрямую, без группы: `p10@:h` до 2026-10-04 компилировался молча.
  const l = alts.length;
  let i = 0;
  for (; i < l; i++) {
    assertTrailingSeparator(alts[i], 'variants');
    assertMediaNames(alts[i], 'variants');
  }
  return alts;
}

/**
 * Группирует один вариант comboName (`altComboName`) по его нормализованному суффиксу
 * (контекст `<parent`/`>child`/`:state`/`@media`).
 *
 * Несколько эссенций с БУКВАЛЬНО одинаковым суффиксом (например разные значения одного
 * префикса, `w50:hover` и `w100:hover`) попадают в один и тот же `suffixes[suffix]`, чтобы
 * их общий контекст (`parseContext`/`buildContext`) вычислялся один раз на всех, а не на
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
 * const scp = selectorsCompileProvider;
 * const result = scp.parseClass('w50');
 * // → [[{ w50: 1 }, { '.w50': [[0, undefined]] }]]
 */
export function selectorsCompileProvider(instance?: ParseComboNameFn) {
  let $$states: StrMap<string[]>;
  let $$synonyms: StrMap<AltMap>;

  /**
   * Проверка мягкого `maxDepth` для {@link getCombinator} — ОДИН объект на
   * провайдер, а не новый на каждый разбор имени.
   *
   * Раньше он собирался заново внутри `parseComboName`: новый объект плюс новое
   * замыкание `onExceed` на каждый токен, причём `onExceed` зовётся только при
   * превышении лимита, то есть почти никогда. Единственное, что реально менялось
   * от токена к токену, — `token`; его и обновляем перед разбором, а `onExceed`
   * читает значение из самого объекта, а не из замыкания над `comboName`.
   */
  const $$depthCheck: MnDepthCheck = {
    maxDepth: undefined,
    token: '',
    // Режим `maxDepthMode` решает ядро (D-039); без ядра (`selectorsCompileProvider`
    // отдельно) превышение ни на что не влияет.
    onExceed: (depth: number, maxDepth: number) => (instance as any)._raisedToken?.(
      $$depthCheck.token, 'max-depth-exceeded',
      (strict: boolean) => maxDepthMessage(
        depth, maxDepth, strict,
      ),
    ),
  };

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
   * Каждый `childName` — самостоятельная `<parent`-цепочка (см. {@link parseChain}),
   * без явного целевого селектора (`alt: '*'` — если сам сегмент не задаёт класс/id,
   * подставляется wildcard). Она пристыковывается к уже накопленным `alts`
   * (более ранний, «внешний» селектор) через комбинатор из числового depth-префикса
   * (`getCombinator`) — то есть `alts` становится предком, а разобранный `childName` —
   * более глубоким потомком в итоговом CSS-селекторе.
   *
   * @param alts — селектор(ы), накопленные до этого `>`-сегмента
   * @param childName — один `>`-сегмент суффикса (может нести свой depth-префикс и `<`-цепочку)
   */
  function parseComboName(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    // ИСПРАВЛЕНО 2026-09-23: `states` заводится безусловно в момент
    // selectorsCompileProvider(instance) — НО это не делает фолбэк мёртвым,
    // как я сперва решил: `instance.states` документирован здесь же ниже
    // (см. getSynonyms) как ПУБЛИЧНАЯ "точка расширения для потребителя" —
    // внешний код имеет полное право присвоить `mn.states = {...}` целиком
    // (не домешивая в существующий объект), и тогда фолбэк на `{}` — не
    // страховка от гипотетической ошибки, а рабочий путь. `_synonyms` тем же
    // способом лениво заводится только при первом `mn.synonyms(...)`.
    $$states = (instance as any).states || {};
    $$synonyms = (instance as any)._synonyms || {};
    // Опции читаются на каждый разбор: `mn.setOptions` может поменять лимит
    // между вызовами. Обновляем три поля вместо аллокации объекта с замыканием.
    const $$mnOptions = (instance as any).options || {};
    $$depthCheck.maxDepth = $$mnOptions.maxDepth;
    $$depthCheck.token = comboName;
    // Режим синтаксиса (D-045): строки пресета — в режиме пресета (на время его `setup`),
    // остальное — в режиме проекта. Свой разборщик на режим (D-047); по умолчанию —
    // 'context-qualified' ниже.
    if (((instance as any)._presetMode || $$mnOptions.notationMode) === 'variant-prefixed') {
      return parseVariantPrefixed(comboName, targetName);
    }

    let name = comboName;
    let tgt = targetName;
    let multiplier: number;
    let suffix: string;
    let essence: string;
    let childs: string[];

    const multiplierMatch = REGEXP_MULTIPLIER.exec(name);
    if (multiplierMatch) {
      name = multiplierMatch[1];
      multiplier = parseInt(multiplierMatch[2]);
      if (multiplier > 1) {
        // Накрутка специфичности — свой режим (D-039); запрещённый токен CSS не даёт.
        if ((instance as any)._raisedToken?.(
          comboName, 'raised-specificity', (strict: boolean) => specificityMessage('*' + multiplier, strict),
        )) {
          return [];
        }
        tgt = repeat(tgt, multiplier);
      }
    }

    const suffixes = reduceIn(
      variantsBase(name, (instance as any).handlerMap || {}),
      suffixesReduce, {} as StrMap<StrMap<number>>,
    );
    // `!important` (`-i`) виден только в именах эссенций — после разворота групп;
    // дочерний сегмент `>` — в суффиксе (D-041).
    for (suffix in suffixes) { // eslint-disable-line
      if (suffix.indexOf('>') > -1 && (childs = splitChild(suffix)).length > 1
        && (instance as any)._raisedToken?.(
          comboName, 'child-selector',
          (strict: boolean) => childSelectorMessage('>' + childs.slice(1).join('>'), strict),
        )) {
        return [];
      }
      for (essence in suffixes[suffix]) { // eslint-disable-line
        if (REGEXP_MATCH_IMPORTANT.test(essence)
          && (instance as any)._raisedToken?.(
            comboName, 'important', importantMessage,
          )) {
          return [];
        }
      }
    }
    $$tgt = tgt;
    return (reduceIn as any)(
      suffixes, suffixesIteratee, [],
    );
  }

  /**
   * Целевой селектор текущего разбора — для {@link suffixesIteratee}.
   *
   * Итератор вынесен из тела `parseComboName` (там он создавался заново на
   * каждый токен, хотя от токена к токену менялся только `tgt`). Тот же приём,
   * что и с `$$depthCheck.token`: меняющееся значение кладём в поле провайдера,
   * функцию создаём один раз. Повторного входа в `parseComboName` нет —
   * `reduceIn` синхронный, рекурсии через него не возникает.
   */
  let $$tgt: string;

  function suffixesIteratee(
    items: Array<[StrMap<number>, AltMap]>, essences: StrMap<number>, suffix: string,
  ): Array<[StrMap<number>, AltMap]> {
    return push(items, [essences, buildContext(parseContext(suffix), $$tgt)]);
  }

  /**
   * Разборщик `'variant-prefixed'` (Tailwind, D-045/D-046): приставки варианта перед
   * классом — `dark:md:hover:group-hover:bg-blue-500`, `!mt-4`. Каждая приставка ищется:
   * 1. среди синонимов и `mn.states` — состояние самого элемента;
   * 2. среди имён медиа (`mn.media`) — медиа; имя есть и там, и там — берётся синоним;
   * 3. по шаблону `{метка}-{синоним|медиа}[/имя]` — метка, зарегистрированная в
   *    `mn.variantPrefixedSynonyms` (`group: '.group'` — предок, `peer: '.peer~'` — сосед),
   *    с этим состоянием или медиа (D-048).
   * Неизвестная приставка — предупреждение, CSS нет. Строк контекста нет: сразу
   * эталонная структура (D-047).
   *
   * @param comboName — класс в записи Tailwind
   * @param targetName — готовый селектор самого элемента
   */
  function parseVariantPrefixed(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    const prefixes = splitState(comboName);
    const l = prefixes.length - 1;
    const states: string[] = [''];
    const medias: string[] = [];
    const chain: MnChain = [[
      '',
      '',
      undefined,
      undefined,
    ]];
    const media: StrMap<unknown> = (instance as any).media || {};
    const essences: StrMap<number> = {};
    let utility = prefixes[l];
    let prefix: string;
    let i = 0;
    for (; i < l; i++) {
      prefix = prefixes[i];
      $$synonyms[prefix] || $$states[prefix]
        ? states.push(prefix)
        : media[prefix]
          ? medias.push(prefix)
          : pushVariantParent(
            chain, prefix, media,
          ) || throwUnknownVariant(comboName, prefix);
    }
    states.length > 1 && (chain[0][2] = [[states, undefined]]);
    medias.length && (chain[0][3] = medias.join('&'));
    if (utility[0] === '!') {
      utility = utility.slice(1);
      if ((instance as any)._raisedToken?.(
        comboName, 'important', importantMessage,
      )) {
        return [];
      }
      essences[unslash(utility) + '-i'] = 1;
    } else {
      essences[unslash(utility)] = 1;
    }
    return [[essences, buildContext([chain, []], targetName)]];
  }

  /**
   * `{метка}-{синоним|медиа}[/имя]` → метка в цепочке (D-046, D-048). Метка — только
   * зарегистрированная в `mn.variantPrefixedSynonyms` (`group: '.group'`, `peer: '.peer~'`),
   * как в Tailwind: иное имя — неизвестный вариант (опечатка `grop-hover:` не проходит
   * молча). `/имя` — именованная метка: `group-hover/item:` → `.group\/item:hover …`.
   * Перебор с правого дефиса, чтобы хвост рос: `peer-focus-visible` — сначала `visible`,
   * потом `focus-visible`.
   *
   * @returns найдено ли совпадение
   */
  function pushVariantParent(
    chain: MnChain, prefix: string, media: StrMap<unknown>,
  ): boolean {
    const relations: StrMap<string> = (instance as any)._variantPrefixedSynonyms || {};
    const slash = prefix.indexOf('/');
    const base = slash < 0 ? prefix : prefix.slice(0, slash);
    const label = slash < 0 ? '' : escapeCss(prefix.slice(slash));
    let i = base.lastIndexOf('-');
    let rest: string;
    let relation: string | undefined;
    let last: string;
    let isState: unknown;
    while (i > 0) {
      relation = relations[base.slice(0, i)];
      rest = base.slice(i + 1);
      isState = $$synonyms[rest] || $$states[rest];
      if (relation && (isState || media[rest])) {
        last = relation[relation.length - 1];
        last = last === '~' || last === '+' || last === '>' ? last : '';
        chain.push([
          last || ' ',
          (last ? relation.slice(0, -1) : relation) + label,
          isState ? [[['', rest], undefined]] : undefined,
          isState ? undefined : rest,
        ]);
        return true;
      }
      i = base.lastIndexOf('-', i - 1);
    }
    return false;
  }

  function throwUnknownVariant(comboName: string, prefix: string): never {
    throw new MnParseError('Variant "' + prefix + ':" is unknown — it is neither a synonym nor a media'
      + ' name, and "{label}-{synonym|media}" does not match a label registered with'
      + ' mn.variantPrefixedSynonyms. The class gives no CSS.', {
      token: comboName,
      handler: '',
      arg: prefix,
      utility: 'variant-prefixed',
    });
  }

  /**
   * Фаза разбора `'context-qualified'` (D-047): строка контекста (`:h@md<.group>1`) →
   * {@link MnContext}. Ошибки и проверки глубины (`getCombinator`) — здесь.
   *
   * @param suffix — нормализованный контекст одного варианта токена
   * @returns эталонная структура контекста
   */
  function parseContext(suffix: string): MnContext {
    const childNames = splitChild(suffix);
    const chain = parseChain(childNames.shift() as string);
    const childs: Array<[string, MnChain]> = [];
    const l = childNames.length;
    let i = 0;
    let part: [string, string];
    for (; i < l; i++) {
      part = getCombinator(
        childNames[i], $$depthCheck, true,
      );
      childs.push([part[0], parseChain(part[1])]);
    }
    return [chain, childs];
  }

  /**
   * `<`-цепочка (`Child<1Parent<2GrandParent`) → {@link MnChain}: первая часть — сам
   * элемент (без комбинатора), каждая следующая — предок со своим комбинатором глубины
   * (`getCombinator`: `0`/нет → пробел, `1` → `>`, `2+` → `> *>…`), состояниями и медиа.
   */
  function parseChain(name: string): MnChain {
    const parts = splitParent(name);
    const l = parts.length;
    const chain: MnChain = [];
    let i = 0;
    let mediaNames: string[];
    let part: [string, string];
    for (; i < l; i++) {
      mediaNames = [];
      part = i
        ? getCombinator(extractMedia(mediaNames, parts[i]), $$depthCheck)
        : ['', extractMedia(mediaNames, parts[i])];
      chain.push(parseSegment(
        part[0], part[1], mediaNames[0],
      ));
    }
    return chain;
  }

  /** Делит часть цепочки на селектор и состояния (`Parent:hover` → `Parent`, `:hover`). */
  function parseSegment(
    combinator: string, name: string, media: string | undefined,
  ): MnSegment {
    const i = name.indexOf(':');
    return i < 0
      ? [
        combinator,
        name,
        undefined,
        media,
      ]
      : [
        combinator,
        unslash(name.slice(0, i)),
        parseStates(name.slice(i)),
        media,
      ];
  }

  /** `':h:f[2n]'` → дерево {@link MnStateNode}: `[`/`]` — вложенность, `:` — состояния. */
  function parseStates(value: string): MnStateNode[] {
    return toStateNodes(scopeSplit2(
      value, SCOPE_START, SCOPE_END,
    ));
  }

  function toStateNodes(scopes: ScopeNode[]): MnStateNode[] {
    const l = scopes.length;
    const out: MnStateNode[] = [];
    let i = 0;
    let scope: ScopeNode;
    for (; i < l; i++) {
      scope = scopes[i];
      out.push([splitState(scope[0]), scope[1] && toStateNodes(scope[1])]);
    }
    return out;
  }

  /**
   * Фаза построения (D-047), общая для всех режимов: {@link MnContext} → селекторы с
   * медиа-альтернативами.
   *
   * @param context — эталонная структура контекста
   * @param targetName — готовый селектор самого элемента (`.p10`, `#id`)
   */
  function buildContext(context: MnContext, targetName: string): AltMap {
    const childs = context[1];
    const l = childs.length;
    let i = 0;
    let alts = buildChain(context[0], targetName);
    for (; i < l; i++) {
      alts = joinMapsWithFirstValue(
        alts, buildChain(childs[i][1], ''), childs[i][0],
      );
    }
    return mapIn(alts, mediaFilterIteratee as any);
  }

  /** Цепочка → AltMap: элемент склеивается с `targetName`, предки — через свои комбинаторы. */
  function buildChain(chain: MnChain, targetName: string): AltMap {
    const l = chain.length;
    let segment = chain[0];
    let alts = joinPrefixWithFirstValue(
      targetName + segment[1],
      buildStates(segment[2]),
      segment[3],
    );
    let i = 1;
    for (; i < l; i++) {
      segment = chain[i];
      alts = joinMapsWithFirstValue(
        joinPrefixWithFirstValue(
          segment[1],
          buildStates(segment[2]),
          segment[3],
        ),
        alts,
        segment[0],
      );
    }
    return alts;
  }

  /** Без состояний — одна пустая альтернатива: нечего раскрывать. */
  function buildStates(states: MnStateNode[] | undefined): AltMap {
    return states
      ? getSynonyms(states)
      : {
        '': [],
      };
  }

  /**
   * Разбирает `:state`-часть суффикса (после первого `:` в {@link parseSegment}) в AltMap.
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
  function getSynonyms(nodes: MnStateNode[]): AltMap {
    let alts: AltMap = {
      '': [], 
    };
    base(nodes, 1);
    return alts;

    function base(scopes: MnStateNode[], hasTop: number): void {
      const scopesL = scopes.length;
      let scopesI = 0;
      let scope: MnStateNode;
      let state: string;
      let _state: string;
      let states: string[];
      let childs: MnStateNode[] | undefined;
      let ns: string[];
      let si: number;
      let statesL: number;
      let statesI: number;
      // `shift()` у пустого массива даёт `undefined` — ниже это и
      // проверяется (`if (head)`).
      let head: string | undefined;
      let matches: RegExpExecArray | null;
      let suffix: string;
      let synonyms: AltMap;
      let wasEmpty: boolean;

      for (; scopesI < scopesL; scopesI++) {
        scope = scopes[scopesI];
        // Узел уже разобран (D-047): `[0]` — литеральный префикс, дальше — имена
        // состояний. Массив общий для кеша разбора — не мутируется.
        states = scope[0];
        head = states[0];
        if (head) {
          _pushSuffix(head);
        }
        statesL = states.length;
        statesI = 1;

        for (; statesI < statesL; statesI++) {
          // Пустое имя — признак псевдоЭЛЕМЕНТА (`p10::before` даёт пару
          // ['', 'before']). О следующем за ним имени предупреждать не о чем:
          // `::before` — не состояние и синонимом не заводится.
          wasEmpty = !states[statesI - 1] && statesI > 1;
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
              // Имени нет ни в синонимах, ни в `mn.states` — пропускаем как есть
              // (псевдокласс может быть специфичен для окружения или ещё не быть
              // в стандарте), но предупреждаем: `p10:fv` иначе давал мёртвое
              // правило `.p10\:fv:fv{…}` молча. Пустое имя — это `::before`
              // и подобные, там предупреждать не о чем.
              _state && !wasEmpty && (instance as any)._collectWarning?.({
                type: 'unregistered-state',
                token: $$depthCheck.token,
                message: 'State ":' + _state + '" is not registered — neither as a synonym '
                  + 'nor in `mn.states`. It goes to CSS as is; if it is a typo, '
                  + 'the rule is dead. Add a synonym '
                  + '(`mn.synonyms({ … })`) so the project has one canonical spelling',
              });
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

  return extend(instance || (instance = parseComboName as ParseComboNameFn),
    {
      states: {} as StrMap<string[]>,
      parseComboName,
      parseComboNameProvider,
      parseId,
      parseClass,
    });
}
