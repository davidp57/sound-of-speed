import type { StepAnalysis } from './analyze'
import { SETTING_LABELS, readSetting, upshiftSpeeds, type SettingPath } from './settings'
import { DEPARTURE_S, weightedPercentile, percentile } from './measure'
import { DOWNSHIFT_SEPARATION_MS2, ORDINARY_STEPS, type CalibrationStepId } from './protocol'
import { rpmAtSpeed } from '../preset/defaults'
import type { Profile } from '../preset/schema'

/**
 * Ce que l'étalonnage propose, face à ce qui est réglé.
 *
 * **Elle propose, elle n'applique pas.** C'est la règle déjà retenue pour
 * l'analyse d'échantillon, dont les candidats d'ancrage se départagent à
 * l'oreille : la mesure est plus sûre que le souvenir, elle n'est pas plus sûre
 * que le jugement. Une proposition se lit, se compare, et se recopie sur un
 * geste — un réglage à la fois.
 *
 * Ce qui n'a pas été mesuré est dit **non mesuré**, jamais estimé : une session
 * incomplète reste utile, un chiffre inventé ne l'est pas. Un freinage franc ne
 * se commande pas au milieu du trafic.
 *
 * **Rien n'est formulé en régime moteur.** La voiture mesurée n'a pas de
 * rapports : l'étalonnage rend des vitesses, des accélérations, des durées et du
 * bruit de mesure. Les seuils de passage sont donc proposés en kilomètres-heure,
 * et la table de régimes du profil s'affiche elle aussi en kilomètres-heure pour
 * pouvoir être comparée. La conversion n'emploie que ce que le profil contient
 * déjà — pont, démultiplications, rayon de roue — qui sont des choix faits et non
 * des mesures.
 */

export interface Suggestion {
  /** Clé stable, sert de clé de liste. */
  key: string
  label: string
  /** Ce que la mesure donne, dans l'unité où elle a été prise. */
  measured: { value: number | number[]; unit: string; decimals: number } | null
  /** Pourquoi il n'y a rien de mesuré. `null` quand la mesure est là. */
  missing: string | null
  /**
   * Réglage informé, quand la recopie est définie.
   *
   * `null` sur une ligne purement informative : ce que la mesure éclaire sans le
   * déterminer. La raison est alors dans `note`.
   */
  setting: {
    path: SettingPath
    label: string
    /** Unité dans laquelle les deux colonnes s'affichent. */
    unit: string
    decimals: number
    current: number | number[]
    proposed: number | number[]
    /**
     * Ce qui sera écrit dans le profil.
     *
     * Diffère de `proposed` quand le réglage n'est pas stocké dans l'unité
     * affichée — les seuils de passage, mesurés en km/h et rangés en tr/min.
     */
    write: number | number[]
    /** Ce que la conversion suppose. Vide quand il n'y en a pas. */
    conversion: string
  } | null
  note: string | null
}

/**
 * Marge des bornes d'accélération.
 *
 * Les bornes servent à rejeter l'absurde, pas à écrêter le réel : trop serrées
 * elles amputent une décélération vraie, trop larges elles ne protègent de rien
 * — ±14 m/s² ne sont jamais atteints. Une fois et demie la plus forte valeur
 * relevée laisse la place d'un freinage plus appuyé que celui qu'on a enregistré.
 */
const BOUND_MARGIN = 1.5
/** Pas d'arrondi des bornes, en m/s². Une borne n'a pas besoin d'être fine. */
const BOUND_STEP_MS2 = 0.5

/**
 * Marge de la vitesse plausible.
 *
 * Quinze pour cent au-dessus de la plus haute vitesse pratiquée, arrondis à la
 * dizaine supérieure. La borne rejette l'aberrant : la caler exactement sur ce
 * qu'on a fait pendant l'étalonnage ferait rejeter une vitesse simplement plus
 * élevée, et le moteur se tairait au moment où l'on va plus vite que d'habitude.
 */
const PLAUSIBLE_MARGIN = 1.15
const PLAUSIBLE_STEP_KMH = 10

