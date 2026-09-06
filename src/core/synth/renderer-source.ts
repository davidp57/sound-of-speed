/**
 * Le calculateur : engine-sim, dans un fil à lui.
 *
 * Il charge le module WebAssembly, construit le moteur, et remplit la réserve
 * du lecteur bloc par bloc. Il ne sait rien de Web Audio : il compte des
 * échantillons envoyés et des échantillons consommés, la différence est la
 * réserve, et il rend tant qu'elle est sous sa cible.
 *
 * Le pilotage tient en deux nombres, envoyés par le fil principal à chaque tour
 * de la boucle de Speed : le **régime** que le cadran affiche, et l'**effort**
 * que le moteur fournit. Le premier est imposé au dynamomètre d'engine-sim, le
 * second ouvre le papillon.
 *
 * La mesure de charge se fait par fenêtre et non en cumul : un total divisé par
 * la durée depuis le démarrage dirait ce qui s'est passé en moyenne, pas ce qui
 * se passe pendant qu'on écoute.
 *
 * **Le moteur qu'il construit vient du profil.** `synth_create_from` reçoit le
 * tableau de doubles décrit par `native/CONTRAT-MOTEUR.md` : les deux premiers
 * arguments sont ceux du contrat — le pointeur et le compte —, les cinq suivants
 * sont ce que le contrat ne couvre pas, parce que cela décrit le calcul et le
 * poste et non le moteur : fréquence de simulation, cadence de sortie, longueur
 * de la réponse impulsionnelle, et les deux bornes du niveleur.
 */
