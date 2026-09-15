import { describe, expect, it } from 'vitest'

import { Gearbox } from './gearbox'
import { driveModeFromUpshiftRpm } from './drive-mode'
import { Engine } from '../engine/engine'
import { createRoadProfile } from '../preset/defaults'
import { SpeedConditioner } from '../speed/conditioner'
import { GeolocationSource } from '../speed/geolocation'
import { DEFAULT_BENCH, GpsBench } from '../speed/gps-bench'
import { SimulatorSource } from '../speed/simulator'
import type { Profile } from '../preset/schema'

/**
 * La boîte, jugée sur un signal de récepteur et non sur un régime fabriqué.
 *
 * Le banc de boîte ordinaire (`gearbox.test.ts`) fournit à la boîte le régime
 * qu'elle devrait voir : le signal y est parfait, et c'est ce qui a laissé
 * passer tout ce que la voiture a trouvé — le défaut d'horodatage du
 * 10 septembre 2026 comme les allers-retours de rapport à vitesse tenue. **La
 * boîte n'échoue pas sur un signal propre**, donc l'éprouver sur un signal
 * propre ne prouve rien.
 *
 * Ici, des positions fabriquées entrent dans la **vraie** source de
 * géolocalisation, traversent le conditionneur, le moteur et la boîte, et l'on
 * relève les passages en sortie. Rien n'est court-circuité, et la charge se
 * déduit de l'accélération mesurée comme en voiture — le banc ne dit jamais ce
 * que fait le pied.
 *
 * **Ce fichier ne corrige rien.** Il mesure la boîte telle qu'elle est, pour que
 * le lot MOUVEMENT ait un chiffre à battre plutôt qu'une impression. Le relevé
 * complet est dans `.backlog/MOUVEMENT/spec.md`.
 */

const FRAME_S = 1 / 60

/**
 * La cadence du récepteur de la voiture : dix mesures par seconde.
 *
 * Et non les trente millisecondes du banc par défaut, qui décrivent un récepteur
 * de téléphone. Elle compte : moins de points sous la fenêtre, c'est une pente
 * moins moyennée, donc une accélération plus bruitée à bruit de mesure égal. Le
 * relevé plus bas montre que la frontière se déplace avec elle.
 */
const CADENCE_VOITURE_MS = 100

/**
 * Bruit de mesure de référence, en km/h d'écart-type.
 *
 * C'est la valeur du banc livré, et elle rend une accélération d'écart-type
 * 0,17 m/s² à vitesse tenue — l'ordre de grandeur relevé sur un vrai récepteur
 * quand le lot BANC-GPS l'a mesuré, 0,148 m/s² en croisière à 110 km/h.
 *
 * **Ce n'est pas le bruit du récepteur de la voiture**, qui n'a jamais été
 * relevé : il vit dans le profil mesuré, sur le serveur. Tant qu'il ne l'est
 * pas, ce banc dit une marge et non un verdict.
 */
const BRUIT_DE_REFERENCE_KMH = 1

/** Vitesses tenues du relevé, dont celles où la voiture a oscillé. */
const VITESSES_TENUES = [50, 60, 72, 85, 110]

/**
 * Profil Route sur le V8 : celui sous lequel roulait la voiture le
 * 10 septembre 2026 au soir, quand les dix-neuf alternances ont été relevées.
 *
 * La dispersion du seuil de montée est mise à zéro, comme dans le banc de boîte
 * ordinaire : un chiffre qui change à chaque essai ne se compare à rien. Ce
 * qu'elle apporte se juge à part, et elle fait partie des garde-fous que le lot
 * doit examiner.
 */
function profilRoute(): Profile {
  const base = createRoadProfile()
  return {
    ...base,
    drivetrain: { ...base.drivetrain, upshiftJitterRpm: 0 },
  }
}

interface Passage {
  de: number
  vers: number
  t: number
  kmh: number
}

