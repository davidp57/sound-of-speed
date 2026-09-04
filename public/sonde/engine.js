/* global fetch */

/**
 * Le cœur d'engine-sim, compilé en WebAssembly, derrière le contrat de la page.
 *
 * Le binaire est produit par `native/build-wasm.sh` à partir de sources
 * rapatriées et corrigées par `native/prepare.mjs` — dix correctifs de
 * portabilité sur une révision figée. Il n'y a donc rien à compiler pour servir
 * cette page : `probe.mjs` et `probe.wasm` sont déposés ici tels quels.
 *
 * Les trois opérations sont **synchrones et bloquantes**, comme la page
 * l'attend : c'est elle qui chronomètre, et une promesse fausserait la mesure.
 *
 * Ce qui les sépare :
 *
 * - `simulate` avance la physique sans jamais lire la sortie, donc rien n'est
 *   convolué ;
 * - `synthesize` écrit dans l'entrée du synthétiseur un signal fabriqué et tire
 *   la sortie, sans faire tourner le moteur : c'est la convolution seule ;
 * - `run` fait les deux, comme la chaîne tournerait pour de vrai.
 *
 * La séparation n'est pas de la curiosité. Mesuré sur un poste de bureau, la
 * convolution longue coûte la moitié du budget — la chaîne complète tient à 1,76
 * fois le temps réel, contre 3,17 sans elle. Savoir ce qu'elle pèse ici décide
 * s'il faut la déporter sur un `ConvolverNode` de Web Audio, que le navigateur
 * calcule nativement.
 */

const MODULE_URL = './probe.mjs'
const WASM_URL = './probe.wasm'

/** Longueur de la réponse impulsionnelle, en échantillons. */
const IMPULSE_SAMPLES = 10000

/**
 * Huit cylindres : c'est le moteur visé, et il coûte le double d'un quatre.
 * Mesurer l'autre reviendrait à décider sur un moteur qu'on ne veut pas.
 */
const CYLINDERS = 8

let modulePromise = null

/** Charge le module une seule fois, quel que soit le nombre de bancs créés. */
function loadModule() {
  if (modulePromise === null) {
    modulePromise = import(MODULE_URL).then((m) => m.default({ noInitialRun: true }))
  }
  return modulePromise
}

/** Poids du binaire, pour que la page puisse le rapporter sans le deviner. */
async function wasmSize() {
  try {
    const response = await fetch(WASM_URL, { method: 'HEAD' })
    const length = response.headers.get('content-length')
    return length ? Number(length) : 0
  } catch {
    return 0
  }
}

export async function createBench({ sampleRate }) {
  const module = await loadModule()
  const bytes = await wasmSize()

  const create = module.cwrap('bench_create', 'number', ['number', 'number', 'number'])
  const dispose = module.cwrap('bench_dispose', null, [])
  const simulate = module.cwrap('bench_simulate', null, ['number'])
  const synthesize = module.cwrap('bench_synthesize', null, ['number'])
  const run = module.cwrap('bench_run', null, ['number'])
  const rpm = module.cwrap('bench_rpm', 'number', [])

  // Un seul banc à la fois : le moteur et son simulateur sont un état global du
  // binaire. La page en crée un par mesure et le libère aussitôt, ce qui suffit.
  dispose()
  if (create(sampleRate, IMPULSE_SAMPLES, CYLINDERS) !== 1) {
    throw new Error('le banc n’a pas pu être construit')
  }

  return {
    label: `engine-sim, V8 croisé, ${Math.round(sampleRate / 1000)} kHz`,
    wasmBytes: bytes,
    impulseSamples: IMPULSE_SAMPLES,
    simulate,
    synthesize,
    run,
    rpm,
    dispose,
  }
}
