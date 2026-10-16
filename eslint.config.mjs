import antfu from '@antfu/eslint-config';

export default antfu(
  {
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: true,
    },
    typescript: true,
  },
  {
    // generated 目录由 prisma generate 产出，不参与 lint
    ignores: ['**/*.md', '**/generated/**'],
  },
  {
    rules: {
      semi: ['error', 'always'],
      'no-console': 'off',
      'unused-imports/no-unused-vars': 'error',
      'unused-imports/no-unused-imports': 'error',
      'ts/consistent-type-imports': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
      'regexp/no-super-linear-backtracking': 'off',
      'regexp/no-contradiction-with-assertion': 'off',
      'ts/no-unused-expressions': 'error',
      'style/brace-style': 'off',
      'style/quote-props': 'off',
      'style/eol-last': 'off',
      'style/arrow-parens': 'off',
      'style/indent': 'off',
      'style/operator-linebreak': 'off',
      'antfu/if-newline': 'off',
      'antfu/no-top-level-await': 'off',
    },
  },
  {
    files: ['script/ruoyi/*.mjs'],
    rules: {
      // 此规则在当前依赖版本中会把 JS 的运行时变量误判为仅类型使用。
      'unused-imports/no-unused-vars': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'test/no-import-node-test': 'off',
    },
  },
);
