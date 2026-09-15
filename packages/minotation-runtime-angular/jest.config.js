/** @type {import('jest').Config} */
module.exports = {
  coverageThreshold: {
    // Стандарт лаборатории: 99% по всем метрикам
    // (APPROVED/CONVENTIONS/shared/processes/testing.md §5.1).
    global: {
      branches: 99,
      functions: 99,
      lines: 99,
      statements: 99,
    },
  },
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' },
    ],
  },
};
