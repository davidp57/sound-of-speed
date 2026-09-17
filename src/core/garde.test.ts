import { describe, expect, it } from 'vitest'

import {
  attenteRestanteMs,
  ecranOuvert,
  GARDE_AU_DEPART,
  IMMOBILITE_REQUISE_MS,
  observer,
  type EtatDeGarde,
} from './garde'

/** Déroule une suite de relevés, à cadence fixe, et rend l'état obtenu. */
function derouler(
  releves: { auGps?: boolean; alArret: boolean }[],
  depart = 1_000,
  pasMs = 1_000,
): { etat: EtatDeGarde; maintenantMs: number } {
  let etat = GARDE_AU_DEPART
  let maintenantMs = depart
  for (const releve of releves) {
    etat = observer(etat, {
      auGps: releve.auGps ?? true,
      alArret: releve.alArret,
      maintenantMs,
    })
    maintenantMs += pasMs
  }
  return { etat, maintenantMs }
}

describe('la garde', () => {
  it('ouvre sans condition quand la vitesse ne vient pas du GPS', () => {
    // Le simulateur produit une vitesse bien réelle : c'est justement quand on
    // règle qu'elle n'est pas nulle.
    const { etat, maintenantMs } = derouler([{ auGps: false, alArret: false }])

    expect(ecranOuvert(etat, { auGps: false, enVoiture: true, enMarche: true, maintenantMs })).toBe(true)
  })

  it('ouvre sans attendre tant qu’aucune position n’a été reçue', () => {
    expect(
      ecranOuvert(GARDE_AU_DEPART, { auGps: true, enVoiture: true, enMarche: false, maintenantMs: 0 }),
    ).toBe(true)
  })

  it('ferme dès qu’un relevé montre du mouvement', () => {
    const { etat, maintenantMs } = derouler([{ alArret: true }, { alArret: false }])

    expect(ecranOuvert(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs })).toBe(false)
  })

  it('reste fermée avant trente secondes d’immobilité', () => {
    const { etat } = derouler([{ alArret: false }, { alArret: true }], 0)

    expect(
      ecranOuvert(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs: IMMOBILITE_REQUISE_MS }),
    ).toBe(false)
  })

  it('ouvre après trente secondes d’immobilité, au repos', () => {
    // L'immobilité commence au premier relevé à l'arrêt, posé à 1 000 ms.
    const { etat } = derouler([{ alArret: false }, { alArret: true }], 0)

    expect(
      ecranOuvert(etat, {
        auGps: true,
        enVoiture: true,
        enMarche: false,
        maintenantMs: 1_000 + IMMOBILITE_REQUISE_MS,
      }),
    ).toBe(true)
  })

  it('reste fermée si l’application tourne, même arrêtée depuis longtemps', () => {
    // Un feu rouge de trente secondes donne l'immobilité, pas le repos.
    const { etat } = derouler([{ alArret: true }], 0)

    expect(
      ecranOuvert(etat, {
        auGps: true,
        enVoiture: true,
        enMarche: true,
        maintenantMs: 10 * IMMOBILITE_REQUISE_MS,
      }),
    ).toBe(false)
  })

  it('ne retient pas l’immobilité accumulée quand on repart', () => {
    const { etat, maintenantMs } = derouler(
      [{ alArret: true }, { alArret: true }, { alArret: false }],
      0,
    )

    expect(
      ecranOuvert(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs: maintenantMs + 60_000 }),
    ).toBe(false)
  })

  it('oublie ce qu’elle savait quand on quitte le GPS', () => {
    // Simuler une vitesse puis revenir au GPS ne doit pas fermer trente
    // secondes un écran ouvert à l'instant d'avant.
    const { etat, maintenantMs } = derouler([
      { alArret: false },
      { auGps: false, alArret: false },
    ])

    expect(etat).toBe('rien-recu')
    expect(ecranOuvert(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs })).toBe(true)
  })

  it('compte l’immobilité depuis le premier relevé à l’arrêt, pas depuis le dernier', () => {
    const { etat } = derouler([{ alArret: false }, { alArret: true }, { alArret: true }], 0)

    expect(etat).toEqual({ immobileDepuisMs: 1_000 })
  })
})