/**
 * Centile de la durée des paliers qui donne le délai de montée en croisière.
 *
 * Le dixième : neuf paliers sur dix durent alors assez longtemps pour que la
 * montée se produise, et les plus brefs — un ralentissement momentané qui n'est
 * pas une croisière — ne la déclenchent pas.
 *
 * Une fraction de la durée **médiane** avait été essayée d'abord, et elle est
 * fausse : sur autoroute, un palier dure une minute, et le quart d'une minute
 * donnerait un délai que la conduite en ville n'atteindrait jamais. Ce qu'il faut
 * mesurer n'est pas la durée d'un palier typique, c'est celle du plus court dont
 * on veuille encore qu'il compte.
 */
const CRUISE_DELAY_PERCENTILE = 0.1
const CRUISE_DELAY_MIN_S = 1
const CRUISE_DELAY_MAX_S = 6

/**
 * Précision visée pour la pente d'accélération, en m/s².
 *
 * Un dixième de m/s² : un vingtième de la charge pleine du profil Route, donc
 * une résolution de cinq pour cent sur la charge. C'est cette cible qui fixe la
 * fenêtre d'accélération à proposer.
 */
const SLOPE_TARGET_MS2 = 0.1
const WINDOW_MIN_MS = 200
const WINDOW_MAX_MS = 2000
const WINDOW_STEP_MS = 50

/**
 * Écart minimal entre deux seuils de passage, en km/h.
 *
 * Des paliers tous à la même vitesse donneraient des seuils confondus, et la
 * boîte passerait plusieurs rapports d'un coup. On les écarte du minimum plutôt
 * que de rendre une table inutilisable.
 */
const UPSHIFT_MIN_GAP_KMH = 3

/** Rassemble les propositions d'une session, complète ou non. */
export function suggest(analyses: StepAnalysis[], profile: Profile): Suggestion[] {
  const byStep = new Map<CalibrationStepId, StepAnalysis>()
  for (const analysis of analyses) byStep.set(analysis.step, analysis)

  const ordinary = ORDINARY_STEPS.map((id) => byStep.get(id)).filter(
    (analysis): analysis is StepAnalysis => analysis !== undefined && analysis.valid,
  )
  const launchKmh = departureSpeed(byStep.get('city'))

  return [
    fullLoad(byStep.get('launch'), profile),
    brakeDownshift(byStep.get('coast'), byStep.get('brake'), profile),
    lowerBound(analyses, profile),
    upperBound(analyses, profile),
    maxPlausible(ordinary, profile),
    launchUpshift(byStep.get('city'), profile),
    upshiftThresholds(ordinary, launchKmh, profile),
    cruiseFloor(ordinary),
    cruiseDelay(ordinary, profile),
    gpsNoise(ordinary),
    accelWindow(ordinary, profile),
  ]
}

/**
 * Accélération à charge pleine, tirée de la reprise franche.
 *
 * C'est le réglage dont dépend toute la charge — donc le volume, le timbre et
 * les seuils de passage. Il vaut 2 m/s² sur le profil Route, choisi par le
 * calcul, là où une voiture électrique en fait bien davantage.
 */
function fullLoad(analysis: StepAnalysis | undefined, profile: Profile): Suggestion {
  const note =
    'Mesurée sur la reprise franche : c’est l’accélération à laquelle la charge est pleine.'
  const missing = whyMissing(analysis, 'l’accélération franche')
  if (missing !== null || !analysis) {
    return line('mix.fullLoadAccelMs2', profile, note, { missing: missing ?? '' })
  }

  const peak = analysis.measure.peakAccelMs2
  if (peak === null) {
    return line('mix.fullLoadAccelMs2', profile, note, {
      missing: 'Aucune accélération mesurable dans la trace.',
    })
  }
  return line('mix.fullLoadAccelMs2', profile, note, { value: peak, proposal: peak })
}

/**
 * La frontière entre lever le pied et freiner.
 *
 * C'est elle que la boîte utilise pour décider de rétrograder afin de ralentir.
 * Elle vaut −1 m/s² sur Route et −0,7 sur Sport, choisis pour que le
 * rétrogradage ne se déclenche pas sur un simple lever de pied — sans que
 * personne ait mesuré ce que valent l'un et l'autre dans cette voiture.
 *
 * Le seuil se place **au milieu** des deux mesures, et le milieu n'est pas un
 * choix par défaut : il est le point qui laisse la même marge contre les deux
 * erreurs possibles — rétrograder sur un simple lever de pied, et ne pas
 * rétrograder sur un vrai freinage. Le placer plus près de l'un revient à
 * décider laquelle des deux on préfère commettre, ce qu'aucune mesure ne dit.
 *
 * Et s'il n'y a pas de milieu — les deux étapes rendant la même décélération —
 * aucune valeur n'est proposée : une électrique récupère au lever de pied, et il
 * est parfaitement possible que cette voiture-là ne fasse pas de différence. Le
 * dire vaut mieux que d'inventer une frontière.
 */
