<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import NumberField from './components/NumberField.vue'
import { finalDriveFor, rpmAtSpeed } from '../core/preset/defaults'
import type { SampleAnalysis } from '../core/audio/analyze'
import type { LayerRole } from '../core/preset/schema'
import {
  editedProfile,
  tryClack,
  analyzeLayerFile,
  setGearRatios,
  refreshBanks,
} from '../state'

/**
 * Les réglages de fond : le moteur, la transmission, le signal, le caractère.
 *
 * **Il ne demande aucun droit, seulement d'être posé.** Le conducteur qui
 * bricole ses profils chez lui est le même que celui qui roule ; ce qui les
 * sépare est la situation, et c'est `core/garde.ts` qui la tranche. `App.vue`
 * ne monte ce composant que lorsque la garde est ouverte — il n'a donc rien à
 * vérifier lui-même.
 *
 * Ces six sections vivaient dans l'écran de configuration, derrière un bouton
 * « Simplifié / Avancé » que n'importe qui cochait, y compris en roulant. Le
 * fichier faisait 2 454 lignes.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ».
 */

/**
 * Ce qu'on règle : le profil assemblé, sections vivantes.
 *
 * Chaque curseur écrit dans le groupe où le réglage vit — le moteur, la boîte ou
 * la voiture — et non plus dans le profil, qui ne porte plus de valeurs. Les
 * chemins n'ont pas changé pour autant : `profile.engine.idleRpm` désigne
 * toujours le ralenti, il atterrit simplement dans le moteur.
 */
const profile = editedProfile

// Les banques se lisent à l'ouverture de l'écran : c'est le seul endroit d'où
// l'on en change, et une banque déposée entre-temps apparaît en y revenant.
onMounted(() => void refreshBanks())

const ROLES: { id: LayerRole; label: string }[] = [
  { id: 'on', label: 'en charge' },
  { id: 'off', label: 'pied levé' },
  { id: 'idle', label: 'ralenti' },
  { id: 'limiter', label: 'rupteur' },
]

/**
 * Vitesse à laquelle le rupteur tombe dans le dernier rapport. C'est le chiffre
 * parlant : le rapport de pont, seul, ne dit rien à personne. Le modifier
 * recalcule le pont en conséquence.
 */
const redlineSpeed = computed<number>({
  get() {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    const wheelRps =
      engine.redlineRpm / 60 / Math.max(0.01, top * drivetrain.finalDrive)
    return wheelRps * 2 * Math.PI * drivetrain.wheelRadiusM * 3.6
  },
  set(kmh: number) {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    if (kmh <= 0) return
    drivetrain.finalDrive = Number(
      finalDriveFor(engine.redlineRpm, kmh, top, drivetrain.wheelRadiusM).toFixed(3),
    )
  },
})


/** Régime en croisière, repère utile pour juger si la boîte est trop courte. */
const cruiseRpm = computed(() => {
  const { drivetrain } = profile.value
  const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
  return rpmAtSpeed(130, top, drivetrain.finalDrive, drivetrain.wheelRadiusM)
})

const ratiosText = computed<string>({
  get: () => profile.value.drivetrain.gearRatios.map((r) => r.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0)
    // Par l'état, qui redimensionne au passage les tables indexées par rapport
    // quand le nombre de rapports change.
    setGearRatios(parsed)
  },
})

const delaysText = computed<string>({
  get: () => profile.value.drivetrain.shiftDelaysS.map((d) => d.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value >= 0)
    if (parsed.length > 0) profile.value.drivetrain.shiftDelaysS = parsed
  },
})

function addLayer(): void {
  profile.value.layers.push({
    key: `couche-${profile.value.layers.length + 1}`,
    file: '',
    role: 'on',
    anchorRpm: 4000,
    gain: 1,
    minRate: 0.5,
    maxRate: 2,
    enabled: true,
  })
}

function removeLayer(index: number): void {
  profile.value.layers.splice(index, 1)
  delete analyses.value[index]
}

/**
 * Analyse des échantillons.
 *
 * Le résultat n'est jamais appliqué d'office : l'ambiguïté d'octave est réelle
 * sur un spectre de moteur, et un chiffre imposé en silence serait parfois faux
 * sans qu'on sache pourquoi. On propose donc des candidats, et comme le son
 * tourne pendant l'édition, en essayer un se juge à l'oreille immédiatement.
 */
const analyses = ref<Record<number, SampleAnalysis | { error: string }>>({})
const analyzing = ref<number | null>(null)

/** Résultat exploitable pour cette couche, ou `null` si absent ou en échec. */
function analysisOf(index: number): SampleAnalysis | null {
  const entry = analyses.value[index]
  return entry && !('error' in entry) ? entry : null
}

