import type { MnInstance } from 'minotation';

/**
 * Уникальный маркер — используется реальным build-тестом (`real-build.test.ts`)
 * для проверки, что подлинное содержимое этого файла НЕ попадает в клиентский
 * бандл (плагин обязан перехватить side-effect импорт этого файла и подменить
 * его заглушкой).
 */
export const MN_ESBUILD_FIXTURE_MARKER = 'mn-esbuild-fixture-marker-9f3c1a';

export default (mn: MnInstance) => {
  mn('mnEsbuildFixtureToken', 'cF00');
};
