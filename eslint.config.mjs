import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import colorGuard from './scripts/eslint-no-hardcoded-color.mjs';

export default [
  {
    ignores: [
      'node_modules/',
      '**/dist/**',
      '**/out-tsc/**',
      '**/.angular/**',
      '**/coverage/**',
      '**/*.spec.ts',
      '**/environments/environment.prod.ts',
      'apps/api/data/**',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      '**/*.json',
      '**/*.config.ts',
      '**/*.config.js',
      '**/*.config.mjs',
      'scripts/**',
      'tailwind.config.js',
      '**/karma.conf.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      yotara: colorGuard,
    },
    rules: {
      'yotara/no-hardcoded-color-in-styles': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn'] }],
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'TSAsExpression',
          message:
            'Prefer type guards or explicit types over "as" casts. Consider a type guard or unknown assertion instead.',
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['apps/yotara-website/js/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