/**
 * La chaîne entière, du récepteur à la boîte.
 *
 * L'ordre est celui de `src/state.ts` : le banc avance la physique et émet ses
 * positions, le conditionneur en tire une vitesse continue, la boîte décide, et
 * le moteur suit — sa charge servant à la boîte à l'image suivante, comme dans
 * l'assemblage réel.
 */
function chaine(profile: Profile, signal: Partial<typeof DEFAULT_BENCH> = {}) {
  const simulateur = new SimulatorSource()
  simulateur.start()

  const gps = new GpsBench(simulateur)
  gps.setOptions({
    ...DEFAULT_BENCH,
    cadenceMs: CADENCE_VOITURE_MS,
    noiseKmh: BRUIT_DE_REFERENCE_KMH,
    ...signal,
  })

  const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 250 })
  source.setProvider(gps)

  const conditionneur = new SpeedConditioner(profile.speed)
  source.onSample((sample) => conditionneur.push(sample))
  source.start()

  const boite = new Gearbox(
    profile.drivetrain,
    profile.engine,
    profile.feel,
    driveModeFromUpshiftRpm(profile.drivetrain.upshiftRpm, profile.engine.redlineRpm),
  )
  const moteur = new Engine(profile.engine, profile.mix)

  const passages: Passage[] = []
  let rapport = 0
  let charge = 0
  let t = 0

  const rpmDansLeRapport = (gear: number, kmh: number): number =>
    Engine.kinematicRpm(
      kmh,
      (profile.drivetrain.gearRatios[gear] ?? 1) * profile.drivetrain.finalDrive,
      profile.drivetrain.wheelRadiusM,
    )

  /** Un tour de boucle, dans l'ordre de l'assemblage réel. */
  const pas = (): void => {
    t += FRAME_S
    gps.tick(FRAME_S)
    const vitesse = conditionneur.tick(FRAME_S)

    const etatBoite = boite.tick(FRAME_S, {
      rpmInGear: (gear) => rpmDansLeRapport(gear, vitesse.kmh),
      atStandstill: vitesse.atStandstill,
      load: charge,
      kmh: vitesse.kmh,
      accelMs2: vitesse.accelMs2,
    })

    const etatMoteur = moteur.tick(FRAME_S, {
      kmh: vitesse.kmh,
      accelMs2: vitesse.accelMs2,
      totalRatio: etatBoite.ratio * profile.drivetrain.finalDrive,
      wheelRadiusM: profile.drivetrain.wheelRadiusM,
      atStandstill: vitesse.atStandstill,
      isShifting: etatBoite.isShifting,
      shiftProgress: etatBoite.shiftProgress,
      // La pédale n'est pas connue : c'est tout l'intérêt de ce banc. La charge
      // se déduit de l'accélération mesurée, bruit compris.
      throttle: null,
    })
    charge = etatMoteur.load

    if (etatBoite.gear !== rapport) {
      passages.push({ de: rapport, vers: etatBoite.gear, t, kmh: vitesse.kmh })
      rapport = etatBoite.gear
    }
  }

  const rouler = (secondes: number): void => {
    for (let i = 0; i < Math.round(secondes / FRAME_S); i += 1) pas()
  }

  return { simulateur, passages, rouler, horloge: () => t }
}

/** Secondes laissées à la boîte pour monter ses rapports avant qu'on compte. */
const ETABLISSEMENT_S = 40
/** Durée de la croisière comptée. */
const CROISIERE_S = 120

/**
 * Passages relevés pendant une croisière, une fois le rapport établi.
 *
 * En croisière tenue, **tout** passage est de trop : la vitesse ne bouge pas, et
 * une boîte qui change d'avis le fait sur du bruit. C'est pourquoi on les compte
 * tous au lieu de chercher un motif d'aller-retour — le motif est ce qu'on
 * entend, le compte est ce qui se mesure.
 */
function passagesEnCroisiere(kmh: number, signal: Partial<typeof DEFAULT_BENCH> = {}): number {
  const { simulateur, rouler, passages } = chaine(profilRoute(), signal)
  simulateur.setCruise(kmh)

  rouler(ETABLISSEMENT_S)
  const etabli = passages.length
  rouler(CROISIERE_S)

  return passages.length - etabli
}

