import { describe, expect, it } from 'vitest'

import { Journal, newSessionId, type JournalOptions, type JournalSlice } from './journal'

/**
 * Tests du journal de bord.
 *
 * Ce qui se vérifie ici n'est pas un format mais deux promesses : **rien ne se
 * perd** quand le réseau manque, et **rien n'est renvoyé deux fois** quand il
 * revient. Les deux se tiennent sans réseau ni horloge, le journal recevant le
 * temps de son appelant.
 */

const OPTIONS = { sessionId: 'k7bq', startedAt: Date.parse('2026-09-04T14:32:11Z') }

/** Un journal avec des seuils courts, pour que les tests restent lisibles. */
function journal(over: Partial<JournalOptions> = {}): Journal {
  return new Journal({ ...OPTIONS, sliceAfterMs: 1000, sliceAtBytes: 500, ...over })
}

/** Les événements d'une tranche, relus depuis son corps. */
function events(slice: JournalSlice): { at: number; kind: string; data: Record<string, unknown> }[] {
  return slice.body
    .split('\n')
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => JSON.parse(ligne) as { at: number; kind: string; data: Record<string, unknown> })
}

describe('le journal retient et découpe', () => {
  it('ne rend rien tant qu’il n’y a rien', () => {
    const j = journal()
    expect(j.shouldSlice(10_000)).toBe(false)
    expect(j.takeSlice(10_000)).toBeNull()
  })

  it('découpe sur la durée', () => {
    const j = journal()
    j.add(0, 'source', { kind: 'geolocation' })

    expect(j.shouldSlice(500)).toBe(false)
    expect(j.shouldSlice(1000)).toBe(true)
  })

  it('découpe sur la taille sans attendre l’horloge', () => {
    // Un trajet bavard ne doit pas attendre cinq minutes pour vider un tampon
    // déjà gros : c'est la seconde condition, et elle se déclenche seule.
    const j = journal()
    for (let i = 0; i < 40; i += 1) {
      j.add(i * 10, 'sample', { kmh: 90 + i, rpm: 2400, gear: 6, load: 0.5 })
    }

    expect(j.shouldSlice(100)).toBe(true)
  })

  it('ne met dans une tranche que ce qui est nouveau', () => {
    // C'est la promesse qui a fait écarter le fichier unique réécrit : deux
    // tranches ne se recouvrent pas, donc rien ne part deux fois.
    const j = journal()
    j.add(0, 'source', { detail: 'un' })
    const first = j.takeSlice(1000)
    j.add(1200, 'source', { detail: 'deux' })
    const second = j.takeSlice(2000)

    expect(events(first!).map((e) => e.data.detail)).toEqual(['un'])
    expect(events(second!).map((e) => e.data.detail)).toEqual(['deux'])
  })

  it('vide l’attente en détachant une tranche', () => {
    const j = journal()
    j.add(0, 'audio', { state: 'suspended' })
    expect(j.pendingCount).toBe(1)

    j.takeSlice(1000)
    expect(j.pendingCount).toBe(0)
    expect(j.takeSlice(2000)).toBeNull()
  })
})

describe('les noms de tranches', () => {
  it('portent la session et se trient dans l’ordre du trajet', () => {
    // Un tri de noms est tout ce dont on dispose sur un partage de fichiers :
    // c'est lui qui doit rendre l'ordre du trajet, et regrouper ses tranches.
    const j = journal()
    const noms: string[] = []
    for (let i = 0; i < 12; i += 1) {
      j.add(i * 1000, 'sample', { kmh: 50 })
      noms.push(j.takeSlice((i + 1) * 1000)!.name)
    }

    expect(noms[0]).toBe('2026-09-04-14-32-11_k7bq_001.jsonl')
    expect(noms[9]).toBe('2026-09-04-14-32-11_k7bq_010.jsonl')
    // Le rang sur trois chiffres : sans lui, la dixième tranche se trierait
    // avant la deuxième.
    expect([...noms].sort()).toEqual(noms)
    expect(noms.every((nom) => nom.includes('_k7bq_'))).toBe(true)
  })

  it('survit à un horodatage de départ absurde', () => {
    // Le navigateur de la voiture compte parfois le temps depuis le chargement
    // de la page : un nom de fichier ne doit pas devenir illisible pour autant.
    const j = new Journal({ sessionId: 'ab34', startedAt: Number.NaN })
    j.add(0, 'error', { detail: 'essai' })

    expect(j.takeSlice(1)!.name).toBe('sans-date_ab34_001.jsonl')
  })
})