function brakeDownshift(
  coast: StepAnalysis | undefined,
  brake: StepAnalysis | undefined,
  profile: Profile,
): Suggestion {
  const path: SettingPath = 'drivetrain.brakeDownshiftAccelMs2'
  const generic =
    'La boîte descend un rapport au-dessous de ce seuil. Il se place entre le ' +
    'lever de pied et le freinage.'

  const missing =
    whyMissing(coast, 'la décélération pied levé') ?? whyMissing(brake, 'le freinage franc')
  if (missing !== null || !coast || !brake) {
    return line(path, profile, generic, { missing: missing ?? '' })
  }

  const lift = coast.measure.peakDecelMs2
  const stop = brake.measure.peakDecelMs2
  if (lift === null || stop === null) {
    return line(path, profile, generic, {
      missing: 'Une des deux traces ne porte aucune décélération mesurable.',
    })
  }

  const note =
    `Entre le lever de pied (${lift.toFixed(2)} m/s²) et le freinage ` +
    `(${stop.toFixed(2)} m/s²).`

  if (lift - stop < DOWNSHIFT_SEPARATION_MS2) {
    return line(path, profile, note, {
      missing:
        `Les deux étapes donnent la même décélération, à ` +
        `${Math.abs(lift - stop).toFixed(2)} m/s² près : soit le frein a servi ` +
        'pendant le lever de pied, soit la récupération de cette voiture suffit à ' +
        'elle seule. Il n’y a pas de frontière à placer entre les deux.',
    })
  }

  const middle = (lift + stop) / 2
  return line(path, profile, note, { value: middle, proposal: middle })
}

/**
 * Borne basse de l'accélération : la plus forte décélération relevée, avec marge.
 *
 * Toutes les étapes valides comptent, pas seulement le freinage : on freine
 * aussi en ville, parfois plus fort que sur la manœuvre commandée.
 *
 * **Mais il faut qu'une étape ait pu ralentir.** Mesuré en éprouvant la reprise
 * d'un étalonnage par une création de profil : avec la seule étape de reprise
 * enregistrée — une accélération pure, sans un freinage — la plus forte
 * décélération relevée valait presque zéro, et la borne proposée −0,5 m/s².
 * Écrite dans un profil, elle aurait écrêté **tout** freinage réel : la charge
 * et la boîte auraient vu un ralentissement minuscule là où l'on plante les
 * freins. Une borne trop large ne protège de rien ; une borne trop serrée
 * ampute le signal, ce qui est bien pire.
 *
 * La borne ne se propose donc que si au moins une étape susceptible de ralentir
 * a été mesurée : le lever de pied, le freinage, ou la conduite ordinaire.
 */
function lowerBound(analyses: StepAnalysis[], profile: Profile): Suggestion {
  const note =
    'La plus forte décélération relevée sur toutes les étapes, plus la moitié en ' +
    'marge. Toute décélération au-delà est écrêtée.'
  const decelerating: CalibrationStepId[] = ['coast', 'brake', ...ORDINARY_STEPS]
  const measured = analyses.filter((analysis) => decelerating.includes(analysis.step))
  const values = validValues(measured, (measure) => measure.peakDecelMs2)

  if (values.length === 0) {
    return line('speed.minAccelMs2', profile, note, {
      missing:
        'Aucune étape qui ralentisse : le lever de pied, le freinage ou la ' +
        'conduite ordinaire. Une borne déduite d’une accélération seule ' +
        'écrêterait les freinages réels.',
    })
  }

  const worst = Math.min(...values)
  return line('speed.minAccelMs2', profile, note, {
    value: worst,
    proposal: snap(worst * BOUND_MARGIN, BOUND_STEP_MS2),
  })
}

