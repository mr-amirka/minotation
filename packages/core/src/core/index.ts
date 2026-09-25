/**
 * Minotation — ядро.
 *
 * ## Про `any` и присваивание внутри условия
 *
 * Оба отключённых ниже правила — осознанный стиль этого модуля, а не недосмотр.
 *
 * `no-explicit-any`: ядро принимает структуры, форма которых определяется
 * во время выполнения и статически не выражается — объекты параметров хендлера
 * (зависят от `pattern`, с которым хендлер зарегистрирован), «сырые» значения
 * пресетов до нормализации, узлы дерева неизвестного происхождения (ядро
 * работает и вне браузера). Там, где тип выразим, он указан явно — кортежи
 * эссенций (`MnEssenceResult`), опции, предупреждения.
 *
 * `no-cond-assign`: `if (m = re.exec(v))` — сквозная идиома компилятора,
 * унаследованная от v1. Разворот в две строки на горячем пути разбора токенов
 * добавил бы переменных и переходов, не прибавив ясности.
 *
 * @module core
 */
/* eslint-disable @typescript-eslint/no-explicit-any, no-cond-assign -- см. комментарий выше */

import {
  eachApply,
  eachTry,
  forEach,
  forIn,
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
  cssPropertiesStringifyProvider,
  type IStringifyCss,
  withDefer,
  getBase,
  set as baseSet,
} from 'fundamentool';
import {
  selectorsCompileProvider,
  extractMedia,
} from '../selectorsCompileProvider';
import type {
  ParseComboNameFn,
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
  MN_ESSENCE_STYLE,
  MN_ESSENCE_PRIORITY,
  MN_ESSENCE_IMPORTANT,
  MN_ESSENCE_EXTS,
  MN_ESSENCE_SELECTORS,
  MN_ESSENCE_CHILDS,
  MN_ESSENCE_MEDIA,
  MN_ESSENCE_INCLUDE,
  MN_ESSENCE_CSS_TEXT,
  MN_ESSENCE_INITED,
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
  REGEXP_IMPORTANT,
  REGEXP_MATCH_VALUE,
  REGEXP_INVALID_CSS_VALUE,
  JOIN_AND,
  normalizeSelectors,
  normalizeComboNames,
  parseMediaPart,
  isBadMediaRange,
  handlerWrap,
  __normalize,
  mergeEssenceInto,
  mergeEssenceDepth,
  priotitySort,
  priotitySortContext,
  getEessenceSelectors,
  __compileProvider,
  spaceNormalize,
} from './utils';
import {
  isValidCssPropertyValue, 
} from '../cssGrammar';
import type {
  MnData,
  MnStatics,
  MnStyleEntry,
  MnCompiler,
  MnMediaEntry,
  MnContextEssence,
  MnEssenceResult,
  MnEssenceRaw,
  MnEssenceParams,
  MnOptions,
  MnWarning,
} from './types';
import {
  MnParseError,
  MnStrictError,
} from './types';
import type {
  MnEntity,
  MnHandler,
  MnInstance,
} from '../types';

// Присваиваем utils статическому свойству (нужно для обратной совместимости)
minotationProvider.utils = baseUtils;

/** `MnOptions.onWarning` по умолчанию — `'console'` (см. `AGENT_DRAFT/SPEC/10-error-warnings.md` §4, Q2). */
function defaultOnWarning(warning: MnWarning): void {
  console.warn('[minotation] ' + warning.token + ': ' + warning.message);
}

