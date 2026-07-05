import {
  parseLexeme, 
} from '../../parser/parseLexeme';
import {
  compileSelector,
  compileClassName,
  compileIdSelector,
  compileStates,
  escapeCss,
} from '../../compiler/selectorCompiler';
import {
  variants, 
} from 'fundamentool';
import type {
  StyleHandler,
  StyleResult,
  MediaDef,
  StyleBlock,
  MnOptions,
} from './types';
import {
  camelToKebab,
  compileAttrSelector,
  parseMediaTemplate,
  parseSynonymValue,
  normalizeSelectorStr,
} from './helpers';
import {
  mnUtils, 
} from '../utils';
import type {
  MnUtils, 
} from '../utils';

/**
 * Ядро Minimalist Notation.
 *
 * Все методы инициализируются в конструкторе как замыкания (§15),
 * всё состояние — closure-переменные конструктора.
 * Исключает lookup по прototipной цепочке в горячем коде (§1, §6.3).
 *
 * Обычно не используется напрямую — вместо него создаётся callable-обёртка
 * через {@link createMn}.
 */
export class MnInstance {
  // ─── Type declarations (методы создаются в конструкторе — §15) ───

  /**
   * Регистрирует обработчик стиля для тег-префикса.
   * Используется внутренне через `_registerOne`; публичный API — callable `mn(key, fn)`.
   * @param tag - тег-префикс (`'p'`, `'bgc'`, `'fx'`)
   * @param handler - функция, получающая разобранный стем и возвращающая {@link StyleResult}
   */
  register: (tag: string, handler: StyleHandler) => this;

  /**
   * Регистрирует строковый макрос: точный токен → строка токенов.
   * Используется внутренне через `_registerOne`; публичный API — callable `mn(key, 'string')`.
   * @param key - полный токен-ключ (exact match, не тег-префикс)
   * @param expansion - строка токенов через пробел, в которую раскрывается ключ
   * @example inst.registerExpansion('flex-center', 'fx fxaC fyaC')
   */
  registerExpansion: (key: string, expansion: string) => this;

  /**
   * Устанавливает синонимы состояний (псевдоклассы, атрибуты).
   * @example inst.setSynonyms({ h: ':hover', f: ':focus', d: '[disabled]' })
   */
  setSynonyms: (map: Record<string, string>) => this;

  /**
   * Добавляет сырые CSS-правила, минуя MN-трансформацию.
   * @example inst.css('*, *::before', { boxSizing: 'border-box' })
   */
  css: (
    selector: string | Record<string, Record<string, string>>,
    rules?: Record<string, string>,
  ) => this;

  /**
   * Регистрирует `@keyframes` анимацию.
   * @example inst.setKeyframes('spin', { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } })
   */
  setKeyframes: (name: string, body: Record<string, Record<string, string>>) => this;

  /**
   * Назначает MN-токены на фиксированный CSS-селектор.
   * Компилирует токены и адресует результат указанному селектору.
   * @example inst.assign('html', 'f14 lh1_5')
   */
  assign: (
    ((selectors: Record<string, string>) => MnInstance) &
    ((selector: string, tokens: string) => MnInstance)
  );

  /**
   * Загружает пресеты — вызывает каждую функцию с текущим экземпляром.
   * @example inst.setPresets([presetStandard, myPreset])
   */
  setPresets: (presets: Array<(mn: this) => void>) => this;

  /**
   * Возвращает компилятор для произвольного HTML-атрибута.
   * Генерирует селектор `[attr~="token"]` вместо `.token`.
   * @example const comp = inst.getCompiler('mn'); comp.check('p10 cF00');
   */
  getCompiler: (attrName: string) => { check: (value: string) => void };

  /**
   * Добавляет токены в очередь компиляции (dedup — повторы игнорируются).
   * @param attrValue - строка токенов через пробел (как значение HTML-атрибута `class`)
   */
  check: (attrValue: string) => this;

  /**
   * Инкрементальная компиляция: обрабатывает только новые токены с последнего вызова.
   * Обновляет {@link styles$} и уведомляет подписчиков.
   */
  compile: () => this;

  /**
   * Полная перекомпиляция с нуля.
   * Нужна после замены хендлеров или синонимов post-compile.
   * Очищает mediaGroups и перекомпилирует все ранее виденные токены.
   */
  recompile: () => this;

  /**
   * Наблюдаемый поток скомпилированных стилей.
   * `getValue()` возвращает текущий массив, `on(fn)` подписывает на новые компиляции.
   */
  styles$: {
    getValue(): StyleBlock[];
    on(fn: (styles: StyleBlock[]) => void): () => void;
  };

  /**
   * Карта именованных медиа-контекстов. Можно дополнять после создания.
   * @example mn.media.m = { query: '(max-width: 991px)', priority: 0 };
   */
  media: Record<string, MediaDef>;

