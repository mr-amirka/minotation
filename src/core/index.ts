/**
 * Minotation — ядро (v1 API).
 *
 * @module core
 */

/* eslint-disable */
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
  map,
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
  withDefer,
  withResult,
  getBase,
  baseSet,
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

// Присваиваем utils статическому свойству (нужно для обратной совместимости)
minotationProvider.utils = baseUtils;

function minotationProvider(options) {
  options = options || {};
  function setPresets(presets) {
    isArray(presets) && (eachTry as any)(
      presets, [mn], mn, emitError,
    );
  }
  function styleRender() {
    emit((values as any)($$stylesMap).sort(priotitySort));
  }
  function updateOptions() {
    const options = mn.options || {};
    $$onError = options.onError || noop;
    $$selectorPrefixes = keys(selectorsValidateFilter(normalizeSelectors(options.selectorPrefix || '')));
    $$altColor = options.altColor !== 'off';
  }
  function mn(
    essencePath, extendedEssence, paramsMatchPath, skip,
  ) {
    const type = typeof essencePath;
    type === OBJECT
      ? (forIn as any)(essencePath, baseSetMapIteratee)
      : (
        !essencePath || type !== STRING
          ? console.warn('MN: essencePath value must be an string', essencePath)
          : mnBaseSet(
            extendedEssence, essencePath, paramsMatchPath, skip, undefined,
          )
      );
    return mn;
  }
  mn.set = mn;

  function mnBaseSet(
    extendedEssence, essencePath, paramsMatchPath, skip, v,
  ) {
    const type = typeof(extendedEssence);
    type === FUNCTION
      ? (
        v = $$handlerMap[essencePath] = paramsMatchPath
          ? handlerWrap(extendedEssence, paramsMatchPath)
          : extendedEssence,
        v.skip = skip || 0
      )
      : (
        type === OBJECT
          ? baseSetEssense(essencePath, extendedEssence)
          : (
            type === STRING
              ? baseSetEssense(essencePath, {
                exts: extendedEssence,
              })
              : console.warn(
                'MN: extendedEssence value must be an object on',
                extendedEssence, 'where', essencePath,
              )
          )
      );
  }

  function baseSetMapIteratee(extendedEssence, essencePath) {
    isArray(extendedEssence)
      ? mnBaseSet(
        extendedEssence[0], essencePath, extendedEssence[1], undefined, undefined,
      )
      : mnBaseSet(extendedEssence, essencePath, undefined, undefined, undefined);
  }

  function baseSetEssenseBase(
    name, path, extendedEssence,
  ) {
    $$staticsEssences[name] || ($$staticsEssences[name] = __normalize({
      inited: 1,
    }));
    baseSet(
      $$staticsEssences, path, __mergeDepth([getBase($$staticsEssences, path), __normalize(extendedEssence)], {}),
    );
  }

  function baseSetEssense(_essencePath, extendedEssence) {
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

  function getCompiler(attrName) {
    return $$compilers[attrName]
      || ($$compilers[attrName] = __compileProvider(attrName));
  }

  function setStyle(
    name, content, priority,
  ) {
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

  // eslint-disable-next-line
  const updateAttrByMap = mn.updateAttrByMap = withResult((comboNamesMap, attrName) => {
    // eslint-disable-next-line
    let parseComboName: any = withCatchParseComboNameDecorate(parseComboNameProvider(attrName)), comboName: any;
    for (comboName in comboNamesMap) (forEach as any)( // eslint-disable-line
      parseComboName(comboName), updateSelectorIteratee);
  }, mn as any);
  // eslint-disable-next-line
  const updateAttrByValues = mn.updateAttrByValues = withResult((comboNames, attrName) => {
    // eslint-disable-next-line
    const parseComboName: any = withCatchParseComboNameDecorate(parseComboNameProvider(attrName));
    (forEach as any)(comboNames, (comboName: any) => {
      (forEach as any)(parseComboName(comboName), updateSelectorIteratee);
    });
  }, mn);

  mn.recompileFrom = withResult((attrsMap) => {
    __clear();
    updateOptions();
    (forIn as any)(attrsMap, updateAttrByMap);
    (forIn as any)($$root, generate);
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
  mn.recursiveCheckByAttrs = withResult((node, attrs) => {
    (eachApply as any)((map as any)(map(isString(attrs) ? [attrs] : attrs, getCompiler as any),
      'recursiveCheck'), [node]);
  }, mn);
  mn.checkOneNodeByAttrs = withResult((node, attrs) => {
    (eachApply as any)((map as any)(map(isString(attrs) ? [attrs] : attrs, getCompiler as any),
      'checkNode'), [node]);
  }, mn);
  mn.checkByAttrs = withResult((v, attrs) => {
    isString(attrs)
      ? getCompiler(attrs)(v)
      : (eachApply as any)((map as any)(attrs, getCompiler as any), [v]);
  }, mn);
  mn.setStyle = (
    name, content, priority,
  ) => setStyle(
    'custom.' + name, content, priority || MN_DEFAULT_OTHER_CSS_PRIORITY,
  );

  mn.options = extend({}, options);
  const $$data: any = mn.data = {};
  const $$compilers = $$data.compilers = {};
  const cssPropertiesStringify = mn.propertiesStringify
    = cssPropertiesStringifyProvider() as any;
  const emit = (mn.styles$ = observableProvider([])).emit;
  const error$ = mn.error$ = observableProvider<any>(undefined);
  const emitError = error$.emit;
  let $$onError: any = noop;
  let $$updated;
  let $$essences;
  let $$root;
  let $$statics;
  let $$staticsAssigned;
  let $$staticsEssences;
  let $$keyframes;
  let $$css;
  let $$stylesMap = $$data.stylesMap = {};
  let $$assigned = $$data.assigned = {};
  let $$media = mn.media = options.media || {};
  let $$handlerMap = mn.handlerMap = {};
  let $$force;
  let $$selectorPrefixes;
  let $$altColor;
  let $$revision = 0;

  (error$ as any).on((error: any) => {
    $$onError(error);
  });

  function withCatchParseComboNameDecorate(parseComboNameFn) {
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

  function selectorsValidateFilter(selectorsMap) {
    let selector, output = {}; // eslint-disable-line
    for (selector in selectorsMap) { // eslint-disable-line
      isInvalidSelector(selector)
        ? emitError(new Error('Invalid selector: "' + selector + '"'))
        : (output[selector] = selectorsMap[selector]);
    }
    return output;
  }

  function parseMediaExpression(mediaExpression) {
    if (!mediaExpression) {
      return [[]];
    }

    let mediaPriority;
    let priority;
    let selector;
    let query;
    let partsAnd;
    let iAnd;
    let lAnd;
    let fragment;
    let outputQuery;
    let outputSelector;
    let tmp;
    let name;
    let media;
    const medias = [];
    const names = [];
    const queries = [];

    // get media priority
    if (tmp = REGEXP_MEDIA_PRIORITY.exec(mediaExpression)) {
      mediaExpression = tmp[1];
      mediaPriority = parseInt(tmp[2]);
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
            tmp = parseMediaTemplate(fragment),
            (query = tmp[0]) && push(outputQuery, query),
            isDefined(priority) || (priority = tmp[1])
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

  function parseMediaTemplate(mediaName) {
    if (mediaName === 'x') {
      return [mediaName];
    }
    // eslint-disable-next-line
    let queries = [], mp, v, priority, input = mediaName.split('x');
    try {
      (mp = parseMediaPart(input[0])) && (
        (v = mp[0]) && (push as any)(queries, '(min-width: ' + v + 'px)'),
        (v = mp[1]) && (
          priority = -v,
          (push as any)(queries, '(max-width: ' + v + 'px)')
        )
      );
      (mp = parseMediaPart(input[1])) && (
        (v = mp[0]) && (push as any)(queries, '(min-height: ' + v + 'px)'),
        (v = mp[1]) && (
          isDefined(priority) || (priority = -v),
          (push as any)(queries, '(max-height: ' + v + 'px)')
        )
      );
    } catch (ex) {
      return [mediaName];
    }
    return [JOIN_AND(queries), priority];
  }
  mn.parseMediaExpression = parseMediaExpression;

  function generate(context, mediaExpression) {
    const medias = parseMediaExpression(mediaExpression);
    const lMedia = medias.length;
    const updated = {};
    const globalSelectorPrefixes = $$selectorPrefixes;
    const lGSP = globalSelectorPrefixes.length;
    let iMedia = 0;
    let media;
    let mediaPriority;
    let mediaQuery;
    let essenceName;
    let contextEssence;
    let cssText;
    let output;
    let selectorPrefixes;
    let selectorsIteratee;
    let isContinue;
    let mediaName;
    let mediaSelector;

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
        ? ((selectors: any) => (
          joinComma(joinArrays(
            selectorPrefixes, selectors, ' ',
          )) + cssText
        ))
        : ((selectors: any) => joinComma(selectors) + cssText);

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
                  result[si] = selectorsIteratee(sels[si], si, sels as any);
                }
                return result;
              })())
              : ''
          );
      }

      isContinue || (
        output = joinOnly((() => {
          const sorted = (values as any)(context).sort(priotitySortContext);
          const result: any[] = [];
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
    assigned: any, comboNames: any, selectors: any, defaultMediaName: any, excludes?: any,
  ) {
    defaultMediaName = defaultMediaName || 'all';
    let name;
    let selector;
    let l;
    let i;
    let items;
    let essenceName;
    let item;
    let selectorsMedias;
    let essencesNames;
    let childSelectors;
    let childSelector;
    let mediaName;
    let actx;

    for (name in comboNames) { // eslint-disable-line
      for (selector in selectors) { // eslint-disable-line
        for (
          items = __parseComboName(name, selector), l = items.length, i = 0;
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
  mn.assign = withResult((
    selectors, comboNames, defaultMediaName,
  ) => {
    function iteratee(comboNames, s) {
      __assignCore(
        $$staticsAssigned,
        normalizeComboNames(comboNames),
        normalizeSelectors(s),
        defaultMediaName,
      );
    }
    isPlainObject(selectors)
      ? (forIn as any)(selectors, iteratee)
      : iteratee(comboNames, selectors);
  }, mn);

  function __initEssence(
    value: any, matchs?: any, ni?: any, name?: any, handle?: any, essence?: any, params?: any, suffix?: any, err?: any,
  ): any {
    try {
      if (matchs = REGEXP_MATCH_VAR.exec(value)) {
        params = {};
        params[matchs[1]] = spaceNormalize(matchs[2]);
        return {
          style: params,
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
    essenceName, essence, excludes,
  ) {
    let _essence;
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
      childs: any, separator: any, withStatic?: any,
    ) {
      const __prefix = essenceName + separator;
      (forIn as any)(childs, withStatic ? (_childEssence: any, _childName: any) => {
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
      } : (_childEssence: any, _childName: any) => {
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
    dst: any, src: any, excludes: any, important?: any,
  ) {
    const include = src.include;
    let // eslint-disable-line
      i = include && include.length,
      mergingMixins, style;
    if (i) {
      mergingMixins = new Array(i + 1);
      mergingMixins[i] = src;
      // eslint-disable-next-line
      for (; i--;) mergingMixins[i] = updateEssence(include[i], {}, '', excludes);
      __mergeDepth(mergingMixins, dst);
    } else {
      extend(dst, src);
    }

    dst.cssText = (style = dst.style)
      && (style = (cssPropertiesStringify as any)(style, dst.important || important))
      ? ('{' + style + '}') : '';
    dst.inited = 1;
    return dst;
  }
  function createContextEssence(
    essenceName, essence, excludes,
  ) {
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
    essenceName: any, selectors: any, mediaName: any, _excludes?: any, essence?: any,
  ): any {
    const excludes = extend({}, _excludes);
    if (excludes[essenceName]) {
      return;
    }
    mediaName = mediaName || 'all';
    excludes[essenceName] = 1;
    essence || (essence = $$essences[essenceName] || {});
    const context = $$root[mediaName] || ($$root[mediaName] = {});
    const contextEssence = context[essenceName] || (context[essenceName]
      = createContextEssence(
        essenceName, essence, excludes,
      ));

    isEmpty(essence) || ($$essences[essenceName] = essence);

    contextEssence[MN_CONTEXT_ESSENCE_UPDATED] = 1;
    extend(contextEssence[MN_CONTEXT_ESSENCE_MAP],
      selectors = joinMaps(selectors, contextEssence[MN_CONTEXT_ESSENCE_SELECTORS]));
    function __childsHandle(childs, separator) {
      let childName;
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
  function updateSelectorIteratee(item) {
    let selector;
    let essenceName;
    let mediaName;
    let selectors;
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
  function baseSetSynonyms(selectors, name) {
    // eslint-disable-next-line
    let selectorsMedias = {}, from, to, mediaNames;
    selectors = normalizeSelectors(selectors);
    for (from in selectors) { // eslint-disable-line
      to = extractMedia(mediaNames = [], from);
      selectorsMedias[to] = [0, mediaNames[0]];
    }
    ((mn as any)._synonyms || ((mn as any)._synonyms = {}))[name] = selectorsMedias;
  }

  function __assignItemCompile(actx, mediaName) {
    (forIn as any)(actx, (selectors: any, essenceName: any) => {
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
    $$statics = $$data.statics || ($$data.statics = {});

    $$staticsEssences = $$statics.essences || ($$statics.essences = {});
    $$keyframes = $$data.keyframes || ($$data.keyframes = [{}, 0]);
    $$css = $$data.css = $$data.css || [{}, 0];
    $$stylesMap = $$data.stylesMap = {};
    $$assigned = $$data.assigned = {};
      (forIn as any)($$staticsAssigned = $$statics.assigned || ($$statics.assigned = {}),
        __assignItemCompile);
  }
  __clear();
  mn.clear = withResult((attrName) => {
    // eslint-disable-next-line
    for (attrName in $$compilers) $$compilers[attrName].clear();
    __clear();
  }, mn);

  const keyframesRender = mn.keyframesCompile = withResult(() => {
    $$keyframes[1] = 0;
    const keyframesPrefix = MN_KEYFRAMES_TOKEN + ' ';
    const prefixes = cssPropertiesStringify.prefixes;
    // eslint-disable-next-line
    setStyle(MN_KEYFRAMES_TOKEN, (joinOnly as any)((reduceIn as any)($$keyframes[0], (output: any, v: any, k: any) => {
      let prefix: string;
      for (prefix in prefixes) (push as any)( // eslint-disable-line
        output, '@' + prefix + keyframesPrefix + k + v);
      (push as any)(output, '@' + keyframesPrefix + k + v);
      return output;
    }, [],
    )), MN_DEFAULT_CSS_PRIORITY,
    );
  }, mn);
  const cssRender = mn.cssCompile = withResult(() => {
    $$css[1] = 0;
    // eslint-disable-next-line
    setStyle('css', (joinOnly as any)((reduceIn as any)($$css[0], __cssReducer, [])), MN_DEFAULT_CSS_PRIORITY);
  }, mn);

  /**
   * Компилирует накопленные токены в CSS-стили.
   *
   * Должен вызываться после того, как все токены собраны через `getCompiler()`.
   * Результат доступен через `mn.styles$.getValue()`.
   *
   * @returns mn (чейнинг)
   */
  const __render = mn.compile = withResult(() => {
    let attrName: any;
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
    (forIn as any)($$root, generate);
    $$updated && styleRender();
    $$updated = $$force = 0;
  }, mn);
  mn.recompile = withResult(() => {
    $$force = 1;
    __render();
  }, mn);
  const deferCompile = mn.deferCompile = withDefer(__render, mn);
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
  mn.setKeyframes = withResult((
    name, body, ifEmpty,
  ) => {
    const keyframes = $$keyframes[0];
    if (ifEmpty && keyframes[name]) {
      return;
    }
    if (body) {
      const output = ['{'];
      isObject(body)
        ? (forIn as any)(body, (css: any, k: any) => (push as any)(output, k + '{'
          + (isObject(css) ? (cssPropertiesStringify as any)(css) : css) + '}'))
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
  mn.css = withResult((selector, css) => {
    const cssMap = $$css[0];
    function baseSetCSS(css, s) {
      s = joinComma(keys(normalizeSelectorsIteratee({}, s)));
      if (css) {
        const instance = cssMap[s] || (cssMap[s] = {
          css: {},
        });
        instance.content = joinOnly([
          s,
          '{',
          cssPropertiesStringify(isObject(css)
            ? (extend as any)(instance.css, css)
            : (cssPropertiesParseSimple as any)(css, instance.css)),
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
  mn.synonyms = withResult((synonym, selectors) => {
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
  mn.utils = extend(extend({}, baseUtils), {
    color: (v) => color(v, $$altColor),
    colorGetBackground: (v) => colorGetBackground(v, $$altColor),
  });

  updateOptions();
  setPresets(options.presets);

  return mn;
}

export default minotationProvider;
export {
  minotationProvider, 
};
