import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
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
const version = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
).version

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
  plugins: [vue(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // accessible depuis le téléphone sur le réseau local
  },
})
