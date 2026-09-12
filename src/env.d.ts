/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** Version de `package.json`, injectée à la construction par Vite. */
declare const __APP_VERSION__: string

/**
 * Les écrans de banc sont-ils dans cette construction ?
 *
 * Faux par défaut, vrai quand `BENCH=1` est posé à la construction — ce que fait
 * la publication de l'étiquette `develop`, et elle seule.
 */
declare const __BENCH__: boolean