describe('la boîte sur un signal de récepteur', () => {
  it('monte ses rapports en accélérant', () => {
    // La scène de contrôle : sans elle, un banc qui ne passe aucun rapport
    // donnerait zéro oscillation et se croirait bon.
    const { simulateur, rouler, passages } = chaine(profilRoute())
    simulateur.setThrottle(1)

    rouler(60)

    expect(passages.filter((p) => p.vers > p.de).length).toBeGreaterThanOrEqual(4)
    expect(passages.at(-1)?.vers).toBeGreaterThanOrEqual(4)
  })

  it('ne change pas de rapport à vitesse tenue, au bruit de référence', () => {
    // Scène A. Cinq vitesses tenues, dont 72 km/h où les alternances 5ᵉ↔6ᵉ ont
    // été entendues le 10 septembre au soir, et 50 km/h qui se révèle la plus
    // fragile des cinq.
    for (const kmh of VITESSES_TENUES) {
      expect({ kmh, passages: passagesEnCroisiere(kmh) }).toEqual({ kmh, passages: 0 })
    }
  })

  it('tient jusqu à moitié de bruit en plus, et décroche au-delà', () => {
    // **Le chiffre de référence du lot.** À la cadence de la voiture, la boîte
    // tient une croisière bruitée à 1,5 km/h et décroche à 1,75.
    //
    // Elle décrochait à 1,5 avant que la lecture du mouvement ne soit unifiée :
    // la marge est passée d'un quart à une moitié. Elle est bornée par la
    // réactivité et non par cette lecture — voir `smoothS` dans
    // `core/speed/motion.ts`, qui gagnerait encore un cran au prix d'un lever de
    // pied vu trop tard.
    const tient = VITESSES_TENUES.map((kmh) => passagesEnCroisiere(kmh, { noiseKmh: 1.5 }))
    expect(tient).toEqual([0, 0, 0, 0, 0])

    // Et le banc reproduit toujours le défaut, sans quoi il ne prouverait rien.
    const decroche = VITESSES_TENUES.map((kmh) => passagesEnCroisiere(kmh, { noiseKmh: 1.75 }))
    expect(decroche.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })

  it('descend rapport par rapport en ralentissant, sans jamais remonter', () => {
    // Scène B — de 110 km/h, pied levé, sans frein : la voiture ralentit sur sa
    // seule traînée, à −0,32 m/s² en moyenne.
    const { simulateur, rouler, passages, horloge } = chaine(profilRoute())
    simulateur.setCruise(110)
    rouler(60)

    const depart = horloge()
    simulateur.setCruise(null)
    simulateur.setThrottle(0)
    rouler(90)

    const enDeceleration = passages.filter((passage) => passage.t >= depart)
    expect(enDeceleration.filter((p) => p.vers > p.de)).toHaveLength(0)
    expect(enDeceleration.map((p) => `${p.de + 1}->${p.vers + 1}`)).toEqual([
      '6->5',
      '5->4',
      '4->3',
      '3->2',
      '2->1',
    ])
  })

  it('descend rapport par rapport en freinant, sans jamais remonter', () => {
    // Scène B bis — même départ, frein appuyé : −0,46 m/s² en moyenne, avec des
    // pointes à −4,4. C'est le chemin qui passe par le rétrogradage au freinage,
    // et non par le seuil de régime.
    const { simulateur, rouler, passages, horloge } = chaine(profilRoute())
    simulateur.setCruise(110)
    rouler(60)

    const depart = horloge()
    simulateur.setCruise(null)
    simulateur.setBrake(0.15)
    rouler(60)

    const enDeceleration = passages.filter((passage) => passage.t >= depart)
    expect(enDeceleration.filter((p) => p.vers > p.de)).toHaveLength(0)
    expect(enDeceleration.length).toBeGreaterThanOrEqual(4)
  })
})
