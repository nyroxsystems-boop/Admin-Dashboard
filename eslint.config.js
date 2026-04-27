// ESLint 9 Flat Config — Admin-Dashboard
//
// Aligned with User-Dashboard config. Catches real bugs (unused vars,
// hook-deps, undef, unreachable) while keeping cosmetic noise out of
// the way. Pragmatic: warn on day-one issues, error on real bugs.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            'dist/**',
            'build/**',
            'node_modules/**',
            'coverage/**',
            '*.config.ts',
            '*.config.js',
            'src/test/**',
            'src/locales/**',
        ],
    },
    // Base configs
    js.configs.recommended,
    ...tseslint.configs.recommended,
    // Project rules
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2022,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],

            // TypeScript overrides — catch real bugs, not style nits
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/ban-ts-comment': [
                'warn',
                { 'ts-expect-error': false, 'ts-ignore': 'allow-with-description' },
            ],

            // Plain JS rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'prefer-const': 'warn',

            // Hook deps — warn to surface but not block
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    // shadcn/Radix UI components co-export variant helpers
    {
        files: ['src/components/ui/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
    // Tests have a different set of globals
    {
        files: ['src/test/**/*', '**/*.test.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
            },
        },
    },
);
