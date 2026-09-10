/**
 * Reproduction jetable des deux symptômes de l'essai du 10 septembre 2026.
 *
 * À supprimer une fois la cause établie : ce fichier ne vérifie rien, il
 * observe. Voir `.backlog/MOUVEMENT/spec.md`.
 */

import { describe, it } from 'vitest'

import { Gearbox } from './gearbox'
import { Engine } from '../engine/engine'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'
import type { Profile } from '../preset/schema'

const FRAME_S = 1 / 60

function rpmInGearAt(p: Profile, kmh: number) {
  return (gear: number) =>
    Engine.kinematicRpm(
      kmh,
      (p.drivetrain.gearRatios[gear] ?? 1) * p.drivetrain.finalDrive,
      p.drivetrain.wheelRadiusM,
    )
}

function roule(
  p: Profile,
  speedAt: (t: number) => number,
  seconds: number,
  load: number,
): { passages: string[]; fin: string } {
  const gearbox = new Gearbox(p.drivetrain, p.engine, p.feel)
  const passages: string[] = []
  let precedent = 0
  gearbox.tick(FRAME_S, {
    rpmInGear: rpmInGearAt(p, 0),
    atStandstill: true,
    load,
    kmh: 0,
    accelMs2: 0,
  })

  let dernier = { gear: 0, kmh: 0, rpm: 0 }
  for (let frame = 1; frame * FRAME_S <= seconds; frame += 1) {
    const t = frame * FRAME_S
    const kmh = speedAt(t)
    const accelMs2 = (kmh - speedAt(t - FRAME_S)) / FRAME_S / 3.6
    const rpmInGear = rpmInGearAt(p, kmh)
    const etat = gearbox.tick(FRAME_S, {
      rpmInGear,
      atStandstill: kmh < 1,
      load,
      kmh,
      accelMs2,
    })
    if (etat.gear !== precedent) {
      passages.push(
        `${precedent + 1}->${etat.gear + 1} à ${kmh.toFixed(0)} km/h, ${rpmInGear(precedent).toFixed(0)} tr/min (t=${t.toFixed(1)}s)`,
      )
      precedent = etat.gear
    }
    dernier = { gear: etat.gear, kmh, rpm: rpmInGear(etat.gear) }
  }
  return {
    passages,
    fin: `rapport ${dernier.gear + 1} à ${dernier.kmh.toFixed(0)} km/h, ${dernier.rpm.toFixed(0)} tr/min`,
  }
}

describe('reproduction — symptôme A : rester en 3e jusqu\'à 150', () => {
  for (const [nom, profil] of [
    ['Route', createRoadProfile()],
    ['Sport', createDefaultProfile()],
  ] as const) {
    it(`${nom} — accélération franche de 0 à 150 puis tenue`, () => {
      // Zéro à cent cinquante en quatorze secondes, puis six secondes tenues.
      const montee = (t: number) => (t < 14 ? (150 * t) / 14 : 150)
      const { passages, fin } = roule(profil, montee, 20, 1)
      console.log(`\n[${nom}, pleine charge] ${passages.length} passages`)
      for (const p of passages) console.log('   ' + p)
      console.log('   fin : ' + fin)
    })

    it(`${nom} — même montée, charge moyenne`, () => {
      const montee = (t: number) => (t < 14 ? (150 * t) / 14 : 150)
      const { passages, fin } = roule(profil, montee, 20, 0.5)
      console.log(`\n[${nom}, charge 0,5] ${passages.length} passages`)
      for (const p of passages) console.log('   ' + p)
      console.log('   fin : ' + fin)
    })
  }
})

describe('reproduction — un moteur de la bibliothèque change le rupteur, pas les seuils', () => {
  // Charger un moteur de la bibliothèque écrit `engine.redlineRpm` et laisse
  // `drivetrain.upshiftRpm` tel quel. Les rupteurs vont de 5500 (Chevrolet 454)
  // à 11000 (Hayabusa) : les seuils de Sport, jusqu'à 6500, passent au-dessus
  // du rupteur du 454.
  for (const [moteur, rupteur] of [
    ['GM LS (livré)', 6500],
    ['Chevrolet 454', 5500],
    ['Honda B18C5', 8400],
    ['Hayabusa', 11000],
  ] as const) {
    it(`Sport + ${moteur} (rupteur ${rupteur}) — accélération de 0 à 150`, () => {
      const base = createDefaultProfile()
      const profil: Profile = {
        ...base,
        engine: {
          ...base.engine,
          redlineRpm: rupteur,
          softLimitRpm: Math.round(rupteur * 0.965),
        },
      }
      const montee = (t: number) => (t < 14 ? (150 * t) / 14 : 150)
      const { passages, fin } = roule(profil, montee, 24, 1)
      const seuils = profil.drivetrain.upshiftRpm
        .map((r) => (r > rupteur ? `${r}⚠` : `${r}`))
        .join(' ')
      console.log(`\n[Sport + ${moteur}] seuils : ${seuils} — rupteur ${rupteur}`)
      for (const p of passages) console.log('   ' + p)
      console.log('   fin : ' + fin)
    })
  }
})

describe('reproduction — symptôme B : monter un rapport en ralentissant', () => {
  for (const [nom, profil] of [
    ['Route', createRoadProfile()],
    ['Sport', createDefaultProfile()],
  ] as const) {
    // Le trajet part de zéro et monte jusqu'à 110 en vingt secondes, puis tient
    // dix secondes : la boîte a le temps d'arriver sur son dernier rapport par
    // ses propres moyens. Sans cette mise en route, le banc cascadait six
    // rapports en trois secondes et le ralentissement se jugeait sur une boîte
    // qui n'avait pas fini de démarrer.
    const MONTEE_S = 20
    const PALIER_S = 10
    const misEnRoute = (t: number) => (t < MONTEE_S ? (110 * t) / MONTEE_S : 110)
    const debutRalenti = MONTEE_S + PALIER_S

    for (const perte of [0.2, 0.3, 0.5, 1, 2]) {
      it(`${nom} — croisière à 110 puis perte de ${perte} km/h par seconde`, () => {
        const trajet = (t: number) =>
          t < debutRalenti ? misEnRoute(t) : Math.max(30, 110 - perte * (t - debutRalenti))
        const { passages, fin } = roule(profil, trajet, debutRalenti + 90, 0.35)
        const apres = passages.filter((p) => {
          const t = Number(p.match(/t=([\d.]+)s/)?.[1] ?? 0)
          return t >= debutRalenti
        })
        const montees = apres.filter((p) => {
          const m = p.match(/^(\d)->(\d)/)
          return m !== null && Number(m[2]) > Number(m[1])
        })
        console.log(
          `\n[${nom}, -${perte} km/h/s] ${apres.length} passages pendant le ralentissement, dont ${montees.length} montées`,
        )
        for (const p of apres) console.log('   ' + p)
        console.log('   fin : ' + fin)
      })
    }
  }
})