/** Message d'échec pour cette couche, ou une chaîne vide. */
function errorOf(index: number): string {
  const entry = analyses.value[index]
  return entry && 'error' in entry ? entry.error : ''
}

async function analyzeLayer(index: number): Promise<void> {
  const layer = profile.value.layers[index]
  if (!layer?.file) return
  analyzing.value = index
  try {
    analyses.value = {
      ...analyses.value,
      [index]: await analyzeLayerFile(layer.file, profile.value.engine.cylinders),
    }
  } catch (error) {
    analyses.value = {
      ...analyses.value,
      [index]: { error: error instanceof Error ? error.message : 'Analyse impossible.' },
    }
  } finally {
    analyzing.value = null
  }
}

async function analyzeAll(): Promise<void> {
  for (let index = 0; index < profile.value.layers.length; index += 1) {
    await analyzeLayer(index)
  }
}

function candidateTitle(candidate: { firingHz: number; relativeScore: number }): string {
  return `${candidate.firingHz.toFixed(0)} Hz d'allumage · score ${candidate.relativeScore.toFixed(2)}`
}

/**
 * Ancrages remplacés par un candidat, pour pouvoir revenir en arrière.
 *
 * Appliquer une proposition écrase un réglage parfois trouvé à l'oreille au
 * terme de plusieurs essais. Sans retour possible, la moindre fausse manœuvre —
 * ou un nombre de cylindres erroné, qui décale toutes les propositions — coûte
 * ce travail.
 */
const previousAnchors = ref<Record<number, number>>({})

function applyCandidate(index: number, rpm: number): void {
  const layer = profile.value.layers[index]
  if (!layer || layer.anchorRpm === rpm) return
  previousAnchors.value = { ...previousAnchors.value, [index]: layer.anchorRpm }
  layer.anchorRpm = rpm
}

function undoCandidate(index: number): void {
  const previous = previousAnchors.value[index]
  const layer = profile.value.layers[index]
  if (previous === undefined || !layer) return
  layer.anchorRpm = previous
  const rest = { ...previousAnchors.value }
  delete rest[index]
  previousAnchors.value = rest
}

/**
 * Nombre de cylindres que suggère l'ancrage actuel, au vu de la raie détectée.
 *
 * Si l'ancrage en place est juste, ce nombre doit retomber sur celui du profil.
 * Un écart franc désigne l'un des deux comme faux — et c'est le seul moyen de
 * s'en apercevoir avant d'appliquer une proposition erronée.
 */
function impliedCylinders(index: number): number | null {
  const analysis = analysisOf(index)
  const layer = profile.value.layers[index]
  const best = analysis?.candidates[0]
  if (!analysis || !layer || !best || best.rpm <= 0) return null
  // La raie mesurée vaut régime ÷ 120 × cylindres ; on inverse avec l'ancrage en place.
  return Math.round((best.firingHz * 120) / layer.anchorRpm)
}
</script>

