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
    include: ['src/**/*.test.ts'],
    environment: 'node',
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
