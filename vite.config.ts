import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * Le serveur de développement est servi en HTTPS, avec un certificat auto-signé.
 *
 * Ce n'est pas une coquetterie : la géolocalisation, le verrou d'écran et
 * l'AudioWorklet ne sont accessibles que depuis un « contexte sécurisé ».
 * `localhost` en fait partie, mais **pas** une adresse de réseau local en clair —
 * donc sans cela, ouvrir l'application depuis un téléphone donnerait une page qui
 * s'affiche correctement et refuse silencieusement le GPS.
 *
 * Le certificat n'étant signé par personne, le téléphone affichera un
 * avertissement à accepter une fois.
 */
export default defineConfig({
  plugins: [vue(), basicSsl()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // accessible depuis le téléphone sur le réseau local
  },
})