  /**
   * CSS value utilities для авторов пресетов.
   * @example const { val, colorVal } = mn.utils;
   */
  readonly utils: MnUtils;

  constructor(options: MnOptions = {}) {
    // ─── Всё состояние — closure-переменные (§15) ───

    const handlers    = new Map<string, StyleHandler>();
    const synonyms    = new Map<string, string>();
    const expansions  = new Map<string, string>();
    const tokens      = new Set<string>();
    const rawCss      = new Map<string, Record<string, string>>();
    const keyframesMap = new Map<string, string>();
    const assigns     = new Map<string, string[]>();
    const parseCache  = new Map<string, ReturnType<typeof parseLexeme>>();
    // Кэш результатов обработчика: ключ = tag+'\x00'+arg+(important?'\x01':'')
    // Обработчик вызывается один раз для каждого уникального tag+arg, независимо от контекста
    const resultCache = new Map<string, StyleResult>();
    const compilers   = new Map<string, Set<string>>();
    // §16: инкрементальный паттерн — pending-очереди + постоянное состояние
    const pending: string[]  = [];
    const compilersNew = new Map<string, string[]>();
    const pendingAssignSelectors = new Set<string>();
    const mediaGroups  = new Map<string, Map<string, string>>();
    // Кэш разрешённых & combined медиа (например 'sm&safari' → { query, selector, priority })
    const resolvedMediaCache = new Map<string, MediaDef>();
    // §13.2: synonym-with-media — expansion: key → [[stateStr, mediaName|null], ...]
    // Используется когда значение синонима содержит @media или вариантные группы
    const synonymExpansions = new Map<string, Array<[string, string | null]>>();
    let synonymsObj: Record<string, string> = {};
    let rawCssDirty    = false;
    let keyframesDirty = false;
    const listeners: Array<(styles: StyleBlock[]) => void> = [];
    let styles: StyleBlock[] = [];
    let revision = 0;

    // Опции иммутабельны после конструктора — предвычисляем один раз
    const selectorPrefix = options.selectorPrefix || '';
    const onError        = options.onError || ((_e: Error) => {});
    const prefixedAttrs  = options.prefixedAttrs || {};
    const prefixes       = options.prefixes || {};
    const prefixKeys    = Object.keys(prefixes);
    const prefixKeysLen = prefixKeys.length;

    // Regex-константы вычисляются один раз в конструкторе
    const caretRe   = /^(.*)\^(-?\d+)$/;
    const wsSplitRe = /\s+/;
    const ampRe     = /\s*&+\s*/;  // §13.1: разделитель & combinator в медиа-именах

    // ─── Публичные данные ───

    this.media = {};
    this.utils = mnUtils;
    if (options.media) {
      Object.assign(this.media, options.media);
    }

    // ─── Наблюдаемый поток стилей ───

    this.styles$ = {
      getValue: () => styles,
      on: (fn) => {
        listeners.push(fn);
        return () => {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) {
            listeners.splice(idx, 1);
          }
        };
      },
    };

    // ─── Приватные хелперы ───

    /** Кешированный парсинг лексемы (§6.3). */
    const parse = (token: string) => {
      let cached = parseCache.get(token);
      if (!cached) {
        cached = parseLexeme(token);
        parseCache.set(token, cached);
      }
      return cached;
    };

    /**
     * Разрешает медиа-имя в { name, selector?, priority? }.
     * Принимает `media` параметром — не обращается к this.media (§6.3).
     *
     * §13.1: поддерживает & combinator: 'sm&safari' → объединяет query + selector из частей.
     */
    const resolveMedia = (stemMedia: string | null, media: Record<string, MediaDef>) => {
      if (!stemMedia) {
        return {
          name: 'all', 
        };
      }
      let mediaName = stemMedia;
      let priority: number | undefined;
      const caretMatch = caretRe.exec(stemMedia);
      if (caretMatch) {
        mediaName = caretMatch[1];
        priority  = parseInt(caretMatch[2], 10);
      }

      // §13.1: & combinator — 'sm&safari' → split, collect queries + selectors
      if (mediaName.indexOf('&') >= 0) {
        const cached = resolvedMediaCache.get(mediaName);
        if (cached) {
          return {
            name: mediaName,
            selector: cached.selector,
            priority: priority ?? cached.priority, 
          };
        }
        const parts     = mediaName.split(ampRe);
        const queries:   string[] = [];
        const selectors: string[] = [];
        let combinedPriority: number | undefined = priority;
        let pi = 0;
        const plen = parts.length;
        while (pi < plen) {
          const part = parts[pi++];
          if (!part) {
            continue;
          }
          const partDef = media[part];
          if (partDef) {
            if (partDef.query)    {
              queries.push(partDef.query);
            }
            if (partDef.selector) {
              selectors.push(partDef.selector);
            }
            if (combinedPriority === undefined && partDef.priority !== undefined) {
              combinedPriority = partDef.priority;
            }
          } else {
            const tmpl = parseMediaTemplate(part);
            if (tmpl) {
              queries.push(tmpl);
            }
          }
        }
        const resolved: MediaDef = {
          query:    queries.join(' and ')   || undefined,
          selector: selectors.join('')      || undefined,
          priority: combinedPriority,
        };
        resolvedMediaCache.set(mediaName, resolved);
        return {
          name: mediaName,
          selector: resolved.selector,
          priority: combinedPriority, 
        };
      }

      const mediaDef = media[mediaName];
      if (mediaDef?.selector) {
        return {
          name: mediaName,
          selector: mediaDef.selector,
          priority, 
        };
      }
      const template = parseMediaTemplate(mediaName);
      if (template) {
        return {
          name: template,
          priority, 
        };
      }
      return {
        name: mediaName,
        priority, 
      };
    };