describe('l’attente restante', () => {
  it('est nulle quand l’écran est ouvert', () => {
    expect(
      attenteRestanteMs(GARDE_AU_DEPART, { auGps: true, enVoiture: true, enMarche: false, maintenantMs: 0 }),
    ).toBe(0)
  })

  it('décompte les trente secondes pendant l’immobilité', () => {
    const { etat } = derouler([{ alArret: false }, { alArret: true }], 0)

    expect(
      attenteRestanteMs(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs: 11_000 }),
    ).toBe(20_000)
  })

  it('annonce l’attente entière tant qu’on roule', () => {
    const { etat, maintenantMs } = derouler([{ alArret: false }], 0)

    expect(attenteRestanteMs(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs })).toBe(
      IMMOBILITE_REQUISE_MS,
    )
  })
})

/**
 * La garde ne se déclenche qu'en voiture.
 *
 * Arbitrage de David, le 17 septembre 2026 — demandé deux fois avant d'être
 * écrit : « les limitations à l'arrêt ne doivent être activées que si on est en
 * voiture, donc GPS actif ET cet appareil = Voiture ».
 *
 * Le cas qui l'a motivé : un poste de travail dont le navigateur donne une
 * position par le réseau, sans satellite. La garde le prenait pour une voiture
 * à l'arrêt et faisait patienter trente secondes, au bureau.
 */
describe('la garde et l’appareil déclaré', () => {
  /** Une voiture arrêtée depuis moins de trente secondes : garde fermée. */
  function justeArretee() {
    return derouler([{ alArret: false }, { alArret: true }], 0)
  }

  it('ouvre tout de suite sur un appareil qui n’est pas la voiture', () => {
    const { etat, maintenantMs } = justeArretee()

    expect(ecranOuvert(etat, { auGps: true, enVoiture: false, enMarche: false, maintenantMs })).toBe(
      true,
    )
  })

  it('ouvre même en mouvement, si l’appareil n’est pas la voiture', () => {
    // Un poste dont le navigateur donne des positions qui bougent — un portable
    // dans un train — n'a aucune raison de fermer ses écrans de réglage.
    const { etat, maintenantMs } = derouler([{ alArret: false }, { alArret: false }], 0)

    expect(ecranOuvert(etat, { auGps: true, enVoiture: false, enMarche: true, maintenantMs })).toBe(
      true,
    )
  })

  it('garde toujours la voiture, elle : c’est le seul cas qui ferme', () => {
    const { etat, maintenantMs } = justeArretee()

    expect(ecranOuvert(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs })).toBe(
      false,
    )
  })

  it('ne fait plus attendre hors de la voiture', () => {
    // C'est la gêne concrète : trente secondes devant un écran grisé, au bureau.
    const { etat, maintenantMs } = justeArretee()

    expect(
      attenteRestanteMs(etat, { auGps: true, enVoiture: false, enMarche: false, maintenantMs }),
    ).toBe(0)
    expect(
      attenteRestanteMs(etat, { auGps: true, enVoiture: true, enMarche: false, maintenantMs }),
    ).toBeGreaterThan(0)
  })

  it('les deux conditions se cumulent par un et', () => {
    // « GPS actif ET cet appareil = Voiture » : il suffit qu'une manque.
    const { etat, maintenantMs } = justeArretee()
    const ferme = { auGps: true, enVoiture: true, enMarche: false, maintenantMs }

    expect(ecranOuvert(etat, ferme)).toBe(false)
    expect(ecranOuvert(etat, { ...ferme, auGps: false })).toBe(true)
    expect(ecranOuvert(etat, { ...ferme, enVoiture: false })).toBe(true)
    expect(ecranOuvert(etat, { ...ferme, auGps: false, enVoiture: false })).toBe(true)
  })
})
