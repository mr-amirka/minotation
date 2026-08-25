/**
 * Minotation — ядро.
 *
 * @module core
 */

import {
  eachApply,
  eachTry,
  forEach,
  forIn,
  includes,
  isArray,
  isDefined,
  isEmpty,
  isObject,
  isPlainObject,
  isString,
  keys,
  noop,
  push,
  values,
  extend,
  joinArrays,
  joinComma,
  joinMaps,
  joinOnly,
  reduceIn,
  color,
  colorGetBackground,
  cssPropertiesParseSimple,
  cssPropertiesStringifyProvider,
  type IStringifyCss,
  withDefer,
  withResult,
  getBase,
  set as baseSet,
} from 'fundamentool';
import {
  selectorsCompileProvider,
  extractMedia,
} from '../selectorsCompileProvider';
import {
  isInvalidSelector,
} from '../isInvalidSelector';
import {
  baseUtils,
  observableProvider,
  OBJECT,
  FUNCTION,
  STRING,
  MN_CONTEXT_ESSENCE_MAP,
  MN_CONTEXT_ESSENCE_SELECTORS,
  MN_CONTEXT_ESSENCE_CSS_TEXT,
  MN_CONTEXT_ESSENCE_UPDATED,
  MN_CONTEXT_ESSENCE_CONTENT,
  MN_KEYFRAMES_TOKEN,
  MN_DEFAULT_PRIORITY,
  MN_DEFAULT_CSS_PRIORITY,
  MN_DEFAULT_OTHER_CSS_PRIORITY,
  SPLIT_SELECTOR,
  SPLIT_AMP,
  REGEXP_MEDIA_PRIORITY,
  REGEXP_MATCH_VAR,
  REGEXP_MATCH_NAME,
  REGEXP_MATCH_IMPORTANT,
  REGEXP_MATCH_VALUE,
  JOIN_AND,
  normalizeSelectors,
  normalizeComboNames,
  normalizeSelectorsIteratee,
  __cssReducer,
  parseMediaPart,
  handlerWrap,
  __normalize,
  __mergeDepth,
  priotitySort,
  priotitySortContext,
  getEessenceSelectors,
  __compileProvider,
  spaceNormalize,
} from './utils';
import type {
  MnData,
  MnStatics,
  MnStyleEntry,
  MnCompiler,
  MnMediaEntry,
  MnContextEssence,
  MnEssenceResult,
  MnEssenceParams,
  MnOptions,
} from './types';
import type {
  MnEntity,
  MnHandler,
  MnInstance,
} from '../types';
import type {
  MnEssenceRaw,
} from './utils';

// Присваиваем utils статическому свойству (нужно для обратной совместимости)
minotationProvider.utils = baseUtils;

/**
 * Создаёт независимый экземпляр Minotation.
 *
 * Возвращает функцию `mn`, вызываемую и как регистратор хендлеров/эссенций
 * (`mn(name, handler)`), и как объект с методами API (`mn.compile()`, `mn.css()`, ...) —
 * см. {@link MnInstance}. Несколько экземпляров полностью независимы: своё состояние
 * (`$$essences`, `$$root`, `$$staticsEssences` и т.д.), свои пресеты, свой `styles$`.
 *
 * @param options — `presets` (загружаются сразу), `media`, `onError`, `selectorPrefix`, `altColor`
 * @returns экземпляр `mn`
 *
 * @example
 * const mn = minotationProvider({ presets: [presetStandard] });
 * mn.check('w50 cF00');
 * mn.compile();
 * mn.styles$.getValue(); // → скомпилированные CSS-стили
 */
