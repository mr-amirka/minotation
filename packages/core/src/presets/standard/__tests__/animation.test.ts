/**
 * `an` — анимация, слоты в фиксированном порядке, как у `tn` (запрос трека web-games, 2026-10-14); именованные
 * анимации с кадрами по использованию — группа G (D-097).
 */
import minotationProvider from '../../../core';
import presetStandard from '..';

function compile(tokens: string, setup?: (mn: ReturnType<typeof minotationProvider>) => void) {
  const warnings: string[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w.message),
  });
  mn.setPresets([presetStandard]);
  setup && setup(mn);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings,
  };
}

test.each([
  [
    'an_wg-appear_0.2s_ease-out_0.3s_both',
    'animation:wg-appear 0.2s ease-out 0.3s both',
  ],
  [
    'an_spin_1s_linear_infinite',
    'animation:spin 1s linear infinite',
  ],
  [
    'an_fade_200',
    'animation:fade 200ms',
  ],
  [
    'an_fade_200_300_2_alternate_forwards_paused',
    'animation:fade 200ms 300ms 2 alternate forwards paused',
  ],
  [
    'an_none',
    'animation:none',
  ],
  [
    'an_x_1s_none',
    'animation:x 1s none',
  ],
  [
    'an_a_1s,b_2s',
    'animation:a 1s,b 2s',
  ],
  [
    'an_--anim',
    'animation:var(--anim)',
  ],
  [
    'an_fade_1s_cubic-bezier\\(0.4,0,0.2,1\\)',
    'animation:fade 1s cubic-bezier(0.4,0,0.2,1)',
  ],
  [
    'an_fade_1s_steps\\(4\\)_infinite',
    'animation:fade 1s steps(4) infinite',
  ],
])('%s → %s', (token, declaration) => {
  const result = compile(token);
  expect(result.css).toContain('{' + declaration + '}');
  expect(result.warnings).toEqual([]);
});

test.each([
  [
    'an_1s_fade',
    '"_1s_fade" is invalid for "an": the order is name, duration, easing, delay, iteration count,'
    + ' direction, fill mode, play state — "fade" is out of place',
  ],
  [
    'an_fade_1s_9x',
    'fits none of them',
  ],
  [
    'an',
    '"an" produced no CSS: handler "an" needs a value here',
  ],
])('%s — предупреждение', (token, message) => {
  const result = compile(token);
  expect(result.css).toBe('');
  expect(result.warnings[0]).toContain(message);
});

test('ключевые кадры — из пресета, анимация — токеном', () => {
  expect(compile('an_wg-appear_0.2s_ease-out_0.3s_both', (mn) => {
    mn.setKeyframes('wg-appear', {
      from: {
        opacity: '0',
      },
      to: {
        opacity: '1',
      },
    });
  }).css).toBe('@keyframes wg-appear{from{opacity:0}to{opacity:1}}'
    + '.an_wg-appear_0\\.2s_ease-out_0\\.3s_both{animation:wg-appear 0.2s ease-out 0.3s both}');
});

const KEYFRAMES_SPIN = '@keyframes spin{to{transform:rotate(360deg)}}';
const KEYFRAMES_PULSE = '@keyframes pulse{50%{opacity:.5}}';

describe('named animations (group G)', () => {
  test.each([
    [
      'anSpin',
      KEYFRAMES_SPIN + '.anSpin{animation:spin 1s linear infinite}',
    ],
    [
      'anPing',
      '@keyframes ping{75%,100%{transform:scale(2);opacity:0}}'
      + '.anPing{animation:ping 1s cubic-bezier(0,0,.2,1) infinite}',
    ],
    [
      'anPulse',
      KEYFRAMES_PULSE + '.anPulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}',
    ],
    [
      'anBounce',
      '@keyframes bounce{0%,100%{transform:translateY(-25%);animation-timing-function:cubic-bezier(.8,0,1,1)}'
      + '50%{transform:none;animation-timing-function:cubic-bezier(0,0,.2,1)}}.anBounce{animation:bounce 1s infinite}',
    ],
    // С частями значение остаётся как написано, кадры — те же.
    [
      'an_spin_2s',
      KEYFRAMES_SPIN + '.an_spin_2s{animation:spin 2s}',
    ],
    [
      'an_spin_2s,pulse',
      KEYFRAMES_SPIN + KEYFRAMES_PULSE
      + '.an_spin_2s\\,pulse{animation:spin 2s,pulse 2s cubic-bezier(.4,0,.6,1) infinite}',
    ],
    // Кадры — один раз на весь вывод.
    [
      'anSpin an_spin_3s',
      KEYFRAMES_SPIN + '.anSpin{animation:spin 1s linear infinite}.an_spin_3s{animation:spin 3s}',
    ],
    [
      'anN',
      '.anN{animation:none}',
    ],
    // Своё имя кадров не получает: их задаёт автор.
    [
      'anFade',
      '.anFade{animation:fade}',
    ],
  ])('%s', (token, css) => {
    const result = compile(token);
    expect(result.css).toBe(css);
    expect(result.warnings).toEqual([]);
  });

  test('keyframes set by the author under the same name win', () => {
    expect(compile('anSpin', (mn) => {
      mn.setKeyframes('spin', {
        to: {
          transform: 'rotate(-360deg)',
        },
      });
    }).css).toBe('@keyframes spin{to{transform:rotate(-360deg)}}.anSpin{animation:spin 1s linear infinite}');
  });
});
