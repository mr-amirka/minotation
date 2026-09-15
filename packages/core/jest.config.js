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
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
  ],
};
