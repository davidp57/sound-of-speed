/*
 * Sonde engine-sim — mesure et affichage.
 *
 * La question à laquelle cette page répond est écrite dans
 * `.backlog/SYNTHESE/tickets/01-la-sonde.md` : combien de secondes de son le
 * cœur d'engine-sim produit-il par seconde de calcul, dans le navigateur de la
 * Tesla ? Au-dessus de ×3, on porte engine-sim ; en dessous, on écrit la
 * synthèse maison.
 *
 * ---------------------------------------------------------------------------
 * Contrat du module de mesure
 * ---------------------------------------------------------------------------
 *
 * La page ne connaît d'engine-sim que ces quelques appels. Le module
 * WebAssembly doit être un module ES posé en `./engine.js`, à côté de ce
 * fichier, exportant :
 *
 *     export async function createBench({ sampleRate }) → Bench
 *
 * `sampleRate` est la fréquence d'échantillonnage de la synthèse, en hertz.
 * La page en crée deux : un banc à 10 000 Hz et un banc à 20 000 Hz.
 *
 * Un `Bench` expose :
 *
 *   label            chaîne affichée telle quelle, par exemple
 *                    « engine-sim, V8, 20 kHz »
 *   wasmBytes        poids du binaire chargé, en octets ; 0 si inconnu, la page
 *                    le cherche alors dans le relevé des ressources
 *   impulseSamples   longueur de la réponse impulsionnelle, en échantillons
 *   simulate(s)      avance la physique de `s` secondes de temps simulé, sans
 *                    produire le moindre échantillon
 *   synthesize(s)    produit `s` secondes de son à partir d'un état figé, sans
 *                    avancer la physique
 *   run(s)           la chaîne complète : physique et synthèse, `s` secondes
 *   dispose()        libère ce que le banc tient
 *
 * Les trois appels de calcul sont **synchrones et bloquants** : la page
 * chronomètre autour d'eux, et un appel qui rendrait la main avant d'avoir fini
 * rendrait la mesure fausse. Ils ne retournent rien, n'écrivent rien, ne jouent
 * rien. Aucun ne doit toucher au contexte audio : la sonde mesure du temps de
 * calcul, pas un rendu sonore.
 *
 * Tant que `./engine.js` n'existe pas, la page charge `./bouchon.js`, qui tient
 * le même contrat en brûlant du temps processeur. Rien à modifier ici quand le
 * vrai module arrivera.
 */

/*
 * Les fichiers de `public/` sont servis tels quels, hors chaîne de
 * construction : ESLint les analyse sans savoir qu'ils tournent dans un
 * navigateur. On lui nomme donc les objets globaux utilisés, plutôt que
 * d'exclure le fichier de la vérification — elle a déjà servi ici.
 */
/* global document, window, navigator, performance, setTimeout, fetch */

/** Seuil de décision du lot, fixé avant la mesure. */
const THRESHOLD = 3

/** Durée de son mesurée pour chaque relevé, en secondes. */
const TARGET_SECONDS = 2

/**
 * Durée jetée avant chaque relevé.
 *
 * Le premier appel paie la compilation du code WebAssembly et le remplissage
 * des caches. Le compter donnerait un facteur plus mauvais que la réalité, et
 * d'autant plus mauvais que la mesure serait courte.
 */
const WARMUP_SECONDS = 0.25

/**
 * Taille d'une tranche de calcul, en secondes de son.
 *
 * On rend la main au navigateur entre deux tranches, sinon la page reste figée
 * plusieurs secondes et paraît plantée — sur l'écran de la voiture, sans
 * console, c'est indiscernable d'un vrai plantage. Seul le temps passé dans les
 * appels est compté : les pauses n'entrent pas dans le facteur.
 */
const SLICE_SECONDS = 0.1

const LOW_RATE_HZ = 10000
const HIGH_RATE_HZ = 20000

/**
 * Les quatre relevés, dans l'ordre où ils sont faits.
 *
 * Un seul chiffre ne dirait pas où passe le temps : la mesure en natif attribue
 * les deux tiers du coût à la convolution, que Web Audio saurait prendre à sa
 * charge. Séparer la physique de la synthèse est ce qui permettra de décider
 * quoi déporter.
 */
