/**
 * `MnParseError` узнаётся по метке, а не по прототипу (2026-10-05).
 *
 * Ядро публикуется в CJS и ESM, и в одном процессе бывают обе копии:
 * `minotation-vite` (ESM) берёт пресеты из ESM-копии, а `minotation-build` (CJS)
 * создаёт инстанс из CJS-копии. Ошибка, брошенная пресетом одной копии, должна
 * ловиться `instanceof` другой — иначе она стала бы обычным исключением.
 */
import {
  MnParseError,
} from '../core/types';

describe('MnParseError — instanceof между копиями ядра', () => {
  const context = {
    token: 'fx',
    handler: 'fx',
    arg: '',
  };

  test('своя ошибка узнаётся', () => {
    const error = new MnParseError('x', context);
    expect(error instanceof MnParseError).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(error.name).toBe('MnParseError');
  });

  test('ошибка из другой копии класса узнаётся по общей метке', () => {
    const foreign = new Error('из другой копии');
    Object.defineProperty(
      foreign, Symbol.for('minotation.MnParseError'), {
        value: true,
      },
    );
    expect(foreign instanceof MnParseError).toBe(true);
  });

  test('обычные ошибки и не-объекты не узнаются', () => {
    expect(new Error('x') instanceof MnParseError).toBe(false);
    expect((null as unknown) instanceof MnParseError).toBe(false);
    expect(('MnParseError' as unknown) instanceof MnParseError).toBe(false);
  });

  test('метка неперечисляемая и неизменяемая — в JSON и спред не попадает', () => {
    const descriptor = Object.getOwnPropertyDescriptor(new MnParseError('x', context), Symbol.for('minotation.MnParseError'));
    expect(descriptor).toEqual({
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  });
});
