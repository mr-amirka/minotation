import {
  MnInstance, 
} from './MnInstance';
import type {
  StyleHandler,
  StyleResult,
  StyleBlock,
  MediaDef,
  MnOptions,
} from './types';
import type {
  MnUtils, 
} from '../utils';

/**
 * Значение, принимаемое при callable-регистрации `mn(key, value)`.
 *
 * - `StyleHandler` — функция-обработчик (матч по тег-префиксу)
 * - `string` — строковый макрос (полный токен → раскрытие)
 * - `StyleResult` — статический объект стилей
 */
export type RegisterValue = StyleHandler | string | StyleResult;

/**
 * Callable-экземпляр Minimalist Notation.
 *
 * Функция `mn` одновременно является объектом — её можно вызывать
 * для регистрации хендлеров и использовать методы через точку.
 *
 * ## Регистрация хендлеров
 *
 * ```ts
 * // Функция-хендлер (по тег-префиксу):
 * mn('p', (c) => ({ style: { padding: c.arg + 'px' } }));
 *
 * // Строковый макрос (точное совпадение токена → раскрытие):
 * mn('flex-center', 'fx fxaC fyaC');
 *
 * // Статический объект стилей:
 * mn('abs', { style: { position: 'absolute' } });
 *
 * // Карта сразу нескольких:
 * mn({ p: handler, abs: { style: { position: 'absolute' } } });
 * ```
 *
 * ## Цепочка вызовов
 *
 * ```ts
 * mn('p', handler)
 *   .check('p10 p20')
 *   .compile();
 * const css = mn.styles$.getValue().map(b => b.content).join('');
 * ```
 *
 * Создаётся через {@link createMn}.
 */
export interface MnFn {
  /**
   * Регистрирует хендлер, макрос или статический стиль по ключу.
   *
   * - `handler` — функция, матчит по тег-префиксу (`'p'` → `p10`, `p4`, …)
   * - `string` — макрос, матчит по точному совпадению токена (`'flex-center'`)
   * - `StyleResult` — статический объект стилей
   *
   * @example
   * mn('p', (c) => ({ style: { padding: c.arg + 'px' } }));
   * mn('flex-center', 'fx fxaC fyaC');
   * mn('card', { style: { borderRadius: '8px', padding: '16px' } });
   */
  (key: string, value: RegisterValue): MnFn;

  /**
   * Регистрирует несколько хендлеров/макросов за один вызов.
   *
   * @example
   * mn({
   *   p:  (c) => ({ style: { padding: c.arg + 'px' } }),
   *   m:  (c) => ({ style: { margin: c.arg + 'px' } }),
   *   abs: { style: { position: 'absolute' } },
   *   'flex-center': 'fx fxaC fyaC',
   * });
   */
  (map: Record<string, RegisterValue>): MnFn;

  /**
   * Устанавливает синонимы псевдоклассов/состояний.
   *
   * Ключ — короткий алиас в токене, значение — CSS-суффикс (`:hover`, `[disabled]`, …).
   *
   * @example
   * mn.setSynonyms({ h: ':hover', f: ':focus', d: '[disabled]' });
   * // cF00:h → .cF00:hover { color: #F00 }
   */
  setSynonyms(map: Record<string, string>): MnFn;

  /**
   * Добавляет сырые CSS-правила, не проходящие через MN-трансформацию.
   *
   * @example
   * // Один селектор:
   * mn.css('*, *::before, *::after', { boxSizing: 'border-box' });
   *
   * // Карта селекторов:
   * mn.css({
   *   'html, body': { margin: '0', padding: '0' },
   *   'a': { textDecoration: 'none' },
   * });
   */
  css(
    selector: string | Record<string, Record<string, string>>,
    rules?: Record<string, string>,
  ): MnFn;

  /**
   * Регистрирует `@keyframes` анимацию.
   *
   * Ключи объекта `body` — шаги (`'from'`, `'to'`, `'0%'`, `'50%'`),
   * значения — CSS-свойства в camelCase.
   *
   * @example
   * mn.setKeyframes('fadeIn', {
   *   from: { opacity: '0' },
   *   to:   { opacity: '1' },
   * });
   * // → @keyframes fadeIn { from{opacity:0} to{opacity:1} }
   */
  setKeyframes(name: string, body: Record<string, Record<string, string>>): MnFn;

  /**
   * Назначает MN-токены на фиксированный CSS-селектор.
   *
   * Токены компилируются как обычно, но CSS-блок адресован указанному селектору,
   * а не классу из разметки. Удобно для глобальных reset-правил или base-стилей.
   *
   * @example
   * mn.assign('*, *::before, *::after', 'bxzbb');
   * mn.assign({
   *   'html': 'f14 lh1_5',
   *   'body': 'bg0 c0',
   * });
   */
  assign(selector: string, tokens: string): MnFn;
  assign(selectors: Record<string, string>): MnFn;