const MEASUREMENTS = [
  {
    id: 'simulation',
    label: 'Simulation seule',
    note: 'corps rigides, dynamique des gaz',
    rate: LOW_RATE_HZ,
    method: 'simulate',
  },
  {
    id: 'synthese',
    label: 'Synthèse seule',
    note: 'réponse impulsionnelle de 10 000 échantillons',
    rate: LOW_RATE_HZ,
    method: 'synthesize',
  },
  {
    id: 'chaine-10k',
    label: 'Chaîne complète, 10 kHz',
    note: 'la fréquence la plus basse envisagée',
    rate: LOW_RATE_HZ,
    method: 'run',
    decides: true,
  },
  {
    id: 'chaine-20k',
    label: 'Chaîne complète, 20 kHz',
    note: 'la fréquence du moteur livré',
    rate: HIGH_RATE_HZ,
    method: 'run',
  },
]

const elements = {
  source: document.getElementById('source'),
  start: document.getElementById('start'),
  progress: document.getElementById('progress'),
  results: document.getElementById('results'),
  verdict: document.getElementById('verdict'),
  verdictDetail: document.getElementById('verdict-detail'),
  environment: document.getElementById('environment'),
  copy: document.getElementById('copy'),
  deposit: document.getElementById('deposit'),
  depositNote: document.getElementById('deposit-note'),
  copyStatus: document.getElementById('copy-status'),
  report: document.getElementById('report'),
}

/** Module chargé, et d'où il vient. */
let engineModule = null
let usingStub = true

/** Résultats du dernier passage, dans l'ordre de `MEASUREMENTS`. */
let results = []

/** Ce que le premier banc créé a déclaré sur lui-même. */
let benchInfo = { label: '', wasmBytes: 0, impulseSamples: 0 }

// --- Chargement du module ---------------------------------------------------

/**
 * Charge le vrai module s'il est là, le bouchon sinon.
 *
 * On ne se contente pas d'un import réussi : un serveur qui répond la page de
 * l'application à la place d'un fichier absent produit un import qui n'échoue
 * pas franchement. Vérifier la forme de ce qu'on a reçu est le seul test qui
 * tienne dans les deux cas.
 */
async function loadModule() {
  try {
    const candidate = await import('./engine.js')
    if (typeof candidate.createBench === 'function') {
      engineModule = candidate
      usingStub = false
      return
    }
  } catch {
    // Absent ou illisible : c'est le cas normal tant que la compilation n'a pas
    // eu lieu, et il ne mérite pas d'être signalé autrement que par la bannière.
  }

  engineModule = await import('./bouchon.js')
  usingStub = true
}

// --- Mesure -----------------------------------------------------------------

/** Rend la main au navigateur, le temps qu'il repeigne. */
function breathe() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Chronomètre un appel de calcul sur `seconds` secondes de son.
 *
 * @returns {{ audioSeconds: number, computeMs: number, factor: number }}
 */
async function measure(bench, method, seconds) {
  let audioSeconds = 0
  let computeMs = 0

  while (audioSeconds < seconds - 1e-9) {
    const slice = Math.min(SLICE_SECONDS, seconds - audioSeconds)
    const start = performance.now()
    bench[method](slice)
    computeMs += performance.now() - start
    audioSeconds += slice
    await breathe()
  }

  return {
    audioSeconds,
    computeMs,
    factor: computeMs > 0 ? (audioSeconds * 1000) / computeMs : Number.POSITIVE_INFINITY,
  }
}