describe('quand le dépôt échoue', () => {
  it('remet la tranche en attente, devant ce qui a suivi', () => {
    // Sans réseau, la tranche revient et se joint à la suivante : un seul
    // fichier au retour du réseau, et non un par tentative.
    const j = journal()
    j.add(0, 'source', { detail: 'avant' })
    const slice = j.takeSlice(1000)!

    j.add(1500, 'source', { detail: 'après' })
    j.restore(slice)

    expect(j.pendingCount).toBe(2)
    const joint = j.takeSlice(2000)!
    expect(events(joint).map((e) => e.data.detail)).toEqual(['avant', 'après'])
    expect(joint.count).toBe(2)
  })

  it('ne réemploie pas le rang d’une tranche remise', () => {
    // Deux fichiers de même nom sur le serveur seraient un dépôt qui en écrase
    // un autre. Un numéro sauté se lit et ne coûte rien.
    const j = journal()
    j.add(0, 'source', {})
    const premiere = j.takeSlice(1000)!
    j.restore(premiere)
    const seconde = j.takeSlice(2000)!

    expect(premiere.name).toContain('_001.')
    expect(seconde.name).toContain('_002.')
  })

  it('rend une tranche relisible telle quelle', () => {
    // La tranche est le format déposé : ce qui en revient doit être exactement
    // ce qui y était, sinon un aller-retour raté déforme le journal.
    const j = journal()
    j.add(120, 'reject', { motif: 'imprécise', accuracyM: 240 })
    j.add(340, 'speed-origin', { derived: true })
    const slice = j.takeSlice(1000)!

    const relu = journal()
    relu.restore(slice)
    const encore = relu.takeSlice(1000)!

    expect(events(encore)).toEqual(events(slice))
  })
})

describe('le plafond du journal', () => {
  it('écarte les plus anciens et le dit dans la tranche', () => {
    // Quand le réseau manque longtemps, ce qui vient de se passer explique
    // mieux l'état courant qu'un relevé d'il y a deux heures. Mais un journal
    // troué qui ne le dit pas se lirait comme un journal complet.
    const j = journal({ maxPending: 3 })
    for (let i = 0; i < 6; i += 1) j.add(i * 100, 'sample', { rang: i })

    expect(j.pendingCount).toBe(3)
    expect(j.droppedCount).toBe(3)

    const slice = j.takeSlice(1000)!
    const lus = events(slice)
    expect(lus[0]?.kind).toBe('error')
    expect(lus[0]?.data.dropped).toBe(3)
    expect(lus.slice(1).map((e) => e.data.rang)).toEqual([3, 4, 5])
    // Le compte repart à zéro : le trou est déclaré une fois, pas à chaque
    // tranche suivante.
    expect(j.droppedCount).toBe(0)
  })

  it('s’applique aussi à une tranche remise', () => {
    const j = journal({ maxPending: 2 })
    j.add(0, 'sample', { rang: 0 })
    j.add(100, 'sample', { rang: 1 })
    const slice = j.takeSlice(1000)!
    j.add(1100, 'sample', { rang: 2 })
    j.add(1200, 'sample', { rang: 3 })
    j.restore(slice)

    expect(j.pendingCount).toBe(2)
    expect(j.droppedCount).toBe(2)
  })
})

describe('la taille annoncée', () => {
  it('compte des octets, et non des caractères', () => {
    // Un accent pèse deux octets en UTF-8, et les libellés de ce projet en sont
    // pleins : compter les caractères sous-estimerait la tranche, donc
    // retarderait un découpage réglé sur la taille.
    const j = journal()
    j.add(0, 'error', { detail: 'précision dégradée' })
    const slice = j.takeSlice(1000)!

    expect(slice.bytes).toBeGreaterThan(slice.body.length)
    expect(slice.bytes).toBe(new TextEncoder().encode(slice.body).length)
  })

  it('donne un corps d’une ligne de JSON par événement', () => {
    const j = journal()
    j.add(0, 'source', {})
    j.add(10, 'audio', {})
    const slice = j.takeSlice(1000)!

    expect(slice.body.endsWith('\n')).toBe(true)
    expect(slice.body.trimEnd().split('\n')).toHaveLength(2)
    expect(slice.count).toBe(2)
  })
})

describe('l’identifiant de session', () => {
  it('évite les caractères qu’on confond en lisant', () => {
    // Ce nom est lu à l'œil dans une liste de fichiers, et parfois retapé.
    let n = 0
    const suite = () => {
      n += 1
      return (n * 0.0137) % 1
    }
    for (let i = 0; i < 200; i += 1) {
      const id = newSessionId(suite)
      expect(id).toHaveLength(4)
      expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
    }
  })
})
