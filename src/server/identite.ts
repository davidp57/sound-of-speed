/**
 * L'identité : qui tient le volant.
 *
 * Tout passe par [Better Auth](https://better-auth.com/), sous licence MIT, donc
 * combinable avec l'AGPL de ce dépôt. C'est une bibliothèque qui vit dans ce
 * code et non un service à déployer à côté — c'est ce qui la fait préférer aux
 * solutions qui ajoutent un second moteur avec ses règles dans son propre
 * langage.
 *
 * **Une seule table d'identité, et c'est `accounts`.** La bibliothèque apporte
 * ses modèles ; elle sait se poser sur des tables qui existent, et c'est le sens
 * choisi. L'inverse — adopter les siennes — obligerait à refaire six tables,
 * puisque SQLite ne déplace pas une clé étrangère : il recrée la table qui la
 * porte.
 *
 * **Deux mots « compte » qui ne veulent pas dire la même chose.** Ce que la
 * bibliothèque appelle `account` est le lien vers une façon de prouver qui on
 * est — un mot de passe, un fournisseur tiers. Ce que ce dépôt appelle un compte
 * est la personne. Les renommages ci-dessous ne servent qu'à ça, et `CONTEXT.md`
 * dit lequel est lequel.
 *
 * **Rien ne dépend encore de ce module.** Il rend une session qui se crée et se
 * relit ; qui s'en sert, et pour ouvrir quoi, vient après.
 */

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'

import type { Base } from './base/base'
import { accounts, authIdentities, authSessions, authVerifications } from './base/schema'

/** Le préfixe sous lequel la bibliothèque répond. */
export const CHEMIN_IDENTITE = '/api/auth'

export interface OptionsDIdentite {
  /** La base, déjà ouverte et migrée. */
  base: Base
  /** De quoi signer les témoins de connexion. Voir `secretPersistant`. */
  secret: string
  /**
   * L'adresse publique du serveur, quand on la connaît.
   *
   * Absente, la bibliothèque la déduit de la requête. C'est ce qu'on veut pour
   * une installation chez soi, qui ne sait pas sous quel nom on l'atteindra.
   */
  adresse?: string
}

export type Identite = ReturnType<typeof creerIdentite>

const UN_JOUR_EN_SECONDES = 24 * 60 * 60
const UN_AN_EN_SECONDES = 365 * UN_JOUR_EN_SECONDES

/**
 * Où vivent les sessions d'identité, et sous quel nom de champ.
 *
 * Toutes les tables d'ici désignent un compte par `accountId` ; la bibliothèque,
 * elle, dit `userId`.
 */
const SESSION_MAPPEE = {
  modelName: 'auth_sessions',
  fields: { userId: 'accountId' },
} as const

/**
 * Monte la bibliothèque sur la base qui existe.
 *
 * Les tables lui sont désignées **par leur nom de table**, et non par le nom de
 * l'export TypeScript : c'est ce que l'adaptateur cherche. Les champs, eux, sont
 * désignés par la clé de l'objet Drizzle.
 */
export function creerIdentite({ base, secret, adresse }: OptionsDIdentite) {
  return betterAuth({
    secret,
    ...(adresse === undefined ? {} : { baseURL: adresse }),
    basePath: CHEMIN_IDENTITE,

    database: drizzleAdapter(base, {
      provider: 'sqlite',
      schema: {
        accounts,
        auth_sessions: authSessions,
        auth_identities: authIdentities,
        auth_verifications: authVerifications,
      },
    }),

    // Une adresse et un mot de passe suffisent à rattacher un compte. Rien ne
    // l'exige : un compte reste anonyme tant que ça suffit, et c'est le lot
    // COMPTES qui ouvre ce chemin-là.
    emailAndPassword: { enabled: true },

    plugins: [
      anonymous({
        /**
         * **Le compte anonyme ne s'efface pas quand une adresse s'y rattache.**
         *
         * Sans ce réglage, la bibliothèque crée un compte neuf au rattachement
         * et supprime l'ancien. Ici, huit tables pendent à `accounts` en
         * `ON DELETE CASCADE` : cette suppression emporterait les profils, les
         * moteurs, les trajets et le profil mesuré de l'appareil — exactement ce
         * que le rattachement est censé conserver.
         */
        disableDeleteAnonymousUser: true,
        /**
         * Un nom en français, et daté.
         *
         * La bibliothèque nomme « Anonymous » ce qu'elle crée, et ce nom
         * s'afficherait tel quel dans une application qui n'a pas d'autre
         * langue que le français. La date le rend en plus distinguable : deux
         * appareils font deux comptes, et une liste de comptes qui disent tous
         * la même chose ne se lit pas.
         */
        generateName: () => `Appareil du ${new Date().toLocaleDateString('fr-FR')}`,
      }),
    ],

    session: {
      ...SESSION_MAPPEE,
      /**
       * Un an, et la session se prolonge à chaque passage.
       *
       * Ce n'est pas une session de service bancaire : c'est **l'identité d'un
       * appareil**, et l'appareil est le navigateur d'une voiture. Une semaine —
       * le défaut — ferait perdre son compte à qui ne roule pas pendant les
       * vacances, et le lui ferait perdre sans rien lui dire.
       */
      expiresIn: UN_AN_EN_SECONDES,
      updateAge: UN_JOUR_EN_SECONDES,
    },

    // Aucun courriel ne part d'ici : il n'y a pas de service d'envoi à
    // configurer, et celui qui déploie chez lui n'en fournira pas.
    emailVerification: { sendOnSignUp: false },

    user: { modelName: 'accounts' },
    account: {
      modelName: 'auth_identities',
      // Le renommage qui compte : pour la bibliothèque, `accountId` est
      // l'identifiant **chez le fournisseur**, soit l'inverse exact de ce que
      // `accountId` désigne partout ailleurs ici.
      fields: { userId: 'accountId', accountId: 'providerAccountId' },
    },
    verification: { modelName: 'auth_verifications' },
  })
}

/** Le nom du fichier qui garde le secret, à côté de la base. */
const FICHIER_SECRET = 'identite.secret'

/**
 * Le secret qui signe les témoins de connexion, gardé d'un démarrage à l'autre.
 *
 * **Il ne peut pas être tiré à chaque démarrage** : un conteneur qu'on remplace
 * déconnecterait alors tout le monde, et la voiture se retrouverait sans compte
 * au premier arrêt du serveur.
 *
 * Il vit dans un fichier à côté de la base, et non dans la base : c'est un
 * secret, pas une donnée. Il n'a donc rien à faire dans une copie de la base
 * qu'on ouvre pour regarder ce qu'elle contient, ni dans ce que `npm run
 * verdict` recopie.
 *
 * Celui qui déploie chez lui n'a rien à fournir — c'est le premier démarrage qui
 * l'écrit. Qui préfère le tenir lui-même le donne par l'environnement.
 */
export function secretPersistant(fichierDeBase: string): string {
  const dossier = fichierDeBase.includes(':memory:') ? '.' : dirname(fichierDeBase)
  const fichier = join(dossier, FICHIER_SECRET)

  try {
    const garde = readFileSync(fichier, 'utf8').trim()
    if (garde !== '') return garde
  } catch {
    // Pas encore de secret : c'est un premier démarrage, et on l'écrit.
  }

  const neuf = randomBytes(32).toString('base64url')
  mkdirSync(dossier, { recursive: true })
  // Lisible par son seul propriétaire : sur un volume partagé, un secret en
  // lecture pour tous vaut un secret publié.
  writeFileSync(fichier, `${neuf}\n`, { mode: 0o600 })
  return neuf
}