    /** Приоритет медиа-группы по умолчанию. */
    const defaultPriority = (mediaName: string): number =>
      mediaName === 'all' ? -2000 : -1000;

    /**
     * Строит CSS-тело из объекта стилей.
     * §6: прямая конкатенация без Object.entries/map/join.
     * §6.2: переменные объявлены до цикла.
     */
    const buildCssBody = (styleObj: Record<string, string>, importantSuffix: string): string => {
      let body = '';
      let k: string;
      let v: string;
      let prop: string;
      let rule: string;
      let j: number;
      for (k in styleObj) {
        v    = styleObj[k];
        prop = camelToKebab(k);
        rule = `${prop}:${v}${importantSuffix}`;
        if (prefixedAttrs[k]) {
          // Сначала вендорные префиксы, потом стандартное свойство
          j = 0;
          while (j < prefixKeysLen) {
            if (body) {
              body += ';';
            }
            body += prefixKeys[j] + rule;
            j++;
          }
        }
        if (body) {
          body += ';';
        }
        body += rule;
      }
      return body;
    };

    // ─── Публичные методы (инициализируются в конструкторе — §15) ───

    this.register = (tag, handler) => {
      handlers.set(tag, handler);
      return this;
    };

    this.registerExpansion = (key, expansion) => {
      expansions.set(key, expansion);
      return this;
    };

    this.setSynonyms = (map) => {
      let k: string;
      let v: string;
      for (k in map) {
        v = map[k];
        // §13.2: synonym-with-media или вариантные/comma синонимы — parseSynonymValue
        // Условие: @ (медиа-суффикс), | (вариант), ',' (несколько альтернатив)
        // НЕ проверяем '(' т.к. CSS-функции :nth-child(2n) содержат '(' без '|'
        if (v.indexOf('@') >= 0 || v.indexOf('|') >= 0 || v.indexOf(',') >= 0) {
          synonymExpansions.set(k, parseSynonymValue(v));
        } else {
          synonyms.set(k, v);
        }
      }
      // §16: предвычисляем при изменении настроек, не в compile()
      synonymsObj = Object.fromEntries(synonyms);
      return this;
    };

    this.css = (selector, rules) => {
      const t = typeof selector;
      if (t === 'string' && rules) {
        rawCss.set(selector as string, rules);
        rawCssDirty = true;
      } else if (t === 'object') {
        const obj = selector as Record<string, Record<string, string>>;
        let sel: string;
        for (sel in obj) {
          rawCss.set(sel, obj[sel]);
        }
        rawCssDirty = true;
      }
      return this;
    };

    this.setKeyframes = (name, body) => {
      let kfStr = '{';
      let step: string;
      let props: Record<string, string>;
      let propsStr: string;
      let k: string;
      for (step in body) {
        props    = body[step];
        propsStr = '';
        for (k in props) {
          if (propsStr) {
            propsStr += ';';
          }
          propsStr += `${camelToKebab(k)}:${props[k]}`;
        }
        kfStr += `${step}{${propsStr}}`;
      }
      kfStr += '}';
      keyframesMap.set(name, kfStr);
      keyframesDirty = true;
      return this;
    };

    this.assign = ((selectorsOrSelector: Record<string, string> | string, tokensArg?: string) => {
      switch(typeof selectorsOrSelector) {
        case 'string':
          if (tokensArg) {
            assigns.set(selectorsOrSelector, tokensArg.split(wsSplitRe));
            pendingAssignSelectors.add(selectorsOrSelector);
          }
          break;
        case 'object': {
          const obj = selectorsOrSelector as Record<string, string>;
          let sel: string;
          for (sel in obj) {
            assigns.set(sel, obj[sel].split(wsSplitRe));
            pendingAssignSelectors.add(sel);
          }
          break;
        }
        default:
          break;
      }

      return this;
    }) as unknown as MnInstance['assign'];

