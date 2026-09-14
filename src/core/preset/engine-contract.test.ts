import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ENGINE_FIELDS } from './schema'

/**
 * Les deux listes du contrat doivent dire la même chose, dans le même ordre.
 *
 * `native/CONTRAT-MOTEUR.md` annonce ce test depuis le début — « un test compare
 * la liste TypeScript à l'énumération C++ extraite de la source » — mais il
 * n'existait pas. Écrit le 14 septembre 2026, en déplaçant l'énumération de
 * `probe.cpp` vers `engines.h` : le déplacement est sûr tant que quelque chose
 * vérifie qu'on n'a rien décalé en chemin.
 *
 * Ce que le contrat exige, et que ce test fait respecter : l'ordre **est** le
 * contrat, un paramètre neuf s'ajoute à la fin, un paramètre retiré laisse sa
 * place occupée. Deux listes qui se désaccordent sans bruit sont exactement ce
 * qu'on veut éviter — le tableau de doubles part tel quel dans la mémoire du
 * module, et un décalage d'un cran fait passer une longueur de bielle pour un
 * volume de chambre.
 */
describe('le contrat de définition de moteur', () => {
  /** L'énumération C++, relue à la source : `ENGINE_X = n, // <clé>`. */
  const cles = (() => {
    const source = readFileSync(resolve(process.cwd(), 'native/engines.h'), 'utf8')
    const debut = source.indexOf('enum EngineParam {')
    const fin = source.indexOf('};', debut)
    expect(debut, 'l’énumération EngineParam est introuvable dans native/engines.h').toBeGreaterThan(
      -1,
    )

    const trouvees: { rang: number; cle: string }[] = []
    for (const ligne of source.slice(debut, fin).split('\n')) {
      // `\s*$` et non `$` : le dépôt est en LF, le répertoire de travail en CRLF
      // sur un poste Windows, et le retour chariot traîne en fin de ligne.
      const m = /^\s*ENGINE_[A-Z_]+ = (\d+),\s*\/\/ (\w+)\s*$/.exec(ligne)
      if (m) trouvees.push({ rang: Number(m[1]), cle: m[2] as string })
    }
    return trouvees
  })()

  it('porte les mêmes clés des deux côtés, dans le même ordre', () => {
    expect(cles.map((c) => c.cle)).toEqual(ENGINE_FIELDS.map((f) => f.key))
  })

  it('numérote l’énumération sans trou ni saut', () => {
    expect(cles.map((c) => c.rang)).toEqual(cles.map((_, i) => i))
  })

  it('se compte pareil des deux côtés', () => {
    const source = readFileSync(resolve(process.cwd(), 'native/engines.h'), 'utf8')
    const compte = /ENGINE_PARAM_COUNT = (\d+)/.exec(source)
    expect(Number(compte?.[1])).toBe(ENGINE_FIELDS.length)
  })
})