export const RENDERER_SOURCE = `
let core = null
let render = null
let setTarget = null
let setThrottleRange = null
let setVolume = null
let setDyno = null
let setNoise = null
let setLevelerTarget = null
let readRpm = null
let readLatency = null
let buffer = 0
let link = null

let blockFrames = 1024
let reserveFrames = 12000
let sampleRate = 48000
let framesSent = 0
let framesConsumed = 0
let shortfall = 0
let underruns = 0
let underrunFrames = 0
let peak = 0
let clipped = 0
let rms = 0
let brightness = 0
let windowCpu = 0
let windowFrames = 0
let pump = 0
let report = 0
let stopped = false

let chainRpm = 800
let chainEffort = 0
let sweep = false
let sweepSeconds = 12
let sweepLow = 800
let sweepHigh = 6000
let forceEffort = false
let forcedEffort = 0.5
let liveRpm = 800

/**
 * Le regime a imposer pour le bloc qui commence.
 *
 * Le balayage se cale sur le nombre d'echantillons deja envoyes, et non sur une
 * horloge de minuteur : c'est la seule facon que la montee dure exactement ce
 * qu'on a demande, quels que soient les a-coups du fil.
 */
function nextRpm() {
  if (!sweep) return chainRpm
  const phase = ((framesSent / sampleRate) % sweepSeconds) / sweepSeconds
  const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2
  return sweepLow + (sweepHigh - sweepLow) * triangle
}

function topUp() {
  if (core === null || stopped) return
  let guard = 0
  while (framesSent - framesConsumed < reserveFrames && guard < 32) {
    liveRpm = nextRpm()
    setTarget(liveRpm, forceEffort ? forcedEffort : chainEffort)
    const started = performance.now()
    const produced = render(buffer, blockFrames)
    windowCpu += (performance.now() - started) / 1000
    windowFrames += blockFrames
    // Le tas peut avoir ete deplace par une croissance de memoire : on relit la
    // vue a chaque bloc plutot que de garder une reference qui se detacherait.
    const view = core.HEAPF32.subarray(buffer >> 2, (buffer >> 2) + blockFrames)
    const block = new Float32Array(view)
    if (link !== null) link.postMessage({ type: 'block', samples: block.buffer }, [block.buffer])
    framesSent += blockFrames
    shortfall += blockFrames - produced
    guard += 1
  }
}

function publish() {
  if (core === null) return
  const audioSeconds = windowFrames / sampleRate
  self.postMessage({
    type: 'stats',
    targetRpm: liveRpm,
    effort: forceEffort ? forcedEffort : chainEffort,
    engineRpm: readRpm(),
    innerLatency: readLatency(),
    queuedFrames: framesSent - framesConsumed,
    cpuSeconds: windowCpu,
    audioSeconds: audioSeconds,
    shortfall: shortfall,
    underruns: underruns,
    underrunFrames: underrunFrames,
    peak: peak,
    clipped: clipped,
    rms: rms,
    brightness: brightness,
  })
  windowCpu = 0
  windowFrames = 0
  peak = 0
  clipped = 0
}

async function boot(message) {
  const module = await import(message.moduleUrl)
  core = await module.default({ noInitialRun: true })

  // Deux entrees, et l'ordre compte. Le banc d'abord — cadences, convolution,
  // niveleur — parce qu'il ne decrit pas un moteur et n'a donc pas sa place dans
  // le tableau du contrat. Le moteur ensuite.
  const setRig = core.cwrap('synth_set_rig', null, [
    'number',
    'number',
    'number',
    'number',
    'number',
    'number',
  ])
  const createFrom = core.cwrap('synth_create_from', 'number', ['number', 'number'])
  render = core.cwrap('synth_render', 'number', ['number', 'number'])
  setTarget = core.cwrap('synth_set_target', null, ['number', 'number'])
  setThrottleRange = core.cwrap('synth_set_throttle_range', null, ['number', 'number'])
  setVolume = core.cwrap('synth_set_volume', null, ['number'])
  setDyno = core.cwrap('synth_set_dyno', null, ['number'])
  setNoise = core.cwrap('synth_set_noise', null, ['number', 'number'])
  setLevelerTarget = core.cwrap('synth_set_leveler_target', null, ['number'])
  readRpm = core.cwrap('synth_rpm', 'number', [])
  readLatency = core.cwrap('synth_latency', 'number', [])

  const settings = message.settings
  sampleRate = message.sampleRate
  blockFrames = settings.blockFrames
  reserveFrames = Math.round((settings.reserveMs / 1000) * sampleRate)

  // La definition du moteur part en doubles, dans l'ordre du contrat. Le C++ la
  // lit par position : pas d'analyseur JSON de l'autre cote, l'ordre suffit.
  const values = message.engineValues
  const bytes = values.length * 8
  const engine = core._malloc(bytes)
  core.HEAPF64.set(values, engine >> 3)

  const started = performance.now()
  let built = 0
  try {
    setRig(
      settings.simulationHz,
      sampleRate,
      settings.impulseSamples,
      settings.leveler ? 1 : 0,
      settings.levelerGain,
      settings.levelerTarget,
    )
    built = createFrom(engine, values.length)
  } finally {
    // Le C++ recopie ce qu'il lui faut pendant l'appel : rien ne survit ici.
    core._free(engine)
  }
  if (built !== 1) {
    self.postMessage({ type: 'error', error: 'le moteur simule n a pas pu etre construit' })
    return
  }
  const buildMs = performance.now() - started

  buffer = core._malloc(blockFrames * 4)
  setThrottleRange(settings.throttleIdle, settings.throttleFull)
  setVolume(settings.volume)
  setDyno(settings.dynoTorque)
  sweep = settings.sweep
  sweepSeconds = settings.sweepSeconds
  sweepLow = message.sweepLow
  sweepHigh = message.sweepHigh
  forceEffort = settings.forceEffort
  forcedEffort = settings.forcedEffort

  self.postMessage({ type: 'ready', buildMs: buildMs })

  // Cinq millisecondes : bien plus court qu'un bloc, pour que la reserve se
  // remplisse par petites touches plutot que par a-coups.
  pump = setInterval(topUp, 5)
  report = setInterval(publish, 250)
  topUp()
}

self.onmessage = (event) => {
  const message = event.data
  if (message.type === 'link') {
    link = message.port
    link.onmessage = (inner) => {
      const level = inner.data
      if (level.type !== 'level') return
      framesConsumed = level.consumed
      underruns = level.underruns
      underrunFrames = level.underrunFrames
      if (level.peak > peak) peak = level.peak
      // La part la plus ecretee des rapports du lecteur, pas leur moyenne :
      // un ecretage bref se voit, et c'est ce qu'on veut entendre.
      if (level.clipped > clipped) clipped = level.clipped
      rms = level.rms
      brightness = level.brightness
      topUp()
    }
  } else if (message.type === 'boot') {
    boot(message).catch((error) => {
      self.postMessage({ type: 'error', error: String(error && error.message ? error.message : error) })
    })
  } else if (message.type === 'target') {
    chainRpm = message.rpm
    chainEffort = message.effort
  } else if (message.type === 'tune') {
    if (setThrottleRange !== null) setThrottleRange(message.throttleIdle, message.throttleFull)
    if (setVolume !== null) setVolume(message.volume)
    if (setDyno !== null) setDyno(message.dynoTorque)
    if (setNoise !== null) setNoise(message.airNoise, message.inputSampleNoise)
    reserveFrames = Math.round((message.reserveMs / 1000) * sampleRate)
    sweep = message.sweep
    sweepSeconds = message.sweepSeconds
    sweepLow = message.sweepLow
    sweepHigh = message.sweepHigh
    forceEffort = message.forceEffort
    forcedEffort = message.forcedEffort
    // La crete visee s'ecrit a chaud : renderAudio la relit a chaque
    // echantillon, contrairement aux deux bornes de gain du niveleur, qui
    // imposent de rebatir.
    if (setLevelerTarget !== null) setLevelerTarget(message.levelerTarget)
  } else if (message.type === 'noise') {
    // Les deux bruits du moteur, seuls parametres de la definition qui
    // s'ecrivent sans rebatir.
    if (setNoise !== null) setNoise(message.airNoise, message.inputSampleNoise)
  } else if (message.type === 'stop') {
    stopped = true
    clearInterval(pump)
    clearInterval(report)
    if (core !== null) {
      core.ccall('synth_dispose', null, [], [])
      if (buffer !== 0) core._free(buffer)
    }
    core = null
    self.postMessage({ type: 'stopped' })
  }
}
`
