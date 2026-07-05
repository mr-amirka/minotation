module.exports = {
  env: {
    node: true,
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    '@stylistic',
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // §6.7 — каждый элемент на своей строке
    indent: ['error', 2, { SwitchCase: 1 }],
    semi: ['error', 'always'],
    '@stylistic/object-curly-newline': ['error', {
      ObjectExpression:  { minProperties: 1 },
      ObjectPattern:     { minProperties: 1 },
      ImportDeclaration: { minProperties: 1 },
      ExportDeclaration: { minProperties: 1 },
    }],
    '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
    '@stylistic/function-paren-newline':  ['error', { minItems: 3 }],
    '@stylistic/array-bracket-newline':   ['error', { minItems: 3 }],
    '@stylistic/array-element-newline':   ['error', { minItems: 3 }],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],

    // §6.8 — if/else/for/while всегда с блоком {}
    curly: ['error', 'all'],
    '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    'scripts/',
  ],
};
