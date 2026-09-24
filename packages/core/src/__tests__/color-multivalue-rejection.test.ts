/**
 * `border-color` (и его per-side/per-axis варианты `bct`/`bcx`/…) не умеет
 * несколько цветов через `_` — обработчик применяет ОДИН цвет ко всем сторонам
 * (`bcSidesSet`). До исправления (2026-09-23, по замечанию владельца) второй
 * («лишний») кусок суффикса просто отбрасывался внутренним парсером, а essence
 * тихо съезжала на дефолт «`bc0`» (чёрный) — `bcF00_0F0` давал видимый, но
 * НЕВЕРНЫЙ цвет, без единого предупреждения. Теперь непарсящийся непустой
 * суффикс бракует токен целиком (как и остальные `throwInvalid()`-хендлеры
 * в этом файле) — молчаливой подмены цвета больше нет.
 *
 * 2026-09-24: отбраковка уходит в `warnings$` (тип `parse-error`), а не в
 * `error$` — битый аргумент это ошибка автора токена, а не сбой библиотеки
 * (см. `OPEN_QUESTIONS.md`, Q-06).
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(token: string): { css: string;
  errorCount: number;
  warnings: { type: string;
    token?: string }[] } {
  const errors: unknown[] = [];
  const warnings: { type: string;
    token?: string }[] = [];
  const mn: any = minotationProvider({
    onWarning: (w: { type: string;
      token?: string }) => warnings.push(w),
  });
  mn.error$.on((e: unknown) => errors.push(e));
  mn.setPresets([presetStandard]);
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
    errorCount: errors.length,
    warnings,
  };
}

describe('border-color: нераспознанный непустой суффикс бракуется', () => {
  test('второй цвет через _ — не подставляется дефолтный чёрный, есть ошибка разбора', () => {
    const {
      css, errorCount, warnings,
    } = compile('bcF00_0F0');
    expect(css).toBe('');
    // Предупреждение с указанием токена — и ничего в error$.
    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(warnings[0].token).toBe('bcF00_0F0');
    expect(errorCount).toBe(0);
  });

  test('то же для оси (bct/bcx/…)', () => {
    const {
      css, errorCount, warnings,
    } = compile('bctF00_0F0');
    expect(css).toBe('');
    // Предупреждение с указанием токена — и ничего в error$.
    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(warnings[0].token).toBe('bctF00_0F0');
    expect(errorCount).toBe(0);
  });

  test('три цвета через _ (тоже не поддерживается) — бракуется', () => {
    const {
      css, errorCount, warnings,
    } = compile('bcF00_0F0_00F');
    expect(css).toBe('');
    // Предупреждение с указанием токена — и ничего в error$.
    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(warnings[0].token).toBe('bcF00_0F0_00F');
    expect(errorCount).toBe(0);
  });
});

describe('border-color: легитимные случаи не задеты фиксом', () => {
  test('голый bc (пустой суффикс) — дефолт currentColor, без ошибок', () => {
    const {
      css, errorCount, 
    } = compile('bc');
    expect(css).toContain('border-color:currentColor');
    expect(errorCount).toBe(0);
  });

  test('одиночный валидный hex-цвет компилируется как раньше', () => {
    const {
      css, errorCount, 
    } = compile('bcF00');
    expect(css).toContain('border-color:#f00');
    expect(errorCount).toBe(0);
  });

  test('явный дефолтный алиас bc0 (чёрный) остаётся достижим напрямую', () => {
    const {
      css, errorCount, 
    } = compile('bc0');
    expect(css).toContain('border-color:#000');
    expect(errorCount).toBe(0);
  });
});
