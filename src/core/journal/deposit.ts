import { authHeader, type DepositCredentials } from '../deposit/deposit'
import type { JournalSlice } from './journal'

/**
 * Dépôt d'une tranche de journal sur le serveur.
 *
 * Le même chemin que les traces — nginx reçoit un fichier par `PUT`, et rien
 * n'est à ajouter à la pile —, mais **un autre dossier**. Le dossier des traces
 * est servi en index JSON, et c'est cet index que l'application télécharge pour
 * lister les traces du serveur : y verser une tranche par cinq minutes de
 * conduite alourdirait cette liste à chaque sortie.
 *
 * L'authentification est reprise du dépôt de traces, et ce n'est pas une
 * économie de lignes : un second encodage aurait pu diverger du premier, et le
 * refus qui s'ensuivrait ressemblerait à un mot de passe faux.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

/** Dossier servi en écriture pour les journaux. Voir `docker/nginx.conf`. */
const FOLDER = '/journal/'

export type SliceOutcome =
  | { ok: true; name: string; bytes: number }
  | {
      ok: false
      /**
       * Pourquoi cela n'est pas parti.
       *
       * La distinction n'est pas cosmétique : `no-credentials` se corrige à
       * l'écran de configuration, `refused` veut dire que le compte ne
       * correspond pas à celui du serveur, et `network` qu'on est hors
       * couverture — ce qui arrive en roulant et n'est **pas** une erreur.
       * Seul ce dernier cas justifie de garder la tranche pour plus tard.
       */
      reason: 'no-credentials' | 'refused' | 'network'
      detail: string
      /** Vrai quand il vaut la peine de réessayer avec la même tranche. */
      retry: boolean
    }

/**
 * Dépose une tranche, et dit précisément ce qui a échoué.
 *
 * Contrairement au dépôt d'une trace, on ne demande pas au serveur si le fichier
 * est déjà là. Deux raisons : le nom d'une tranche est unique par construction —
 * session plus rang, et un rang n'est jamais réemployé —, et cette question
 * coûterait une requête toutes les cinq minutes pour une réponse qu'on connaît.
 */
export async function depositSlice(
  slice: JournalSlice,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<SliceOutcome> {
  if (!credentials.user.trim() || !credentials.password) {
    return {
      ok: false,
      reason: 'no-credentials',
      detail: "Aucun compte de dépôt : il se règle à l'écran de configuration.",
      // Rien ne sert de réessayer : il manque un réglage, pas du réseau. Mais la
      // tranche est gardée, sans quoi le journal du trajet serait perdu par le
      // seul fait qu'on a oublié de saisir un compte.
      retry: true,
    }
  }

  try {
    const response = await fetchImpl(FOLDER + encodeURIComponent(slice.name), {
      method: 'PUT',
      headers: {
        Authorization: authHeader(credentials),
        'Content-Type': 'application/x-ndjson',
      },
      body: slice.body,
    })

    if (response.ok) return { ok: true, name: slice.name, bytes: slice.bytes }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'refused',
        detail:
          response.status === 401
            ? 'Refusé : le nom ou le mot de passe ne correspond pas au fichier du serveur.'
            : "Le serveur s'est laissé convaincre mais n'a pas le droit d'écrire dans le dossier.",
        // Réessayer avec le même compte donnerait le même refus.
        retry: false,
      }
    }

    // Tout le reste est traité comme une indisponibilité : un 503 derrière un
    // proxy, un 502 pendant un redémarrage du NAS, un 413 sur une tranche trop
    // grosse. Aucun n'est de la faute du journal, et la tranche vaut d'être
    // gardée — sauf le dernier, où réessayer à l'identique échouerait autant.
    return {
      ok: false,
      reason: 'network',
      detail: `Le serveur a répondu ${response.status}.`,
      retry: response.status !== 413,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      detail: error instanceof Error ? error.message : 'Dépôt impossible.',
      retry: true,
    }
  }
}