function minotationProvider(options?: MnOptions) {
  options = options || {};
  function setPresets(presets: Array<(mn: MnInstance) => void>) {
    eachTry(
      presets,
      [mn],
      mn,
      emitError,
    );
  }
  function styleRender(): void {
    emit(values($$stylesMap).sort(priotitySort));
  }
  function updateOptions(): void {
    const options = mn.options || {};
    $$onError = options.onError || noop;
    $$selectorPrefixes = keys(selectorsValidateFilter(normalizeSelectors(options.selectorPrefix || '')));
    $$altColor = options.altColor !== 'off';
  }
  /**
   * Регистрирует эссенцию (хендлер/статический объект) под именем/путём —
   * или, если первый аргумент объект, пачкой (`{ [essencePath]: extendedEssence }`).
   * Возвращает сам `mn` для чейнинга. Полные перегрузки и семантика `skip` — {@link MnInstance}.
   *
   * @param essencePath — имя эссенции (`'w'`) или карта `{ имя: хендлер/эссенция }`
   * @param extendedEssence — хендлер, статическая эссенция или строка (`exts`), если `essencePath` — строка
   * @param paramsMatchPath — паттерн для {@link handlerWrap}, если хендлеру нужен собственный разбор суффикса
   * @param skip — 0/1: пропустить авто-парсинг значения из суффикса токена
   * @returns сам `mn` (чейнинг)
   */
  function mn(
    essencePath: string | Record<string, MnHandler | MnEntity | string>,
    extendedEssence?: MnHandler | MnEntity | string,
    paramsMatchPath?: string | string[],
    skip?: number,
  ): any {
    const type = typeof essencePath;
    type === OBJECT
      ? forIn(essencePath as Record<string, MnHandler | MnEntity | string>, baseSetMapIteratee)
      : (
        !essencePath || type !== STRING
          ? console.warn('MN: essencePath value must be an string', essencePath)
          : mnBaseSet(
            extendedEssence,
            essencePath as string,
            paramsMatchPath,
            skip,
          )
      );
    return mn;
  }

  function mnBaseSet(
    extendedEssence: MnHandler | MnEntity | string,
    essencePath: string,
    paramsMatchPath?: string | string[],
    skip?: number,
  ): void {
    let v: (((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }) | undefined;
    const type = typeof extendedEssence;
    type === FUNCTION
      ? (
        v = $$handlerMap[essencePath] = paramsMatchPath
          ? handlerWrap(extendedEssence as MnHandler, paramsMatchPath)
          : extendedEssence as (p: MnEssenceParams) => MnEssenceRaw | void | 0,
        v.skip = skip || 0
      )
      : (
        type === OBJECT
          ? baseSetEssense(essencePath, extendedEssence as MnEntity)
          : (
            type === STRING
              ? baseSetEssense(essencePath, {
                exts: extendedEssence as string,
              })
              : console.warn(
                'MN: extendedEssence value must be an object on',
                extendedEssence, 'where', essencePath,
              )
          )
      );
  }

  // isArray-ветка (тюпл [handler, pattern]) — легальна на уровне реализации, но нигде
  // не используется в presets/*.ts или тестах и не задокументирована в MnInstance.
  function baseSetMapIteratee(extendedEssence: MnHandler | MnEntity | string | [MnHandler, string], essencePath: string): void {
    isArray(extendedEssence)
      ? mnBaseSet(
        extendedEssence[0],
        essencePath,
        extendedEssence[1],
      )
      : mnBaseSet(extendedEssence,
        essencePath);
  }

  function baseSetEssenseBase(
    name: string, path: string[], extendedEssence: MnEssenceRaw,
  ): void {
    $$staticsEssences[name] || ($$staticsEssences[name] = __normalize({
      inited: 1,
    }) as MnEssenceResult);
    baseSet(
      $$staticsEssences, path, __mergeDepth([getBase($$staticsEssences, path), __normalize(extendedEssence)], {}),
    );
  }

  function baseSetEssense(_essencePath: string, extendedEssence: MnEssenceRaw): void {
    const essencePath = _essencePath.split('.');
    const essenceName = essencePath[0];
    const path = [essenceName];
    const l = essencePath.length;
    let i = 1;
    for (;i < l; i++) {
      push(
        path, 'childs', essencePath[i],
      );
    }
    baseSetEssenseBase(
      essenceName, path, extendedEssence,
    );
    // for important
    baseSetEssenseBase(
      path[0] = essenceName + '-i', path,
      extend(extend({}, extendedEssence), {
        important: 1,
      }),
    );
  }

  function getCompiler(attrName: string): MnCompiler {
    return $$compilers[attrName]
      || ($$compilers[attrName] = __compileProvider(attrName));
  }

  /**
   * Записывает готовый CSS-текст под ключом в `$$stylesMap` и помечает `$$updated`.
   * Используется как для внутренних источников (`'css'`, `MN_KEYFRAMES_TOKEN`),
   * так и для произвольного пользовательского CSS через {@link MnInstance.setStyle}.
   *
   * @param name — уникальный ключ записи в `$$stylesMap` (не CSS-селектор)
   * @param content — готовый CSS-текст
   * @param priority — порядок сортировки при финальной сборке (`priotitySort`)
   * @returns сам `mn` (чейнинг)
   */
  function setStyle(
    name: string, content: string, priority: number,
  ): any {
    $$stylesMap[name] = {
      name,
      priority: priority || 0,
      content: content || '',
      revision: ++$$revision,
    };
    $$updated = 1;
    return mn;
  }


  (selectorsCompileProvider as any)(mn);
  const parseComboNameProvider = (mn as any).parseComboNameProvider;
  const __parseComboName: any = withCatchParseComboNameDecorate((mn as any).parseComboName);

  /**
   * Пересчитывает CSS-правила для набора комбо-имён одного атрибута, переданных
   * КАРТОЙ `{ comboName: 1 }` (например снимок `MnCompiler.cache` — полный набор
   * текущих значений атрибута на странице).
   *
   * @param comboNamesMap — карта комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута (`'class'`, `'id'` и т.д.)
   */
  const updateAttrByMap = mn.updateAttrByMap = withResult((comboNamesMap: Record<string, number>, attrName: string) => {
    // eslint-disable-next-line
    let parseComboName: any = withCatchParseComboNameDecorate(parseComboNameProvider(attrName));
    let comboName: string;
    for (comboName in comboNamesMap) forEach( // eslint-disable-line
      parseComboName(comboName), updateSelectorIteratee);
  }, mn);
  /**
   * То же, что {@link updateAttrByMap}, но для СПИСКА новых комбо-имён
   * (например `MnCompiler.getNext()` — только что появившиеся значения атрибута).
   *
   * @param comboNames — массив комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута
   */
  const updateAttrByValues = mn.updateAttrByValues = withResult((comboNames: string[], attrName: string) => {
    // eslint-disable-next-line
    const parseComboName: any = withCatchParseComboNameDecorate(parseComboNameProvider(attrName));
    forEach(comboNames, (comboName: string) => {
      forEach(parseComboName(comboName), updateSelectorIteratee);
    });
  }, mn);

  /**
   * Полная пересборка CSS с нуля по явно переданному снимку атрибутов —
   * `{ attrName: { comboName: 1 } }` (в отличие от {@link MnInstance.compile},
   * не читает состояние компиляторов из `getCompiler`).
   *
   * @param attrsMap — снимок `{ attrName: comboNamesMap }` по всем нужным атрибутам
   */
  mn.recompileFrom = withResult((attrsMap: Record<string, Record<string, number>>) => {
    __clear();
    updateOptions();
    forIn(attrsMap, updateAttrByMap);
    forIn($$root, generate);
    cssRender();
    keyframesRender();
    styleRender();
  }, mn);

  /**
   * Возвращает компилятор для указанного атрибута.
   *
   * Компилятор собирает токены из DOM-атрибутов (например `class="w50 cF00"`).
   *
   * @param attrName — имя атрибута (`'class'`, `'id'`, `'m-n'` и др.)
   * @returns компилятор с методами `clear()`, `getNext()`, `checkNode()`, `recursiveCheck()`
   */
  mn.getCompiler = getCompiler;
  /**
   * Рекурсивно обходит поддерево DOM от `node` и проверяет узлы по каждому из `attrs`
   * (см. `MnCompiler.recursiveCheck`) — используется для первичного скана/после
   * массовых DOM-изменений (SSR-гидрация, вставка большого фрагмента).
   *
   * @param node — корневой DOM-узел обхода
   * @param attrs — имя атрибута или список имён (`'class'`, `['class', 'id']`)
   */
  mn.recursiveCheckByAttrs = withResult((node: any, attrs: string | string[]) => {
    eachApply((isString(attrs) ? [attrs] : attrs).map(getCompiler)
      .map(x => x.recursiveCheck), [node]);
  }, mn);
  /**
   * Проверяет ОДИН узел (без рекурсии в потомков) по каждому из `attrs` —
   * дешевле {@link MnInstance.recursiveCheckByAttrs} для точечных обновлений
   * (например реакция на мутацию одного элемента).
   *
   * @param node — DOM-узел для проверки
   * @param attrs — имя атрибута или список имён
   */
  mn.checkOneNodeByAttrs = withResult((node: any, attrs: string | string[]) => {
    eachApply((isString(attrs) ? [attrs] : attrs).map(getCompiler)
      .map(x => x.checkNode), [node]);
  }, mn);
  /**
   * Прогоняет ГОТОВОЕ значение атрибута (не DOM-узел) через компилятор(ы) —
   * когда значение известно без чтения DOM (SSR, ручная генерация классов).
   *
   * @param v — значение атрибута (например `'w50 cF00'`)
   * @param attrs — имя атрибута или список имён, каждому передаётся то же `v`
   */
  mn.checkByAttrs = withResult((v: string, attrs: string | string[]) => {
    isString(attrs)
      ? getCompiler(attrs)(v)
      : eachApply(attrs.map(getCompiler), [v]);
  }, mn);
  /**
   * Добавляет произвольный именованный CSS-блок в стили экземпляра
   * (обёртка над {@link setStyle} с префиксом `'custom.'` и дефолтным приоритетом).
   *
   * @param name — уникальное имя блока (ключ, не селектор)
   * @param content — готовый CSS-текст
   * @param priority — порядок сортировки (default `MN_DEFAULT_OTHER_CSS_PRIORITY`)
   * @returns сам `mn` (чейнинг)
   *
   * @example
   * mn.setStyle('reset', '*{box-sizing:border-box}');
   */
  mn.setStyle = (
    name: string, content: string, priority?: number,
  ) => setStyle(
    'custom.' + name, content, priority || MN_DEFAULT_OTHER_CSS_PRIORITY,
  );

  mn.options = extend({}, options) as MnOptions;
  const $$data = mn.data = {} as MnData;
  const $$compilers: Record<string, MnCompiler> = $$data.compilers = {};
  const cssPropertiesStringify: IStringifyCss = mn.propertiesStringify
    = cssPropertiesStringifyProvider();
  const emit = (mn.styles$ = observableProvider<MnStyleEntry[]>([])).emit;
  const error$ = mn.error$ = observableProvider<Error | undefined>(undefined);
  const emitError = error$.emit;
  let $$onError = noop as (e: Error) => void;
  let $$updated: number;
  let $$essences: Record<string, MnEssenceResult>;
  let $$root: Record<string, Record<string, MnContextEssence>>;
  let $$statics: MnStatics;
  let $$staticsAssigned: Record<string, Record<string, Record<string, number>>>;
  let $$staticsEssences: Record<string, MnEssenceResult>;
  let $$keyframes: [Record<string, string>, number];
  let $$css: [Record<string, { css: Record<string, string[]>;
    content?: string }>, number];
  let $$stylesMap: Record<string, MnStyleEntry> = $$data.stylesMap = {};
  let $$assigned: Record<string, Record<string, Record<string, number>>> = $$data.assigned = {};
  let $$media: Record<string, MnMediaEntry> = mn.media = options.media || {};
  let $$handlerMap: Record<string, ((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }> = mn.handlerMap = {};
  let $$force: number;
  let $$selectorPrefixes: string[];
  let $$altColor: boolean;
  let $$revision = 0;

  error$.on((error: Error) => {
    $$onError(error);
  });

  function withCatchParseComboNameDecorate(parseComboNameFn: (...args: any[]) => any): (...args: any[]) => any {
    return function() {
      try {
        // eslint-disable-next-line
        return parseComboNameFn.apply(this, arguments);
      } catch (ex) {
        emitError(ex);
      }
      return [];
    };
  }

  function selectorsValidateFilter<T>(selectorsMap: Record<string, T>): Record<string, T> {
    let selector: string;
    const output: Record<string, T> = {};
    for (selector in selectorsMap) { // eslint-disable-line
      isInvalidSelector(selector)
        ? emitError(new Error('Invalid selector: "' + selector + '"'))
        : (output[selector] = selectorsMap[selector]);
    }
    return output;
  }

  /**
   * Разбирает `@`-медиа-выражение в список готовых медиа-записей.
   *
   * Грамматика (полностью — `AGENT_DRAFT/SPEC/04-grammar-04-media.md`):
   * `media-expr ::= media-atom ('&' media-atom)* (',' media-expr)?` — `&` объединяет
   * атомы через AND в одном `@media (...)`, `,` заводит отдельную альтернативную запись.
   * Каждый атом — либо зарегистрированное имя медиа (`$$media`, добавляется через
   * `options.media`/`mn.media`), либо шаблон `WIDTHxHEIGHT` ({@link parseMediaTemplate})
   * с опциональным `^приоритет`.
   *
   * @param mediaExpression — например `'m&dark,tablet'`
   * @returns массив кортежей `[имя, приоритет, query, доп.селектор]`; `[[]]` — пустое выражение
   */
  function parseMediaExpression(mediaExpression: string): Array<[string, number | undefined, string, string] | []> {
    if (!mediaExpression) {
      return [[]];
    }

    let mediaPriority: number | undefined;
    let priority: number | undefined;
    let selector: string | undefined;
    let query: string;
    let partsAnd: string[];
    let iAnd: number;
    let lAnd: number;
    let fragment: string;
    let outputQuery: string[];
    let outputSelector: string[];
    let priorityMatch: RegExpExecArray | null;
    let mediaTemplate: [string] | [string, number | undefined];
    let name: string;
    let media: MnMediaEntry | undefined;
    const medias: Array<[string, number | undefined, string, string] | []> = [];
    const names: string[] = [];
    const queries: string[] = [];

    // get media priority
    if (priorityMatch = REGEXP_MEDIA_PRIORITY.exec(mediaExpression)) {
      mediaExpression = priorityMatch[1];
      mediaPriority = parseInt(priorityMatch[2]);
    }

    // eslint-disable-next-line
    let partsOr = SPLIT_SELECTOR(mediaExpression), iOr = 0, lOr = partsOr.length;
    for (;iOr < lOr; iOr++) {
      partsAnd = SPLIT_AMP(name = partsOr[iOr]);
      lAnd = partsAnd.length;
      iAnd = 0;
      outputQuery = [];
      outputSelector = [];
      priority = mediaPriority;
      for (;iAnd < lAnd; iAnd++) {
        (fragment = partsAnd[iAnd]) && (
          (media = $$media[fragment]) ? (
            (query = media.query) && push(outputQuery, query),
            (selector = media.selector) && push(outputSelector, selector),
            isDefined(priority) || (priority = media.priority)
          ) : (
            mediaTemplate = parseMediaTemplate(fragment),
            (query = mediaTemplate[0]) && push(outputQuery, query),
            isDefined(priority) || (priority = mediaTemplate[1])
          )
        );
      }

      query = JOIN_AND(outputQuery);
      (selector = joinOnly(outputSelector))
        ? push(medias, [
          name,
          priority,
          query,
          selector,
        ])
        : query && (
          push(names, name),
          push(queries, query)
        );
    }

    (query = joinComma(queries))
      && push(medias, [
        joinComma(names),
        priority,
        query,
        '',
      ]);
    return medias;
  }

  function parseMediaTemplate(mediaName: string): [string] | [string, number | undefined] {
    if (mediaName === 'x') {
      return [mediaName];
    }
    const queries: string[] = [];
    let mp: [number, number] | undefined;
    let v: number;
    let priority: number | undefined;
    const input = mediaName.split('x');
    try {
      (mp = parseMediaPart(input[0])) && (
        (v = mp[0]) && push(queries, '(min-width: ' + v + 'px)'),
        (v = mp[1]) && (
          priority = -v,
          push(queries, '(max-width: ' + v + 'px)')
        )
      );
      (mp = parseMediaPart(input[1])) && (
        (v = mp[0]) && push(queries, '(min-height: ' + v + 'px)'),
        (v = mp[1]) && (
          isDefined(priority) || (priority = -v),
          push(queries, '(max-height: ' + v + 'px)')
        )
      );
    } catch (ex) {
      return [mediaName];
    }
    return [JOIN_AND(queries), priority];
  }
  /** Публичный доступ к {@link parseMediaExpression} — разбор `@`-медиа-выражения без побочных эффектов. */
  mn.parseMediaExpression = parseMediaExpression;

  function generate(context: Record<string, MnContextEssence>, mediaExpression: string): void {
    const medias = parseMediaExpression(mediaExpression);
    const lMedia = medias.length;
    const updated: Record<string, number> = {};
    const globalSelectorPrefixes = $$selectorPrefixes;
    const lGSP = globalSelectorPrefixes.length;
    let iMedia = 0;
    let media: [string, number | undefined, string, string] | [];
    let mediaPriority: number | undefined;
    let mediaQuery: string;
    let essenceName: string;
    let contextEssence: MnContextEssence | undefined;
    let cssText: string;
    let output: string;
    let selectorPrefixes: string[] | 0;
    let selectorsIteratee: (selectors: string[]) => string;
    let isContinue: number;
    let mediaName: string;
    let mediaSelector: string;

    for (; iMedia < lMedia; iMedia++) {
      isContinue = 1;
      media = medias[iMedia];
      [
        mediaName,
        mediaPriority,
        mediaQuery,
        mediaSelector,
      ] = media;

      selectorPrefixes = lGSP
        ? (
          mediaSelector
            ? joinArrays(
              [mediaSelector], globalSelectorPrefixes, ' ',
            )
            : globalSelectorPrefixes
        )
        : (mediaSelector ? [mediaSelector] : 0);

      selectorsIteratee = selectorPrefixes
        ? ((selectors: string[]) => (
          joinComma(joinArrays(
            selectorPrefixes as string[], selectors, ' ',
          )) + cssText
        ))
        : ((selectors: string[]) => joinComma(selectors) + cssText);

      for (essenceName in context) { // eslint-disable-line
        (contextEssence = context[essenceName])
          && contextEssence[MN_CONTEXT_ESSENCE_UPDATED]
          && (
            isContinue = 0,
            updated[essenceName] = 1,
            cssText = contextEssence[MN_CONTEXT_ESSENCE_CSS_TEXT],
            contextEssence[MN_CONTEXT_ESSENCE_CONTENT][mediaName] = cssText
              ? joinOnly((() => {
                const sels = getEessenceSelectors(contextEssence[MN_CONTEXT_ESSENCE_MAP]);
                const result: string[] = [];
                for (let si = 0; si < sels.length; si++) {
                  result[si] = selectorsIteratee(sels[si]);
                }
                return result;
              })())
              : ''
          );
      }

      isContinue || (
        output = joinOnly((() => {
          const sorted = values(context).sort(priotitySortContext);
          const result: string[] = [];
          for (let si = 0; si < sorted.length; si++) {
            result[si] = sorted[si][MN_CONTEXT_ESSENCE_CONTENT][mediaName];
          }
          return result;
        })()),
        mediaQuery && mediaQuery !== 'all' && output
          && (output = joinOnly([
            '@media ',
            mediaQuery,
            '{',
            output,
            '}',
          ])),
        setStyle(
          'media.' + mediaName,
          output,
          isDefined(mediaPriority) ? mediaPriority : MN_DEFAULT_PRIORITY,
        )
      );
    }
    for (essenceName in updated) { // eslint-disable-line
      context[essenceName][MN_CONTEXT_ESSENCE_UPDATED] = 0;
    }
  }

  function __assignCore(
    assigned: Record<string, Record<string, Record<string, number>>>,
    comboNames: Record<string, number>,
    selectors: Record<string, number>,
    defaultMediaName?: string,
    excludes?: Record<string, number>,
  ): void {
    defaultMediaName = defaultMediaName || 'all';
    let name: string;
    let selector: string;
    let l: number;
    let i: number;
    let items: Array<[Record<string, number>, Record<string, string>]>;
    let essenceName: string;
    let item: [Record<string, number>, Record<string, string>];
    let selectorsMedias: Record<string, string>;
    let essencesNames: Record<string, number>;
    let childSelectors: Record<string, number>;
    let childSelector: string;
    let mediaName: string;
    let actx: Record<string, Record<string, number>>;

    for (name in comboNames) { // eslint-disable-line
      for (selector in selectors) { // eslint-disable-line
        for (
          items = __parseComboName(name, selector) as Array<[Record<string, number>, Record<string, string>]>,
          l = items.length, i = 0;
          i < l;
          i++
        ) {
          item = items[i];
          essencesNames = item[0];
          selectorsMedias = selectorsValidateFilter(item[1]);
          for (childSelector in selectorsMedias) { // eslint-disable-line
            mediaName = selectorsMedias[childSelector] || defaultMediaName;
            childSelectors = {};
            childSelectors[childSelector] = 1;
            actx = assigned[mediaName] || (assigned[mediaName] = {});
            for (essenceName in essencesNames) { // eslint-disable-line
              // eslint-disable-next-line
              (actx[essenceName] || (actx[essenceName] = {}))[childSelector] = 1;
              updateEssence(
                essenceName, childSelectors, mediaName, excludes,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Назначает селекторам комбо-имена (статические привязки).
   *
   * Используется в пресетах для связи CSS-правил с селекторами.
   *
   * @param selectors — строка селекторов или объект `{ [selector]: comboNames }`
   * @param comboNames — комбо-имена (если selectors — строка)
   * @param defaultMediaName — медиа по умолчанию (`'all'`)
   *
   * @example
   * mn.assign('*, *:before, *:after', 'bxzBB');
   * mn.assign({ html: 'lh115%', body: 'm' });
   */
  // selectors/comboNames: произвольная вложенная форма (строка/массив/объект), см. normalizeSelectors/normalizeComboNames.
  mn.assign = withResult((
    selectors: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    comboNames?: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    defaultMediaName?: string,
  ) => {
    // comboNames: произвольная вложенная форма, см. normalizeComboNames.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function iteratee(comboNames: string | string[] | Record<string, any>, s: string): void {
      __assignCore(
        $$staticsAssigned,
        normalizeComboNames(comboNames),
        normalizeSelectors(s),
        defaultMediaName,
      );
    }
    isPlainObject(selectors)
      ? forIn(selectors, iteratee)
      : iteratee(comboNames, selectors);
  }, mn);

  function __initEssence(value: string): MnEssenceRaw | 0 | null | void {
    let matchs: RegExpExecArray | null;
    let name: string;
    let ni: string | undefined;
    let suffix: string;
    let handle: (((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }) | undefined;
    let params: MnEssenceParams;
    let essence: MnEssenceRaw | void | 0;
    let err: Error;
    try {
      if (matchs = REGEXP_MATCH_VAR.exec(value)) {
        const varStyle: Record<string, string> = {};
        varStyle[matchs[1]] = spaceNormalize(matchs[2]);
        return {
          style: varStyle,
        };
      }
      return (matchs = REGEXP_MATCH_NAME.exec(value)) && (
        name = matchs[1],
        (matchs = REGEXP_MATCH_IMPORTANT.exec(suffix = matchs[2])) && (
          suffix = matchs[1],
          ni = matchs[2]
        ),
        (handle = $$handlerMap[name]) && (
          params = {
            name: name,
            suffix: suffix,
            ni: ni || '',
          },
          handle.skip || (matchs = REGEXP_MATCH_VALUE.exec(suffix)) && (
            params.value = matchs[2],
            params.camel = matchs[3],
            params.num = matchs[4],
            params.negative = matchs[5],
            params.unit = matchs[6],
            params.other = matchs[7]
          ),
          (essence = handle(params)) && (essence.important = ni ? 1 : 0),
          essence
        )
      );
    } catch (ex) {
      err = new Error('MN parsing error for essence "'
        + value + '": ' + ex.message);
      emitError(err);
    }
  }
  function initEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): void {
    let _essence: MnEssenceRaw | 0 | null | void;
    const staticEssence = $$staticsEssences[essenceName];
    const tmpEssence = staticEssence
      ? (
        staticEssence.inited
          ? staticEssence
          : (_essence = __initEssence(essenceName))
            && __mergeDepth([staticEssence, __normalize(_essence)], {})
      )
      : __normalize(__initEssence(essenceName));

    if (!tmpEssence) {
      return;
    }
    compileMixedEssence(
      essence, tmpEssence, excludes,
    );
    const important = essence.important;

    function __childsHandle(
      childs: Record<string, MnEssenceResult> | undefined, separator: string, withStatic?: number,
    ): void {
      const __prefix = essenceName + separator;
      forIn(childs, withStatic ? (_childEssence: MnEssenceResult, _childName: string) => {
        const childEssenceName = __prefix + _childName;
        const childStaticEssence = $$staticsEssences[childEssenceName];
        childs[_childName] = compileMixedEssence(
          $$essences[childEssenceName] = {},
          childStaticEssence
            ? (childStaticEssence.inited
              ? childStaticEssence
              : __mergeDepth([childStaticEssence, _childEssence], {}))
            : _childEssence,
          excludes, important,
        );
      } : (_childEssence: MnEssenceResult, _childName: string) => {
        childs[_childName] = compileMixedEssence(
          $$essences[__prefix + _childName] = {},
          _childEssence,
          excludes, important,
        );
      });
    }
    __childsHandle(essence.childs, '.');
    __childsHandle(
      essence.media, '@', 1,
    );
  }
  function compileMixedEssence(
    dst: MnEssenceResult, src: MnEssenceResult, excludes: Record<string, number>, important?: number,
  ): MnEssenceResult {
    const include = src.include;
    let i = include ? include.length : 0;
    let mergingMixins: MnEssenceResult[];
    let styleObj: Record<string, string | string[]> | undefined;
    let styleText: string | undefined;
    if (i) {
      mergingMixins = new Array(i + 1);
      mergingMixins[i] = src;
      // eslint-disable-next-line
      for (; i--;) mergingMixins[i] = updateEssence(include[i], {}, '', excludes) as MnEssenceResult;
      __mergeDepth(mergingMixins, dst);
    } else {
      extend(dst, src);
    }

    dst.cssText = (styleObj = dst.style)
      && (styleText = (cssPropertiesStringify as any)(styleObj, dst.important || important))
      ? ('{' + styleText + '}') : '';
    dst.inited = 1;
    return dst;
  }
  function createContextEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): MnContextEssence {
    essence.inited || initEssence(
      essenceName, essence, excludes,
    );
    return [
      {},
      essence.selectors,
      essence.priority || 0,
      essence.cssText,
      0,
      {},
    ];
  }
  function updateEssence(
    essenceName: string,
    selectors: Record<string, number>,
    mediaName: string,
    _excludes?: Record<string, number>,
    essence?: MnEssenceResult,
  ): MnEssenceResult | void {
    const excludes = extend({}, _excludes);
    if (excludes[essenceName]) {
      return;
    }
    mediaName = mediaName || 'all';
    excludes[essenceName] = 1;
    essence || (essence = $$essences[essenceName] || {});
    const context = $$root[mediaName] || ($$root[mediaName] = {});
    const contextEssence: MnContextEssence = context[essenceName] || (context[essenceName]
      = createContextEssence(
        essenceName, essence, excludes,
      ));

    isEmpty(essence) || ($$essences[essenceName] = essence);

    contextEssence[MN_CONTEXT_ESSENCE_UPDATED] = 1;
    extend(contextEssence[MN_CONTEXT_ESSENCE_MAP],
      selectors = joinMaps(selectors, contextEssence[MN_CONTEXT_ESSENCE_SELECTORS]));
    function __childsHandle(childs: Record<string, MnEssenceResult>, separator: string): void {
      let childName: string;
      for (childName in childs) updateEssence( // eslint-disable-line
        essenceName + separator + childName,
        selectors,
        mediaName,
        excludes,
        childs[childName],
      );
    }
    const {
      childs,
      media,
      exts,
    } = essence;
    childs && __childsHandle(childs, '.');
    media && __childsHandle(media, '@');
    exts && __assignCore(
      $$assigned, exts, selectors, mediaName, excludes,
    );
    return essence;
  }
  function updateSelectorIteratee(item: [Record<string, number>, Record<string, string>]): void {
    let selector: string;
    let essenceName: string;
    let mediaName: string;
    let selectors: Record<string, number>;
    const essences = item[0];
    const selectorsMedias = selectorsValidateFilter(item[1]);
    for (selector in selectorsMedias) { // eslint-disable-line
      mediaName = selectorsMedias[selector];
      selectors = {};
      selectors[selector] = 1;
      for (essenceName in essences) { // eslint-disable-line
        updateEssence(
          essenceName, selectors, mediaName,
        );
      }
    }
  }
  // selectors: произвольная вложенная форма, см. normalizeSelectors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function baseSetSynonyms(selectors: string | Record<string, any>, name: string): void {
    const selectorsMedias: Record<string, [number, string]> = {};
    let from: string;
    let to: string;
    let mediaNames: string[];
    const normalizedSelectors = normalizeSelectors(selectors);
    for (from in normalizedSelectors) { // eslint-disable-line
      to = extractMedia(mediaNames = [], from);
      selectorsMedias[to] = [0, mediaNames[0]];
    }
    // _synonyms: внутреннее expando-свойство, не часть публичного MnInstance.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((mn as any)._synonyms || ((mn as any)._synonyms = {}))[name] = selectorsMedias;
  }

  function __assignItemCompile(actx: Record<string, Record<string, number>>, mediaName: string): void {
    forIn(actx, (selectors: Record<string, number>, essenceName: string) => {
      updateEssence(
        essenceName, selectors, mediaName,
      );
    });
  }
  function __clear() {
    $$media = mn.media || (mn.media = {});
    $$handlerMap = mn.handlerMap || (mn.handlerMap = {});
    $$essences = $$data.essences = {};
    $$root = $$data.root = {};
    $$statics = $$data.statics || ($$data.statics = {
      essences: {},
      assigned: {}, 
    });

    $$staticsEssences = $$statics.essences || ($$statics.essences = {});
    $$keyframes = $$data.keyframes || ($$data.keyframes = [{}, 0]);
    $$css = $$data.css = $$data.css || [{}, 0];
    $$stylesMap = $$data.stylesMap = {};
    $$assigned = $$data.assigned = {};
    forIn($$staticsAssigned = $$statics.assigned || ($$statics.assigned = {}),
      __assignItemCompile);
  }
  __clear();
  /**
   * Полностью сбрасывает состояние экземпляра: карту эссенций, `$$root`, кэши
   * компиляторов атрибутов (`$$compilers[*].clear()`) и накопленный CSS.
   * Следующий {@link MnInstance.compile} пересоберёт всё с нуля.
   */
  mn.clear = withResult((attrName?: string) => {
    // eslint-disable-next-line
    for (attrName in $$compilers) $$compilers[attrName].clear();
    __clear();
  }, mn);

  /** Пересобирает CSS-блок `@keyframes` (`MN_KEYFRAMES_TOKEN`) из `$$keyframes[0]`, включая браузерные префиксы. Вызывается автоматически из {@link MnInstance.compile}, когда есть неприменённые изменения (`$$keyframes[1]`). */
  const keyframesRender = mn.keyframesCompile = withResult(() => {
    $$keyframes[1] = 0;
    const keyframesPrefix = MN_KEYFRAMES_TOKEN + ' ';
    const prefixes = cssPropertiesStringify.prefixes;
    // eslint-disable-next-line
    setStyle(MN_KEYFRAMES_TOKEN, joinOnly(reduceIn($$keyframes[0], (output: string[], v: string, k: string): string[] => {
      let prefix: string;
      for (prefix in prefixes) push( // eslint-disable-line
        output, '@' + prefix + keyframesPrefix + k + v);
      push(output, '@' + keyframesPrefix + k + v);
      return output;
    }, [],
    )), MN_DEFAULT_CSS_PRIORITY,
    );
  }, mn);
  /** Пересобирает CSS-блок `'css'` (сырой CSS из {@link MnInstance.css}) из `$$css[0]`. Вызывается автоматически из {@link MnInstance.compile}, когда есть неприменённые изменения (`$$css[1]`). */
  const cssRender = mn.cssCompile = withResult(() => {
    $$css[1] = 0;
    // eslint-disable-next-line
    setStyle('css', joinOnly(reduceIn($$css[0], __cssReducer, [])), MN_DEFAULT_CSS_PRIORITY);
  }, mn);

  /**
   * Компилирует накопленные токены в CSS-стили.
   *
   * Должен вызываться после того, как все токены собраны через `getCompiler()`.
   * Результат доступен через `mn.styles$.getValue()`.
   *
   * Инкрементально: по умолчанию читает только НОВЫЕ значения атрибутов
   * (`$$compilers[*].getNext()`) — уже обработанные не пересчитываются
   * (§16 `coding.md`, паттерн «два буфера»). Полный пересчёт — {@link MnInstance.recompile}.
   *
   * @returns mn (чейнинг)
   */
  const __render = mn.compile = withResult(() => {
    let attrName: string;
    updateOptions();
    if ($$force) {
      __clear();
      // eslint-disable-next-line
      for (attrName in $$compilers) {
        updateAttrByMap($$compilers[attrName].cache, attrName);
      }
    } else {
      // eslint-disable-next-line
      for (attrName in $$compilers) {
        updateAttrByValues($$compilers[attrName].getNext(), attrName);
      }
    }
    $$keyframes[1] && keyframesRender();
    $$css[1] && cssRender();
    forIn($$root, generate);
    $$updated && styleRender();
    $$updated = $$force = 0;
  }, mn);
  /**
   * Форсирует ПОЛНЫЙ пересчёт CSS (в отличие от инкрементального {@link MnInstance.compile}) —
   * очищает состояние и заново читает ВЕСЬ кэш каждого компилятора (`$$compilers[*].cache`),
   * а не только новые значения. Нужен, например, после смены `options` (`selectorPrefix`,
   * `altColor`), меняющей вывод для уже обработанных токенов.
   *
   * @returns mn (чейнинг)
   */
  mn.recompile = withResult(() => {
    $$force = 1;
    __render();
  }, mn);
  /** Отложенная (debounced/batched через `withDefer`) версия {@link MnInstance.compile} — несколько синхронных вызовов схлопываются в один реальный проход компиляции. */
  const deferCompile = mn.deferCompile = withDefer(__render, mn);
  /** Отложенная версия {@link MnInstance.recompile} (полный пересчёт), см. {@link deferCompile}. */
  mn.deferRecompile = () => {
    $$force = 1;
    return deferCompile();
  };
  /**
   * Регистрирует @keyframes-анимацию.
   *
   * @param name — имя анимации
   * @param body — тело анимации (строка или объект `{ '0%': {...}, '100%': {...} }`)
   * @param ifEmpty — если `true`, не перезаписывать существующую
   */
  // body/css: произвольная вложенная форма (строка или объект CSS-свойств).
  mn.setKeyframes = withResult((
    name: string,
    body: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ifEmpty?: number,
  ) => {
    const keyframes = $$keyframes[0];
    if (ifEmpty && keyframes[name]) {
      return;
    }
    if (body) {
      const output = ['{'];
      isObject(body)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? forIn(body, (css: string | Record<string, any>, k: string) => push(output, k + '{'
          + (isObject(css) ? cssPropertiesStringify(css) : css) + '}'))
        : push(output, body);
      push(output, '}');
      keyframes[name] = joinOnly(output);
    } else {
      delete keyframes[name];
    }
    $$keyframes[1] = 1;
  }, mn);

  /**
   * Добавляет сырой CSS.
   *
   * @param selector — CSS-селектор (строка) или объект `{ [selector]: cssProps }`
   * @param css — CSS-свойства (строка или объект)
   *
   * @example
   * mn.css('.myClass', { color: 'red', margin: '10px' });
   * mn.css({ '.a': { color: 'red' }, '.b': 'margin:0' });
   */
  // selector/css: произвольная вложенная форма (строка, селектор->свойства).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mn.css = withResult((selector: string | Record<string, any>, css?: string | Record<string, any>) => {
    const cssMap = $$css[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function baseSetCSS(css: string | Record<string, any>, s: string): void {
      s = joinComma(keys(normalizeSelectorsIteratee({}, s)));
      if (css) {
        const instance = cssMap[s] || (cssMap[s] = {
          css: {},
        });
        // Оба ветвления (объект/строка) пишут в один и тот же instance.css —
        // должны накапливать значения ОДИНАКОВО (массивом на свойство), иначе
        // при чередовании форм на одном селекторе (mn.css('.a', {color:'red'})
        // затем mn.css('.a', 'color:blue')) объектная ветка перезаписывала бы
        // значение голой строкой, а cssPropertiesParseSimple падал на
        // .push() к строке. Объектную форму нормализуем вручную тем же
        // способом (dedupe + push), а не через extend().
        isObject(css)
          ? forIn(css as Record<string, string>, (v: string, k: string) => {
            const existing = instance.css[k];
            existing
              ? (includes(existing, v) || existing.push(v))
              : (instance.css[k] = [v]);
          })
          : cssPropertiesParseSimple(css, instance.css);
        instance.content = joinOnly([
          s,
          '{',
          cssPropertiesStringify(instance.css),
          '}',
        ]);
      } else {
        delete cssMap[s];
      }
    }
    isObject(selector)
      ? forIn(selector, baseSetCSS)
      : baseSetCSS(css, selector);
    $$css[1] = 1;
  }, mn);

  /**
   * Регистрирует синонимы селекторов.
   *
   * @param synonym — имя синонима (строка) или объект `{ [name]: selectors }`
   * @param selectors — селекторы (строка или объект)
   *
   * @example
   * mn.synonyms('big', '.big');
   * mn.synonyms({ big: '.big', small: '.small' });
   */
  // synonym/selectors: произвольная вложенная форма, см. baseSetSynonyms/normalizeSelectors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mn.synonyms = withResult((synonym: string | Record<string, any>, selectors?: string | Record<string, any>) => {
    isObject(synonym)
      ? forIn(synonym, baseSetSynonyms)
      : baseSetSynonyms(selectors, synonym);
  }, mn);

  /**
   * Загружает пресеты (наборы хендлеров и стилей).
   *
   * Каждый пресет — функция `(mn) => void`, которая регистрирует хендлеры
   * и CSS через API экземпляра.
   *
   * @param presets — массив функций-пресетов
   *
   * @example
   * mn.setPresets([presetStyles, presetMedias, presetSynonyms]);
   */
  mn.setPresets = withResult(setPresets, mn);
  /**
   * Утилиты, доступные пресетам внутри `(mn) => {...}` (см. {@link MnUtils}).
   *
   * `baseUtils` (`core/utils.ts`) + `color`/`colorGetBackground`, переопределённые
   * здесь с зафиксированным `$$altColor` (из `options.altColor`, читается в
   * {@link updateOptions}) — сами пресеты передают только цвет, без второго аргумента.
   */
  mn.utils = extend(extend({}, baseUtils), {
    color: (v: string) => color(v, $$altColor),
    colorGetBackground: (v: string) => colorGetBackground(v, $$altColor),
  });

  updateOptions();
  options.presets?.length && setPresets(options.presets);

  return mn;
}

export default minotationProvider;
export {
  minotationProvider, 
};
