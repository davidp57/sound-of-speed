import type { Profile } from './schema'
import {
  applyResponsiveness,
  applySportiness,
  MAX_GEARS,
  MIN_GEARS,
  responsivenessOf,
  setGearCount,
  sportinessOf,
} from './character'

/**
 * Ce que le conducteur ajuste, posé **à côté** du profil et non dedans.
 *
 * Il ne crée pas de profil : il choisit parmi ceux que l'atelier lui a livrés,
 * et bouge trois curseurs. Écrire ces trois-là dans le profil poserait la
 * question du jour où l'atelier en dépose une version corrigée — soit on écrase
 * son réglage, soit on garde une photo périmée qui ne reçoit plus rien.
 *
 * D'où une couche, comme l'étalonnage : le profil livré reste intact, la couche
 * se réapplique par-dessus la version qui arrive, et l'enlever rend le profil
 * tel quel.
 *
 * **Elle pèse trois nombres, pas trente.** Un curseur global recalcule une
 * trentaine de réglages, mais aucun des trois n'est enregistré dans un profil :
 * ils s'en déduisent — c'est ce que `character.ts` appelle être inversible. La
 * couche n'a donc à retenir que les positions, et la composition refait le
 * calcul.
 *
 * **Elle ne voyage pas avec un profil partagé.** Donner son profil, c'est donner
 * un son ; le tempérament qu'on lui a mis est une préférence, au même titre que
 * le volume, qui a quitté le profil pour la même raison.
 */
export interface ReglageConducteur {
  /** 0 calme, 1 sportif. `null` quand le conducteur n'y a pas touché. */
  temperament: number | null
  /** 0 pépère, 1 nerveux. `null` quand le conducteur n'y a pas touché. */
  reactivite: number | null
  /** Nombre de rapports voulu. `null` quand le conducteur n'y a pas touché. */
  rapports: number | null
}

export const SANS_REGLAGE: ReglageConducteur = {
  temperament: null,
  reactivite: null,
  rapports: null,
}

export function estVide(reglage: ReglageConducteur): boolean {
  return (
    reglage.temperament === null && reglage.reactivite === null && reglage.rapports === null
  )
}

/**
 * Compose la couche sur un profil.
 *
 * L'ordre n'est pas indifférent : le **nombre de rapports** passe en premier,
 * parce qu'il redimensionne les tables indexées par rapport — régimes de
 * passage et temporisations. Les appliquer avant lui reviendrait à régler des
 * cases qu'il va ensuite redistribuer.
 *
 * Le tempérament vient ensuite, la réactivité en dernier : le premier décide si
 * la voiture pousse fort, la seconde si elle répond vite, et seule la seconde
 * touche au signal. Ils ne se recouvrent pas, mais fixer l'ordre évite d'avoir
 * à s'en assurer à chaque fois.
 */
export function avecReglage(profile: Profile, reglage: ReglageConducteur): Profile {
  let compose = profile
  if (reglage.rapports !== null) {
    compose = setGearCount(compose, borner(reglage.rapports, MIN_GEARS, MAX_GEARS))
  }
  if (reglage.temperament !== null) {
    compose = applySportiness(compose, borner(reglage.temperament, 0, 1))
  }
  if (reglage.reactivite !== null) {
    compose = applyResponsiveness(compose, borner(reglage.reactivite, 0, 1))
  }
  return compose
}

/**
 * Ce qu'un curseur doit montrer : la position de la couche, ou celle que porte
 * le profil livré tant qu'on n'y a pas touché.
 *
 * Sans cela le curseur partirait de zéro sur un profil sportif, et le premier
 * frôlement le rendrait calme.
 */
export function temperamentAffiche(profile: Profile, reglage: ReglageConducteur): number {
  return reglage.temperament ?? sportinessOf(profile)
}

export function reactiviteAffichee(profile: Profile, reglage: ReglageConducteur): number {
  return reglage.reactivite ?? responsivenessOf(profile)
}

export function rapportsAffiches(profile: Profile, reglage: ReglageConducteur): number {
  return reglage.rapports ?? profile.drivetrain.gearRatios.length
}

function borner(valeur: number, bas: number, haut: number): number {
  if (!Number.isFinite(valeur)) return bas
  return Math.min(haut, Math.max(bas, valeur))
}

/** Relit ce qui a été rangé, en écartant ce qui n'a pas la bonne forme. */
export function lireReglage(valeur: unknown): ReglageConducteur {
  if (typeof valeur !== 'object' || valeur === null) return SANS_REGLAGE
  const champs = valeur as Record<string, unknown>
  return {
    temperament: unNombre(champs['temperament']),
    reactivite: unNombre(champs['reactivite']),
    rapports: unNombre(champs['rapports']),
  }
}

function unNombre(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}
