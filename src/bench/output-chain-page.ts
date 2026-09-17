/**
 * La page du banc : les états mesurés, les configurations comparées, le tableau.
 *
 * Elle vit hors de l'application — aucune entrée du build de production ne la
 * référence — et ne s'ouvre qu'au serveur de développement, sur
 * `/banc/sortie.html`.
 */

import type { EngineState } from '../core/engine/engine'
import type { Profile } from '../core/preset/schema'
import { createRoadProfile } from '../core/preset/defaults'
import {
  BENCH_SAMPLE_RATE,
  loadLayers,
  renderBuffer,
  renderPoint,
  type BenchConfig,
  type BenchLayer,
  type BenchPoint,
  type BenchState,
} from './output-chain-bench'
import { clip, concat, normalize, rmsOf, toWav } from './wav'

/**
 * Deux états, même régime, seul l'effort change.
 *
 * Garder le régime fixe isole ce qu'on cherche : le relief de **charge**. Le
 * relief de régime, lui, se lit en comparant les deux régimes de la troisième
 * et de la quatrième ligne, à effort égal.
 */
function engineState(rpm: number, effort: number): EngineState {
  return {
    rpm,
    audibleRpm: rpm,
    kinematicRpm: rpm,
    load: effort,
    effort,
    rpmFraction: rpm / 6500,
    firingHz: (rpm / 60) * 4,
    limiterActive: false,
    idling: false,
  }
}

const STATES: BenchState[] = [
  { label: 'croisière, 1800 tr/min', state: engineState(1800, 0.35) },
  { label: 'accélération franche, 1800 tr/min', state: engineState(1800, 1) },
  { label: 'croisière, 2600 tr/min', state: engineState(2600, 0.35) },
  { label: 'accélération franche, 2600 tr/min', state: engineState(2600, 1) },
]

/** Le volume général livré, et celui d'un appareil qui n'y a jamais touché. */
const DEFAULT_VOLUME = 0.7

/**
 * Les configurations comparées, pour attribuer ce qui est perdu.
 *
 * Les quatre premières retirent un étage à la fois : l'écart entre deux lignes
 * dit ce que cet étage écrase. Sans cette séparation, on saurait que le relief
 * disparaît sans savoir qui l'écrase, et l'on corrigerait au hasard. Les trois
 * dernières font varier le seul réglage que l'utilisateur touche.
 */
const CONFIGS: BenchConfig[] = [
  { label: 'chaîne complète', bypassShaper: false, bypassLimiter: false, volume: DEFAULT_VOLUME },
  { label: 'sans saturateur', bypassShaper: true, bypassLimiter: false, volume: DEFAULT_VOLUME },
  { label: 'sans limiteur', bypassShaper: false, bypassLimiter: true, volume: DEFAULT_VOLUME },
  { label: 'ni l’un ni l’autre', bypassShaper: true, bypassLimiter: true, volume: DEFAULT_VOLUME },
  {
    label: 'rattrapage neutre',
    bypassShaper: false,
    bypassLimiter: false,
    volume: DEFAULT_VOLUME,
    makeup: 1,
  },
  { label: 'volume 1,0', bypassShaper: false, bypassLimiter: false, volume: 1 },
  { label: 'volume 0,5', bypassShaper: false, bypassLimiter: false, volume: 0.5 },
  { label: 'volume 0,25', bypassShaper: false, bypassLimiter: false, volume: 0.25 },
  // L'ordre d'avant le 17 septembre 2026, gardé comme ligne de comparaison : le
  // limiteur passait avant le rattrapage, donc rien ne rattrapait ce que le
  // rattrapage faisait dépasser. C'est cette ligne qui dit ce que le
  // déplacement a changé, et à quel prix sur le niveau.
  {
    label: 'limiteur avant le rattrapage (ordre d’avant)',
    bypassShaper: false,
    bypassLimiter: false,
    volume: DEFAULT_VOLUME,
    limiterBeforeMakeup: true,
  },
  // Ce qui resterait à prendre si le limiteur en dernier ne suffisait pas : au
  // lieu de rattraper l'écrêtage, ne pas le produire. Le rattrapage descend de
  // 1,8 à 1,25 — juste ce qu'il faut pour que la crête repasse sous la pleine
  // échelle en accélération franche. David a pris le déplacement seul le
  // 17 septembre 2026 ; ces deux lignes disent ce que le cran de plus donnerait.
  {
    label: 'rattrapage 1,25',
    bypassShaper: false,
    bypassLimiter: false,
    volume: DEFAULT_VOLUME,
    makeup: 1.25,
  },
  {
    label: 'rattrapage 1,25, volume 1,0',
    bypassShaper: false,
    bypassLimiter: false,
    volume: 1,
    makeup: 1.25,
  },
  // La comparaison qui compte, à fond : l'ordre d'avant y rognait un
  // échantillon sur onze.
  {
    label: 'limiteur avant le rattrapage, volume 1,0',
    bypassShaper: false,
    bypassLimiter: false,
    volume: 1,
    limiterBeforeMakeup: true,
  },
  // Très en dessous du seuil, un limiteur ne doit rien faire du tout : ces deux
  // lignes doivent donc donner le même niveau. Si elles diffèrent, c'est que le
  // nœud applique un gain qui n'a pas été demandé, et le reste du tableau se lit
  // autrement.
  { label: 'volume 0,05', bypassShaper: true, bypassLimiter: false, volume: 0.05, makeup: 1 },
  {
    label: 'volume 0,05, sans limiteur',
    bypassShaper: true,
    bypassLimiter: true,
    volume: 0.05,
    makeup: 1,
  },
]

