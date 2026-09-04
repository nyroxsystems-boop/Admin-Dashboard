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

            // React 19 compiler-style diagnostics are migration guidance for
            // this React 18 dashboard. Keep them visible without turning
            // established data-loading effects into release blockers.
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
            'react-hooks/use-memo': 'warn',
            'react-hooks/refs': 'warn',

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
    // Phase 0 Design-System-Wache: keine hardcodierten Hex-Farben im Code.
    // Farben laufen über Tokens (design-system/tokens.css → hsl(var(--token))).
    // Einzige Ausnahme: design-system/** (Tokens + ggf. Print-/Rechts-
    // Konstanten wie QR-Kontrast oder Druck-Defaults).
    {
        files: ['**/*.{ts,tsx}'],
        ignores: ['src/design-system/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'Literal[value=/#[0-9a-fA-F]{6}/]',
                    message: 'Keine Hex-Farben — semantisches Token nutzen (Tailwind-Klasse oder hsl(var(--token))). Print-/Rechts-Farben: design-system/print-constants.ts.',
                },
                {
                    selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{6}/]',
                    message: 'Keine Hex-Farben in Template-Strings — semantisches Token nutzen.',
                },
            ],
        },
    },
    // E-Mail-Vorlagen sind KEINE Anwendungsoberflaeche.
    //
    // Sie werden in Outlook, Gmail und Apple Mail gerendert — dort gibt es
    // keine CSS-Variablen, kein Tailwind und kein Stylesheet der Anwendung.
    // `hsl(var(--accent-500))` waere schlicht ein ungueltiger Wert. Farben
    // muessen dort als Hex inline stehen; das ist keine Nachlaessigkeit,
    // sondern die einzige Form, die ueberall ankommt.
    //
    // Bewusst EINE Datei, kein Verzeichnis: Wer eine zweite Vorlage anlegt,
    // soll diese Zeile bewusst ergaenzen und nicht stillschweigend erben.
    {
        files: [
            // Die Vorlage selbst.
            'src/components/mail/mailRahmen.ts',
            // Die Umrechnung auf ein dunkles Erscheinungsbild: sie LIEST und
            // SCHREIBT Farbwerte aus fremder Mail. Hex ist dort das Datum, mit
            // dem gearbeitet wird, nicht eine Gestaltungsentscheidung.
            'src/components/mail/mailDunkel.ts',
            // Die zugehoerigen Tests pruefen mit echten Farbwerten. Ein Token
            // waere dort sinnlos — geprueft wird ja gerade die Umrechnung.
            'src/components/mail/mailRahmen.test.ts',
            'src/components/mail/mailDunkel.test.ts',
        ],
        rules: { 'no-restricted-syntax': 'off' },
    },
);