async function runAll() {
  elements.start.disabled = true
  results = []
  benchInfo = { label: '', wasmBytes: 0, impulseSamples: 0 }
  render()

  const benches = new Map()

  try {
    for (const measurement of MEASUREMENTS) {
      elements.progress.textContent = `${measurement.label}…`
      await breathe()

      let bench = benches.get(measurement.rate)
      if (!bench) {
        bench = await engineModule.createBench({ sampleRate: measurement.rate })
        benches.set(measurement.rate, bench)
        // Le premier banc décrit le module ; les suivants ne diffèrent que par
        // leur fréquence, déjà écrite dans le nom du relevé.
        if (benches.size === 1) {
          benchInfo = {
            label: bench.label || '',
            wasmBytes: bench.wasmBytes || 0,
            impulseSamples: bench.impulseSamples || 0,
          }
        }
      }

      await measure(bench, measurement.method, WARMUP_SECONDS)
      const measured = await measure(bench, measurement.method, TARGET_SECONDS)

      results.push({ ...measurement, ...measured })
      render()
    }

    elements.progress.textContent = 'Mesure terminée.'
  } catch (error) {
    elements.progress.textContent = `Échec : ${error && error.message ? error.message : error}`
  } finally {
    for (const bench of benches.values()) bench.dispose()
    elements.start.disabled = false
    render()
  }
}

// --- Contexte d'exécution ---------------------------------------------------

/**
 * Poids du binaire WebAssembly, en octets, ou 0.
 *
 * Le module l'annonce quand il le connaît. Sinon on interroge le relevé des
 * ressources chargées : c'est la seule autre source, et elle rend zéro derrière
 * un cache qui ne renvoie pas la taille.
 */
function wasmBytes() {
  if (benchInfo.wasmBytes > 0) return benchInfo.wasmBytes

  const entries = performance.getEntriesByType ? performance.getEntriesByType('resource') : []
  for (const entry of entries) {
    if (!entry.name.endsWith('.wasm')) continue
    const size = entry.encodedBodySize || entry.transferSize || 0
    if (size > 0) return size
  }
  return 0
}

/**
 * Ce qu'on saura de la machine trois semaines plus tard.
 *
 * Rien de tout cela ne se déduit : le navigateur de la voiture n'a ni console
 * ni outils, son zoom n'est pas réglable et sa valeur par défaut a déjà changé
 * avec le logiciel de bord. Un facteur sans son contexte ne se relit pas.
 */
function environment() {
  const root = document.documentElement
  const memory = navigator.deviceMemory
  const bytes = wasmBytes()

  return [
    ['Relevé le', new Date().toLocaleString('fr-FR')],
    ['Module', usingStub ? 'bouchon (aucune mesure réelle)' : 'engine.js'],
    ['Banc', benchInfo.label || '—'],
    ['Poids du .wasm', bytes > 0 ? `${(bytes / 1024).toFixed(0)} ko` : '—'],
    [
      'Réponse impulsionnelle',
      benchInfo.impulseSamples > 0 ? `${benchInfo.impulseSamples} échantillons` : '—',
    ],
    ['Navigateur', navigator.userAgent],
    ['Page', `${root.clientWidth} × ${root.clientHeight} px`],
    ['Écran annoncé', `${window.screen.width} × ${window.screen.height} px`],
    ['Densité', String(window.devicePixelRatio)],
    ['Cœurs annoncés', navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : '—'],
    ['Mémoire annoncée', memory ? `${memory} Go` : 'non annoncée'],
  ]
}

// --- Verdict ----------------------------------------------------------------

/** Le relevé qui tranche : la chaîne complète à la fréquence la plus basse. */
function decisive() {
  return results.find((r) => r.decides)
}

function verdictText() {
  const result = decisive()
  if (!result) return { headline: 'Pas encore mesuré.', tone: 'muted', detail: '' }

  const factor = result.factor
  const shown = `×${factor.toFixed(2)}`

  if (factor >= THRESHOLD) {
    return {
      headline: `Au-dessus du seuil : ${shown}`,
      tone: 'good',
      detail: `${result.label} passe les ×${THRESHOLD} attendus.`,
    }
  }
  if (factor < 1) {
    return {
      headline: `En dessous du temps réel : ${shown}`,
      tone: 'warn',
      detail:
        'Le calcul est plus lent que le son qu’il produit. Le portage est hors de question.',
    }
  }
  return {
    headline: `Entre ×1 et ×${THRESHOLD} : ${shown}`,
    tone: 'warn',
    detail:
      'Le temps réel est tenu, mais sans la marge que demandent l’écran, le GPS et le service worker.',
  }
}

