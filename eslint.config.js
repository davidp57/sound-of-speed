import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

/**
 * ESLint cherche des erreurs, pas des écarts de mise en forme.
 *
 * Le projet n'a pas de formateur automatique et sa mise en forme est délibérée :
 * les jeux de règles de style de `eslint-plugin-vue` réclameraient des centaines
 * de retouches dans les composants sans corriger un seul défaut. On prend donc
 * `flat/essential`, qui ne signale que ce qui est réellement fautif, et
 * `recommended` de typescript-eslint sans les règles qui exigent le typage
 * complet — la vérification des types est déjà le travail de `npm run typecheck`.
 */
export default ts.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // Service worker : écrit pour le navigateur, servi tel quel, hors chaîne
      // de construction.
      'public/sw.js',
      // Sortie d'Emscripten : du code machine enveloppé de JavaScript, produit
      // par `native/build-wasm.sh` et déposé tel quel. Le relire n'a pas de sens,
      // et le corriger serait défait à la compilation suivante.
      'public/sonde/probe.mjs',
      // Copies de travail que les agents créent dans le dépôt. Sans cette
      // exclusion, `npm run lint` y voit une seconde racine TypeScript et rend
      // cent quarante erreurs d'analyse qui ne parlent d'aucun code du projet.
      '.claude/worktrees/**',
      // Sources tierces rapatriées et produits de compilation : rien de tout
      // cela n'est versionné, et rien n'y est écrit à la main.
      'native/.work/**',
      'native/.build/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      // `__APP_VERSION__` est injectée par Vite à la construction, depuis
      // `package.json` : elle n'existe dans aucune déclaration de source.
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: { parser: ts.parser },
    },
    rules: {
      // Le tiret bas est la convention du dépôt pour un paramètre qu'on ne peut
      // pas retirer sans casser une signature — `tick(_dt)` des sources
      // purement événementielles, par exemple. C'est une déclaration
      // d'intention, pas un oubli : la règle reste active sur tout le reste.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
    },
  },
  {
    // Les scripts d'outillage tournent sous Node, pas dans le navigateur.
    files: ['scripts/**/*.mjs', 'native/**/*.mjs', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
)
