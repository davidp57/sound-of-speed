import { defineConfig } from 'drizzle-kit'

/**
 * De quoi produire les migrations depuis le schéma.
 *
 * `drizzle-kit generate` lit le schéma, le compare au précédent, et écrit un
 * fichier SQL numéroté. **Ces fichiers sont versionnés** : ce sont eux que le
 * serveur joue au démarrage, pas le schéma. Le schéma décrit où l'on va ; les
 * migrations décrivent comment on y va depuis n'importe quel état déjà en
 * service — y compris celui d'un tiers qui a déployé la version d'avant.
 *
 * Le fichier de base n'est pas lu ici : la génération ne se connecte à rien,
 * elle compare deux descriptions.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/base/schema.ts',
  out: './src/server/base/migrations',
})