const output = document.querySelector('#resultat') as HTMLElement
const status = document.querySelector('#etat') as HTMLElement

function line(text: string): void {
  status.textContent = text
}

/**
 * Rend le tableau : une ligne par configuration, une colonne par état.
 *
 * Chaque case donne le niveau **entendu** — celui d'après écrêtage —, la crête
 * avant écrêtage, et la part rognée quand il y en a une. Les deux colonnes
 * d'écart séparent ce que le calcul produit de ce qui reste une fois la sortie
 * rognée : c'est là que se lit ce que la chaîne coûte au relief.
 */
function render(points: BenchPoint[]): void {
  const head = [
    'configuration',
    ...STATES.map((s) => s.label),
    'écart avant écrêtage',
    'écart entendu',
  ]
  const rows = CONFIGS.map((config) => {
    const cells = STATES.map((state) => {
      const point = points.find((p) => p.config === config.label && p.state === state.label)
      if (!point) return '—'
      const trimmed = point.clippedRatio > 0 ? `, ${point.clippedRatio.toFixed(2)} % rogné` : ''
      const reduction =
        point.limiterReductionDb < -0.05 ? `, limiteur ${point.limiterReductionDb.toFixed(1)}` : ''
      const distortion = Number.isFinite(point.clipErrorDb)
        ? `, distorsion ${point.clipErrorDb.toFixed(0)}`
        : ''
      return `${point.clippedRmsDb.toFixed(1)} dB (crête ${point.peakDb.toFixed(1)}${trimmed}${distortion}${reduction})`
    })
    const cruise = points.find((p) => p.config === config.label && p.state === STATES[0]?.label)
    const full = points.find((p) => p.config === config.label && p.state === STATES[1]?.label)
    const raw = cruise && full ? `${(full.rmsDb - cruise.rmsDb).toFixed(2)} dB` : '—'
    const heard = cruise && full ? `${(full.clippedRmsDb - cruise.clippedRmsDb).toFixed(2)} dB` : '—'
    return [config.label, ...cells, raw, heard]
  })

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of head) {
    const th = document.createElement('th')
    th.textContent = label
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    row.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td')
      cell.textContent = value
      tr.append(cell)
    })
    tbody.append(tr)
  }
  table.append(thead, tbody)
  output.replaceChildren(table)
}


/** Durée de chaque moitié de l'extrait comparatif, en secondes. */
const EXTRAIT_S = 4

/**
 * Produit l'extrait qui répond à « est-ce que ça s'entend ? ».
 *
 * Les deux versions s'enchaînent dans un même fichier, **mises au même niveau
 * efficace** : sans cela on comparerait le plus fort au plus faible, et le plus
 * fort paraîtrait toujours meilleur. Le niveau se juge sur le tableau, la
 * distorsion s'entend ici.
 *
 * Chaque moitié est rognée à la pleine échelle avant d'être mise à niveau —
 * c'est ce que fait le convertisseur, et c'est là que naît la distorsion qu'on
 * veut faire entendre.
 */
async function buildExtract(profile: Profile, layers: BenchLayer[]): Promise<Blob> {
  const state = STATES[1] as BenchState
  const current = await renderBuffer(
    profile,
    layers,
    state,
    {
      label: 'ordre d’avant',
      bypassShaper: false,
      bypassLimiter: false,
      volume: DEFAULT_VOLUME,
      limiterBeforeMakeup: true,
    },
    EXTRAIT_S,
  )
  const fixed = await renderBuffer(
    profile,
    layers,
    state,
    { label: 'ordre livré', bypassShaper: false, bypassLimiter: false, volume: DEFAULT_VOLUME },
    EXTRAIT_S,
  )

  const a = clip(current.buffer)
  const b = clip(fixed.buffer)
  const target = Math.min(rmsOf(a), rmsOf(b))
  normalize(a, target)
  normalize(b, target)
  return toWav(concat([a, b], 0.4, BENCH_SAMPLE_RATE), BENCH_SAMPLE_RATE)
}

/** Range l'extrait dans un lien de téléchargement, sans jamais le faire jouer. */
function offerExtract(blob: Blob): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'chaine-de-sortie-avant-apres.wav'
  link.textContent =
    'Télécharger l’extrait : 4 s dans l’ordre d’avant, puis 4 s telle qu’elle sort aujourd’hui, au même niveau'
  const holder = document.querySelector('#extrait')
  holder?.replaceChildren(link)
}

async function run(): Promise<void> {
  const profile = createRoadProfile()
  line(`Profil « ${profile.name} », banque ${profile.sampleDir} : chargement des couches…`)

  let layers: BenchLayer[]
  try {
    layers = await loadLayers(profile)
  } catch (error) {
    line(`Chargement impossible : ${error instanceof Error ? error.message : String(error)}`)
    return
  }
  if (layers.length === 0) {
    line('Aucune couche active dans ce profil : rien à mesurer.')
    return
  }

  const points: BenchPoint[] = []
  const total = CONFIGS.length * STATES.length
  for (const config of CONFIGS) {
    for (const state of STATES) {
      line(`Rendu ${points.length + 1} sur ${total} — ${config.label}, ${state.label}`)
      points.push(await renderPoint(profile, layers, state, config))
      render(points)
    }
  }

  line(`${total} rendus faits — production de l’extrait à écouter…`)
  offerExtract(await buildExtract(profile, layers))

  line(
    `${total} rendus, ${layers.length} couches, seuil du limiteur ${profile.mix.limiterThresholdDb} dB, ` +
      `saturation ${profile.mix.drive}, passe-haut ${profile.mix.highpassHz} Hz. Aucun son n’est sorti.`,
  )
}

void run()
