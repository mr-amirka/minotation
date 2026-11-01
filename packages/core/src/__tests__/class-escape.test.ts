/**
 * Имя класса в селекторе — одни и те же байты в Node (запасная ветка `escapeCss`) и в браузере
 * (`escapeCss` — это `CSS.escape`): скобки не экранируются дважды, цифра в начале — кодом.
 */
import type minotationProviderType from '../core/index';
import type presetStandardType from '../presets/standard';
import type presetMediasType from '../presets/medias';
import type presetTw4Type from '../presets/tw4';

type Modules = {
  minotationProvider: typeof minotationProviderType;
  presetStandard: typeof presetStandardType;
  presetMedias: typeof presetMediasType;
  presetTw4: typeof presetTw4Type;
};

/**
 * `CSS.escape` по спецификации CSSOM («serialize an identifier») — как в браузере.
 * @param value — строка
 * @returns идентификатор CSS
 */
function cssEscape(value: string): string {
  const dashFirst = value[0] === '-';
  let out = '';
  let code: number;
  for (let i = 0; i < value.length; i++) {
    code = value.charCodeAt(i);
    if (code === 0) {
      out += '�';
    } else if (code < 0x20 || code === 0x7f || (i === 0 && code >= 0x30 && code <= 0x39)
      || (i === 1 && code >= 0x30 && code <= 0x39 && dashFirst)) {
      out += '\\' + code.toString(16) + ' ';
    } else if (i === 0 && value.length === 1 && dashFirst) {
      out += '\\-';
    } else if (code >= 0x80 || /[\w-]/.test(value[i])) {
      out += value[i];
    } else {
      out += '\\' + value[i];
    }
  }
  return out;
}

/**
 * Загружает ядро заново — с `CSS.escape` или без: `escapeCss` выбирает ветку при загрузке.
 * @param native — есть ли `CSS.escape`, как в браузере
 * @returns модули ядра
 */
function load(native: boolean): Modules {
  const scope = globalThis as { CSS?: { escape: (value: string) => string } };
  let modules = {} as Modules;
  scope.CSS = native ? {
    escape: cssEscape,
  } : undefined;
  jest.isolateModules(() => {
    modules = {
      minotationProvider: require('../core/index').default,
      presetStandard: require('../presets/standard').default,
      presetMedias: require('../presets/medias').default,
      presetTw4: require('../presets/tw4').default,
    };
  });
  delete scope.CSS;
  return modules;
}

/**
 * Компилирует токены и возвращает CSS.
 * @param m — модули ядра
 * @param tw4 — запись Tailwind 4 вместо стандартной
 * @param tokens — токены
 * @returns CSS
 */
function compile(
  m: Modules, tw4: boolean, tokens: string[],
): string {
  const mn = m.minotationProvider(tw4 ? {
    notationMode: 'tw4-compatible',
  } : {});
  mn.setPresets(tw4 ? [
    m.presetMedias,
    m.presetTw4,
  ] : [m.presetStandard]);
  const c = mn.getCompiler('class');
  tokens.forEach((t) => c(t));
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('');
}

const NODE = load(false);
const BROWSER = load(true);

describe('имя класса — одинаково в Node и в браузере', () => {
  test.each([
    [
      'w{1+2}',
      '.w\\{1\\+2\\}{width:calc(1px + 2px)}',
    ],
    [
      'm$a{10}',
      '.m\\$a\\{10\\}{margin:var(--a, 10px)}',
    ],
    [
      'wMin{10,5%}',
      '.wMin\\{10\\,5\\%\\}{width:min(10px, 5%)}',
    ],
    [
      'w900@sm&safari',
      '@media sm and safari{.w900\\@sm\\&safari{width:900px}}',
    ],
  ])('%s', (token, css) => {
    expect([
      compile(
        NODE, false, [token],
      ),
      compile(
        BROWSER, false, [token],
      ),
    ]).toEqual([
      css,
      css,
    ]);
  });

  test('цифра в начале — кодом: 2xl:p-4', () => {
    const css = ':root{--spacing:0.25rem}@media (width >= 96rem){.\\32 xl\\:p-4{padding:calc(var(--spacing) * 4)}}';
    expect([
      compile(
        NODE, true, ['2xl:p-4'],
      ),
      compile(
        BROWSER, true, ['2xl:p-4'],
      ),
    ]).toEqual([
      css,
      css,
    ]);
  });
});
