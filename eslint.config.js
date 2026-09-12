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
      // Les services assemblés : du code produit, pas écrit.
      'dist-profileur/**',
      'dist-serveur/**',
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
    // Ce qui tourne sous Node, pas dans le navigateur : les scripts
    // d'outillage, et le serveur.
    files: [
      'scripts/**/*.mjs',
      'native/**/*.mjs',
      'src/server/**/*.ts',
      '*.config.ts',
      '*.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },

  /**
   * Les trois zones, et ce qu'elles n'ont pas le droit de faire.
   *
   * `src/core/` est le calcul, partagé entre le navigateur et le serveur.
   * `src/ui/` est l'affichage. `src/server/` est ce qui tourne sur la machine
   * qui sert. Le partage n'est pas une commodité : dix mille neuf cents des
   * dix-neuf mille lignes du cœur servent aux deux côtés, parce que les deux
   * doivent calculer la même chose.
   *
   * **Pourquoi une règle plutôt qu'une consigne.** L'invariant « le cœur
   * n'importe jamais Vue » tenait depuis le début du projet par un `grep` qu'on
   * lançait à la main, cité dans les instructions du dépôt. Il a tenu — mais
   * rien ne le tenait, et les deux frontières qui arrivent avec le serveur sont
   * moins visibles : rien ne saute aux yeux quand une page importe une pièce de
   * base de données, jusqu'au jour où la voiture la télécharge.
   */
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: ['vue', 'vue/*', '**/ui/**', '**/*.vue'],
          message:
            "Le cœur n'importe jamais Vue ni l'interface : c'est ce qui le rend testable sans navigateur, et ses mille cent tests tournent sous Node pour cette raison.",
        },
        {
          group: ['**/server/**'],
          message:
            'Le cœur est partagé entre le navigateur et le serveur : il ne peut pas dépendre du serveur, sinon la voiture télécharge la base de données.',
        },
      ] }],
    },
  },
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.vue', 'src/*.ts', 'src/*.vue'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: ['**/server/**'],
          message:
            "L'interface ne peut pas importer une pièce de serveur : elle serait embarquée dans le paquet que le téléphone télécharge, et une application qui doit se charger hors réseau ne transporte pas un moteur de base de données.",
        },
      ] }],
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: ['vue', 'vue/*', '**/ui/**', '**/*.vue'],
          message:
            "Le serveur n'affiche rien : il n'a aucune raison d'importer Vue ni un écran.",
        },
      ] }],
    },
  },
)
