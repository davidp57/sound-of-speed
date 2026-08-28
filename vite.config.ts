import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

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
  plugins: [vue(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // accessible depuis le téléphone sur le réseau local
  },
})
