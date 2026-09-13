/**
 * Les comptes tenus ailleurs : se connecter avec Tesla, Google ou Apple.
 *
 * **En plus de l'adresse et du mot de passe, jamais à la place.** Tranché par
 * David le 13 septembre 2026, contre la recommandation inverse : celle-ci tenait
 * sur une présomption — « personne n'est sans compte tiers » — qui n'est pas un
 * fait. Perdre l'accès à son fournisseur ne doit pas faire perdre le compte.
 *
 * **Ce qui n'est pas configuré n'existe pas.** Un fournisseur ne se monte que si
 * ses deux variables d'environnement sont là. Celui qui déploie chez lui n'en
 * inscrit aucune, et son écran ne montre alors aucun bouton — c'est
 * `/compte/possibilites` qui le dit, et il lit ce qui est **réellement monté**
 * plutôt que ce qu'on a voulu monter.
 *
 * **Un compte tiers ne crée jamais de compte.** `disableSignUp` sur chaque
 * fournisseur : une preuve qu'on n'a jamais rattachée n'ouvre rien. Sans cela,
 * cliquer « se connecter avec Google » depuis la voiture fabriquerait un compte
 * neuf et vide, et abandonnerait les réglages qu'on avait — l'inverse exact de
 * ce qu'on venait chercher.
 *
 * **Deux montages pour trois fournisseurs, et c'est un choix.** Tesla passe par
 * le greffon générique, monté sur son document de découverte OpenID Connect ;
 * Google et Apple par ce que la bibliothèque porte déjà. Apple ne rend pas de
 * profil sur une route à part — son identité vit dans le jeton — et son
 * « secret » est un jeton signé qui se périme : refaire cette plomberie à la
 * main donnerait le même résultat avec les défauts en plus. En aval le montage
 * ne se voit pas : les deux sortes répondent aux mêmes routes.
 */

import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth'

/** Ce qu'un écran a besoin de savoir d'un fournisseur : son nom, et son bouton. */
export interface Fournisseur {
  /** L'identifiant que les routes de la bibliothèque attendent. */
  id: string
  /** Ce qui s'écrit sur le bouton. */
  nom: string
}

/** Les deux variables qu'un fournisseur demande, et rien d'autre. */
interface Identifiants {
  clientId: string
  clientSecret: string
}

/**
 * Ce qu'un fournisseur connu demande pour se monter.
 *
 * `decouverte` porte l'adresse du document OpenID Connect : tout le reste —
 * autorisation, jeton, profil, clés de signature — en sort. `integre` dit que la
 * bibliothèque connaît déjà ce fournisseur, avec ses particularités.
 */
type Montage = { sorte: 'integre' } | { sorte: 'decouverte'; decouverte: string }

interface Connu extends Fournisseur {
  /** Le préfixe des deux variables : `<prefixe>_ID` et `<prefixe>_SECRET`. */
  prefixe: string
  montage: Montage
}

/**
 * Les trois fournisseurs que ce serveur sait monter.
 *
 * Tesla en premier, et ce n'est pas un classement alphabétique : c'est le
 * fournisseur dont le compte correspond à la personne assise dans la voiture.
 */
const CONNUS: readonly Connu[] = [
  {
    id: 'tesla',
    nom: 'Tesla',
    prefixe: 'SPEED_OAUTH_TESLA',
    montage: {
      sorte: 'decouverte',
      decouverte:
        'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/.well-known/openid-configuration',
    },
  },
  { id: 'google', nom: 'Google', prefixe: 'SPEED_OAUTH_GOOGLE', montage: { sorte: 'integre' } },
  { id: 'apple', nom: 'Apple', prefixe: 'SPEED_OAUTH_APPLE', montage: { sorte: 'integre' } },
]

/**
 * Ce qu'on demande à un fournisseur : qui vous êtes, et rien de plus.
 *
 * Pas de portée qui donnerait accès aux données de la voiture chez Tesla : ce
 * lot fait de l'identité, et une portée qu'on ne sert pas est une portée qu'on
 * n'a pas à demander à l'écran de consentement.
 */
const PORTEES = ['openid', 'email', 'profile']

/** Ce qu'il faut passer à la bibliothèque pour monter ce qui est configuré. */
export interface ComptesTenusAilleurs {
  /** Ceux que la bibliothèque connaît, par leur identifiant. */
  integres: Record<string, Identifiants & { disableSignUp: true }>
  /** Ceux qui se montent sur un document de découverte. */
  generiques: GenericOAuthConfig[]
}

/**
 * Lit l'environnement et rend de quoi monter ce qui s'y trouve.
 *
 * Une variable vide vaut absente : c'est ce qu'on obtient le plus souvent en
 * déclarant une variable sans valeur dans l'écran d'une pile, et un identifiant
 * vide ferait pire que pas de fournisseur du tout.
 */
export function comptesTenusAilleurs(
  environnement: Record<string, string | undefined>,
): ComptesTenusAilleurs {
  const integres: ComptesTenusAilleurs['integres'] = {}
  const generiques: GenericOAuthConfig[] = []

  for (const connu of CONNUS) {
    const clientId = environnement[`${connu.prefixe}_ID`]?.trim()
    const clientSecret = environnement[`${connu.prefixe}_SECRET`]?.trim()
    if (!clientId || !clientSecret) continue

    if (connu.montage.sorte === 'integre') {
      integres[connu.id] = { clientId, clientSecret, disableSignUp: true }
    } else {
      generiques.push({
        providerId: connu.id,
        name: connu.nom,
        discoveryUrl: connu.montage.decouverte,
        clientId,
        clientSecret,
        scopes: PORTEES,
        disableSignUp: true,
        /**
         * L'identité vient d'un jeton **vérifié**, ou elle ne vient pas.
         *
         * Sans cette exigence, un document de découverte incomplet ferait
         * silencieusement retomber la bibliothèque sur un jeton décodé sans
         * vérification de signature. Le fournisseur est alors écarté, et
         * `/compte/possibilites` cesse de le proposer — ce qui est la bonne
         * façon d'échouer.
         */
        requireIdTokenVerification: true,
      })
    }
  }

  return { integres, generiques }
}

/** Le nom d'affichage d'un fournisseur connu, quand on ne l'a que sous son identifiant. */
export function nomDuFournisseur(id: string): string {
  return CONNUS.find((connu) => connu.id === id)?.nom ?? id
}
