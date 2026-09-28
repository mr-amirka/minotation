/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // `src` перечислен наравне с `tests` намеренно: без него покрытие считается
  // только по файлам, которые импортировал хоть один тест, и непротестированный
  // модуль просто не появляется в отчёте — так `cli.ts` и `index.ts` какое-то
  // время были вне счёта, показывая общие 100%.
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  // Точка входа — четыре строки связи с процессом (`process.argv`, `exitCode`,
  // `console`). Проверяется запуском собранного бинаря, а не unit-тестом.
  coveragePathIgnorePatterns: ['<rootDir>/src/cli.ts'],
  coverageThreshold: {
    global: {
      branches: 99,
      functions: 99,
      lines: 99,
      statements: 99,
    },
  },
};
