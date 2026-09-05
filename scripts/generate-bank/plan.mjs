/**
 * Le plan des prises : quels régimes, quelle charge, quelle longueur.
 *
 * Tout part d'un constat de mesure. Un moteur change de régime sans changer de
 * corps : la raie d'allumage monte, les résonances de l'échappement et de la
 * caisse ne bougent pas. Rejouer une prise à 0,3× descend les deux ensemble, et
 * c'est le défaut que ce lot corrige. La parade est de **rapprocher les
 * ancrages** jusqu'à ce que la vitesse de lecture reste près de un.
 *
 * Les ancrages sont donc répartis **géométriquement** entre le ralenti et le
 * rupteur, et non régulièrement : c'est le rapport entre deux régimes voisins
 * qui fixe la vitesse de lecture, pas leur différence.
 */

/** Longueur d'un cycle moteur, en secondes : deux tours de vilebrequin. */
export function cycleSeconds(rpm) {
  return 120 / rpm
}

/**
 * Régimes d'ancrage, du ralenti au rupteur.
 *
 * L'écart demandé est un plafond, pas une consigne : on prend le nombre entier
 * d'intervalles juste au-dessus, puis on les répartit également. Les deux bouts
 * tombent donc exactement sur le ralenti et sur le rupteur, ce qui garantit
 * qu'aucun régime de la conduite ordinaire ne sorte du domaine couvert.
 */
export function anchors(idleRpm, redlineRpm, spacingOctaves) {
  const span = Math.log2(redlineRpm / idleRpm)
  const intervals = Math.max(1, Math.ceil(span / spacingOctaves))
  const list = []
  for (let i = 0; i <= intervals; i += 1) {
    list.push(idleRpm * Math.pow(redlineRpm / idleRpm, i / intervals))
  }
  return { list, ratio: Math.pow(redlineRpm / idleRpm, 1 / intervals), intervals }
}

/**
 * Longueur d'une prise, en échantillons : un nombre entier de cycles moteur.
 *
 * C'est la fermeture de boucle la moins chère qui soit. À régime tenu, le motif
 * se répète exactement tous les deux tours de vilebrequin ; couper sur un
 * nombre entier de cycles met donc les deux bouts en phase par construction,
 * sans rien couper ni fondre. La correction de `loop.mjs` n'a plus qu'à
 * rattraper le résidu.
 */
export function takeSamples(rpm, targetSeconds, sampleRate) {
  const cycles = Math.max(1, Math.round(targetSeconds / cycleSeconds(rpm)))
  return { cycles, samples: Math.round(cycles * cycleSeconds(rpm) * sampleRate) }
}

/** Nom de fichier d'une prise : le rôle et le régime, rien de plus. */
function takeName(role, rpm) {
  return `${role}-${Math.round(rpm)}.wav`
}

/**
 * Construit le plan complet à partir d'une définition de moteur.
 *
 * Chaque entrée porte tout ce que le banc natif a besoin de savoir, et rien de
 * ce qu'il n'a pas à décider.
 */
export function buildPlan(definition, sampleRate) {
  const bank = definition.bank
  const { list, ratio, intervals } = anchors(
    definition.idleRpm,
    definition.redlineRpm,
    bank.spacingOctaves,
  )

  const takes = []

  for (const rpm of list) {
    for (const [role, throttle] of [
      ['on', 1.0],
      ['off', 0.0],
    ]) {
      const { cycles, samples } = takeSamples(rpm, bank.takeSeconds, sampleRate)
      takes.push({
        name: takeName(role, rpm),
        key: `${role}_${Math.round(rpm)}`,
        role,
        throttle,
        purpose: 'bank',
        rpm,
        cycles,
        samples,
        settle: bank.settleSeconds,
      })
    }
  }

  // Les témoins : une prise en charge au milieu de chaque intervalle, qui ne
  // part pas dans la banque.
  //
  // Sans eux, la question « combien de prises faut-il » ne se mesure pas. Tous
  // les régimes enregistrés sont des ancrages, et sur un ancrage la vitesse de
  // lecture vaut un : l'erreur y est nulle par construction, quel que soit
  // l'écartement. C'est **entre** deux ancrages qu'elle se voit, et il y faut
  // une prise vraie à laquelle comparer.
  if (bank.witnesses !== false) {
    for (let i = 0; i + 1 < list.length; i += 1) {
      const rpm = Math.sqrt(list[i] * list[i + 1])
      const { cycles, samples } = takeSamples(rpm, bank.takeSeconds, sampleRate)
      takes.push({
        name: `witness-${Math.round(rpm)}.wav`,
        key: `witness_${Math.round(rpm)}`,
        role: 'on',
        throttle: 1.0,
        purpose: 'witness',
        rpm,
        cycles,
        samples,
        settle: bank.settleSeconds,
      })
    }
  }

  // Le ralenti : ni plein gaz ni pied levé, un papillon presque fermé. C'est la
  // prise qui manque à la banque enregistrée depuis le début — on n'enregistre
  // pas un ralenti propre depuis une voiture qui roule.
  {
    const { cycles, samples } = takeSamples(definition.idleRpm, bank.takeSeconds, sampleRate)
    takes.push({
      name: takeName('idle', definition.idleRpm),
      key: `idle_${Math.round(definition.idleRpm)}`,
      role: 'idle',
      throttle: bank.idleThrottle,
      purpose: 'bank',
      rpm: definition.idleRpm,
      cycles,
      samples,
      settle: bank.settleSeconds,
    })
  }

  // Le rupteur : on tient le régime **au-dessus** de la limite d'allumage du
  // moteur simulé et on le laisse couper tout seul. Le hachage vient du modèle,
  // il n'est pas fabriqué après coup.
  if (bank.limiterRpm > 0) {
    const { cycles, samples } = takeSamples(bank.limiterRpm, bank.takeSeconds, sampleRate)
    takes.push({
      name: takeName('limiter', bank.limiterRpm),
      key: `limiter_${Math.round(bank.limiterRpm)}`,
      role: 'limiter',
      throttle: 1.0,
      purpose: 'bank',
      rpm: bank.limiterRpm,
      cycles,
      samples,
      settle: bank.settleSeconds,
    })
  }

  return { takes, anchors: list, ratio, intervals }
}