<template>
  <div class="config">
    <section class="panel">
      <h2>Moteur</h2>
      <NumberField
        v-model="profile.engine.cylinders"
        label="Cylindres enregistrés"
        :min="1"
        :max="16"
        :step="1"
        hint="Nombre de cylindres du moteur enregistré, pas de celui qu'on veut entendre : ce réglage ne change pas le son. Il ne sert qu'à l'analyse des fichiers, où une valeur fausse fausserait les propositions d'autant."
      />
      <NumberField v-model="profile.engine.idleRpm" label="Ralenti" :min="400" :max="3000" :step="10" unit="tr/min"
        hint="Régime moteur à l'arrêt, embrayage débrayé. C'est le son qu'on entend au feu rouge."
      />
      <NumberField v-model="profile.engine.launchRpm" label="Régime de décollage" :min="600" :max="4000" :step="50" unit="tr/min"
        hint="Ce que l'embrayage impose dès que la voiture avance. Le moteur y monte et l'y tient pendant qu'elle prend de la vitesse, jusqu'à ce que les roues le rejoignent. Sans lui, le régime resterait au ralenti à très basse vitesse, et le son serait celui de l'arrêt."
      />
      <NumberField
        v-model="profile.engine.softLimitRpm"
        label="Seuil de coupure"
        :min="2000"
        :max="16000"
        :step="50"
        unit="tr/min"
        hint="Régime auquel l'allumage commence à être coupé."
      />
      <NumberField v-model="profile.engine.redlineRpm" label="Rupteur" :min="2000" :max="16000" :step="50" unit="tr/min"
        hint="Plafond absolu : le régime n'ira jamais au-delà. Un moteur de série tourne à 6000-7000, un moteur de course au-delà de 8000."
      />
      <NumberField
        v-model="profile.engine.limiterHoldMs"
        label="Durée de coupure"
        :min="0"
        :max="400"
        :step="5"
        unit="ms"
        hint="C'est le hachage qui produit le crépitement, pas le plafonnement du régime."
      />
      <NumberField
        v-model="profile.engine.inertia"
        label="Inertie"
        :min="0.1"
        :max="4"
        :step="0.05"
        hint="Poids du volant moteur. Plus il est lourd, plus le moteur met de temps à prendre ses tours."
      />
      <NumberField v-model="profile.engine.freeRevRate" label="Montée à vide" :min="1000" :max="30000" :step="100" unit="tr/min·s⁻¹"
        hint="Rapidité de montée en régime quand les roues n'entraînent pas le moteur, comme un coup d'accélérateur à l'arrêt."
      />
      <NumberField v-model="profile.engine.engineBraking" label="Frein moteur" :min="500" :max="20000" :step="100" unit="tr/min·s⁻¹"
        hint="Rapidité avec laquelle le régime retombe quand on lève le pied."
      />
      <NumberField
        v-model="profile.engine.flutterRpm"
        label="Tremblement au ralenti"
        :min="0"
        :max="150"
        :step="1"
        unit="tr/min"
        hint="Un moteur au ralenti oscille de quelques dizaines de tours, et sous charge partielle il tremble encore. Le tremblement décroît quand le régime monte et quand la charge monte. Zéro donne un régime parfaitement lisse, ce qu'aucun moteur thermique n'est. Il ne va que dans le son : la boîte et ses seuils gardent le régime net."
      />
      <NumberField
        v-model="profile.engine.flutterHz"
        label="Vitesse du tremblement"
        :min="0.5"
        :max="20"
        :step="0.1"
        unit="Hz"
        hint="Fréquence de la composante rapide ; une composante lente à un dixième de cette valeur s'y ajoute, sans quoi le tremblement s'entend comme un vibrato."
      />
    </section>

    <section class="panel">
      <h2>Transmission</h2>
      <label class="inline">
        Démultiplications
        <input
          type="text"
          :value="ratiosText"
          @change="ratiosText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">Du plus court au plus long, séparés par des virgules. Une seule valeur = prise directe.</p>

      <NumberField v-model="profile.drivetrain.finalDrive" label="Pont" :min="1" :max="12" :step="0.05"
        hint="Démultiplication commune à tous les rapports. La baisser fait tourner le moteur moins vite à toute vitesse ; le réglage voisin permet de raisonner en km/h plutôt qu'avec ce nombre."
      />
      <NumberField
        v-model="redlineSpeed"
        label="Rupteur atteint à"
        :min="60"
        :max="400"
        :step="1"
        unit="km/h"
        hint="Dans le dernier rapport. Modifier cette valeur recalcule le pont."
      />
      <NumberField v-model="profile.drivetrain.wheelRadiusM" label="Rayon de roue" :min="0.15" :max="0.6" :step="0.005" unit="m"
        hint="Rayon d'une roue, en mètres. Entre dans le calcul du régime : une roue plus grande fait moins de tours pour la même vitesse. Environ 0,33 m pour une berline."
      />
      <NumberField v-model="profile.drivetrain.shiftTimeMs" label="Temps de passage" :min="0" :max="1500" :step="10" unit="ms"
        hint="Durée pendant laquelle le couple est coupé, et durée de toute la séquence : chute au neutre, coup de gaz, clac, reprise. C'est elle qui décide si le passage s'entend — sous deux cents millisecondes, les quatre temps se chevauchent et l'on ne perçoit qu'un trou. Court sur une boîte moderne, plus long sur une ancienne."
      />
      <p class="note">
        Les régimes de passage ne se règlent plus ici : ils se déduisent du
        <strong>rupteur du moteur</strong> et du <strong>tempérament</strong> —
        route ou sport —, qui se choisit sur la touche de marche, entre les cadrans de l'écran de conduite.
        C'est ce qui fait qu'un moteur de moto tient ses rapports plus longtemps
        qu'un V8, là où cinq régimes en tours absolus ignoraient le moteur qu'ils
        avaient devant eux.
      </p>
      <NumberField
        v-model="profile.drivetrain.upshiftLoadSpreadRpm"
        label="Écart selon la charge"
        :min="0"
        :max="4000"
        :step="50"
        unit="tr/min"
        hint="De combien le passage recule pied au plancher et avance pied levé, de part et d'autre des valeurs ci-dessus."
      />
      <NumberField
        v-model="profile.drivetrain.upshiftJitterRpm"
        label="Dispersion aléatoire"
        :min="0"
        :max="600"
        :step="10"
        unit="tr/min"
        hint="Tiré au sort à chaque passage. Sans lui, la boîte passe toujours au même régime exact et s'entend comme une machine."
      />
      <div class="toggle">
        <button
          :aria-pressed="profile.drivetrain.firstGearLaunchOnly"
          @click="profile.drivetrain.firstGearLaunchOnly = !profile.drivetrain.firstGearLaunchOnly"
        >
          Première réservée au lancement
        </button>
        <span class="note">On la quitte tout de suite et on n’y revient plus.</span>
      </div>
      <NumberField
        v-if="profile.drivetrain.firstGearLaunchOnly"
        v-model="profile.drivetrain.launchUpshiftKmh"
        label="Passage en seconde à"
        :min="1"
        :max="40"
        :step="1"
        unit="km/h"
        hint="La première n'est qu'une amorce : au-delà de cette vitesse, elle cède la place."
      />
      <NumberField
        v-model="profile.drivetrain.minUpshiftRpm"
        label="Ne jamais monter sous"
        :min="800"
        :max="5000"
        :step="50"
        unit="tr/min"
        hint="Plancher appliqué aux régimes de passage ci-dessus, toutes charges confondues : il empêche l'écart de charge de faire monter un rapport à un régime où le moteur peinerait. Sans effet sur le rétrogradage."
      />
      <NumberField
        v-model="profile.drivetrain.downshiftAtRedlineRatio"
        label="Descente sous"
        :min="0.05"
        :max="0.8"
        :step="0.01"
        hint="Fraction du rupteur sous laquelle la boîte redescend, quand la vitesse n'est ni tenue ni franchement en baisse. Plus la valeur est élevée, plus elle rétrograde tôt."
      />
      <NumberField
        v-model="profile.drivetrain.cruiseMinRpm"
        label="Croisière au-dessus de"
        :min="600"
        :max="4000"
        :step="50"
        unit="tr/min"
        hint="Quand vous tenez une vitesse, la boîte monte les rapports d'elle-même et s'arrête juste avant de descendre sous ce régime. Trop bas, le moteur broute ; trop haut, il reste inutilement haut en croisière."
      />
      <NumberField
        v-model="profile.drivetrain.cruiseUpshiftAfterS"
        label="Monter après"
        :min="0.5"
        :max="10"
        :step="0.1"
        unit="s"
        hint="Durée de vitesse stable avant de tenter un rapport de plus. Court, la boîte monte dès que vous levez le pied ; long, elle garde ses rapports."
      />
      <NumberField
        v-model="profile.drivetrain.brakeDownshiftAccelMs2"
        label="Descendre en freinant à"
        :min="-4"
        :max="-0.2"
        :step="0.1"
        unit="m/s²"
        hint="Décélération à partir de laquelle la boîte descend pour aider à ralentir, sans attendre que le régime soit tombé. Proche de zéro, elle descend au moindre lever de pied."
      />
      <label class="inline">
        Temporisations de montée
        <input
          type="text"
          :value="delaysText"
          @change="delaysText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">
        En secondes, une par rapport. Des valeurs volontairement inégales : avec une
        temporisation unique, la boîte sonne comme un métronome.
      </p>
      <p class="derived">À 130 km/h dans le dernier rapport : <b class="numeric">{{ Math.round(cruiseRpm) }}</b> tr/min</p>
    </section>

    <section class="panel">
      <h2>Signal de vitesse</h2>
      <NumberField
        v-model="profile.speed.springOmega"
        label="Raideur du lissage"
        :min="2"
        :max="40"
        :step="0.5"
        hint="Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard."
      />
      <NumberField
        v-model="profile.speed.accelWindowMs"
        label="Fenêtre d'accélération"
        :min="200"
        :max="3000"
        :step="50"
        unit="ms"
        hint="Durée sur laquelle l'accélération est calculée. Courte, elle réagit vite mais tremble ; longue, elle est stable mais en retard."
      />
      <NumberField v-model="profile.speed.maxPlausibleKmh" label="Vitesse plausible max" :min="50" :max="400" :step="10" unit="km/h"
        hint="Au-delà, la mesure est rejetée comme aberrante. Le GPS produit parfois des sauts sous un pont ou entre deux immeubles."
      />
      <NumberField v-model="profile.speed.maxAccuracyM" label="Précision GPS acceptée" :min="20" :max="1000" :step="10" unit="m"
        hint="Au-delà, la position est écartée : trop floue pour en tirer une vitesse. Volontairement large — relevez la précision réelle sur l'écran de télémétrie avant de resserrer, un seuil trop serré fait taire le GPS."
      />
      <NumberField v-model="profile.speed.maxAccelMs2" label="Accélération max retenue" :min="1" :max="30" :step="0.5" unit="m/s²"
        hint="Ignore les accélérations plus fortes que cette valeur : ce sont des sauts du GPS, pas votre conduite."
      />
      <NumberField v-model="profile.speed.minAccelMs2" label="Décélération max retenue" :min="-30" :max="-1" :step="0.5" unit="m/s²"
        hint="Le même plafond, en freinage."
      />
    </section>

    <section class="panel">
      <h2>Caractère</h2>
      <p class="note">
        Trois comportements qui rendent la conduite plus vivante. Chacun s'active
        séparément.
      </p>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.kickdown.enabled"
          @click="profile.feel.kickdown.enabled = !profile.feel.kickdown.enabled"
        >
          Rétrogradage forcé
        </button>
        <span class="note">Descend d'un ou deux rapports quand on enfonce la pédale, pour reprendre plus fort.</span>
      </div>
      <template v-if="profile.feel.kickdown.enabled">
        <NumberField
          v-model="profile.feel.kickdown.loadThreshold"
          label="Déclenché au-delà de"
          :min="0.3"
          :max="1"
          :step="0.05"
          hint="Charge à partir de laquelle la demande est jugée franche."
        />
        <NumberField
          v-model="profile.feel.kickdown.targetRpmFraction"
          label="Régime visé"
          :min="0.3"
          :max="0.95"
          :step="0.01"
          :hint="`Fraction du rupteur, soit ${Math.round(profile.engine.redlineRpm * profile.feel.kickdown.targetRpmFraction)} tr/min.`"
        />
        <NumberField
          v-model="profile.feel.kickdown.maxGears"
          label="Rapports descendus au plus"
          :min="1"
          :max="4"
          :step="1"
        hint="Deux suffisent pour une reprise franche ; trois donnent une réponse plus vive, au risque de monter très haut dans les tours."
      />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.backfire.enabled"
          @click="profile.feel.backfire.enabled = !profile.feel.backfire.enabled"
        >
          Pétarade
        </button>
        <span class="note">Claquements à l'échappement quand on lève le pied.</span>
      </div>
      <template v-if="profile.feel.backfire.enabled">
        <NumberField
          v-model="profile.feel.backfire.minRpm"
          label="À partir de"
          :min="1000"
          :max="9000"
          :step="100"
          unit="tr/min"
          hint="En deçà, rien ne se produit : il ne reste pas assez à brûler."
        />
        <NumberField v-model="profile.feel.backfire.intensity" label="Intensité" :min="0" :max="1" :step="0.05"
        hint="Volume des claquements. Au-delà de la moitié, ils dominent le moteur."
      />
        <NumberField v-model="profile.feel.backfire.count" label="Claquements par salve" :min="1" :max="10" :step="1"
        hint="Nombre de détonations à chaque lever de pied. Peu et espacés pour rester crédible."
      />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.shiftJolt.enabled"
          @click="profile.feel.shiftJolt.enabled = !profile.feel.shiftJolt.enabled"
        >
          À-coup de passage
        </button>
        <span class="note">Le petit trou pendant le changement de rapport.</span>
      </div>
      <template v-if="profile.feel.shiftJolt.enabled">
        <NumberField
          v-model="profile.feel.shiftJolt.depth"
          label="Profondeur"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Combien le niveau baisse pendant la coupure. Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.cutDepth"
          label="Coupure de couple"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Combien le moteur passe en roue libre le temps du passage. C'est ce qui fait entrer le son pied levé, donc changer le timbre et pas seulement le niveau. Zéro garde le son de pleine charge d'un bout à l'autre."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.dipRpm"
          label="Plongée du régime"
          :min="-800"
          :max="1500"
          :step="50"
          unit="tr/min"
          hint="De combien le moteur tombe sous le régime du nouveau rapport pendant la coupure, avant que l'embrayage ne l'y ramène : il diminue, puis remonte. Une valeur négative donne l'inverse, un coup de gaz au débrayage."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.blipRpm"
          label="Coup de gaz"
          :min="0"
          :max="2000"
          :step="50"
          unit="tr/min"
          hint="De combien le moteur remonte au-dessus du rapport visé, entre la chute au neutre et l'engagement. C'est le geste du double débrayage, et le mouvement qui s'entend le mieux dans un passage. Zéro laisse la séquence en trois temps."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.clack"
          label="Clac de la boîte"
          :min="0"
          :max="3"
          :step="0.05"
          hint="Le choc mécanique quand le rapport s'engage : sec, métallique, doublé d'un coup mat. Rien à voir avec le claquement d'échappement, qui est grave et traînant."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.clackDownshift"
          label="Clac au rétrogradage"
          :min="0"
          :max="1.5"
          :step="0.05"
          hint="Part du clac gardée quand la boîte descend un rapport. On rétrograde pied levé ou en freinant, donc avec un moteur bien plus doux : à intensité égale le clac y ressort deux fois plus. Un pour le même niveau qu'en montant."
        />
        <div class="toggle">
          <button @click="tryClack()">Écouter le clac</button>
          <span class="note">
            Le joue seul, sans attendre un passage. Le son doit être activé.
          </span>
        </div>
        <NumberField
          v-model="profile.feel.shiftJolt.crackle"
          label="Claquement de reprise"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Une détonation à l'échappement au moment où le couple revient. Zéro n'en produit aucune."
        />
      </template>
    </section>

    <section class="panel">
      <h2>Mixage</h2>
      
      <NumberField
        v-model="profile.mix.loadReliefDb"
        label="Relief de charge"
        :min="0"
        :max="12"
        :step="0.5"
        unit="dB"
        hint="Autant en moins pied levé, autant en plus pied au plancher. Sans lui, accélérer ne s'entend pas : les fondus sont à puissance constante, ils changent le timbre et jamais le volume. À 4, il y a 8 dB entre lever le pied et écraser."
      />
      <NumberField
        v-model="profile.mix.rpmReliefDb"
        label="Relief du régime"
        :min="0"
        :max="12"
        :step="0.5"
        unit="dB"
        hint="Gain gagné entre le ralenti et le rupteur : c'est le rugissement qui monte avec les tours. Il s'ajoute aux 4 dB que la banque livrée donne déjà, sa prise haut régime étant enregistrée plus fort."
      />
      <NumberField
        v-model="profile.mix.idleLevelDb"
        label="Niveau au ralenti"
        :min="-24"
        :max="0"
        :step="0.5"
        unit="dB"
        hint="Au ralenti, faute de couche dédiée dans la banque, on entend la prise « pied levé » jouée deux octaves plus bas. Sans ce réglage elle sonne aussi fort que tout le reste."
      />
      <NumberField
        v-model="profile.mix.offLoadGain"
        label="Gain pied levé"
        :min="0"
        :max="6"
        :step="0.1"
        hint="Curseur de goût sur toute la famille « pied levé ». La compensation des prises plus douces vit maintenant dans le gain de chaque couche, où le déficit se mesure : laisser 1 sauf pour forcer le trait."
      />
      <NumberField
        v-model="profile.mix.loadContrast"
        label="Contraste de charge"
        :min="0"
        :max="1"
        :step="0.05"
        hint="À 1, le fondu va d'un extrême à l'autre. Plus bas, les deux familles se mélangent et l'écart s'entend moins."
      />
      <NumberField
        v-model="profile.mix.layerDetuneCents"
        label="Désaccord des couches"
        :min="0"
        :max="50"
        :step="1"
        unit="centièmes"
        hint="Écart de justesse entre les deux couches d'une même famille, en centièmes de demi-ton. Au rapport exact elles sont parfaitement justes l'une par rapport à l'autre, ce qui n'arrive sur aucun moteur : les inégalités entre cylindres et les deux lignes d'échappement produisent un battement lent. Mesuré, 12 centièmes donnent un battement à 2,4 Hz à 5100 tr/min et 1,5 Hz à 3200."
      />
      <NumberField
        v-model="profile.mix.layerRefreshS"
        label="Renouvellement de position"
        :min="0"
        :max="30"
        :step="0.5"
        unit="s"
        hint="Intervalle moyen entre deux reprises de la lecture ailleurs dans l'enregistrement. Chaque couche est une boucle de trois à cinq secondes qui, sans cela, se répète à l'identique toutes les quatre à vingt secondes selon la vitesse de lecture. L'intervalle réel est tiré à quarante pour cent près, sinon on remplacerait une périodicité par une autre. À zéro, le comportement est celui d'avant ce réglage."
      />
      <NumberField
        v-model="profile.mix.crossfadeLowRpm"
        label="Début de bascule"
        :min="500"
        :max="12000"
        :step="50"
        unit="tr/min"
        hint="Régime où la couche haute commence à entrer. Indépendant des régimes d'ancrage."
      />
      <NumberField v-model="profile.mix.crossfadeHighRpm" label="Fin de bascule" :min="500" :max="16000" :step="50" unit="tr/min"
        hint="Régime au-delà duquel seule la couche haut régime joue. L'écart avec le début de bascule fixe la douceur de la transition."
      />
      <NumberField
        v-model="profile.mix.fullLoadAccelMs2"
        label="Accélération pleine charge"
        :min="0.5"
        :max="10"
        :step="0.1"
        unit="m/s²"
        hint="Accélération au-delà de laquelle la charge est considérée maximale."
      />
      <NumberField
        v-model="profile.mix.dragRefKmh"
        label="Repère de traînée"
        :min="60"
        :max="250"
        :step="5"
        unit="km/h"
        hint="Vitesse à laquelle tenir l'allure demande la moitié de l'effort maximal. Faute de pédale, tenir une allure vaudrait sinon toujours la même chose, à 30 comme à 130 km/h. Bas, tout devient chargé tôt ; haut, la traînée compte peu."
      />
      <NumberField v-model="profile.mix.loadSmoothingS" label="Lissage de la charge" :min="0.02" :max="1.5" :step="0.01" unit="s"
        hint="Temps que met la charge à suivre la pédale. Trop court, le fondu papillonne ; trop long, le son traîne derrière la conduite."
      />
      <NumberField v-model="profile.mix.idleFadeOutRpm" label="Effacement du ralenti" :min="800" :max="4000" :step="50" unit="tr/min"
        hint="Régime au-dessus duquel la couche de ralenti disparaît complètement, le moteur étant alors entraîné par les roues."
      />
      <NumberField v-model="profile.mix.highpassHz" label="Coupe-bas" :min="10" :max="200" :step="1" unit="Hz"
        hint="Retire les fréquences les plus graves. Utile sur un petit haut-parleur, qui ne les reproduit pas et s'y fatigue."
      />
      <NumberField v-model="profile.mix.drive" label="Saturation" :min="0" :max="1" :step="0.01"
        hint="Épaissit le son et le fait paraître plus fort. Trop poussé, il devient sale."
      />
      <NumberField v-model="profile.mix.limiterThresholdDb" label="Seuil du limiteur" :min="-24" :max="0" :step="0.5" unit="dB"
        hint="Niveau à partir duquel le son est retenu pour éviter la saturation. Le baisser laisse monter le volume général, mais aplatit les nuances."
      />
    </section>

    <section class="panel wide">
      <h2>Couches</h2>
      <p class="note">
        Le régime d'ancrage est celui auquel l'échantillon a été enregistré : il détermine
        la justesse, pas le point de bascule. Les bornes de lecture limitent l'étirement —
        au-delà d'environ une octave, l'échantillon devient métallique vers le haut et
        pâteux vers le bas.
      </p>
      <div class="table-scroll">
      <table class="layers">
        <thead>
          <tr>
            <th></th>
            <th>Clé</th>
            <th>Fichier</th>
            <th>Rôle</th>
            <th>Ancrage</th>
            <th>Gain</th>
            <th>Lecture min</th>
            <th>Lecture max</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(layer, index) in profile.layers" :key="index">
          <tr>
            <td><input v-model="layer.enabled" type="checkbox" /></td>
            <td><input v-model="layer.key" type="text" /></td>
            <td><input v-model="layer.file" type="text" /></td>
            <td>
              <select v-model="layer.role">
                <option v-for="role in ROLES" :key="role.id" :value="role.id">{{ role.label }}</option>
              </select>
            </td>
            <td><input v-model.number="layer.anchorRpm" type="number" min="200" max="20000" step="10" /></td>
            <td><input v-model.number="layer.gain" type="number" min="0" max="4" step="0.05" /></td>
            <td><input v-model.number="layer.minRate" type="number" min="0.1" max="1" step="0.05" /></td>
            <td><input v-model.number="layer.maxRate" type="number" min="1" max="4" step="0.05" /></td>
            <td class="actions">
              <button :disabled="!layer.file || analyzing !== null" @click="analyzeLayer(index)">
                {{ analyzing === index ? 'Analyse…' : 'Analyser' }}
              </button>
              <button @click="removeLayer(index)">Retirer</button>
            </td>
          </tr>
          <tr v-if="analyses[index]" class="analysis">
            <td :colspan="9">
              <span v-if="errorOf(index)" class="error">{{ errorOf(index) }}</span>
              <template v-else-if="analysisOf(index)">
                <div class="facts">
                  <span>
                    {{ analysisOf(index)!.durationS.toFixed(2) }} s ·
                    {{ analysisOf(index)!.sampleRate }} Hz ·
                    {{ analysisOf(index)!.channels }} canaux
                  </span>
                  <span :class="{ warn: analysisOf(index)!.seamRatio > 0.02 }">
                    raccord {{ (analysisOf(index)!.seamRatio * 100).toFixed(1) }} %
                  </span>
                  <span>timbre {{ analysisOf(index)!.centroidHz.toFixed(0) }} Hz</span>
                  <span :class="{ warn: !analysisOf(index)!.steady }">
                    <template v-if="analysisOf(index)!.steady">régime stable</template>
                    <template v-else>
                      rampe {{ analysisOf(index)!.startRpm }} → {{ analysisOf(index)!.endRpm }} tr/min
                    </template>
                  </span>
                </div>
                <p
                  v-if="impliedCylinders(index) && impliedCylinders(index) !== profile.engine.cylinders"
                  class="error"
                >
                  L'ancrage en place correspondrait à {{ impliedCylinders(index) }} cylindres, non
                  {{ profile.engine.cylinders }}. L'un des deux est faux : vérifier le nombre de
                  cylindres avant d'appliquer une proposition, sans quoi elle sera décalée d'autant.
                </p>
                <div class="candidates">
                  <span class="muted">Ancrage proposé :</span>
                  <button
                    v-for="candidate in analysisOf(index)!.candidates"
                    :key="candidate.rpm"
                    :aria-pressed="layer.anchorRpm === candidate.rpm"
                    :title="candidateTitle(candidate)"
                    @click="applyCandidate(index, candidate.rpm)"
                  >
                    {{ candidate.rpm }}
                  </button>
                  <button
                    v-if="previousAnchors[index] !== undefined"
                    class="undo"
                    @click="undoCandidate(index)"
                  >
                    Revenir à {{ previousAnchors[index] }}
                  </button>
                </div>
              </template>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
      </div>
      <div class="layer-actions">
        <button class="add" @click="addLayer()">Ajouter une couche</button>
        <button :disabled="analyzing !== null" @click="analyzeAll()">Analyser toutes les couches</button>
      </div>
      <p class="note">
        Le régime d'ancrage est mesurable, mais un spectre de moteur se prête mal à
        une réponse unique : la détection confond volontiers une fréquence avec sa
        moitié, son tiers ou ses trois demis. Les propositions sont donc classées
        et non appliquées d'office. Comme le son tourne pendant l'édition, les
        essayer se juge à l'oreille — la bonne saute aux oreilles, les autres
        sonnent une octave ou une quinte à côté. L'indication « timbre » aide à
        recouper : d'un même moteur, la prise haut régime a forcément le timbre le
        plus aigu.
      </p>
    </section>
  </div>
