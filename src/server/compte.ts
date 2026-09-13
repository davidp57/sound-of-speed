/**
 * Se faire un vrai compte : une adresse, et un mot de passe qu'on choisit.
 *
 * Le [code de liaison](liaison.ts) relie deux appareils qu'on a **sous la
 * main**. Il ne peut rien quand on n'en a plus aucun : navigateur nettoyé,
 * voiture changée, téléphone perdu. Il faut alors quelque chose qui survive à
 * l'appareil — une adresse et un mot de passe, qui se rangent dans un
 * gestionnaire de mots de passe.
 *
 * **Et cela se fait depuis un poste de travail.** On y arrive par un code, et
 * on saisit sur un vrai clavier : la voiture n'est pas un endroit où taper une
 * adresse.
 *
 * **Le compte ne change pas d'identifiant.** Tout ce qu'il porte pend à lui par
 * clé étrangère ; ce qui bouge est son adresse, jamais sa ligne. C'est ce qui
 * distingue ce chemin de celui que la bibliothèque propose d'ordinaire — une
 * inscription, qui créerait un compte neuf et laisserait les réglages sur
 * l'ancien.
 *
 * **Aucun courriel ne part.** L'adresse n'est pas vérifiée, et c'est assumé tant
 * qu'aucun relais n'est configuré : celui qui déploie chez lui n'en fournira
 * pas. Ce que cela coûte est dit à l'écran.
 */

import { createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { and, eq, ne } from 'drizzle-orm'
import * as z from 'zod'

import { estAnonyme, reglerLAncien } from './abandon'
import type { Base } from './base/base'
import { accounts } from './base/schema'

/** Le préfixe sous lequel ce greffon répond, sous celui de l'identité. */
export const CHEMIN_COMPTE = '/api/auth/compte'

/**
 * La preuve « adresse et mot de passe », telle que la bibliothèque la nomme.
 *
 * Les autres valeurs de cette colonne sont des fournisseurs tiers, qui viendront
 * au ticket 12.
 */
const PREUVE_PAR_MOT_DE_PASSE = 'credential'

/**
 * Ce qu'on accepte comme adresse.
 *
 * Volontairement large : la seule vérification qui vaudrait quelque chose est
 * d'y envoyer un message, et rien n'en envoie. Ce qu'on écarte ici, ce sont les
 * saisies qui ne peuvent pas être une adresse — et le domaine réservé
 * `.invalid`, sous lequel la bibliothèque fabrique les adresses des comptes
 * anonymes : s'en donner une reviendrait à se croire joignable en ne l'étant
 * pas.
 */
const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function compte({ base }: { base: Base }) {
  return {
    id: 'compte',

    endpoints: {
      /**
       * Donne au compte de la session une adresse et un mot de passe.
       *
       * Le compte reste le même — c'est tout l'intérêt : ses profils, ses
       * moteurs, ses trajets et son profil mesuré ne bougent pas d'un pouce.
       */
      rattacherUneAdresse: createAuthEndpoint(
        '/compte/rattacher',
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.object({ email: z.string(), motDePasse: z.string() }),
        },
        async (contexte) => {
          const moi = contexte.context.session.user.id
          const email = contexte.body.email.trim().toLowerCase()
          const motDePasse = contexte.body.motDePasse

          if (!ADRESSE.test(email) || email.endsWith('.invalid')) {
            throw contexte.error('BAD_REQUEST', { message: 'Cette adresse n’en est pas une.' })
          }

          const minimum = contexte.context.password.config.minPasswordLength
          if (motDePasse.length < minimum) {
            throw contexte.error('BAD_REQUEST', {
              message: `Le mot de passe fait moins de ${minimum} caractères.`,
            })
          }

          // Changer d'adresse une fois qu'on en a une est un autre geste, et il
          // demande de prouver qu'on est bien là — c'est le ticket 13.
          if (!(await estAnonyme(base, moi))) {
            throw contexte.error('BAD_REQUEST', {
              message: 'Ce compte a déjà une adresse.',
            })
          }

          const dejaPrise = await base
            .select({ id: accounts.id })
            .from(accounts)
            .where(and(eq(accounts.email, email), ne(accounts.id, moi)))
          if (dejaPrise.length > 0) {
            // Le même message qu'un mot de passe refusé serait plus discret,
            // mais il ferait chercher une faute de frappe là où il n'y en a pas.
            throw contexte.error('CONFLICT', {
              message: 'Cette adresse est déjà celle d’un autre compte.',
            })
          }

          await contexte.context.internalAdapter.linkAccount({
            userId: moi,
            providerId: PREUVE_PAR_MOT_DE_PASSE,
            accountId: moi,
            password: await contexte.context.password.hash(motDePasse),
          })

          await contexte.context.internalAdapter.updateUser(moi, {
            email,
            // Rien ne l'a vérifiée, et rien ne le peut tant qu'aucun relais de
            // courriel n'est configuré. Le dire faux est la vérité.
            emailVerified: false,
            isAnonymous: false,
          })

          return contexte.json({ email })
        },
      ),

      /**
       * Ouvre ici un compte qui existe ailleurs, et règle le sort de celui d'ici.
       *
       * **Les deux dans le même passage, et c'est tout l'objet de cet endpoint.**
       * La preuve qu'on possède le compte d'ici est son témoin de connexion, et
       * ce témoin est remplacé par la nouvelle session : après, il n'y a plus
       * rien à prouver. Les faire en deux appels a été essayé et ne marche pas —
       * effacer le compte d'ici invalide sa session, et la connexion qui suit
       * n'installe plus rien. Mesuré dans un navigateur.
       *
       * La route `sign-in/email` de la bibliothèque reste en place et fait très
       * bien son travail ; elle ne sait simplement pas ce qu'est un compte
       * abandonné.
       */
      seConnecter: createAuthEndpoint(
        '/compte/connexion',
        {
          method: 'POST',
          body: z.object({ email: z.string(), motDePasse: z.string() }),
        },
        async (contexte) => {
          const email = contexte.body.email.trim().toLowerCase()
          const trouve = await contexte.context.internalAdapter.findUserByEmail(email, {
            includeAccounts: true,
          })

          // Adresse inconnue et mot de passe faux se confondent : dire lequel
          // des deux apprendrait à qui cherche quelles adresses existent.
          const refus = () =>
            contexte.error('UNAUTHORIZED', {
              message: 'Cette adresse et ce mot de passe n’ouvrent aucun compte.',
            })
          if (!trouve) throw refus()

          const preuve = trouve.accounts.find(
            (candidate) => candidate.providerId === PREUVE_PAR_MOT_DE_PASSE,
          )
          if (!preuve?.password) throw refus()

          const bon = await contexte.context.password.verify({
            hash: preuve.password,
            password: contexte.body.motDePasse,
          })
          if (!bon) throw refus()

          const avant = await getSessionFromCtx(contexte)

          const session = await contexte.context.internalAdapter.createSession(trouve.user.id)
          await setSessionCookie(contexte, { session, user: trouve.user })

          const ancien = await reglerLAncien(base, avant?.user.id, trouve.user.id)

          return contexte.json({
            user: { id: trouve.user.id, name: trouve.user.name, email, isAnonymous: false },
            ancien,
          })
        },
      ),
    },

    rateLimit: [
      // Un mot de passe se devine si l'on peut essayer vite. La bibliothèque
      // borne ses propres routes de connexion ; celle-ci est à nous, donc à
      // nous de la borner. Elle ne s'applique qu'en production.
      { pathMatcher: (chemin: string) => chemin === '/compte/connexion', window: 60, max: 10 },
    ],
  }
}
