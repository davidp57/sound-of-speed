/**
 * Relier un second appareil au compte d'un premier.
 *
 * L'écran de la voiture donne un code. On le scanne avec son téléphone, ou on
 * recopie huit caractères sur un poste de travail sans caméra, et cet appareil
 * ouvre **le même compte** : les mêmes profils, les mêmes moteurs, les mêmes
 * trajets. Sans adresse, sans mot de passe à retenir, sans service tiers — c'est
 * ce qui en fait le chemin normal.
 *
 * **Un jeton, deux rendus.** Le lien à scanner et le code court portent la même
 * valeur : celle qui ouvre le compte une fois, et qui expire. Le lien évite de
 * recopier, le code court sauve l'appareil sans caméra.
 *
 * **Pourquoi pas le mot de passe du compte.** La première version en posait un
 * sur le compte anonyme, et cela marchait — mais la bibliothèque d'identité n'en
 * garde qu'un par compte : afficher un code aurait écrasé celui qu'on choisit au
 * ticket 11. Un jeton séparé ne touche à rien.
 *
 * **Pourquoi un greffon de la bibliothèque, et non deux routes à nous.** Le
 * témoin de connexion est **signé** avec le secret du serveur : le composer à la
 * main donnerait un témoin que les routes de la bibliothèque ne reconnaîtraient
 * pas. Mesuré en lisant `setSessionCookie`. De l'intérieur, on obtient en prime
 * la table de vérification — qui sait déjà consommer une valeur une seule fois,
 * de façon atomique, et rendre `null` si elle a expiré — et la limitation de
 * débit, qui est ce qui protège vraiment un code court.
 *
 * **Ce qu'un code donne à qui le voit.** Le compte, jusqu'à ce qu'il serve ou
 * qu'il expire. C'est assumé : ce qui est en jeu est une bibliothèque de
 * réglages, pas de l'argent — et le jeton s'use.
 */

import { createHash, randomInt } from 'node:crypto'

import { createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import * as z from 'zod'

import { estAnonyme, reglerLAncien } from './abandon'
import type { Base } from './base/base'

/** Le préfixe sous lequel ce greffon répond, sous celui de l'identité. */
export const CHEMIN_LIAISON = '/api/auth/liaison'

/**
 * L'alphabet du code court, sans ce qui se confond.
 *
 * Ni `I` ni `1`, ni `O` ni `0`, ni `L`, ni `U` — qui se lit `V` sur un écran de
 * voiture et s'entend comme lui au téléphone. Trente caractères, ce qui fait
 * six cent cinquante milliards de combinaisons sur huit rangs.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Huit caractères, groupés en deux : on les dicte sans épeler. */
const LONGUEUR = 8

/**
 * Vingt-quatre heures, et c'est un choix d'usage plutôt que de sécurité.
 *
 * **Le code s'affiche dans la voiture et se saisit au bureau.** Dix minutes —
 * la valeur d'avant — supposaient qu'on aille de l'une à l'autre sans s'arrêter ;
 * on se gare, on rentre, on allume un ordinateur, et le code est mort. Le
 * regénérer demande de retourner dans une voiture éteinte.
 *
 * Ce qui protège reste l'usage unique et la limitation de débit ci-après, pas
 * la brièveté : un code qui expire pendant qu'on le recopie ne gêne que celui
 * qui le possède.
 */
export const VALIDITE_MS = 24 * 60 * 60 * 1000

/**
 * Ce qui rend un code court aussi sûr qu'un long : on ne peut pas essayer vite.
 *
 * Dix essais par minute, par adresse. Sur les vingt-quatre heures de validité
 * d'un code, cela fait quatorze mille quatre cents tentatives contre six cent
 * cinquante milliards de combinaisons — une chance sur quarante-cinq millions.
 * Sans cette borne, l'alphabet ne suffirait pas.
 *
 * **Elle ne s'applique qu'en production** : la bibliothèque coupe sa limitation
 * de débit hors de là, ce qui est voulu — un jeu de tests ne doit pas se faire
 * refouler — mais explique qu'aucun test ne la voie.
 */
const ESSAIS_PAR_MINUTE = 10

/** Sous quoi le jeton est rangé dans la table de vérification. */
const PREFIXE = 'liaison:'

/**
 * Le greffon, à monter sur la bibliothèque d'identité.
 *
 * Il reçoit la base parce qu'il a besoin de savoir ce qu'un compte porte, pour
 * décider si celui que l'appareil abandonne mérite d'être gardé — voir
 * `abandon.ts`. Tout le reste passe par la bibliothèque.
 */
export function liaison({ base }: { base: Base }) {
  return {
    id: 'liaison',

    endpoints: {
      /**
       * Donne un code pour le compte de la session.
       *
       * Ce qui est rangé est l'**empreinte** du code, jamais le code : une base
       * qu'on recopie pour la regarder ne doit pas livrer de quoi ouvrir des
       * comptes. L'appelant reçoit la seule copie lisible.
       */
      poserUnCodeDeLiaison: createAuthEndpoint(
        '/liaison/code',
        { method: 'POST', use: [sessionMiddleware] },
        async (contexte) => {
          const code = tirerUnCode()
          const expireLe = new Date(Date.now() + VALIDITE_MS)

          await contexte.context.internalAdapter.createVerificationValue({
            identifier: `${PREFIXE}${empreinte(code)}`,
            value: contexte.context.session.user.id,
            expiresAt: expireLe,
          })

          return contexte.json({ code, expireLe: expireLe.toISOString() })
        },
      ),

      /**
       * Ouvre ici le compte que le code désigne, et règle le sort de l'ancien.
       *
       * **L'ordre est le sujet.** L'appareil qui se relie porte déjà un compte
       * anonyme — il s'en est créé un au démarrage, comme tout appareil neuf. La
       * preuve qu'il le possède est son témoin de connexion, et ce témoin est
       * remplacé par la nouvelle session : il faut donc décider du sort de
       * l'ancien **dans le même passage**, pendant qu'on tient les deux bouts.
       */
      relierAuCompte: createAuthEndpoint(
        '/liaison/relier',
        { method: 'POST', body: z.object({ code: z.string() }) },
        async (contexte) => {
          const consomme = await contexte.context.internalAdapter.consumeVerificationValue(
            `${PREFIXE}${empreinte(normaliser(contexte.body.code))}`,
          )
          // Usé, périmé, ou mal recopié : les trois se confondent volontairement.
          // Dire lequel apprendrait quelque chose à qui cherche.
          if (!consomme) throw contexte.error('UNAUTHORIZED', { message: 'Ce code n’ouvre rien.' })

          const compte = await contexte.context.internalAdapter.findUserById(consomme.value)
          if (!compte) throw contexte.error('UNAUTHORIZED', { message: 'Ce code n’ouvre rien.' })

          const avant = await getSessionFromCtx(contexte)

          // Une session **neuve**, et non celle de l'appareil qui a donné le
          // code : deux appareils qui partageraient une session se
          // déconnecteraient ensemble.
          const session = await contexte.context.internalAdapter.createSession(compte.id)
          await setSessionCookie(contexte, { session, user: compte })

          const ancien = await reglerLAncien(base, avant?.user.id, compte.id)

          return contexte.json({
            compte: {
              id: compte.id,
              name: compte.name,
              anonymous: await estAnonyme(base, compte.id),
            },
            ancien,
          })
        },
      ),
    },

    rateLimit: [
      { pathMatcher: (chemin: string) => chemin === '/liaison/relier', window: 60, max: ESSAIS_PAR_MINUTE },
      { pathMatcher: (chemin: string) => chemin === '/liaison/code', window: 60, max: ESSAIS_PAR_MINUTE },
    ],
  }
}

/**
 * Un code tiré au sort, groupé en deux.
 *
 * `randomInt` plutôt qu'un modulo sur des octets : trente ne divise pas deux
 * cent cinquante-six, et le biais qui en résulterait ne se verrait pas.
 */
function tirerUnCode(): string {
  let code = ''
  for (let i = 0; i < LONGUEUR; i += 1) code += ALPHABET[randomInt(ALPHABET.length)]
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Ce qu'on accepte à la saisie.
 *
 * Le trait est un confort de lecture, la casse une distraction : ni l'un ni
 * l'autre ne portent d'information. Refuser `k7m4pq2r` parce qu'il est en
 * minuscules serait une punition sans contrepartie.
 */
export function normaliser(code: string): string {
  const propre = code.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return propre.length === LONGUEUR ? `${propre.slice(0, 4)}-${propre.slice(4)}` : propre
}

/** L'empreinte rangée en base. Le code porte assez de hasard pour s'en tenir là. */
function empreinte(code: string): string {
  return createHash('sha256').update(code).digest('base64url')
}
