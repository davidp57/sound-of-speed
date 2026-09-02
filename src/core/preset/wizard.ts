import { createDefaultProfile } from './defaults'
import { deepCopy, newId } from './store'
import type { Profile } from './schema'

/**
 * Construction guidée d'un profil.
 *
 * Un profil compte une trentaine de réglages qui ne s'accordent pas
 * indépendamment : un rupteur bas avec des rapports courts fait hurler le moteur
 * en ville, un pont long avec des passages hauts ne sort jamais des premiers
 * rapports. Les régler un à un suppose de savoir comment ils se répondent.
 *
 * On demande donc quatre choses qu'on sait décrire sans vocabulaire technique —
 * le tempérament, le terrain, le nombre de rapports, le type de moteur — et on
 * en déduit l'ensemble. Le résultat reste entièrement modifiable ensuite : c'est
 * un point de départ cohérent, pas un carcan.
 */

export type Temperament = 'calme' | 'equilibre' | 'sportif'
export type Usage = 'ville' | 'route' | 'autoroute'
export type EngineKind = 'diesel' | 'essence' | 'sportif'

export interface WizardChoices {
  name: string
  temperament: Temperament
  usage: Usage
  gearCount: number
  engine: EngineKind
}

/** Régime maximal et ralenti, selon le type de moteur choisi. */
const ENGINES: Record<EngineKind, { redline: number; idle: number; label: string }> = {
  diesel: { redline: 4600, idle: 750, label: 'Diesel — coupleux, tourne bas' },
  essence: { redline: 6600, idle: 800, label: 'Essence — la plage la plus courante' },
  sportif: { redline: 8600, idle: 900, label: 'Sportif — monte très haut dans les tours' },
}

/**
 * Vitesse de croisière visée, et régime auquel on veut y tourner.
 *
 * C'est ce couple qui fixe le pont, donc l'assiette générale du moteur. Un
 * tempérament calme cherche à tourner bas à sa vitesse habituelle ; un
 * tempérament sportif accepte de tourner plus haut pour rester dans la zone où
 * le moteur pousse.
 */
const CRUISE: Record<Usage, number> = { ville: 60, route: 90, autoroute: 130 }
const CRUISE_RPM_FRACTION: Record<Temperament, number> = {
  calme: 0.36,
  equilibre: 0.43,
  sportif: 0.52,
}

/** Régimes de passage, en fraction du rupteur : du premier rapport au dernier. */
const UPSHIFT_RANGE: Record<Temperament, [number, number]> = {
  calme: [0.42, 0.5],
  equilibre: [0.55, 0.66],
  sportif: [0.68, 0.82],
}

/**
 * Plancher de croisière, en fraction du rupteur.
 *
 * C'est lui qui décide jusqu'où la boîte monte quand on tient une vitesse. Un
 * tempérament calme accepte de croiser bas ; un sportif garde du régime sous le
 * pied.
 */
const CRUISE_FLOOR: Record<Temperament, number> = {
  calme: 0.2,
  equilibre: 0.25,
  sportif: 0.3,
}

/** Écart entre pied levé et pied au plancher, en fraction du rupteur. */
const LOAD_SPREAD: Record<Temperament, number> = {
  calme: 0.2,
  equilibre: 0.28,
  sportif: 0.34,
}

const K = 1 / 3.6 / (2 * Math.PI) // km/h → tours de roue par seconde, à rayon 1 m