    this.setPresets = (presets) => {
      for (const preset of presets) {
        preset(this);
      }
      return this;
    };

    this.getCompiler = (attrName) => {
      let compSet = compilers.get(attrName);
      if (!compSet) {
        compSet = new Set();
        compilers.set(attrName, compSet);
      }
      let compNew = compilersNew.get(attrName);
      if (!compNew) {
        compNew = [];
        compilersNew.set(attrName, compNew);
      }
      const set   = compSet;
      const queue = compNew;
      return {
        check: (value) => {
          // §6.2: переменные до цикла
          const parts = value.split(wsSplitRe);
          const len   = parts.length;
          let i = 0;
          let t: string;
          while (i < len) {
            t = parts[i];
            // §16: dedup через seen-set, в pending — только новые
            if (t && !set.has(t)) {
              set.add(t);
              queue.push(t);
            }
            i++;
          }
        },
      };
    };

    this.check = (attrValue) => {
      // §6.2: переменные до цикла; §16: dedup через seen-set
      const parts = attrValue.split(wsSplitRe);
      const len   = parts.length;
      let i = 0;
      let t: string;
      while (i < len) {
        t = parts[i];
        if (t && !tokens.has(t)) {
          tokens.add(t);
          pending.push(t);
        }
        i++;
      }
      return this;
    };

