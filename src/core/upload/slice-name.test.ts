import { describe, expect, it } from 'vitest'

import { groupBySession, parseSliceName, recordedAtOf } from './slice-name'
import { SliceBuffer } from './slicing'

/**
 * Tests de la lecture d'un nom de tranche.
 *
 * Le format est produit par `SliceBuffer` : ces tests font l'aller-retour
 * plutôt que de répéter le format, sinon les deux dériveraient chacun de leur
 * côté et rien ne le dirait.
 */

interface Ligne {
  at: number
  n: number
}

function tampon(sessionId = 'da2m') {
  return new SliceBuffer<Ligne>({
    sessionId,
    startedAt: Date.UTC(2026, 8, 11, 6, 24, 1),
    serialize: (l) => JSON.stringify(l),
    parse: (ligne) => JSON.parse(ligne) as Ligne,
  })
}

describe('parseSliceName', () => {
  it('relit ce que le tampon écrit', () => {
    const b = tampon()
    b.add({ at: 0, n: 0 })
    const name = b.takeSlice(0)!.name

    const ref = parseSliceName(name)

    expect(ref).not.toBeNull()
    expect(ref!.sessionId).toBe('da2m')
    expect(ref!.index).toBe(1)
  })

  /**
   * Les rangs sautent quand un dépôt échoue : la tranche revient en file et
   * rejoint la suivante, mais son numéro reste consommé pour qu'aucun fichier
   * n'en écrase un autre. Relevé sur l'essai du 11 septembre 2026 : une session
   * de journal va de 001 à 015 puis saute à 741.
   */
  it('lit un rang à plus de trois chiffres', () => {
    const ref = parseSliceName('2026-09-11-06-24-01_da2m_741.jsonl.gz')

    expect(ref!.index).toBe(741)
    expect(ref!.sessionId).toBe('da2m')
  })

  it('lit une tranche compressée comme une autre', () => {
    const clair = parseSliceName('2026-09-11-06-24-01_da2m_001.jsonl')
    const compresse = parseSliceName('2026-09-11-06-24-01_da2m_001.jsonl.gz')

    expect(clair!.sessionId).toBe(compresse!.sessionId)
    expect(clair!.index).toBe(compresse!.index)
  })

  it('rend null sur ce qui n’est pas une tranche', () => {
    expect(parseSliceName('lisez-moi.txt')).toBeNull()
    expect(parseSliceName('2026-09-11_da2m.jsonl')).toBeNull()
  })

  it('lit une session sans date, que le tampon écrit quand l’horloge manque', () => {
    const ref = parseSliceName('sans-date_ab34_001.jsonl')

    expect(ref!.stamp).toBe('sans-date')
    expect(ref!.sessionId).toBe('ab34')
  })
})

describe('groupBySession', () => {
  it('réunit les tranches d’un trajet et les met dans l’ordre', () => {
    const sessions = groupBySession([
      '2026-09-11-06-24-01_da2m_003.jsonl.gz',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      '2026-09-11-06-24-01_da2m_002.jsonl.gz',
    ])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.map((s) => s.index)).toEqual([1, 2, 3])
  })

  it('sépare deux trajets et les rend du plus ancien au plus récent', () => {
    const sessions = groupBySession([
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      '2026-09-10-17-07-47_2geq_001.jsonl.gz',
      '2026-09-11-06-24-01_da2m_002.jsonl.gz',
    ])

    expect(sessions).toHaveLength(2)
    expect(sessions[0]![0]!.sessionId).toBe('2geq')
    expect(sessions[1]![0]!.sessionId).toBe('da2m')
  })

  /**
   * Deux sessions peuvent porter le même identifiant court si elles ne
   * commencent pas au même instant : c'est l'horodatage qui les sépare.
   */
  it('ne confond pas deux sessions de même identifiant', () => {
    const sessions = groupBySession([
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      '2026-09-12-08-00-00_da2m_001.jsonl.gz',
    ])

    expect(sessions).toHaveLength(2)
  })

  it('ignore sans bruit ce qui n’est pas une tranche', () => {
    const sessions = groupBySession([
      'lisez-moi.txt',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      '.DS_Store',
    ])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toHaveLength(1)
  })

  it('ne suppose pas les rangs contigus', () => {
    const sessions = groupBySession([
      '2026-09-11-06-24-01_da2m_019.jsonl.gz',
      '2026-09-11-06-24-01_da2m_021.jsonl.gz',
    ])

    expect(sessions[0]!.map((s) => s.index)).toEqual([19, 21])
  })
})

describe('recordedAtOf', () => {
  it('rend l’instant que le tampon a écrit dans le nom', () => {
    // L'aller-retour, encore : c'est `SliceBuffer` qui décide du format, et une
    // date lue de travers ferait effacer un trajet du bon mois.
    const debut = Date.UTC(2026, 8, 11, 6, 24, 1)
    const b = tampon()
    b.add({ at: 0, n: 0 })

    expect(recordedAtOf(b.takeSlice(0)!.name)).toBe(debut)
  })

  it('lit la date en temps universel, quel que soit le fuseau de la machine', () => {
    // Le nom vient de `toISOString`. La relire en heure locale donnerait deux
    // dates différentes pour la même tranche selon qui la regarde.
    expect(recordedAtOf('2026-09-11-06-24-01_da2m_001.jsonl.gz')).toBe(
      Date.UTC(2026, 8, 11, 6, 24, 1),
    )
  })

  it('rend null sur un nom libre', () => {
    // Le dossier des traces en porte deux, d'avant la convention.
    expect(recordedAtOf('trace-essai.jsonl')).toBeNull()
    expect(recordedAtOf('essai_manuel_001.jsonl')).toBeNull()
  })
})