// --- Affichage --------------------------------------------------------------

function factorClass(result) {
  if (result.method !== 'run') return ''
  return result.factor >= THRESHOLD ? 'good' : 'warn'
}

function renderSource() {
  if (usingStub) {
    elements.source.innerHTML = ''
    const banner = document.createElement('section')
    banner.className = 'banner'
    banner.textContent =
      'Bouchon en place : le module WebAssembly n’est pas encore là. Les chiffres ci-dessous ne mesurent qu’une boucle de calcul, pas engine-sim.'
    elements.source.appendChild(banner)
    return
  }
  elements.source.innerHTML = ''
}

function renderResults() {
  elements.results.innerHTML = ''

  for (const measurement of MEASUREMENTS) {
    const result = results.find((r) => r.id === measurement.id)
    const row = document.createElement('tr')

    const label = document.createElement('td')
    label.textContent = measurement.label
    const note = document.createElement('span')
    note.className = 'note'
    note.textContent = measurement.note
    label.appendChild(note)

    const audio = document.createElement('td')
    audio.className = 'numeric'
    audio.textContent = result ? `${result.audioSeconds.toFixed(2)} s` : '—'

    const compute = document.createElement('td')
    compute.className = 'numeric'
    compute.textContent = result ? `${(result.computeMs / 1000).toFixed(3)} s` : '—'

    const factor = document.createElement('td')
    factor.className = `numeric factor ${result ? factorClass(result) : 'muted'}`
    factor.textContent = result ? `×${result.factor.toFixed(2)}` : '—'

    row.append(label, audio, compute, factor)
    elements.results.appendChild(row)
  }
}

function renderVerdict() {
  const { headline, tone, detail } = verdictText()
  elements.verdict.textContent = headline
  elements.verdict.className = `verdict ${tone}`
  elements.verdictDetail.textContent = detail
}

function renderEnvironment() {
  elements.environment.innerHTML = ''
  for (const [key, value] of environment()) {
    const term = document.createElement('dt')
    term.textContent = key
    const description = document.createElement('dd')
    description.textContent = value
    elements.environment.append(term, description)
  }
}

/** Le relevé en texte, tel qu'il sera recopié dans le ticket 02. */
function reportText() {
  const lines = ['Sonde engine-sim — Speed']

  if (usingStub) {
    lines.push('ATTENTION : bouchon, ces chiffres ne mesurent pas engine-sim.')
  }

  lines.push('')
  for (const [key, value] of environment()) lines.push(`${key} : ${value}`)

  lines.push('', 'Relevés (son mesuré / calcul / facteur)')
  for (const measurement of MEASUREMENTS) {
    const result = results.find((r) => r.id === measurement.id)
    if (!result) {
      lines.push(`  ${measurement.label} : non mesuré`)
      continue
    }
    lines.push(
      `  ${measurement.label} : ${result.audioSeconds.toFixed(2)} s / ` +
        `${(result.computeMs / 1000).toFixed(3)} s / ×${result.factor.toFixed(2)}`,
    )
  }

  const { headline } = verdictText()
  lines.push('', `Seuil : ×${THRESHOLD}`, `Verdict : ${headline}`)

  return lines.join('\n')
}

function render() {
  renderSource()
  renderResults()
  renderVerdict()
  renderEnvironment()
  elements.report.value = reportText()
}

// --- Recopie ----------------------------------------------------------------

/**
 * Met le relevé dans le presse-papiers.
 *
 * Deux chemins, parce que le premier manque là où il servirait : l'API moderne
 * exige un contexte sécurisé et une autorisation que le navigateur de bord peut
 * refuser sans rien afficher. La sélection du champ reste le filet — et elle
 * fonctionne même quand les deux échouent.
 */
async function copyReport() {
  const text = elements.report.value

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      elements.copyStatus.textContent = 'Copié.'
      return
    }
  } catch {
    // On tente la voie ancienne plutôt que d'abandonner.
  }

  elements.report.focus()
  elements.report.select()
  let copied
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  elements.copyStatus.textContent = copied
    ? 'Copié.'
    : 'Copie refusée : le texte est sélectionné, copiez-le à la main.'
}