export function buildProfile(choices: WizardChoices, template: Profile): Profile {
  const base = createDefaultProfile()
  const engine = ENGINES[choices.engine]
  const count = Math.max(2, Math.min(9, Math.round(choices.gearCount)))

  // Rapports répartis géométriquement entre un premier court et un dernier long.
  // Une progression géométrique donne des écarts de régime égaux d'un rapport au
  // suivant, ce qui est le propre d'une boîte bien étagée.
  const first = 3.6
  const last = 0.72
  const gearRatios = Array.from({ length: count }, (_, i) =>
    Number((first * (last / first) ** (i / (count - 1))).toFixed(3)),
  )

  const wheelRadiusM = template.drivetrain.wheelRadiusM
  const cruiseKmh = CRUISE[choices.usage]
  const cruiseRpm = engine.redline * CRUISE_RPM_FRACTION[choices.temperament]
  const topGear = gearRatios[count - 1] ?? 0.72

  // Pont déduit du couple vitesse/régime voulu en dernier rapport.
  const wheelRps = (cruiseKmh * K) / wheelRadiusM
  const finalDrive = Number((cruiseRpm / (wheelRps * 60 * topGear)).toFixed(3))

  const [from, to] = UPSHIFT_RANGE[choices.temperament]
  const upshiftRpm = Array.from({ length: Math.max(1, count - 1) }, (_, i) => {
    const t = count > 2 ? i / (count - 2) : 0
    return Math.round(engine.redline * (from + (to - from) * t))
  })

  // Temporisations volontairement inégales : identiques, la boîte sonne comme un
  // métronome. Plus courtes sur un tempérament vif.
  const baseDelay = choices.temperament === 'sportif' ? 0.22 : choices.temperament === 'calme' ? 0.45 : 0.32
  const shiftDelaysS = Array.from({ length: count }, (_, i) =>
    Number((baseDelay * (i % 2 === 0 ? 1 : 1.7)).toFixed(2)),
  )

  const sportiness = choices.temperament === 'sportif' ? 1 : choices.temperament === 'calme' ? 0 : 0.5

  return {
    ...base,
    id: newId(),
    name: choices.name.trim() || 'Nouveau profil',
    // Les échantillons ne se devinent pas : on reprend ceux du profil courant.
    sampleDir: template.sampleDir,
    layers: deepCopy(template.layers),
    engine: {
      ...base.engine,
      cylinders: template.engine.cylinders,
      idleRpm: engine.idle,
      redlineRpm: engine.redline,
      softLimitRpm: Math.round(engine.redline * 0.97),
      inertia: 1.4 - 0.5 * sportiness,
      freeRevRate: Math.round(engine.redline * (0.9 + 0.5 * sportiness)),
      engineBraking: Math.round(engine.redline * 0.6),
    },
    drivetrain: {
      ...base.drivetrain,
      gearRatios,
      finalDrive,
      wheelRadiusM,
      shiftTimeMs: Math.round(140 - 60 * sportiness),
      upshiftRpm,
      upshiftLoadSpreadRpm: Math.round(engine.redline * LOAD_SPREAD[choices.temperament]),
      upshiftJitterRpm: Math.round(engine.redline * 0.02),
      minUpshiftRpm: Math.round(engine.redline * 0.34),
      downshiftAtRedlineRatio: 0.28,
      firstGearLaunchOnly: true,
      launchUpshiftKmh: choices.usage === 'ville' ? 5 : 8,
      // Le plancher garde une marge au-dessus du ralenti : sur un diesel, la
      // fraction du rupteur seule tomberait trop près du régime de ralenti.
      cruiseMinRpm: Math.round(
        Math.max(engine.idle * 1.4, engine.redline * CRUISE_FLOOR[choices.temperament]),
      ),
      // Un tempérament calme monte dès que la vitesse se stabilise ; un sportif
      // garde son rapport plus longtemps avant d'y renoncer.
      cruiseUpshiftAfterS: Number((2 + 1.6 * sportiness).toFixed(1)),
      // Et il descend au freinage sur une décélération plus faible.
      brakeDownshiftAccelMs2: Number((-1.1 + 0.5 * sportiness).toFixed(2)),
      shiftDelaysS,
    },
    mix: {
      ...base.mix,
      crossfadeLowRpm: Math.round(engine.redline * 0.4),
      crossfadeHighRpm: Math.round(engine.redline * 0.8),
      fullLoadAccelMs2: 2.5 - 0.6 * sportiness,
      offLoadGain: 3.2 - 0.6 * sportiness,
      loadContrast: 0.6 + 0.2 * sportiness,
    },
    feel: {
      kickdown: {
        ...base.feel.kickdown,
        targetRpmFraction: 0.5 + 0.15 * sportiness,
        maxGears: choices.temperament === 'sportif' ? 3 : 2,
      },
      backfire: {
        ...base.feel.backfire,
        enabled: choices.temperament !== 'calme',
        minRpm: Math.round(engine.redline * 0.5),
        intensity: 0.2 + 0.35 * sportiness,
        count: choices.temperament === 'sportif' ? 5 : 3,
      },
      shiftJolt: {
        ...base.feel.shiftJolt,
        depth: 0.25 + 0.4 * sportiness,
      },
    },
  }
}

