import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const unfilteredQueryCall = (method) => ({
  selector: `CallExpression[callee.property.name='${method}'][arguments.length=0]`,
  message: `${method}() without a query key refreshes every module. Pass the exact keys you changed (DECISIONS.md, proposal §9.2).`,
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Every UI text comes from messages/*.json (next-intl), never written in JSX.
      'react/jsx-no-literals': [
        'error',
        { allowedStrings: ['/', '·', '…', '—', '–', '|', ':', '(', ')', '%', '৳'] },
      ],
      'no-restricted-syntax': [
        'error',
        unfilteredQueryCall('invalidateQueries'),
        unfilteredQueryCall('refetchQueries'),
        unfilteredQueryCall('resetQueries'),
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Architecture rule (proposal §3): core must never import from business modules.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/modules/*', '**/modules/*'], message: 'core must not depend on modules.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**'],
    rules: { 'react/jsx-no-literals': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);