</template>

<style scoped>
/*
 * La bande de défilement était déclarée ici ; elle vit maintenant dans
 * `style.css` et se pose sur tous les écrans qui défilent, en voiture et sur
 * téléphone. Cet écran ne la porte donc plus lui-même.
 */
.config {
  display: grid;
  /*
   * Le `min()` est ce qui empêche la grille de déborder en portrait : une
   * colonne d'au moins vingt rem, plus la bande, dépasse la largeur d'un
   * téléphone, et la page se décale alors horizontalement. Mesuré avant
   * correction sur un écran de 375 px : soixante-cinq pixels de débordement.
   */
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
  align-items: start;
  max-width: 80rem;
  margin: 0 auto;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.panel.wide {
  grid-column: 1 / -1;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

.inline {
  display: block;
  color: var(--muted);
  margin-top: 0.6rem;
}

.inline input {
  margin-top: 0.25rem;
}

.note {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.4rem 0 0.6rem;
}

/*
 * Une note qui avertit. La classe était déjà employée dans cet écran sans être
 * définie : l'avertissement s'y lisait dans le gris de tout le reste, donc il ne
 * se lisait pas.
 */
.note.warn {
  color: var(--warn);
}

.derived {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0.6rem 0 0;
}

.derived b {
  color: var(--text);
}

.error {
  color: var(--warn);
  margin: 0.5rem 0 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

/*
 * Le tableau des couches est plus large qu'un téléphone en portrait — mesuré à
 * 687 pixels pour un écran de 375. Sans ce conteneur, c'est la page entière qui
 * défilait latéralement : on cherchait à faire défiler vers le bas et l'écran
 * partait de côté. Le tableau glisse maintenant dans sa propre boîte.
 *
 * Le défaut est antérieur à la bande de défilement : mesuré identique avec et
 * sans elle.
 */
.table-scroll {
  overflow-x: auto;
  touch-action: pan-x pan-y;
}

th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.78rem;
  padding-bottom: 0.3rem;
}

td {
  padding: 0.2rem 0.3rem 0.2rem 0;
  border-top: 1px solid var(--line);
}

td input[type='number'] {
  width: 6rem;
  text-align: right;
}

.mode .note {
  flex: 1 1 16rem;
  margin: 0;
}

.global-actions .note {
  flex: 1 1 16rem;
  margin: 0;
}

.creation-pitch .note {
  flex: 1 1 18rem;
  margin: 0;
}

.reset .note {
  margin: 0;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.6rem 0 0.3rem;
  border-top: 1px solid var(--line);
}

.toggle .note {
  margin: 0;
  flex: 1 1 12rem;
}

.offline-state .warn {
  color: var(--warn);
}

.layer-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.actions {
  display: flex;
  gap: 0.3rem;
  white-space: nowrap;
}

.analysis td {
  background: var(--panel-alt);
  padding: 0.5rem 0.6rem;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.facts .warn {
  color: var(--warn);
}

.candidates {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.candidates .undo {
  border-color: var(--warn);
  color: var(--warn);
  background: transparent;
}

.candidates button {
  padding: 0.25rem 0.6rem;
  font-variant-numeric: tabular-nums;
}
</style>
