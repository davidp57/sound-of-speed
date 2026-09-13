import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Configuration des tests.
 *
 * Une configuration à part, et non la section `test` de `vite.config.ts` : les
 * tests n'ont besoin ni du greffon Vue, ni du certificat auto-signé, ni du
 * serveur. Ils tournent sous Node, sans navigateur — c'est possible parce que
 * `src/core/` n'importe jamais Vue, et c'est ce qui les rend rapides.
 *
 * Ce qui a besoin d'un navigateur ne se teste pas ici et n'a pas à faire semblant :
 * le graphe Web Audio, le service worker, la géolocalisation et la boucle
 * d'affichage sont exclus de la mesure de couverture, avec la raison en regard.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // L'outillage de `scripts/` s'ajoute à `src/` : le générateur de banque y
    // tient l'arithmétique des ancrages et des longueurs de boucle, qui décide
    // de toute la banque produite et qui se vérifie sans rien faire tourner.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
    /**
     * Trente secondes pour un `beforeEach`, au lieu de dix.
     *
     * Les tests du serveur ouvrent chacun une base dans un dossier temporaire et
     * y jouent les migrations. **Mesuré : vingt-six millisecondes** quand la
     * machine est libre — ce n'est donc pas le coût du code. Mais les fichiers
     * de test tournent en parallèle, et sur un poste occupé — un navigateur, un
     * serveur d'essai, une autre passe de tests — le même hook a dépassé les dix
     * secondes par défaut, faisant échouer une douzaine de tests de fichiers
     * différents. Un seuil franchi par la charge de la machine ne dit rien du
     * code, et une suite qui rougit au hasard ne sert plus à rien.
     */
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: [
        'src/core/**/*.test.ts',
        // Graphe Web Audio : demande un AudioContext, donc un navigateur. Ce qui
        // s'en teste, c'est mix.ts — la décision — pas l'application des gains.
        'src/core/audio/engine.ts',
        // Service worker et installation : demandent navigator et caches.
        'src/core/offline.ts',
        // Verrou d'écran et session média : API du système, permission comprise.
        'src/core/session.ts',
        // API de géolocalisation du navigateur.
        'src/core/speed/geolocation.ts',
        // Cadence d'affichage : requestAnimationFrame et visibilité de la page.
        'src/core/loop.ts',
      ],
      reporter: ['text-summary', 'text'],
    },
  },
})