  /**
   * Загружает пресеты — вызывает каждую функцию с текущим экземпляром `mn`.
   *
   * Пресет — функция `(mn: MnFn) => void`, регистрирующая хендлеры через `mn(...)`.
   *
   * @example
   * import { presetStandard } from 'minotation/presets/standard';
   *
   * mn.setPresets([presetStandard]);
   *
   * // Собственный пресет:
   * const myPreset = (mn: MnFn) => {
   *   mn('card', { style: { borderRadius: '8px' } });
   *   mn.css('*', { boxSizing: 'border-box' });
   * };
   * mn.setPresets([presetStandard, myPreset]);
   */
  setPresets(presets: Array<(mn: MnFn) => void>): MnFn;

  /**
   * Возвращает компилятор для произвольного HTML-атрибута (не `class`).
   *
   * Полезно когда MN-токены размещаются в кастомных атрибутах (`mn`, `data-mn`, …).
   * CSS-селектор генерируется как `[attr~="token"]` вместо `.token`.
   *
   * @example
   * const mnAttr = mn.getCompiler('mn');
   * mnAttr.check('p10 cF00');
   * mn.compile();
   * // → [mn~="p10"]{padding:10px}  [mn~="cF00"]{color:#F00}
   */
  getCompiler(attrName: string): { check: (value: string) => void };

  /**
   * Добавляет токены в очередь компиляции (dedup — повторы игнорируются).
   *
   * Принимает строку с пробельными разделителями — как значение HTML-атрибута `class`.
   * Фактическая компиляция происходит при следующем вызове {@link compile}.
   *
   * @example
   * mn.check('p10 cF00 bgF.12');
   * mn.check('p10'); // проигнорируется — уже в очереди
   * mn.compile();
   */
  check(attrValue: string): MnFn;

  /**
   * Компилирует накопленные токены в CSS-блоки.
   *
   * Инкрементальная: обрабатывает только токены, добавленные с последнего вызова.
   * Без новых токенов — выходит без эффектов.
   * После компиляции обновляет {@link styles$} и уведомляет подписчиков.
   *
   * @example
   * mn.check('p10 cF00').compile();
   * const css = mn.styles$.getValue().map(b => b.content).join('');
   */
  compile(): MnFn;

  /**
   * Полная перекомпиляция с нуля.
   *
   * Используется когда изменились хендлеры или синонимы после первой компиляции —
   * например, при горячей замене пресетов. Очищает накопленные CSS-группы
   * и перекомпилирует все ранее виденные токены.
   *
   * @example
   * mn.check('p10').compile();
   * mn('p', newHandler);  // заменили хендлер
   * mn.recompile();       // пересобрать CSS с новым хендлером
   */
  recompile(): MnFn;

  /**
   * Карта именованных медиа-контекстов.
   * Можно дополнять после создания экземпляра.
   *
   * @example
   * mn.media.m  = { query: '(max-width: 991px)', priority: 0 };
   * mn.media.xl = { query: '(min-width: 1280px)', priority: 1 };
   * // Использование: p10@m, cF00@xl
   */
  media: Record<string, MediaDef>;

  /**
   * Наблюдаемый поток скомпилированных CSS-блоков.
   *
   * - `getValue()` — синхронно возвращает последний результат (пустой массив до первой компиляции)
   * - `on(fn)` — подписка на каждую компиляцию; возвращает функцию отписки
   *
   * @example
   * const unsub = mn.styles$.on((blocks) => {
   *   const css = blocks.map(b => b.content).join('');
   *   styleTag.textContent = css;
   * });
   * // позже:
   * unsub();
   */
  readonly styles$: {
    getValue(): StyleBlock[];
    on(fn: (styles: StyleBlock[]) => void): () => void;
  };

  /**
   * CSS value utilities для авторов пресетов.
   *
   * @example
   * const { val, colorVal, numVal } = mn.utils;
   * mn('p', (c) => ({ style: { padding: val(c.arg) } }));
   * mn('c', (c) => ({ style: { color: colorVal(c.arg) } }));
   */
  readonly utils: MnUtils;
}

// Служебный тип: снимает readonly-модификатор со всех свойств MnFn.
// Нужен для назначения методов на функцию mnFn без приведения через any.
type MutableMnFn = {
  -readonly [K in keyof MnFn]: MnFn[K];
};

function _isStyleResult(v: unknown): v is StyleResult {
  return typeof v === 'object' && v !== null && 'style' in v;
}

