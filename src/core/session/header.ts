import type { Profile } from '../preset/schema'

/**
 * Le profil qu'une capture porte en tête.
 *
 * La capture inscrit, dans sa première ligne, la configuration **complète** qui
 * jouait au moment de l'enregistrement : le moteur, la boîte, le conditionnement
 * du signal, le mixage, les couches et la banque. C'est ce profil-là qu'il faut
 * rejouer, et non celui qui est actif au bureau — sans quoi on écouterait autre
 * chose que ce qui a été vécu.
 *
 * **Il n'est pas repris au format courant**, contrairement à un profil
 * enregistré : une capture du 11 septembre 2026 se rejoue avec les six rapports
 * qu'elle avait ce jour-là. Rejouer un trajet, c'est le rejouer tel quel ; la
 * comparaison avec ce que la chaîne d'aujourd'hui recalcule est justement ce que
 * le relecteur montre.
 *
 * Une session qui n'a que son journal — celles des 8, 9 et 10 septembre 2026 —
 * n'a pas d'en-tête, et rend `null` : il n'y a alors rien à faire entendre.
 */

/** Les sections sans lesquelles la chaîne ne peut pas tourner. */
const REQUIRED = ['engine', 'drivetrain', 'speed', 'mix', 'feel'] as const

export function profileFromHeader(header: Record<string, unknown> | null): Profile | null {
  if (header === null) return null
  const runtime = header['runtime']
  if (typeof runtime !== 'object' || runtime === null) return null

  const candidate = runtime as Record<string, unknown>
  for (const section of REQUIRED) {
    if (typeof candidate[section] !== 'object' || candidate[section] === null) return null
  }
  // Sans couches ni banque, il n'y a rien à jouer : mieux vaut le dire que de
  // laisser le chargement échouer sur un fichier introuvable.
  if (!Array.isArray(candidate['layers']) || candidate['layers'].length === 0) return null
  if (typeof candidate['sampleDir'] !== 'string' || candidate['sampleDir'] === '') return null

  return candidate as unknown as Profile
}

/** Ce qu'il faut dire quand une session ne peut pas s'entendre. */
export function whyNoSound(header: Record<string, unknown> | null): string {
  if (header === null) {
    return 'Cette session n’a que son journal : elle est antérieure à la capture continue, et il n’y a rien à faire entendre.'
  }
  if (profileFromHeader(header) === null) {
    return 'L’en-tête de cette capture ne porte pas de configuration complète.'
  }
  return ''
}