/** Borne haute, symétrique : la plus forte accélération relevée, avec marge. */
function upperBound(analyses: StepAnalysis[], profile: Profile): Suggestion {
  const note =
    'La plus forte accélération relevée sur toutes les étapes, plus la moitié en ' +
    'marge. Toute accélération au-delà est écrêtée.'
  const values = validValues(analyses, (measure) => measure.peakAccelMs2)

  if (values.length === 0) {
    return line('speed.maxAccelMs2', profile, note, {
      missing: 'Aucune étape valide : rien à borner.',
    })
  }

  const best = Math.max(...values)
  return line('speed.maxAccelMs2', profile, note, {
    value: best,
    proposal: snap(best * BOUND_MARGIN, BOUND_STEP_MS2),
  })
}

/**
 * Vitesse plausible maximale : la plus haute vitesse pratiquée, avec marge.
 *
 * Au-delà, une mesure n'est plus une vitesse mais une erreur, et elle est
 * rejetée entière. C'est pour cela que la marge compte : une borne calée trop
 * juste ferait rejeter une vitesse réelle, et le son se figerait.
 */
function maxPlausible(ordinary: StepAnalysis[], profile: Profile): Suggestion {
  const note =
    'La plus haute vitesse pratiquée sur les étapes de conduite ordinaire, plus ' +
    'quinze pour cent. Au-delà, une mesure est rejetée comme aberrante.'
  if (ordinary.length === 0) {
    return line('speed.maxPlausibleKmh', profile, note, {
      missing: 'Aucune étape de conduite ordinaire valide.',
    })
  }

  const top = Math.max(...ordinary.map((analysis) => analysis.measure.practicedMaxKmh))
  return line('speed.maxPlausibleKmh', profile, note, {
    value: top,
    proposal: snap(top * PLAUSIBLE_MARGIN, PLAUSIBLE_STEP_KMH),
  })
}

/** Vitesse relevée une seconde après un départ arrêté, médiane sur la trace. */
function departureSpeed(city: StepAnalysis | undefined): number | null {
  if (!city || !city.valid) return null
  const departures = city.measure.departureKmh
  if (departures.length === 0) return null
  return percentile(departures, 0.5)
}

/**
 * Vitesse à laquelle la première cède la place.
 *
 * Sur une automatique, la première n'est qu'une amorce. La mesure prend la
 * vitesse atteinte une seconde après chaque départ arrêté, et en garde la
 * médiane. **La seconde est une convention**, et elle est dite : rien dans une
 * trace GPS ne désigne l'instant où la première « devrait » céder la place, la
 * voiture mesurée n'ayant pas de rapports.
 */
function launchUpshift(city: StepAnalysis | undefined, profile: Profile): Suggestion {
  const path: SettingPath = 'drivetrain.launchUpshiftKmh'
  const note =
    `Vitesse atteinte ${DEPARTURE_S} s après un départ arrêté, en médiane sur ` +
    'la trace de ville. Le délai est une convention : rien dans la trace ne dit ' +
    'où la première devrait s’arrêter.'

  const missing = whyMissing(city, 'la conduite en ville')
  if (missing !== null || !city) return line(path, profile, note, { missing: missing ?? '' })

  const speed = departureSpeed(city)
  if (speed === null) {
    return line(path, profile, note, {
      missing:
        'Aucun départ arrêté dans la trace de ville : il faut au moins un arrêt ' +
        'complet suivi d’une seconde de roulage.',
    })
  }

  return line(path, profile, note, { value: speed, proposal: speed })
}

/**
 * Seuils de passage, placés aux vitesses où l'on roule vraiment.
 *
 * La règle est simple et se dit en une phrase : **chaque rapport couvre une part
 * égale du temps passé à vitesse tenue.** Les seuils sont donc les quantiles de
 * la distribution des paliers, pondérés par leur durée — ce qu'on a fait le plus
 * longtemps, non le plus souvent.
 *
 * Le profil Route a été décrit comme « calibré sur les vitesses que l'on pratique
 * vraiment ». C'était de mémoire. Voilà le relevé.
 *
 * Quand la première ne sert qu'à s'élancer, son seuil n'est pas un quantile : la
 * première n'a pas de part de croisière à couvrir, elle a une amorce à finir. Le
 * premier seuil vaut donc la vitesse de fin de première.
 */