/**
 * Регистрирует один ключ в экземпляре MnInstance.
 * Разбирает тип значения и вызывает соответствующий внутренний метод:
 * - функция → `inst.register` (хендлер по тег-префиксу)
 * - строка  → `inst.registerExpansion` (строковый макрос, точное совпадение)
 * - объект с `style` → `inst.register` со статической функцией-обёрткой
 */
function _registerOne(
  inst: MnInstance, key: string, value: RegisterValue,
): void {
  const t = typeof value;
  if (t === 'function') {
    inst.register(key, value as StyleHandler);
  } else if (t === 'string') {
    inst.registerExpansion(key, value as string);
  } else if (_isStyleResult(value)) {
    const staticResult = value;
    inst.register(key, () => staticResult);
  }
}

/**
 * Создаёт callable-экземпляр Minimalist Notation.
 *
 * Возвращает функцию `mn`, которую можно вызывать напрямую для регистрации
 * хендлеров и одновременно использовать как объект (`mn.compile()`, `mn.check()`, …).
 *
 * Методы `MnInstance` делегируются через кешированные ссылки (§6.3) —
 * без lookup по прototipной цепочке на каждом вызове.
 *
 * @param options - опции {@link MnOptions}
 * @returns {@link MnFn} — callable-экземпляр MN
 *
 * @example
 * const mn = createMn();
 * mn('p', (c) => ({ style: { padding: mn.utils.val(c.arg) } }));
 * mn.check('p10 cF00');
 * mn.compile();
 * const css = mn.styles$.getValue().map(b => b.content).join('');
 */
export function createMn(options?: MnOptions): MnFn {
  const inst = new MnInstance(options);

  // §6.3: кешируем ссылки на методы inst один раз —
  // делегирующие обёртки на mnFn не делают property lookup при каждом вызове
  const instSetSynonyms       = inst.setSynonyms;
  const instCss               = inst.css;
  const instSetKeyframes      = inst.setKeyframes;
  const instAssign            = inst.assign;
  const instGetCompiler       = inst.getCompiler;
  const instCheck             = inst.check;
  const instCompile           = inst.compile;
  const instRecompile         = inst.recompile;

  function mnFn(keyOrMap: string | Record<string, RegisterValue>,
    value?: RegisterValue): MnFn {
    if (typeof keyOrMap === 'string') {
      _registerOne(
        inst, keyOrMap, value!,
      );
    } else {
      for (const [k, v] of Object.entries(keyOrMap)) {
        _registerOne(
          inst, k, v,
        );
      }
    }
    return mnFn as unknown as MnFn;
  }

  // Типизированный прокси для назначения методов и свойств на mnFn без any
  const mnFnM = mnFn as unknown as MutableMnFn;

  // Делегирующие обёртки: вызывают кешированный метод inst, возвращают mnFn для чейнинга
  mnFnM.setSynonyms = (map: Record<string, string>) => {
    instSetSynonyms(map); return mnFnM as unknown as MnFn;
  };
  mnFnM.css = (sel: string | Record<string, Record<string, string>>, rules?: Record<string, string>) => {
    instCss(sel, rules); return mnFnM as unknown as MnFn;
  };
  mnFnM.setKeyframes = (name: string, body: Record<string, Record<string, string>>) => {
    instSetKeyframes(name, body); return mnFnM as unknown as MnFn;
  };
  mnFnM.assign = ((a: string | Record<string, string>, b?: string) => {
    if (typeof a === 'string') {
      instAssign(a, b!);
    } else {
      instAssign(a);
    }
    return mnFnM as unknown as MnFn;
  }) as MnFn['assign'];
  mnFnM.getCompiler = instGetCompiler; // возвращает объект, не chainable
  mnFnM.check = (v: string) => {
    instCheck(v); return mnFnM as unknown as MnFn;
  };
  mnFnM.compile = () => {
    instCompile(); return mnFnM as unknown as MnFn;
  };
  mnFnM.recompile = () => {
    instRecompile(); return mnFnM as unknown as MnFn;
  };

  // setPresets: передаём mnFn в каждый пресет (не inst),
  // чтобы пресеты могли вызывать mn(...) как callable
  mnFnM.setPresets = (presets: Array<(mn: MnFn) => void>) => {
    for (const preset of presets) {
      preset(mnFnM as unknown as MnFn);
    }
    return mnFnM as unknown as MnFn;
  };

  // Данные делегируются через общую ссылку (мутации видны с обеих сторон)
  mnFnM.media   = inst.media;
  mnFnM.utils   = inst.utils;
  mnFnM.styles$ = inst.styles$;

  return mnFnM as unknown as MnFn;
}
