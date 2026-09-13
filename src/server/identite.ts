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
import { eq } from 'drizzle-orm'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'
import { genericOAuth } from 'better-auth/plugins/generic-oauth'

import { tirerUneEtiquette } from '../core/identity/etiquette'

import type { Base } from './base/base'
import { accounts, authIdentities, authSessions, authVerifications } from './base/schema'
import { compte } from './compte'
import { faireHeriter, formaterHeritage } from './heritage'
import { liaison } from './liaison'
import { comptesTenusAilleurs, type ComptesTenusAilleurs } from './tiers'

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
   *
   * **Elle cesse d'être facultative dès qu'un compte tenu ailleurs est
   * configuré** : le fournisseur doit revenir sur le site, et derrière un proxy
   * inversé le conteneur ne voit qu'un port local.
   */
  adresse?: string
  /**
   * Les comptes tenus ailleurs, tels que l'environnement les déclare.
   *
   * Absents, aucun : c'est le cas de celui qui déploie chez lui, et de tous les
   * tests qui n'en parlent pas.
   */
  tiers?: ComptesTenusAilleurs
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
export function creerIdentite({ base, secret, adresse, tiers }: OptionsDIdentite) {
  const ailleurs = tiers ?? comptesTenusAilleurs({})

  return betterAuth({
    secret,
    /**
     * **Les jointures natives, sans quoi aucune connexion par un compte tenu
     * ailleurs ne fonctionne.**
     *
     * Pour savoir à qui appartient une preuve — c'est la question que pose tout
     * retour de Google ou de Tesla —, la bibliothèque joint la preuve et son
     * compte. Sans cette option, elle n'utilise pas la jointure de l'adaptateur
     * mais un repli qui, sur un schéma dont les tables et les champs sont
     * renommés comme ici, rend un compte **vide** : la preuve est trouvée, son
     * propriétaire non, et la connexion est refusée comme si ce fournisseur
     * n'avait jamais été rattaché.
     *
     * Le défaut ne se voyait pas : le rattachement, lui, marchait — il sait
     * déjà de quel compte il parle. On rattachait donc Google avec succès, et
     * on ne pouvait plus jamais s'en servir pour revenir. Trouvé le 13 septembre
     * 2026 sur la pile de production ; `proprietaire.test.ts` le tient.
     *
     * Les relations que cette jointure suit sont déclarées dans `base/schema.ts`,
     * et leurs noms ne sont pas libres.
     */
    advanced: { database: { joins: true } },
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

    // Les comptes tenus ailleurs que la bibliothèque connaît déjà. Vide tant que
    // rien n'est configuré, ce qui est le cas par défaut — voir `tiers.ts`.
    socialProviders: ailleurs.integres,

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
         * Une étiquette qu'on retient, tirée au sort — voir `etiquette.ts`.
         *
         * La bibliothèque nomme « Anonymous » ce qu'elle crée. Le nom daté qui
         * a précédé disait le jour et rien d'autre : tous les comptes ouverts
         * le même jour portaient le même. Celui-ci se reconnaît d'un coup d'œil
         * et se dit à voix haute, ce qui est tout ce qu'on lui demande — il
         * n'ouvre rien.
         */
        generateName: () => tirerUneEtiquette(),
      }),

      // Relier un second appareil au même compte. Un greffon et non deux routes
      // à côté : le témoin de connexion est signé avec le secret du serveur, et
      // seule la bibliothèque sait le poser — voir `liaison.ts`.
      liaison({ base }),

      // Se faire un vrai compte : une adresse et un mot de passe choisis, sur
      // le compte qui existe déjà — voir `compte.ts`.
      compte({ base }),

      // Les comptes tenus ailleurs qui se montent sur un document de découverte,
      // Tesla pour l'instant. Le greffon ne se charge que s'il y en a : il fait
      // un appel réseau par fournisseur au démarrage, et un serveur qui démarre
      // avant son réseau n'a pas à le payer pour rien.
      ...(ailleurs.generiques.length === 0
        ? []
        : [genericOAuth({ config: ailleurs.generiques })]),
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

      accountLinking: {
        /**
         * **Le rattachement se demande, il ne se devine pas.**
         *
         * Par défaut, la bibliothèque relie d'elle-même un compte tenu ailleurs
         * à un compte d'ici qui porte la même adresse. Ici ce serait un piège :
         * le rattachement est un geste qu'on fait depuis l'écran du compte, en
         * étant déjà connecté, et une connexion à un fournisseur jamais
         * rattaché doit échouer plutôt que d'ouvrir le compte de quelqu'un.
         */
        disableImplicitLinking: true,
        /**
         * **L'adresse du fournisseur n'a aucune raison d'être celle d'ici.**
         *
         * Un compte anonyme porte une adresse fabriquée sous `.invalid` : elle
         * ne correspondra jamais à celle d'un compte Google ou Tesla, et exiger
         * qu'elles soient égales interdirait le rattachement dans le seul cas
         * qui compte. Ce que cette option ouvre d'ordinaire — un rattachement
         * fait sur la foi d'une adresse — est fermé par la ligne du dessus : il
         * faut être connecté pour rattacher, et la session est la preuve.
         *
         * L'adresse du compte, elle, ne bouge pas : la bibliothèque ne la
         * change jamais au rattachement.
         */
        allowDifferentEmails: true,
      },
    },
    verification: { modelName: 'auth_verifications' },

    databaseHooks: {
      account: {
        create: {
          /**
           * Une preuve de plus, c'est un compte qui cesse d'être anonyme.
           *
           * `is_anonymous` ne dit pas « sans nom » mais « s'est créé tout seul,
           * et rien ne permet d'y revenir ». Dès qu'un compte tenu ailleurs y
           * est rattaché, il y a un chemin de retour — et le laisser anonyme
           * aurait une conséquence bien réelle : `reglerLAncien` efface les
           * comptes anonymes qui ne portent rien, donc un compte relié à Tesla
           * mais encore vide disparaîtrait au premier appareil qui rejoint
           * autre chose.
           *
           * Le rattachement d'une adresse, lui, le fait déjà de son côté — voir
           * `compte.ts` —, et le refaire ici ne coûte qu'une écriture pour rien.
           */
          after: async (preuve) => {
            // `userId`, et surtout pas `accountId` : dans le vocabulaire de la
            // bibliothèque, `accountId` est l'identifiant **chez le
            // fournisseur**. C'est le renommage qui piège, et il est déjà
            // signalé plus bas.
            const compteVise = preuve.userId
            try {
              // Écrit dans la table plutôt que par la bibliothèque : le contexte
              // d'appel qu'elle passe à ce crochet vaut `null` dès que la preuve
              // se pose hors d'une requête, et on ne veut pas d'un anonymat qui
              // se lève seulement quand la pile a la bonne forme.
              await base
                .update(accounts)
                .set({ isAnonymous: false })
                .where(eq(accounts.id, compteVise))
            } catch (erreur) {
              // Un compte resté marqué anonyme reste utilisable : ce qui est en
              // jeu est son effacement au passage d'un autre appareil, pas son
              // fonctionnement. Faire échouer le rattachement coûterait plus.
              console.error(`fin de l'anonymat du compte ${compteVise} : ${String(erreur)}`)
            }
          },
        },
      },
      user: {
        create: {
          /**
           * Le premier compte qui se présente hérite de ce que portait le compte
           * d'avant l'identité.
           *
           * **Ici, et pas au démarrage du serveur** : il faut un héritier, et
           * l'héritier n'existe qu'au moment où un appareil se présente. Le
           * compte vient d'être créé, donc il est vide — aucun conflit possible
           * avec ce qu'on lui verse.
           *
           * Un héritage qui échoue ne doit pas empêcher le compte d'exister :
           * l'appareil pourrait alors ne jamais en obtenir un, et l'application
           * resterait sans identité pour une raison qui ne la regarde pas. Le
           * compte d'avant, lui, est toujours là au démarrage suivant.
           */
          after: async (compte) => {
            try {
              const heritage = await faireHeriter(base, compte.id)
              if (heritage !== null) console.log(formaterHeritage(heritage, compte.id))
            } catch (erreur) {
              console.error(`héritage du compte d'avant : ${String(erreur)}`)
            }
          },
        },
      },
    },
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