function upshiftThresholds(
  ordinary: StepAnalysis[],
  launchKmh: number | null,
  profile: Profile,
): Suggestion {
  const path: SettingPath = 'drivetrain.upshiftRpm'
  const { gearRatios, finalDrive, wheelRadiusM, upshiftRpm, firstGearLaunchOnly } =
    profile.drivetrain
  const current = upshiftSpeeds(profile).map((kmh) => Math.round(kmh))
  const note =
    'Chaque rapport couvre une part égale du temps passé à vitesse tenue. ' +
    'Mesuré et réglé sont tous deux en km/h : le réglage, lui, est rangé en ' +
    'tr/min, et la conversion emploie le pont et les démultiplications du profil.'

  const held = heldSpeeds(ordinary)
  if (held.length === 0) {
    return line(path, profile, note, {
      current,
      missing:
        'Aucun palier dans les étapes de conduite ordinaire : rien ne dit où l’on ' +
        'roule vraiment.',
    })
  }

  const count = upshiftRpm.length
  if (count === 0) {
    return line(path, profile, note, {
      current,
      missing: 'Ce profil est en prise directe : il n’a pas de seuil de passage.',
    })
  }

  // La première, quand elle ne sert qu'à s'élancer, prend la vitesse de fin de
  // première ; à défaut de l'avoir mesurée, celle qui est réglée — ce qui laisse
  // les autres seuils exploitables plutôt que de refuser toute la table.
  const fixed = firstGearLaunchOnly ? 1 : 0
  const free = Math.max(0, count - fixed)
  const parts = free + 1

  const thresholds: number[] = []
  if (fixed === 1) {
    thresholds.push(Math.round(launchKmh ?? profile.drivetrain.launchUpshiftKmh))
  }
  for (let k = 1; k <= free; k += 1) {
    thresholds.push(Math.round(weightedPercentile(held, k / parts)))
  }

  // Croissants, et écartés du minimum : des paliers tous à la même vitesse
  // donneraient sinon des seuils confondus, donc plusieurs rapports passés d'un
  // coup.
  for (let i = 1; i < thresholds.length; i += 1) {
    const previous = thresholds[i - 1] ?? 0
    const value = thresholds[i] ?? 0
    if (value < previous + UPSHIFT_MIN_GAP_KMH) {
      thresholds[i] = previous + UPSHIFT_MIN_GAP_KMH
    }
  }

  const write = thresholds.map((kmh, index) =>
    Math.round(rpmAtSpeed(kmh, gearRatios[index] ?? 1, finalDrive, wheelRadiusM)),
  )

  return line(path, profile, note, {
    current,
    value: thresholds,
    proposal: thresholds,
    write,
    conversion:
      'Converti en tr/min avec le pont, les démultiplications et le rayon de roue ' +
      'du profil.',
  })
}

/**
 * Plancher de croisière : la vitesse la plus basse réellement tenue.
 *
 * Rien n'est proposé pour `cruiseMinRpm`, et c'est délibéré. Le réglage est un
 * régime ; le convertir demanderait de choisir dans quel rapport la boîte se
 * trouve à cette vitesse — or c'est précisément ce que le réglage sert à
 * décider. Aucune mesure ne tranche cela, et la voiture mesurée n'a pas de
 * rapports. On rend donc la vitesse, et on dit pourquoi on s'arrête là.
 */
function cruiseFloor(ordinary: StepAnalysis[]): Suggestion {
  const note =
    'Le réglage « plancher de croisière » est un régime. Le déduire de cette ' +
    'vitesse demanderait de choisir un rapport, ce qu’aucune mesure ne dit — et ' +
    'la voiture mesurée n’a pas de rapports. À reporter à la main.'
  const held = heldSpeeds(ordinary)
  if (held.length === 0) {
    return report('cruise.floor', 'Plancher de croisière', note, null, 'Aucun palier mesuré.')
  }

  // Le dixième centile, non le minimum : un unique palier à quinze
  // kilomètres-heure dans un embouteillage n'est pas le plancher de croisière.
  return report('cruise.floor', 'Plancher de croisière', note, {
    value: Math.round(weightedPercentile(held, 0.1)),
    unit: 'km/h',
    decimals: 0,
  })
}

/**
 * Délai avant de monter un rapport à vitesse tenue.
 *
 * Le dixième centile de la durée des paliers : neuf paliers sur dix durent assez
 * longtemps pour que la montée se produise, et les plus brefs ne la déclenchent
 * pas. C'est le plus court palier dont on veuille encore qu'il compte, non la
 * durée d'un palier typique — sur autoroute, un palier dure une minute.
 */