/**
 * Ce que donnera le profil, en langage de conducteur.
 *
 * Un aperçu chiffré vaut mieux qu'une promesse : il permet de juger avant de
 * créer, et de comprendre ce que chaque choix a changé.
 */
/**
 * Rapport le plus long qui tourne encore au-dessus du plancher de croisière.
 *
 * C'est exactement là que la montée en croisière s'arrête : elle grimpe d'un
 * rapport tant que le suivant reste au-dessus du plancher, et le régime décroît
 * avec l'index du rapport. Le calcul donne donc le même résultat que la boîte,
 * sans avoir à la faire tourner.
 */
function cruiseGearAt(profile: Profile, kmh: number): number {
  const { gearRatios, finalDrive, wheelRadiusM, cruiseMinRpm } = profile.drivetrain
  let chosen = 0
  for (let gear = 0; gear < gearRatios.length; gear += 1) {
    const rpm = ((kmh * K) / wheelRadiusM) * 60 * (gearRatios[gear] ?? 1) * finalDrive
    if (rpm >= cruiseMinRpm) chosen = gear
  }
  return chosen
}

export function describeProfile(profile: Profile): string[] {
  const { drivetrain, engine } = profile
  const count = drivetrain.gearRatios.length
  const top = drivetrain.gearRatios[count - 1] ?? 1
  const rpmAt = (kmh: number, ratio: number) =>
    ((kmh * K) / drivetrain.wheelRadiusM) * 60 * ratio * drivetrain.finalDrive

  // Le régime de croisière vient en premier : c'est celui qu'on entendra le
  // plus souvent, la boîte montant d'elle-même dès que la vitesse se tient.
  const croisiere = cruiseGearAt(profile, 90)
  const lines = [
    `${count} rapports, rupteur à ${engine.redlineRpm} tr/min.`,
    `À 90 km/h, allure tenue : ${croisiere + 1}e rapport à ` +
      `${Math.round(rpmAt(90, drivetrain.gearRatios[croisiere] ?? 1))} tr/min.`,
    `À 90 km/h en dernier rapport : ${Math.round(rpmAt(90, top))} tr/min.`,
    `À 130 km/h : ${Math.round(rpmAt(130, top))} tr/min.`,
  ]

  // Premier passage commandé par le régime. Quand la première n'est qu'une
  // amorce de lancement, son seuil ne sert jamais : le premier passage qu'on
  // entend est 2 → 3. Le libellé et le calcul portent sur le même rapport —
  // ils annonçaient « 2 → 3 » en prenant le seuil de la première, donc une
  // vitesse qui ne correspondait à aucun passage réel.
  const gear = drivetrain.firstGearLaunchOnly ? 1 : 0
  const threshold = drivetrain.upshiftRpm[gear]
  const ratio = drivetrain.gearRatios[gear]
  if (threshold !== undefined && ratio !== undefined) {
    const kmh = threshold / (60 * ratio * drivetrain.finalDrive) / (K / drivetrain.wheelRadiusM)
    lines.push(`Passage ${gear + 1} → ${gear + 2} vers ${Math.round(kmh)} km/h à charge moyenne.`)
  }
  return lines
}