/**
 * Создаёт независимый экземпляр Minotation.
 *
 * Возвращает функцию `mn`, вызываемую и как регистратор хендлеров/эссенций
 * (`mn(name, handler)`), и как объект с методами API (`mn.compile()`, `mn.assign()`, ...) —
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
  function setPresets(presets: Array<(mn: MnInstance) => void>): any {
    eachTry(
      presets,
      [mn],
      mn,
      emitError,
    );
    return mn;
  }
  function styleRender(): void {
    emit(values($$stylesMap).sort(priotitySort));
  }
  /**
   * Пересчитывает производные из `options` значения ($$onError/$$onWarning/
   * $$selectorPrefixes/$$altColor/$$strict) и публикует снимок в `mn.options`.
   *
   * ПЕРЕСМОТРЕНО 2026-09-23: раньше называлась `updateOptions()` и вызывалась
   * на КАЖДОМ `compile()`/`recompileFrom()`, перечитывая `mn.options` заново —
   * расчёт был на то, что потребитель может мутировать `mn.options` напрямую
   * между компиляциями и ожидать, что это подхватится. Проверка (по вопросу
   * владельца) показала: нигде в монорепе (плагины, runtime-адаптеры, docs,
   * playground) так никто не делает — единственным свидетельством был
   * собственный тест, написанный в этой же сессии для другого повода. Опции
   * теперь читаются из ЗАМЫКАНИЯ (`options`, параметр конструктора), эта
   * функция вызывается только явно: один раз при создании и из
   * {@link MnInstance.setOptions} — не на каждой компиляции. Изменить
   * конфигурацию уже созданного инстанса теперь можно только через
   * `mn.setOptions(partial)` — прямая мутация `mn.options` эффекта не имеет
   * (снимок для чтения/отладки, обновляется этой же функцией).
   */
  function applyOptions(): void {
    mn.options = extend({}, options) as MnOptions;
    const nextSelectorPrefix = options.selectorPrefix || '';
    $$onError = options.onError || noop;
    $$onWarning = options.onWarning === 'silent'
      ? noop
      : typeof options.onWarning === 'function'
        ? options.onWarning
        : defaultOnWarning;
    nextSelectorPrefix === $$lastSelectorPrefix || (
      $$lastSelectorPrefix = nextSelectorPrefix,
      $$selectorPrefixes = keys(selectorsValidateFilter(normalizeSelectors(nextSelectorPrefix)))
    );
    $$altColor = options.altColor === true;
    $$strict = !!options.strict;
  }
  /**
   * Собирает {@link MnWarning} (парсинг-ошибка/неизвестный хендлер/превышение
   * `maxDepth`) — не бросает, не блокирует компиляцию. Дедуп по токену (§10-error-warnings.md,
   * Q3): повторное предупреждение для уже отмеченного токена не добавляется повторно.
   * `warnings$` копится между `compile()`, сбрасывается только в `__clear()` (см. ниже).
   */
  function collectWarning(warning: MnWarning): void {
    if ($$warningTokens[warning.token]) {
      return;
    }
    $$warningTokens[warning.token] = 1;
    $$warnings = $$warnings.concat([warning]);
    $$onWarning(warning);
    emitWarnings($$warnings);
  }
  /**
   * Проверяет `essence.style` (CSS-значения, УЖЕ вернувшиеся из хендлера) —
   * "где-то в ядре после возврата CSS из обработчиков" (решение пользователя
   * 2026-09-04), а не точечные `throw` по каждому хендлеру отдельно. Первое
   * найденное битое значение — весь essence отбраковывается (не частично).
   *
   * Два уровня проверки на значение (см. {@link isBadCssValue}):
   * 1. {@link REGEXP_INVALID_CSS_VALUE} — узнаваемый мусор (`undefined`/`NaN`/`Rpx`),
   *    универсально для ЛЮБОГО свойства.
   * 2. {@link isValidCssPropertyValue} (`cssGrammar.ts`, решение пользователя
   *    2026-09-05 — "полная валидация") — строгая грамматика ПО КОНКРЕТНОМУ
   *    свойству, для той части CSS-поверхности, где ядро само формирует
   *    значение из числа/цвета (не для permissive pass-through хендлеров —
   *    см. `cssGrammar.ts`'s module doc про границы охвата).
   *
   * @returns `true`, если `style` не содержит подозрительных значений (или его нет вовсе)
   */
  function isBadCssValue(prop: string, v: string): boolean {
    return REGEXP_INVALID_CSS_VALUE.test(v) || !isValidCssPropertyValue(prop, v);
  }
  function validateEssenceStyle(
    essence: MnEssenceRaw, token: string, handlerName: string,
  ): boolean {
    const style = essence.style;
    if (!style) {
      return true;
    }
    let prop: string;
    let v: string | string[];
    let bad: string | undefined;
    for (prop in style) { // eslint-disable-line
      v = style[prop];
      bad = isArray(v)
        ? (v as string[]).find((s) => isBadCssValue(prop, s))
        : (isBadCssValue(prop, v as string) ? v as string : undefined);
      if (bad !== undefined) {
        collectWarning({
          type: 'invalid-css-value',
          token,
          handler: handlerName,
          arg: prop + ':' + bad,
          message: 'Хендлер "' + handlerName + '" вернул похожее на битое CSS-значение для "'
            + prop + '": "' + bad + '"',
        });
        return false;
      }
    }
    return true;
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

  /**
   * Запоминает, что для `base` объявлен статический медиа-контекст.
   *
   * Важностные дубликаты (`box@sm-i`, заводятся рядом с каждой статикой)
   * пропускаются: иначе у `box` появился бы медиа-ребёнок с именем `sm-i`
   * и в CSS уехало бы `@media sm-i`.
   */
  function indexStaticMedia(name: string): void {
    if (REGEXP_IMPORTANT.test(name)) {
      return;
    }
    const at = name.indexOf('@');
    if (at < 1 || at === name.length - 1) {
      return;
    }
    const base = name.slice(0, at);
    ($$staticsMedias[base] || ($$staticsMedias[base] = {}))[name.slice(at + 1)] = 1;
  }

  function baseSetEssenseBase(
    name: string, path: string[], extendedEssence: MnEssenceRaw,
  ): void {
    indexStaticMedia(name);
    $$staticsEssences[name] || ($$staticsEssences[name] = __normalize({
      inited: 1,
    }) as MnEssenceResult);
    baseSet(
      $$staticsEssences, path, mergeEssenceDepth([getBase($$staticsEssences, path) || [], __normalize(extendedEssence) as MnEssenceResult], []),
    );
  }

  const MN_ESSENCE_CHILDS_KEY = '' + MN_ESSENCE_CHILDS;
  function baseSetEssense(_essencePath: string, extendedEssence: MnEssenceRaw): void {
    const essencePath = _essencePath.split('.');
    const essenceName = essencePath[0];
    const path = [essenceName];
    const l = essencePath.length;
    let i = 1;
    // Эссенция — кортеж по индексам (см. utils.ts MN_ESSENCE_*): дочерняя часть
    // `tbl.cell` лежит в essence[MN_ESSENCE_CHILDS].cell, а не в свойстве `childs`
    // (строковый ключ на массиве компилятор не видит — регрессия миграции на кортежи,
    // найдена сверкой с v1 2026-09-17: `tbl` терял `.tbl>*{display:table-cell}`).
    for (;i < l; i++) {
      push(
        path, MN_ESSENCE_CHILDS_KEY, essencePath[i],
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

  /** Кэширующая обёртка над `parseComboNameProvider(attrName)` — сама обёртка (try/catch) не пересоздаётся на каждый вызов {@link updateAttrByMap}/{@link updateAttrByValues}, а живёт всё время жизни инстанса, как {@link getCompiler}. */
  function getParseComboName(attrName: string): ParseComboNameFn {
    return $$parseComboNameCache[attrName]
      || ($$parseComboNameCache[attrName] = withCatchParseComboNameDecorate(parseComboNameProvider(attrName)));
  }

  /**
   * Пересчитывает CSS-правила для набора комбо-имён одного атрибута, переданных
   * КАРТОЙ `{ comboName: 1 }` (например снимок `MnCompiler.cache` — полный набор
   * текущих значений атрибута на странице).
   *
   * @param comboNamesMap — карта комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута (`'class'`, `'id'` и т.д.)
   */
  const updateAttrByMap = mn.updateAttrByMap = (comboNamesMap: Record<string, number>, attrName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseComboName: any = getParseComboName(attrName);
    let comboName: string;
    for (comboName in comboNamesMap) forEach( // eslint-disable-line
      parseComboName(comboName), updateSelectorIteratee);
    return mn;
  };
  /**
   * То же, что {@link updateAttrByMap}, но для СПИСКА новых комбо-имён
   * (например `MnCompiler.getNext()` — только что появившиеся значения атрибута).
   *
   * @param comboNames — массив комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута
   */
  const updateAttrByValues = mn.updateAttrByValues = (comboNames: string[], attrName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseComboName: any = getParseComboName(attrName);
    forEach(comboNames, (comboName: string) => {
      forEach(parseComboName(comboName), updateSelectorIteratee);
    });
    return mn;
  };

  /**
   * Полная пересборка CSS с нуля по явно переданному снимку атрибутов —
   * `{ attrName: { comboName: 1 } }` (в отличие от {@link MnInstance.compile},
   * не читает состояние компиляторов из `getCompiler`).
   *
   * @param attrsMap — снимок `{ attrName: comboNamesMap }` по всем нужным атрибутам
   */
  mn.recompileFrom = (attrsMap: Record<string, Record<string, number>>): any => {
    __clear();
    forIn(attrsMap, updateAttrByMap);
    forIn($$root, generate);
    keyframesRender();
    styleRender();
    return mn;
  };

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
  mn.recursiveCheckByAttrs = (node: any, attrs: string | string[]): any => {
    eachApply((isString(attrs) ? [attrs] : attrs).map(getCompiler)
      .map(x => x.recursiveCheck), [node]);
    return mn;
  };
  /**
   * Проверяет ОДИН узел (без рекурсии в потомков) по каждому из `attrs` —
   * дешевле {@link MnInstance.recursiveCheckByAttrs} для точечных обновлений
   * (например реакция на мутацию одного элемента).
   *
   * @param node — DOM-узел для проверки
   * @param attrs — имя атрибута или список имён
   */
  mn.checkOneNodeByAttrs = (node: any, attrs: string | string[]): any => {
    eachApply((isString(attrs) ? [attrs] : attrs).map(getCompiler)
      .map(x => x.checkNode), [node]);
    return mn;
  };
  /**
   * Прогоняет ГОТОВОЕ значение атрибута (не DOM-узел) через компилятор(ы) —
   * когда значение известно без чтения DOM (SSR, ручная генерация классов).
   *
   * @param v — значение атрибута (например `'w50 cF00'`)
   * @param attrs — имя атрибута или список имён, каждому передаётся то же `v`
   */
  mn.checkByAttrs = (v: string, attrs: string | string[]): any => {
    isString(attrs)
      ? getCompiler(attrs)(v)
      : eachApply(attrs.map(getCompiler), [v]);
    return mn;
  };
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
  const $$parseComboNameCache: Record<string, ParseComboNameFn> = {};
  let $$lastSelectorPrefix: string | undefined | 0 = 0; // 0 — сентинел "ещё не считали", отличим от валидного undefined
  const cssPropertiesStringify: IStringifyCss = mn.propertiesStringify
    = cssPropertiesStringifyProvider();
  const emit = (mn.styles$ = observableProvider<MnStyleEntry[]>([])).emit;
  const error$ = mn.error$ = observableProvider<Error | undefined>(undefined);
  const emitError = error$.emit;
  let $$onError = noop as (e: Error) => void;
  const warnings$ = mn.warnings$ = observableProvider<MnWarning[]>([]);
  const emitWarnings = warnings$.emit;
  let $$onWarning = defaultOnWarning;
  let $$warnings: MnWarning[] = [];
  let $$warningTokens: Record<string, number> = {};
  let $$updated: number;
  let $$essences: Record<string, MnEssenceResult>;
  let $$root: Record<string, Record<string, MnContextEssence>>;
  let $$statics: MnStatics;
  let $$staticsAssigned: Record<string, Record<string, Record<string, number>>>;
  let $$staticsEssences: Record<string, MnEssenceResult>;
  /**
   * Медиа-контексты, объявленные СТАТИКОЙ: `base` → набор медиа-имён.
   *
   * Нужен потому, что `mn('box@sm', {...})` кладёт эссенцию под плоским ключом
   * `box@sm`, а рендер обходит `essence[MN_ESSENCE_MEDIA]` самого `box`. Если у
   * хендлера своего `media`-блока для `sm` нет, обходить нечего — и статика
   * молча не применялась вообще (Q-05). Индекс позволяет завести недостающего
   * медиа-ребёнка пустым, чтобы статике было куда влиться.
   */
  let $$staticsMedias: Record<string, Record<string, number>> = {};
  let $$keyframes: [Record<string, string>, number];
  let $$stylesMap: Record<string, MnStyleEntry> = $$data.stylesMap = {};
  let $$assigned: Record<string, Record<string, Record<string, number>>> = $$data.assigned = {};
  let $$media: Record<string, MnMediaEntry> = mn.media = options.media || {};
  let $$handlerMap: Record<string, ((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }> = mn.handlerMap = {};
  let $$force: number;
  let $$selectorPrefixes: string[];
  let $$altColor: boolean;
  let $$strict: boolean;
  let $$revision = 0;

  error$.on((error: Error) => {
    $$onError(error);
  });
  // Позволяет selectorsCompileProvider (отдельный модуль, свой замкнутый scope)
  // сообщать о превышении maxDepth в режиме 'warn' — по тому же соглашению,
  // что и уже существующие internal-геттеры (mn.states/mn._synonyms).
  (mn as any)._collectWarning = collectWarning;

  function withCatchParseComboNameDecorate(parseComboNameFn: (...args: any[]) => any): (...args: any[]) => any {
    return function() {
      try {
        // eslint-disable-next-line
        return parseComboNameFn.apply(this, arguments);
      } catch (ex) {
        if (ex instanceof MnParseError) {
          collectWarning({
            type: ex.context.warningType || 'parse-error',
            token: ex.context.token,
            handler: ex.context.handler,
            arg: ex.context.arg,
            utility: ex.context.utility,
            message: ex.message,
            error: ex,
          });
        } else {
          emitError(ex);
        }
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
    const badInput = mediaName.split('x');
    // Проверяем ДО try ниже: тот перехватывает любой throw и трактует имя как
    // названное медиа, поэтому исключение отсюда до пользователя не дошло бы.
    if (isBadMediaRange(badInput[0]) || isBadMediaRange(badInput[1])) {
      collectWarning({
        type: 'parse-error',
        token: '@' + mediaName,
        handler: '',
        arg: mediaName,
        utility: 'parseMediaTemplate',
        message: 'Медиа-шаблон "@' + mediaName + '" записан не по форме. Допустимо: '
          + '"@760" (max-width), "@760-" (min-width), "@760-1200" (диапазон), '
          + '"@760x400" (ширина x высота). Ведущий дефис не нужен — "@-760" даёт '
          + 'ту же max-width, что "@760"',
      });
      return [''];
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
    } catch {
      return [mediaName];
    }
    return [JOIN_AND(queries), priority];
  }
  /** Публичный доступ к {@link parseMediaExpression} — разбор `@`-медиа-выражения без побочных эффектов. */
  mn.parseMediaExpression = parseMediaExpression;

  /** Хелпер {@link generate} — вынесен из тела цикла по essence, чтобы не создавать замыкание на каждую essence, только на каждый media-контекст. */
  function mapEssenceSelectors(map: Record<string, Record<string, number>>, selectorsIteratee: (selectors: string[]) => string): string[] {
    const sels = getEessenceSelectors(map);
    const result: string[] = [];
    for (let si = 0; si < sels.length; si++) {
      result[si] = selectorsIteratee(sels[si]);
    }
    return result;
  }

  /** Хелпер {@link generate} — вынесен из инлайн-IIFE, собирает контент всех essence по имени медиа-контекста. */
  function mapContentByMediaName(sortedContext: MnContextEssence[], mediaName: string): string[] {
    const result: string[] = [];
    for (let si = 0; si < sortedContext.length; si++) {
      result[si] = sortedContext[si][MN_CONTEXT_ESSENCE_CONTENT][mediaName];
    }
    return result;
  }

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
              ? joinOnly(mapEssenceSelectors(contextEssence[MN_CONTEXT_ESSENCE_MAP], selectorsIteratee))
              : ''
          );
      }

      isContinue || (
        output = joinOnly(mapContentByMediaName(values(context).sort(priotitySortContext), mediaName)),
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
   * mn.assign({ html: 'lh1.15', body: 'm' });
   */
  // selectors/comboNames: произвольная вложенная форма (строка/массив/объект), см. normalizeSelectors/normalizeComboNames.
  mn.assign = (
    selectors: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    comboNames?: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    defaultMediaName?: string,
  ): any => {
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
    return mn;
  };

  /**
   * Разбирает токен, вызывает хендлер пресета и СРАЗУ нормализует результат
   * (`__normalize`) — наружу (обоим вызывающим в {@link initEssence}) никогда
   * не попадает "сырой" `MnEssenceRaw` от автора пресета, только уже готовый
   * кортеж `MnEssenceResult`. Автор пресета по-прежнему пишет обычный объект
   * (`{ style: {...} }`) — удобство холодного пути не меняется; движок
   * перестраивает его во внутреннее представление ровно в точке появления,
   * не давая "сырой" форме просочиться дальше по компиляционному пайплайну.
   */
  function __initEssence(value: string): MnEssenceResult | 0 | null | false | void {
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
        return __normalize({
          style: varStyle,
        });
      }
      return (matchs = REGEXP_MATCH_NAME.exec(value)) && (
        name = matchs[1],
        (matchs = REGEXP_MATCH_IMPORTANT.exec(suffix = matchs[2])) && (
          suffix = matchs[1],
          ni = matchs[2]
        ),
        (handle = $$handlerMap[name])
          ? (
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
            essence && !validateEssenceStyle(
              essence, value, name,
            ) && (essence = undefined),
            __normalize(essence)
          )
          // Хендлера с таким именем нет — значит это вообще не MN-токен, а
          // чужой CSS-класс (`container`, `btn`, `swiper-slide`, семантика из
          // собственного CSS проекта). Молчим: сам синтаксис нотации
          // предполагает соседство с любыми другими классами
          // (`cF00.active`), а чужих имён может быть сколько угодно — на
          // каждое из них предупреждать означает забивать вывод мусором.
          // Предупреждение остаётся там, где автор ЯВНО писал MN-токен и
          // ошибся в аргументе: хендлер найден, но разбор не удался
          // (`parse-error`, ниже). Решение владельца 2026-09-24 —
          // см. OPEN_QUESTIONS.md, Q-12.
          : undefined
      );
    } catch (ex) {
      if (ex instanceof MnParseError) {
        // Контекст может быть пустым: `throwInvalid()` в пресетах зовётся из
        // глубины разбора значения, где ни токена, ни имени хендлера не видно
        // (см. его JSDoc в `presets/standard.ts`). Здесь они известны —
        // дозаполняем, чтобы предупреждение указывало на конкретный токен.
        collectWarning({
          type: 'parse-error',
          token: ex.context.token || value,
          handler: ex.context.handler || name,
          arg: ex.context.arg || suffix,
          utility: ex.context.utility,
          message: ex.message,
          error: ex,
        });
        return;
      }
      err = new Error('MN parsing error for essence "'
        + value + '": ' + ex.message);
      emitError(err);
    }
  }
  function initEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): void {
    const staticEssence = $$staticsEssences[essenceName];
    // Ветка "staticEssence не MN_ESSENCE_INITED" убрана 2026-09-23: единственное
    // место записи в $$staticsEssences (baseSetEssenseBase, см. ниже) заводит
    // запись ВСЕГДА с inited=1 — прочитанный отсюда staticEssence гарантированно
    // уже инициализирован. Подтверждено сверкой с v1 (та же гарантия там же).
    const tmpEssence = staticEssence || __initEssence(essenceName);

    if (!tmpEssence) {
      return;
    }
    compileMixedEssence(
      essence, tmpEssence, excludes,
    );
    // Статика могла объявить медиа-контекст, которого у хендлера нет вовсе
    // (`mn('box', …)` без `media` + `mn('box@sm', …)`). Тогда обходить в
    // `__childsHandle` нечего, и переопределение не применялось бы — заводим
    // пустого ребёнка, чтобы статике было куда влиться.
    const staticMedias = $$staticsMedias[essenceName];
    if (staticMedias) {
      const media = essence[MN_ESSENCE_MEDIA] || (essence[MN_ESSENCE_MEDIA] = {});
      let staticMediaName: string;
      for (staticMediaName in staticMedias) { // eslint-disable-line
        media[staticMediaName] || (media[staticMediaName] = []);
      }
    }
    const important = essence[MN_ESSENCE_IMPORTANT];

    function __childsHandle(
      childs: Record<string, MnEssenceResult> | undefined, separator: string, withStatic?: number,
    ): void {
      const __prefix = essenceName + separator;
      forIn(childs, withStatic ? (_childEssence: MnEssenceResult, _childName: string) => {
        const childEssenceName = __prefix + _childName;
        const childStaticEssence = $$staticsEssences[childEssenceName];
        // Q-05, решение владельца: статическое переопределение для конкретного
        // медиа-контекста (`mn('box@sm', {...})`) СЛИВАЕТСЯ с собственным
        // `media`-блоком хендлера, а не затирает его. Раньше ветка
        // `childStaticEssence[MN_ESSENCE_INITED] ? childStaticEssence : …`
        // выбирала статику целиком — а `INITED` стоит у неё ВСЕГДА
        // (`baseSetEssenseBase` заводит запись с `inited: 1`), так что
        // `media`-блок хендлера терялся при любом переопределении.
        // Порядок источников — статика ПОСЛЕ: `mergeEssenceDepth` льёт их по
        // очереди в `dst`, поэтому побеждает последний, а переопределение и
        // должно побеждать.
        childs[_childName] = compileMixedEssence(
          $$essences[childEssenceName] = [],
          childStaticEssence
            ? mergeEssenceDepth([_childEssence, childStaticEssence], [])
            : _childEssence,
          excludes, important,
        );
      } : (_childEssence: MnEssenceResult, _childName: string) => {
        childs[_childName] = compileMixedEssence(
          $$essences[__prefix + _childName] = [],
          _childEssence,
          excludes, important,
        );
      });
    }
    __childsHandle(essence[MN_ESSENCE_CHILDS], '.');
    __childsHandle(
      essence[MN_ESSENCE_MEDIA], '@', 1,
    );
  }
  function compileMixedEssence(
    dst: MnEssenceResult, src: MnEssenceResult, excludes: Record<string, number>, important?: number,
  ): MnEssenceResult {
    const include = src[MN_ESSENCE_INCLUDE];
    let i = include ? include.length : 0;
    let mergingMixins: MnEssenceResult[];
    let styleObj: Record<string, string | string[]> | undefined;
    let styleText: string | undefined;
    if (i) {
      mergingMixins = new Array(i + 1);
      mergingMixins[i] = src;
      // eslint-disable-next-line
      for (; i--;) mergingMixins[i] = updateEssence(include[i], {}, '', excludes) as MnEssenceResult;
      mergeEssenceDepth(mergingMixins, dst);
    } else {
      mergeEssenceInto(dst, src);
    }

    dst[MN_ESSENCE_CSS_TEXT] = (styleObj = dst[MN_ESSENCE_STYLE])
      && (styleText = (cssPropertiesStringify as any)(styleObj, dst[MN_ESSENCE_IMPORTANT] || important))
      ? ('{' + styleText + '}') : '';
    dst[MN_ESSENCE_INITED] = 1;
    return dst;
  }
  function createContextEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): MnContextEssence {
    essence[MN_ESSENCE_INITED] || initEssence(
      essenceName, essence, excludes,
    );
    return [
      {},
      essence[MN_ESSENCE_SELECTORS],
      essence[MN_ESSENCE_PRIORITY] || 0,
      essence[MN_ESSENCE_CSS_TEXT],
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
    // Запоминаем ДО подстановки 'all': медиа-детям нужно отличать «медиа не
    // задан» от «задан и называется all», иначе их собственный контекст
    // затирается фолбэком (см. __childsHandle ниже).
    const explicitMediaName = mediaName;
    mediaName = mediaName || 'all';
    excludes[essenceName] = 1;
    essence || (essence = $$essences[essenceName] || []);
    const context = $$root[mediaName] || ($$root[mediaName] = {});
    const contextEssence: MnContextEssence = context[essenceName] || (context[essenceName]
      = createContextEssence(
        essenceName, essence, excludes,
      ));

    isEmpty(essence) || ($$essences[essenceName] = essence);

    contextEssence[MN_CONTEXT_ESSENCE_UPDATED] = 1;
    extend(contextEssence[MN_CONTEXT_ESSENCE_MAP],
      selectors = joinMaps(selectors, contextEssence[MN_CONTEXT_ESSENCE_SELECTORS]));
    /**
     * @param asMedia — дети из `media`-блока: имя ребёнка И ЕСТЬ его медиа-контекст.
     *   Без этого они рендерились с медиа РОДИТЕЛЯ (обычно пустым), то есть
     *   `media: { sm: {...} }` уезжал в CSS безусловным правилом — ровно та
     *   утечка, о которой Q-05. Явный медиа-суффикс токена (`box@md`) имеет
     *   приоритет: два медиа-контекста на одно правило в плоском выводе не
     *   совместить, а тот, что написан в разметке, ближе к намерению автора.
     */
    function __childsHandle(
      childs: Record<string, MnEssenceResult>, separator: string, asMedia?: number,
    ): void {
      let childName: string;
      for (childName in childs) updateEssence( // eslint-disable-line
        essenceName + separator + childName,
        selectors,
        asMedia ? (explicitMediaName || childName) : mediaName,
        excludes,
        childs[childName],
      );
    }
    const childs = essence[MN_ESSENCE_CHILDS];
    const media = essence[MN_ESSENCE_MEDIA];
    const exts = essence[MN_ESSENCE_EXTS];
    childs && __childsHandle(childs, '.');
    media && __childsHandle(
      media, '@', 1,
    );
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
    // mn.media/mn.handlerMap заведены при создании инстанса (см. выше) —
    // фолбэк на пустой объект здесь не нужен
    $$media = mn.media;
    $$handlerMap = mn.handlerMap;
    $$essences = $$data.essences = {};
    $$root = $$data.root = {};
    $$statics = $$data.statics || ($$data.statics = {
      essences: {},
      assigned: {}, 
    });

    // обе половины $$statics заводятся вместе (либо из $$data.statics, либо тут же выше)
    $$staticsEssences = $$statics.essences;
    $$keyframes = $$data.keyframes || ($$data.keyframes = [{}, 0]);
    $$stylesMap = $$data.stylesMap = {};
    $$assigned = $$data.assigned = {};
    forIn($$staticsAssigned = $$statics.assigned, __assignItemCompile);
    // Отдельный mn.clearWarnings() не нужен (§10-error-warnings.md, Q3) —
    // recompile()/__clear() уже "чистый лист" для остального состояния.
    $$warnings = [];
    $$warningTokens = {};
    emitWarnings($$warnings);
  }
  __clear();
  /**
   * Полностью сбрасывает состояние экземпляра: карту эссенций, `$$root`, кэши
   * компиляторов атрибутов (`$$compilers[*].clear()`) и накопленный CSS.
   * Следующий {@link MnInstance.compile} пересоберёт всё с нуля.
   */
  mn.clear = (attrName?: string): any => {
    // eslint-disable-next-line
    for (attrName in $$compilers) $$compilers[attrName].clear();
    __clear();
    return mn;
  };

  /** Пересобирает CSS-блок `@keyframes` (`MN_KEYFRAMES_TOKEN`) из `$$keyframes[0]`, включая браузерные префиксы. Вызывается автоматически из {@link MnInstance.compile}, когда есть неприменённые изменения (`$$keyframes[1]`). */
  const keyframesRender = mn.keyframesCompile = (): any => {
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
    return mn;
  };
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
  const __render = mn.compile = (): any => {
    let attrName: string;
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
    forIn($$root, generate);
    $$updated && styleRender();
    $$updated = $$force = 0;
    // Бросок ЗДЕСЬ, а не из collectWarning() — там он попал бы в try/catch
    // вокруг разбора токена (__initEssence) и был бы проглочен как обычный
    // Error через $$onError (по умолчанию noop). Здесь, после того как вся
    // работа compile() уже сделана, throw ничем не перехватывается и доходит
    // до вызывающего кода (сборщика) как есть.
    if ($$strict && $$warnings.length) {
      throw new MnStrictError($$warnings);
    }
    return mn;
  };
  /**
   * Форсирует ПОЛНЫЙ пересчёт CSS (в отличие от инкрементального {@link MnInstance.compile}) —
   * очищает состояние и заново читает ВЕСЬ кэш каждого компилятора (`$$compilers[*].cache`),
   * а не только новые значения. Нужен, например, после смены `options` (`selectorPrefix`,
   * `altColor`), меняющей вывод для уже обработанных токенов.
   *
   * @returns mn (чейнинг)
   */
  mn.recompile = (): any => {
    $$force = 1;
    __render();
    return mn;
  };
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
  mn.setKeyframes = (
    name: string,
    body: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ifEmpty?: number,
  ): any => {
    const keyframes = $$keyframes[0];
    if (ifEmpty && keyframes[name]) {
      return mn;
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
    return mn;
  };

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
  mn.synonyms = (synonym: string | Record<string, any>, selectors?: string | Record<string, any>): any => {
    isObject(synonym)
      ? forIn(synonym, baseSetSynonyms)
      : baseSetSynonyms(selectors, synonym);
    return mn;
  };

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
  mn.setPresets = setPresets;
  /**
   * Утилиты, доступные пресетам внутри `(mn) => {...}` (см. {@link MnUtils}).
   *
   * `baseUtils` (`core/utils.ts`) + `color`/`colorGetBackground`, переопределённые
   * здесь с зафиксированным `$$altColor` (из `options.altColor`, читается в
   * {@link applyOptions}) — сами пресеты передают только цвет, без второго аргумента.
   */
  mn.utils = extend(extend({}, baseUtils), {
    color: (v: string) => color(v, $$altColor),
    colorGetBackground: (v: string) => colorGetBackground(v, $$altColor),
  });

  /**
   * Переконфигурирует инстанс после создания — слияние с текущими опциями
   * (частичное обновление, не замена целиком). Единственный поддерживаемый
   * способ поменять `onError`/`onWarning`/`selectorPrefix`/`altColor`/`strict`
   * на уже созданном `mn` — эти поля читаются из замыкания и пересчитываются
   * только здесь и при создании инстанса, не на каждой компиляции (см.
   * {@link applyOptions}, пересмотрено 2026-09-23). Прямая мутация `mn.options`
   * эффекта не имеет — это только снимок для чтения/отладки.
   *
   * @param partialOptions — поля {@link MnOptions} для обновления
   * @returns mn (чейнинг)
   *
   * @example
   * mn.setOptions({ selectorPrefix: '.app' });
   * mn.recompile();
   */
  mn.setOptions = (partialOptions: Partial<MnOptions>): any => {
    options = extend(extend({}, options), partialOptions) as MnOptions;
    applyOptions();
    return mn;
  };

  applyOptions();
  options.presets?.length && setPresets(options.presets);

  return mn;
}

export default minotationProvider;
export {
  minotationProvider, 
};
