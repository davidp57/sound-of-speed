import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * La version, lue dans `package.json` au moment de la construction.
 *
 * Elle n'était affichée nulle part. Dans la voiture, où il n'y a ni console ni
 * outils de développement et où un service worker sert un cache, rien ne
 * permettait donc de savoir si l'on essayait la version qu'on croyait — et un
 * correctif jugé sur la version précédente est un correctif jugé pour rien.
 */
const packageJson = fileURLToPath(new URL('./package.json', import.meta.url))
const version = JSON.parse(readFileSync(packageJson, 'utf-8')).version

/**
 * Redémarre le serveur de développement quand la version change.
 *
 * Elle est injectée à la construction : sans cela, le serveur garde celle qu'il
 * a lue à son démarrage et l'affiche pendant qu'on travaille sur une autre.
 * Relevé le jour même de sa mise en place — l'écran annonçait 0.1.27 sur du
 * 0.1.30, et le numéro censé lever les doutes en créait un.
 *
 * Vite surveille sa propre configuration et ce qu'elle importe, mais pas ce
 * qu'elle lit elle-même.
 */
const watchVersion = {
  name: 'speed:watch-version',
  configureServer(server: { watcher: { add: (p: string) => void; on: (e: string, cb: (f: string) => void) => void }; restart: () => void }) {
    server.watcher.add(packageJson)
    server.watcher.on('change', (file: string) => {
      if (file === packageJson) void server.restart()
    })
  },
}

/**
 * Listage des banques d'échantillons, en développement seulement.
 *
 * En production, c'est nginx qui rend le contenu d'un dossier en JSON, et c'est
 * de là que l'application apprend quelles banques sont déposées. Le serveur de
 * développement, lui, ne liste rien : sans ce relais, la découverte des banques
 * ne se vérifierait qu'après un déploiement, alors que trois banques sont
 * présentes dans `public/audio/`.
 *
 * Le format imité est celui de `autoindex_format json` : un tableau d'entrées
 * `{ name, type }`. Rien de tout cela ne part dans la construction.
 */
const audioListing: Plugin = {
  name: 'speed:audio-listing',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
      // Seuls les dossiers se listent ; un échantillon est servi comme avant.
      if (!path.startsWith('/audio/') || !path.endsWith('/') || path.includes('..')) return next()

      let entries: { name: string; type: string }[]
      try {
        entries = readdirSync(fileURLToPath(new URL('./public' + path, import.meta.url)), {
          withFileTypes: true,
        }).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }))
      } catch {
        // Dossier absent : le même 404 que nginx, que l'application lit comme
        // une liste vide.
        res.statusCode = 404
        res.end()
        return
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(entries))
    })
  },
}

/**
 * Le HTTPS n'est activé qu'à la demande, par `npm run dev:mobile`.
 *
 * La géolocalisation, le verrou d'écran, le service worker et l'AudioWorklet
 * exigent un « contexte sécurisé ». `localhost` en est un même en clair, donc le
 * développement courant n'a besoin de rien. Une adresse de réseau local, en
 * revanche, n'en est pas un : sans chiffrement, une page ouverte depuis le
 * téléphone s'affiche normalement et refuse silencieusement le GPS.
 *
 * Le certificat étant auto-signé, l'activer par défaut imposerait un
 * avertissement à chaque ouverture pour un bénéfice nul sur le poste.
 */
const useHttps = process.env['HTTPS'] === '1'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [vue(), watchVersion, audioListing, ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // accessible depuis le téléphone sur le réseau local
  },
})