// --- Dépôt sur le serveur ---------------------------------------------------

/*
 * Le relevé se prend dans la voiture, et c'est là qu'il ne sort pas : le
 * navigateur de bord ne télécharge rien, et son presse-papiers ne mène nulle
 * part. Le dépôt est donc la seule voie réelle — le bouton de copie reste, il
 * est plus court sur un poste.
 *
 * La sonde est servie par le même serveur que l'application : le compte de
 * dépôt saisi là-bas est lisible ici, et il n'y a rien à redemander. C'est la
 * seule chose que cette page emprunte à l'application, et elle reste autonome.
 */

/** Dossier servi en écriture pour les relevés. Voir `docker/nginx.conf`. */
const DEPOSIT_FOLDER = '/mesures/'

/**
 * Le relevé en JSON, qui se relit par une machine.
 *
 * Le texte affiché part aussi, tel quel : c'est lui qu'on recopie dans un
 * ticket, et le regénérer ailleurs le ferait diverger de ce qu'on a lu à
 * l'écran.
 */
function reportPayload() {
  return {
    tool: 'sonde engine-sim',
    at: new Date().toISOString(),
    stub: usingStub,
    threshold: THRESHOLD,
    verdict: verdictText().headline,
    environment: Object.fromEntries(environment()),
    measurements: MEASUREMENTS.map((measurement) => {
      const result = results.find((r) => r.id === measurement.id)
      return {
        id: measurement.id,
        label: measurement.label,
        audioSeconds: result ? result.audioSeconds : null,
        computeMs: result ? result.computeMs : null,
        factor: result ? result.factor : null,
      }
    }),
    text: reportText(),
  }
}

/** Nom du fichier : quand, et sur quoi. Un relevé sans son contexte ne se relit pas. */
function depositName() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'poste'
  return `${stamp}_sonde_${usingStub ? 'bouchon' : mobile}.json`
}

/**
 * Dépose le relevé sous le compte de cet appareil.
 *
 * **Il n'y a rien à lire ni à composer.** Cette page est servie par le même
 * serveur que l'application, donc le témoin de connexion part avec la requête
 * tout seul. Elle lisait auparavant le compte de dépôt dans le stockage du
 * navigateur et fabriquait son propre en-tête ; ce compte n'existe plus.
 *
 * Si l'application n'a jamais été ouverte sur cet appareil, il n'y a pas encore
 * de compte, et le serveur refuse — c'est ce que dit alors le message.
 */
async function depositReport() {
  const name = depositName()
  elements.deposit.disabled = true
  elements.depositNote.textContent = 'Dépôt en cours…'
  try {
    const response = await fetch(DEPOSIT_FOLDER + encodeURIComponent(name), {
      method: 'PUT',
      body: JSON.stringify(reportPayload(), null, 2),
    })
    if (response.ok) {
      elements.depositNote.textContent = `Déposé : ${name}`
    } else if (response.status === 401 || response.status === 403) {
      elements.depositNote.textContent =
        response.status === 401
          ? "Refusé : cet appareil n'a pas de compte. Ouvrez l'application sur ce serveur une fois, puis revenez."
          : "Le serveur reconnaît cet appareil mais lui refuse l'écriture ici."
    } else {
      elements.depositNote.textContent = `Le serveur a répondu ${response.status}.`
    }
  } catch (error) {
    elements.depositNote.textContent =
      error && error.message
        ? `Dépôt impossible : ${error.message}`
        : 'Dépôt impossible : le serveur est injoignable.'
  } finally {
    elements.deposit.disabled = false
  }
}

// --- Démarrage --------------------------------------------------------------

elements.start.addEventListener('click', () => void runAll())
elements.copy.addEventListener('click', () => void copyReport())
elements.deposit.addEventListener('click', () => void depositReport())

// Pas d'`await` au premier niveau : il demande un navigateur plus récent que ce
// que la voiture peut embarquer, et il ferait échouer le module entier.
void (async () => {
  await loadModule()
  render()
})()
