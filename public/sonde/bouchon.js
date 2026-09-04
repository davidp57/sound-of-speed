/*
 * Bouchon — à remplacer par le vrai module WebAssembly.
 *
 * Le binaire d'engine-sim n'existe pas encore. Sans ce fichier, la page ne
 * serait vérifiable qu'une fois la compilation terminée, et l'on découvrirait
 * ses défauts au pire moment : dans la voiture, sans outils.
 *
 * Il tient exactement le même contrat que le vrai module (décrit dans
 * `sonde.js`), et il brûle du temps processeur au lieu de simuler quoi que ce
 * soit. Les chiffres qu'il produit ne mesurent donc rien d'autre que
 * lui-même — la page l'annonce en clair, pour qu'un relevé de bouchon ne soit
 * jamais confondu avec un relevé réel.
 *
 * Quand `engine.js` sera là, la page le chargera à la place de ce fichier sans
 * qu'aucune ligne ne change : elle essaie le vrai module d'abord, et ne retombe
 * ici que s'il manque.
 */

/*
 * Les fichiers de `public/` sont servis tels quels, hors chaîne de
 * construction : ESLint les analyse sans savoir qu'ils tournent dans un
 * navigateur. On lui nomme donc les objets globaux utilisés, plutôt que
 * d'exclure le fichier de la vérification — elle a déjà servi ici.
 */
/* global performance */

/**
 * Part du temps réel que le bouchon consomme pour chaque appel.
 *
 * Les valeurs sont choisies pour encadrer le seuil de ×3 : la chaîne à 10 kHz
 * le passe, celle à 20 kHz ne le passe pas. C'est ce qui permet de vérifier que
 * la page rend bien les deux verdicts, ce qu'un bouchon uniforme ne montrerait
 * pas.
 */
const COST = {
  simulate: 0.05,
  synthesize: 0.1,
  runLowRate: 0.15,
  runHighRate: 0.4,
}

/** Au-delà de cette fréquence, la chaîne complète coûte le tarif élevé. */
const HIGH_RATE_HZ = 20000

/** Longueur de la réponse impulsionnelle du vrai code, reprise telle quelle. */
const IMPULSE_SAMPLES = 10000

/**
 * Total du calcul de remplissage, gardé hors de la boucle et relu à chaque tour.
 *
 * Un calcul dont personne ne lit le résultat peut être supprimé par le moteur
 * JavaScript : la boucle disparaîtrait et le bouchon ne coûterait plus rien.
 */
let sink = 0

/** Cumule le remplissage, en relisant le total pour qu'il serve à quelque chose. */
function keep(value) {
  sink += value
  // Le cumul finirait par dépasser ce qu'un nombre flottant représente.
  if (!Number.isFinite(sink)) sink = 0
}

/** Nombre d'itérations que cette machine avale par milliseconde. */
let iterationsPerMs = 0

function burn(iterations) {
  let x = 0.5
  for (let i = 0; i < iterations; i += 1) {
    x = x * 1.0000001 + 0.3
    if (x > 1e6) x -= 1e6
  }
  return x
}

/**
 * Mesure la vitesse de la boucle de remplissage.
 *
 * Sans cet étalonnage, les coûts ci-dessus vaudraient un facteur différent sur
 * chaque machine, et la page ne pourrait pas être vérifiée de façon reproductible.
 * On monte la charge jusqu'à dépasser cinq millisecondes : en dessous,
 * l'horloge du navigateur est trop grossière — plusieurs la dégradent
 * volontairement à la milliseconde — pour que le rapport veuille dire quelque
 * chose.
 */
function calibrate() {
  let iterations = 100000
  let ms = 0

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const start = performance.now()
    keep(burn(iterations))
    ms = performance.now() - start
    if (ms >= 5) break
    iterations *= 4
  }

  return ms > 0 ? iterations / ms : 100000
}

/** Occupe le processeur pendant à peu près `seconds` secondes. */
function spend(seconds) {
  if (seconds <= 0) return
  keep(burn(Math.round(iterationsPerMs * seconds * 1000)))
}

/**
 * Fabrique un banc de mesure.
 *
 * @param {{ sampleRate: number }} options fréquence de la synthèse, en hertz
 */
export async function createBench({ sampleRate }) {
  if (iterationsPerMs === 0) iterationsPerMs = calibrate()

  const runCost = sampleRate >= HIGH_RATE_HZ ? COST.runHighRate : COST.runLowRate

  return {
    label: `bouchon, ${Math.round(sampleRate / 1000)} kHz`,
    wasmBytes: 0,
    impulseSamples: IMPULSE_SAMPLES,
    simulate: (seconds) => spend(seconds * COST.simulate),
    synthesize: (seconds) => spend(seconds * COST.synthesize),
    run: (seconds) => spend(seconds * runCost),
    dispose: () => {},
  }
}