function cruiseDelay(ordinary: StepAnalysis[], profile: Profile): Suggestion {
  const path: SettingPath = 'drivetrain.cruiseUpshiftAfterS'
  const note =
    'Le dixième centile de la durée des paliers : neuf paliers sur dix durent ' +
    'assez pour que la montée se produise, les plus brefs ne la déclenchent pas.'

  const durations = ordinary.flatMap((analysis) =>
    analysis.measure.plateaus.map((plateau) => plateau.durationS),
  )
  if (durations.length === 0) {
    return line(path, profile, note, { missing: 'Aucun palier mesuré.' })
  }

  const shortest = percentile(durations, CRUISE_DELAY_PERCENTILE)
  const delay = Math.min(CRUISE_DELAY_MAX_S, Math.max(CRUISE_DELAY_MIN_S, shortest))
  return line(path, profile, note, { value: shortest, proposal: delay })
}

/**
 * Bruit de mesure du GPS, et cadence observée.
 *
 * Relevé sur l'étape la plus rapide disponible : plus la conduite est régulière,
 * mieux le bruit se sépare du mouvement. Purement informatif — c'est la fenêtre
 * d'accélération, ligne suivante, qui s'en déduit.
 *
 * **La raideur du lissage, elle, ne s'en déduit pas.** Le ressort arrondit ce
 * que le bruit laisse passer, et le réglage juste est celui à partir duquel le
 * tremblement ne s'entend plus : c'est un jugement d'oreille, pas une mesure. Le
 * proposer par une formule serait habiller une convention en résultat.
 */
function gpsNoise(ordinary: StepAnalysis[]): Suggestion {
  const label = 'Bruit du GPS'
  const note =
    'Ce chiffre informe la fenêtre d’accélération, ci-dessous. Il n’informe pas ' +
    'la raideur du lissage : le réglage juste est celui à partir duquel le ' +
    'tremblement ne s’entend plus, ce qui se juge à l’oreille.'

  const source = quietestStep(ordinary)
  if (!source) {
    return report('gps.noise', label, note, null, 'Aucune étape de conduite ordinaire valide.')
  }

  const noise = source.measure.noiseKmh
  const cadence = Math.round(source.measure.cadenceMs)
  if (noise === null) {
    return report(
      'gps.noise',
      label,
      note,
      null,
      `Cadence de ${cadence} ms sur « ${source.traceName} » : trop lente pour ` +
        'séparer le bruit du mouvement. Avec une mesure par seconde, il n’y a ' +
        'rien à moyenner.',
    )
  }

  return report(
    'gps.noise',
    label,
    `${note} Relevé sur « ${source.traceName} », à ${cadence} ms de cadence.`,
    { value: noise, unit: 'km/h', decimals: 2 },
  )
}

/**
 * Fenêtre d'accélération, déduite du bruit et de la cadence.
 *
 * La pente est ajustée aux moindres carrés sur la fenêtre. Pour un bruit `σ`,
 * une cadence `Δ` et une fenêtre `T`, l'écart-type de la pente vaut
 * `√(12 σ² Δ / T³)` : on renverse la formule pour trouver la fenêtre qui atteint
 * la précision visée, `T = ∛(12 σ² Δ / cible²)`.
 *
 * Vérifié sur traces synthétiques, à neuf combinaisons de bruit et de cadence :
 * l'écart-type obtenu tient entre 0,093 et 0,114 m/s² pour une cible de 0,100.
 */
function accelWindow(ordinary: StepAnalysis[], profile: Profile): Suggestion {
  const path: SettingPath = 'speed.accelWindowMs'
  const note =
    'Déduite du bruit et de la cadence, pour que la pente d’accélération soit ' +
    `sûre à ${SLOPE_TARGET_MS2.toFixed(1)} m/s² près. Plus le GPS parle et moins ` +
    'il bruite, plus la fenêtre peut être courte — donc réactive.'

  const source = quietestStep(ordinary)
  const noise = source?.measure.noiseKmh ?? null
  if (!source || noise === null) {
    return line(path, profile, note, {
      missing:
        'Le bruit du GPS n’a pas pu être chiffré : sans lui, aucune fenêtre ne se ' +
        'déduit.',
    })
  }

  const target = SLOPE_TARGET_MS2 * 3.6
  const gapS = source.measure.cadenceMs / 1000
  const windowS = Math.cbrt((12 * noise * noise * gapS) / (target * target))
  const windowMs = Math.min(
    WINDOW_MAX_MS,
    Math.max(WINDOW_MIN_MS, snap(windowS * 1000, WINDOW_STEP_MS)),
  )

  return line(path, profile, note, { value: windowMs, proposal: windowMs })
}