    this.compile = () => {
      // §16: guard — нечего обрабатывать, выходим без эффектов
      if (!pending.length && !compilersNew.size && !pendingAssignSelectors.size
          && !rawCssDirty && !keyframesDirty) {
        return this;
      }

      // §6.3: кешируем this.media один раз — передаём в resolveMedia как параметр
      const media = this.media;

      // §2: кортежи [token, attrName] вместо объектов { token, attrName }
      const allTokens: [string, string][] = [];

      // §6.2: все рабочие переменные объявлены до цикла
      let pi: number              = 0;  // pending-loop и keyframes-loop
      let qi: number;                   // compilersNew-loop
      let queueLen: number;
      let ti: number              = 0;
      let token: string;
      let attrName: string;
      let expanded: readonly string[];
      let elen: number;
      let ei: number;
      let expandedToken: string;
      let eq: number;
      let prop: string;
      let varVal: string;
      let sel: string;
      let expansion: string | undefined;
      let expParts: string[];
      let xi: number;
      let expToken: string;
      let lexeme: ReturnType<typeof parseLexeme>;
      let handler: StyleHandler | undefined;
      let result: StyleResult;
      let importantSuffix: string;
      let states: string;
      let targetName: string;
      let contextSelector: string;
      let fullSelector: string;
      let mediaKey: ReturnType<typeof resolveMedia>;
      let group: Map<string, string> | undefined;
      let selector: string;
      let cssBody: string;
      let merged: Record<string, string>;
      let incNames: string[];
      let ii: number;
      let baseHandler: StyleHandler | undefined;
      let baseResult: StyleResult;
      let extNames: string[];
      let expPartsLen: number;
      let stem: ReturnType<typeof parseLexeme>['stem'];
      let selfClassSuffix: string;
      let resultKey: string;
      let mname: string;
      let msel: string | undefined;
      let inc: string | undefined;
      let incNamesLen: number;
      let incToken: string;
      let ext: string | undefined;
      let extNamesLen: number;
      let extToken: string;
      let extBody: string;
      let prev: string | undefined;
      // Variant group: уникальный счётчик для хранения нескольких тел под одним селектором
      // Ключ в Map: selector + '\x02' + vgi, в output фазе '\x02...' стрипается
      let vgi: number             = 0;
      let baseSelector: string;
      let repeat: number;
      let ri: number;
      let selectors: string[] | undefined;
      let si: number;
      let slens: number;
      // childs в StyleResult
      let childNames: string[] | undefined;
      let childHandler: StyleHandler | undefined;
      let childResult: StyleResult;
      let childBody: string;
      let childSels: string[] | undefined;
      let ci: number;
      let childLen: number;
      let cli: number;
      let cslen: number;
      // §13.2: synonym-with-media — expansion variables
      let synExpArr: Array<[string, string | null]> | undefined;
      let synExpStStr: string;
      let synExpMN: string | null;
      let synExpTgt: string;
      let synExpCtx: string;
      let synExpFull: string;
      let synExpMK: ReturnType<typeof resolveMedia>;
      let synExpCombMN: string;
      let synExpGroup: Map<string, string> | undefined;
      let synExpSel: string;
      let sxi: number;
      let synCtxI: number;

      // §16: заполняем из pending-очередей (не из полных seen-sets)
      const pendingLen = pending.length;
      while (pi < pendingLen) {
        allTokens.push([pending[pi], 'class']);
        pi++;
      }
      pending.length = 0;

      for (const [an, queue] of compilersNew) {
        qi = 0;
        queueLen = queue.length;
        while (qi < queueLen) {
          allTokens.push([queue[qi], an]);
          qi++;
        }
        queue.length = 0;
      }

      while (ti < allTokens.length) {
        [token, attrName] = allTokens[ti];
        ti++;
        try {
          expanded = variants(token)[0];
          elen = expanded.length;
          ei   = 0;

          // ── Variant group: (a|b|c) → один CSS-класс с комбинированными стилями ──
          // Оригинальный token (включая скобки) является именем HTML-класса.
          // Каждое расширение использует СВОЁ значение контекста (parent/state/media),
          // но ОДИН и тот же базовый CSS-селектор (из исходного token).
          // Это обеспечивает корректное поведение для:
          //   (p10|m5)<.(clsA|clsB):(hover|focus) → 4 правила, каждое со своим родителем/состоянием
          //   (p10|m5)@sm → правила в медиаблоке @sm
          if (elen > 1) {
            while (ei < elen) {
              expandedToken = expanded[ei];
              ei++;
              lexeme  = parse(expandedToken);
              stem    = lexeme.stem;
              handler = handlers.get(stem.tag);
              if (!handler) {
                continue;
              }

              // Базовый CSS-селектор из ОРИГИНАЛЬНОГО token (одинаков для всех расширений)
              if (attrName === 'class') {
                baseSelector = '.' + escapeCss(token);
              } else if (attrName === 'id') {
                baseSelector = '#' + escapeCss(token);
              } else {
                baseSelector = '[' + attrName + '~="' + token.replace(/"/g, '\\"') + '"]';
              }

              // Multiplier: берётся из каждого расширения отдельно
              repeat = lexeme.multiplier ?? 1;
              let groupBase = baseSelector;
              ri = 1;
              while (ri < repeat) {
                groupBase += baseSelector;
                ri++;
              }

              // Контекст (parent, states, self-class) берётся из ЭТОГО расширения
              selfClassSuffix = lexeme.selfClasses.length
                ? lexeme.selfClasses.map(normalizeSelectorStr).join('')
                : '';

              importantSuffix = stem.important ? '!important' : '';
              resultKey = stem.tag + '\x00' + stem.arg + (stem.important ? '\x01' : '');
              result    = resultCache.get(resultKey)!;
              if (!result) {
                result = handler(stem);
                resultCache.set(resultKey, result);
              }
              cssBody = buildCssBody(result.style, importantSuffix);

              mediaKey = resolveMedia(lexeme.stemMedia, media);
              mname    = mediaKey.name;
              msel     = mediaKey.selector;

              // §13.2: synonym-with-media в variant group path
              synExpArr = undefined;
              synCtxI   = 0;
              while (synCtxI < lexeme.context.length) {
                const _seg2 = lexeme.context[synCtxI++];
                if (_seg2.kind === 'state') {
                  const _arr2 = synonymExpansions.get(_seg2.name);
                  if (_arr2) {
                    synExpArr = _arr2; break; 
                  }
                }
              }

              if (synExpArr) {
                sxi = 0;
                while (sxi < synExpArr.length) {
                  synExpStStr = synExpArr[sxi][0];
                  synExpMN    = synExpArr[sxi][1];
                  sxi++;
                  synExpTgt  = groupBase + selfClassSuffix + synExpStStr;
                  synExpCtx  = compileSelector(lexeme, synExpTgt);
                  synExpFull = selectorPrefix ? selectorPrefix + ' ' + synExpCtx : synExpCtx;
                  if (synExpMN) {
                    synExpCombMN = lexeme.stemMedia ? lexeme.stemMedia + '&' + synExpMN : synExpMN;
                    synExpMK     = resolveMedia(synExpCombMN, media);
                  } else {
                    synExpMK = mediaKey;
                  }
                  synExpGroup = mediaGroups.get(synExpMK.name);
                  if (!synExpGroup) {
                    synExpGroup = new Map(); mediaGroups.set(synExpMK.name, synExpGroup); 
                  }
                  synExpSel = synExpMK.selector ? synExpMK.selector + ' ' + synExpFull : synExpFull;
                  // '\x02' + vgi — variant group деdup суффикс
                  synExpGroup.set(synExpSel + '\x02' + (vgi++), cssBody);
                }
              } else {
                states          = compileStates(lexeme, synonymsObj);
                targetName      = groupBase + selfClassSuffix + states;
                contextSelector = compileSelector(lexeme, targetName);
                fullSelector    = selectorPrefix ? selectorPrefix + ' ' + contextSelector : contextSelector;
                group    = mediaGroups.get(mname);
                if (!group) {
                  group = new Map(); mediaGroups.set(mname, group); 
                }
                selector = msel ? msel + ' ' + fullSelector : fullSelector;
                // '\x02' + vgi — служебный суффикс, стрипается в output-фазе;
                // обеспечивает уникальность ключа при нескольких телах под одним selector
                group.set(selector + '\x02' + (vgi++), cssBody);
              }
            }
            continue;
          }

          // ── Нормальный путь: одиночный токен ──
          while (ei < elen) {
            expandedToken = expanded[ei];
            ei++;

            // --var=value: CSS custom properties
            if (expandedToken.startsWith('--')) {
              eq = expandedToken.indexOf('=');
              if (eq > 0) {
                prop   = expandedToken.slice(0, eq);
                varVal = expandedToken.slice(eq + 1).replace(/_/g, ' ');
                group  = mediaGroups.get('all');
                if (!group) {
                  group = new Map(); mediaGroups.set('all', group); 
                }
                sel = attrName === 'class'
                  ? '.' + escapeCss(expandedToken).replace(/=/g, '\\=')
                  : `[${attrName}~="${expandedToken.replace(/"/g, '\\"')}"]`;
                group.set(sel, `${prop}:${varVal}`);
              }
              continue;
            }

            // Строковые макросы — до парсинга стема
            expansion = expansions.get(expandedToken);
            if (expansion) {
              expParts    = expansion.trim().split(wsSplitRe);
              expPartsLen = expParts.length;
              xi = 0;
              while (xi < expPartsLen) {
                expToken = expParts[xi];
                // §16: dedup expansion-токенов через seen-set
                if (expToken && !tokens.has(expToken)) {
                  tokens.add(expToken);
                  allTokens.push([expToken, attrName]);
                }
                xi++;
              }
              continue;
            }

            lexeme  = parse(expandedToken);
            stem    = lexeme.stem;
            handler = handlers.get(stem.tag);
            if (!handler) {
              continue;
            }

            // Кэш обработчика: один вызов на уникальный tag+arg+important.
            resultKey = stem.tag + '\x00' + stem.arg + (stem.important ? '\x01' : '');
            result    = resultCache.get(resultKey)!;
            if (!result) {
              result = handler(stem);
              resultCache.set(resultKey, result);
            }
            importantSuffix = stem.important ? '!important' : '';
            states          = compileStates(lexeme, synonymsObj);

            selfClassSuffix = lexeme.selfClasses.length
              ? lexeme.selfClasses.map(normalizeSelectorStr).join('')
              : '';

            // Multiplier: повторяем базовый селектор N раз
            repeat = lexeme.multiplier ?? 1;
            baseSelector = attrName === 'class'
              ? compileClassName(lexeme)
              : attrName === 'id'
                ? compileIdSelector(lexeme)
                : compileAttrSelector(lexeme, attrName);

            if (repeat > 1) {
              let repeated = baseSelector;
              ri = 1;
              while (ri < repeat) {
                repeated += baseSelector;
                ri++;
              }
              targetName = repeated + selfClassSuffix + states;
            } else {
              targetName = baseSelector + selfClassSuffix + states;
            }

            contextSelector = compileSelector(lexeme, targetName);
            fullSelector    = selectorPrefix
              ? selectorPrefix + ' ' + contextSelector
              : contextSelector;

            mediaKey = resolveMedia(lexeme.stemMedia, media);
            mname    = mediaKey.name;
            msel     = mediaKey.selector;

            // include: сливаем стили из других хендлеров в текущий блок
            inc = result.include;
            if (inc) {
              merged      = {
                ...result.style, 
              };
              incNames    = inc.split(wsSplitRe);
              incNamesLen = incNames.length;
              ii = 0;
              while (ii < incNamesLen) {
                incToken    = incNames[ii];
                baseHandler = handlers.get(incToken);
                if (baseHandler) {
                  resultKey  = incToken + '\x00';
                  baseResult = resultCache.get(resultKey)!;
                  if (!baseResult) {
                    baseResult = baseHandler({
                      tag: incToken,
                      arg: '',
                      raw: incToken, 
                    });
                    resultCache.set(resultKey, baseResult);
                  }
                  Object.assign(merged, baseResult.style);
                }
                ii++;
              }
              cssBody = buildCssBody(merged, importantSuffix);
            } else {
              cssBody = buildCssBody(result.style, importantSuffix);
            }

            // §13.2: synonym-with-media — ищем первое состояние с expansion в контексте
            // Проверяем ДО создания media group, чтобы не создавать пустую группу
            synExpArr = undefined;
            synCtxI   = 0;
            while (synCtxI < lexeme.context.length) {
              const _seg = lexeme.context[synCtxI++];
              if (_seg.kind === 'state') {
                const _arr = synonymExpansions.get(_seg.name);
                if (_arr) {
                  synExpArr = _arr; break; 
                }
              }
            }

            if (synExpArr) {
              sxi = 0;
              while (sxi < synExpArr.length) {
                synExpStStr = synExpArr[sxi][0];
                synExpMN    = synExpArr[sxi][1];
                sxi++;
                synExpTgt  = baseSelector + selfClassSuffix + synExpStStr;
                synExpCtx  = compileSelector(lexeme, synExpTgt);
                synExpFull = selectorPrefix ? selectorPrefix + ' ' + synExpCtx : synExpCtx;
                if (synExpMN) {
                  synExpCombMN = lexeme.stemMedia ? lexeme.stemMedia + '&' + synExpMN : synExpMN;
                  synExpMK     = resolveMedia(synExpCombMN, media);
                } else {
                  synExpMK = mediaKey;
                }
                synExpGroup = mediaGroups.get(synExpMK.name);
                if (!synExpGroup) {
                  synExpGroup = new Map(); mediaGroups.set(synExpMK.name, synExpGroup); 
                }
                synExpSel = synExpMK.selector ? synExpMK.selector + ' ' + synExpFull : synExpFull;
                if (!synExpGroup.has(synExpSel)) {
                  synExpGroup.set(synExpSel, cssBody);
                }
              }
              continue; // пропускаем обычный group.set + include/exts/selectors/childs
            }

            // Normal path: группа создаётся только если нет synonym expansion
            group    = mediaGroups.get(mname);
            if (!group) {
              group = new Map(); mediaGroups.set(mname, group); 
            }
            selector = msel ? msel + ' ' + fullSelector : fullSelector;

            if (!group.has(selector)) {
              group.set(selector, cssBody);
            }

            // exts: отдельные блоки с тем же селектором
            ext = result.exts;
            if (ext) {
              extNames    = ext.split(wsSplitRe);
              extNamesLen = extNames.length;
              xi = 0;
              while (xi < extNamesLen) {
                extToken    = extNames[xi];
                baseHandler = handlers.get(extToken);
                if (baseHandler) {
                  resultKey  = extToken + '\x00';
                  baseResult = resultCache.get(resultKey)!;
                  if (!baseResult) {
                    baseResult = baseHandler({
                      tag: extToken,
                      arg: '',
                      raw: extToken, 
                    });
                    resultCache.set(resultKey, baseResult);
                  }
                  extBody    = buildCssBody(baseResult.style, importantSuffix);
                  prev       = group.get(selector);
                  group.set(selector, prev ? prev + ';' + extBody : cssBody + ';' + extBody);
                }
                xi++;
              }
            }

            // selectors: дополнительные статические CSS-правила
            selectors = result.selectors;
            if (selectors) {
              slens = selectors.length;
              si = 0;
              while (si < slens) {
                sel = selectors[si];
                si++;
                if (!group.has(sel)) {
                  group.set(sel, cssBody);
                }
              }
            }

            // childs: дочерние эссенции с контекстным селектором
            // child.selectors[i] конкатенируется с parent selector напрямую
            childNames = result.childs;
            if (childNames) {
              childLen = childNames.length;
              ci = 0;
              while (ci < childLen) {
                childHandler = handlers.get(childNames[ci]);
                ci++;
                if (!childHandler) {
                  continue;
                }
                childResult = childHandler({
                  tag: '',
                  arg: '',
                  raw: '', 
                });
                childBody   = buildCssBody(childResult.style, importantSuffix);
                childSels   = childResult.selectors;
                if (childSels) {
                  cslen = childSels.length;
                  cli = 0;
                  while (cli < cslen) {
                    const childSel = selector + childSels[cli];
                    cli++;
                    if (!group!.has(childSel)) {
                      group!.set(childSel, childBody);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          onError(err as Error);
        }
      }

      // ─── Assign-эссенции (§16: только pending assign-селекторы) ───
      // §6.2: переменные ai/alen объявлены до цикла (reuse token/expanded/elen/ei etc.)
      let ai: number;
      let alen: number;
      if (pendingAssignSelectors.size) {
        // Сбрасываем старый CSS для обновляемых селекторов (§16: no duplicate accumulation)
        const allGroup = mediaGroups.get('all');
        if (allGroup) {
          for (const tsel of pendingAssignSelectors) {
            allGroup.delete(tsel);
          }
        }
        for (const [targetSelector, assignTokens] of assigns) {
          if (!pendingAssignSelectors.has(targetSelector)) {
            continue;
          }
          alen = assignTokens.length;
          ai   = 0;
          while (ai < alen) {
            token = assignTokens[ai];
            ai++;
            try {
              expanded = variants(token)[0];
              elen = expanded.length;
              ei   = 0;
              while (ei < elen) {
                expandedToken   = expanded[ei];
                ei++;
                lexeme          = parse(expandedToken);
                handler         = handlers.get(lexeme.stem.tag);
                if (!handler) {
                  continue;
                }
                result          = handler(lexeme.stem);
                importantSuffix = lexeme.stem.important ? '!important' : '';
                cssBody         = buildCssBody(result.style, importantSuffix);
                group  = mediaGroups.get('all');
                if (!group) {
                  group = new Map(); mediaGroups.set('all', group); 
                }
                prev = group.get(targetSelector);
                group.set(targetSelector, prev ? prev + ';' + cssBody : cssBody);
              }
            } catch (err) {
              onError(err as Error);
            }
          }
        }
        pendingAssignSelectors.clear();
      }

      // ─── Сборка итоговых блоков ───
      const newStyles: StyleBlock[] = [];
      revision++;

      // §6.2: переменные до цикла
      let mediaName: string;
      let mediaDef: MediaDef | undefined;
      let priority: number;
      let content: string;
      let cssContent: string;
      let query: string;
      let cssBodyRaw: string;
      // Группировка селекторов: один cssBody → несколько селекторов через запятую
      let bodyMap: Map<string, string[]>;
      let selsForBody: string[] | undefined;
      let x02: number;
      let cleanSel: string;

      for ([mediaName, group] of mediaGroups) {
        // Инвертируем Map<selector, body> → Map<body, selector[]> для группировки
        // '\x02N' суффикс — служебный ключ для variant-групп (несколько тел под одним селектором)
        bodyMap = new Map();
        for (const [s, c] of group) {
          x02      = s.indexOf('\x02');
          cleanSel = x02 >= 0 ? s.slice(0, x02) : s;
          selsForBody = bodyMap.get(c);
          if (!selsForBody) {
            selsForBody = []; bodyMap.set(c, selsForBody); 
          }
          selsForBody.push(cleanSel);
        }
        content = '';
        for (const [c, sels] of bodyMap) {
          content += sels.join(',') + '{' + c + '}';
        }

        // §13.1: сначала проверяем resolved & combined медиа, потом media registry
        mediaDef = media[mediaName] ?? resolvedMediaCache.get(mediaName);
        priority = mediaDef?.priority ?? defaultPriority(mediaName);

        // selector-only: нет @media обёртки (селектор уже встроен в CSS-правила при compile)
        // combined query+selector: @media нужна (selector встроен, query — обёртка)
        if (mediaName === 'all' || (mediaDef?.selector && !mediaDef?.query)) {
          cssContent = content;
        } else {
          query      = mediaDef?.query || mediaName;
          cssContent = `@media ${query}{${content}}`;
        }

        newStyles.push({
          name: 'media.' + mediaName,
          priority,
          content: cssContent,
          revision,
        });
      }

      newStyles.sort((a, b) => a.priority - b.priority);

      // Сырые CSS-правила
      let rawSel: string;
      let rawRules: Record<string, string>;
      let rawK: string;
      for ([rawSel, rawRules] of rawCss) {
        cssBodyRaw = '';
        for (rawK in rawRules) {
          if (cssBodyRaw) {
            cssBodyRaw += ';';
          }
          cssBodyRaw += `${camelToKebab(rawK)}:${rawRules[rawK]}`;
        }
        newStyles.push({
          name: 'custom.css',
          priority: -4000,
          content: `${rawSel}{${cssBodyRaw}}`,
          revision,
        });
      }

      // Keyframes
      let kfName: string;
      let kfBody: string;
      let kfContent: string;
      for ([kfName, kfBody] of keyframesMap) {
        kfContent = '';
        pi = 0;
        while (pi < prefixKeysLen) {
          kfContent += `@${prefixKeys[pi]}keyframes ${kfName}${kfBody}`;
          pi++;
        }
        kfContent += `@keyframes ${kfName}${kfBody}`;
        newStyles.push({
          name: 'keyframes.' + kfName,
          priority: -3000,
          content: kfContent,
          revision,
        });
      }

      styles         = newStyles;
      rawCssDirty    = false;
      keyframesDirty = false;

      // §6.4: обратный цикл уведомлений
      let i = listeners.length;
      while (i--) {
        listeners[i](styles);
      }

      return this;
    };

    this.recompile = () => {
      // §16: полный ресет — очищаем накопленные результаты и перекладываем всё в pending
      mediaGroups.clear();
      resolvedMediaCache.clear(); // §13.1: сбрасываем кэш & combined медиа при полном ресете
      resultCache.clear(); // при recompile пресеты могли смениться — сбрасываем кэш хендлеров
      synonymsObj = Object.fromEntries(synonyms);
      // synonymExpansions сохраняются (заполняются при setSynonyms, не при compile)
      tokens.forEach(t => pending.push(t));
      for (const [an, compSet] of compilers) {
        let queue = compilersNew.get(an);
        if (!queue) {
          queue = []; compilersNew.set(an, queue); 
        }
        compSet.forEach(t => queue!.push(t));
      }
      for (const sel of assigns.keys()) {
        pendingAssignSelectors.add(sel);
      }
      return this.compile();
    };
  }
}