/**
 * L'étape de conduite ordinaire la plus rapide parmi celles enregistrées.
 *
 * Autoroute d'abord, puis route, puis ville : le bruit d'un GPS se sépare
 * d'autant mieux du mouvement que la conduite est régulière, et un trajet de
 * ville n'est qu'une suite d'accélérations et d'arrêts.
 */
function quietestStep(ordinary: StepAnalysis[]): StepAnalysis | undefined {
  for (const id of ['highway', 'road', 'city'] as const) {
    const found = ordinary.find((analysis) => analysis.step === id)
    if (found) return found
  }
  return undefined
}

/** Les paliers de plusieurs étapes, pondérés par leur durée. */
function heldSpeeds(ordinary: StepAnalysis[]): { value: number; weight: number }[] {
  return ordinary.flatMap((analysis) =>
    analysis.measure.plateaus.map((plateau) => ({
      value: plateau.kmh,
      weight: plateau.durationS,
    })),
  )
}

function validValues(
  analyses: StepAnalysis[],
  pick: (measure: StepAnalysis['measure']) => number | null,
): number[] {
  return analyses
    .filter((analysis) => analysis.valid)
    .map((analysis) => pick(analysis.measure))
    .filter((value): value is number => value !== null)
}

type Outcome =
  | {
      value: number | number[]
      proposal: number | number[]
      write?: number | number[]
      conversion?: string
      current?: number | number[]
    }
  | { missing: string; current?: number | number[] }

/**
 * Une ligne du récapitulatif adossée à un réglage.
 *
 * La valeur réglée est lue ici, à un seul endroit : c'est ce qui garantit que la
 * colonne « réglé » montre bien le profil actif et non une copie devenue vieille.
 */
function line(
  path: SettingPath,
  profile: Profile,
  note: string,
  outcome: Outcome,
): Suggestion {
  const { label, unit, decimals } = SETTING_LABELS[path]
  const current = outcome.current ?? readSetting(profile, path)

  if ('missing' in outcome) {
    return { key: path, label, measured: null, missing: outcome.missing, setting: null, note }
  }

  const proposed = roundAny(outcome.proposal, decimals)
  return {
    key: path,
    label,
    measured: { value: outcome.value, unit, decimals },
    missing: null,
    setting: {
      path,
      label,
      unit,
      decimals,
      current,
      proposed,
      write: outcome.write ?? proposed,
      conversion: outcome.conversion ?? '',
    },
    note,
  }
}

/** Une ligne purement informative : mesurée, mais qui ne se recopie pas. */
function report(
  key: string,
  label: string,
  note: string,
  measured: { value: number; unit: string; decimals: number } | null,
  missing: string | null = null,
): Suggestion {
  return { key, label, measured, missing, setting: null, note }
}

/**
 * Pourquoi une étape ne rend rien : pas faite, ou refusée.
 *
 * Les deux se disent, et se distinguent. « Non mesuré » et « mesuré mais
 * refusé » ne demandent pas la même chose à qui lit : refaire l'étape, ou la
 * refaire *mieux*.
 */
function whyMissing(analysis: StepAnalysis | undefined, stepName: string): string | null {
  if (!analysis) return `Étape non enregistrée : ${stepName}.`
  if (!analysis.valid) return `Étape refusée — ${analysis.reason}`
  return null
}

/** Arrondi à un nombre de décimales, pour ne pas proposer douze chiffres. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function roundAny(value: number | number[], decimals: number): number | number[] {
  return Array.isArray(value)
    ? value.map((entry) => round(entry, decimals))
    : round(value, decimals)
}

/** Arrondi au pas donné, vers l'extérieur : une borne ne doit pas serrer. */
function snap(value: number, step: number): number {
  const steps = Math.abs(value) / step
  return Math.sign(value) * Math.ceil(steps) * step
}
