<script setup lang="ts">
import { computed, ref } from 'vue'

import ValueRow from './components/ValueRow.vue'
import {
  DEFAULT_SYNTH,
  EXHAUST_RESPONSES,
  type ExhaustResponse,
  type SynthSettings,
} from '../core/synth/settings'
import {
  ENGINE_GROUPS,
  ENGINE_FIELDS,
  type EngineDefinition,
  type EngineGroup,
} from '../core/preset/schema'
import { mergeEngineGroup, groupVaries } from '../core/preset/engine-definition'
import { GM_LS_V8, SUBARU_EJ25 } from '../core/preset/defaults'
import { ENGINE_LIBRARY, type LibraryEngine } from '../core/preset/engine-library'
import {
  activeProfile,
  applyEngineDefinition,
  applyLibraryEngine,
  applySynthSettings,
  engineDefinition,
  setSynthEnabled,
  setSynthSilent,
  synthSettings,
  synthSilent,
  synthStatus,
} from '../state'

/**
 * Le banc de réglage du son synthétisé.
 *
 * Réservé au développement, comme le simulateur : on ne règle pas un timbre en
 * conduisant, et l'écran embarqué reste sobre. Ce qui se trouve ici partira
 * dans le profil quand le lot SYNTHESE aura son champ `soundSource`.
 *
 * L'écran sert deux choses à la fois, et c'est voulu : régler, et **mesurer**.
 * La machine ne peut pas juger un timbre — c'est écrit dans le ticket —, mais
 * elle peut dire si le son sort sans creux et ce qu'il coûte. Les deux
 * colonnes sont donc côte à côte : on règle à gauche, on lit le prix à droite.
 */

const busy = ref(false)
const running = computed(() => synthStatus.value.phase === 'ready')

async function toggle(): Promise<void> {
  busy.value = true
  try {
    await setSynthEnabled(!running.value)
  } finally {
    busy.value = false
  }
}

function onNumber(key: keyof SynthSettings, event: Event): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  void applySynthSettings({ ...synthSettings.value, [key]: Number(target.value) })
}

/**
 * Revenir aux réglages d'origine.
 *
 * On tâtonne à l'oreille sur ce banc, et l'on s'y perd : sept curseurs, dont
 * plusieurs se compensent. Sans point de retour, la seule issue était de
 * recharger la page — ce qui coupe aussi le son et rebatît le moteur.
 */
function reset(): void {
  void applySynthSettings({ ...DEFAULT_SYNTH })
}

/**
 * Dehors ou dedans.
 *
 * Le passe-bas de sortie faisait déjà cela sans qu'on l'ait cherché : coupé, on
 * entend la voiture de l'extérieur ; refermé bas, on l'entend à travers la
 * tôle et les vitres. C'est David qui l'a remarqué en réglant à l'oreille — le
 * réglage existait, le sens lui manquait.
 *
 * Mille hertz pour l'habitacle : la valeur qu'il avait trouvée lui-même.
 */
const DEDANS_HZ = 1000
const DEHORS_HZ = 22000

const place = computed(() => {
  if (synthSettings.value.mufflerHz >= DEHORS_HZ) return 'dehors'
  if (synthSettings.value.mufflerHz === DEDANS_HZ) return 'dedans'
  return 'libre'
})

const FREQUENCES = [
  { id: 6000, label: '6 kHz' },
  { id: 8000, label: '8 kHz' },
  { id: 10000, label: '10 kHz' },
  { id: 12000, label: '12 kHz' },
  { id: 20000, label: '20 kHz' },
] as const

const CONVOLUTIONS = [
  { id: 0, label: 'déportée' },
  { id: 1000, label: '1 000 éch.' },
  { id: 10000, label: '10 000 éch.' },
] as const

const BLOCS = [
  { id: 256, label: '256' },
  { id: 512, label: '512' },
  { id: 1024, label: '1024' },
  { id: 2048, label: '2048' },
] as const

/** Un choix chiffré pris sur un bouton, et non lu dans un événement. */
function chooseNumber(key: keyof SynthSettings, value: number): void {
  void applySynthSettings({ ...synthSettings.value, [key]: value })
}

const PLACES = [
  { id: 'dehors', label: 'Dehors' },
  { id: 'dedans', label: 'Dedans' },
  { id: 'libre', label: 'Libre' },
] as const

function choosePlace(choix: string): void {
  if (choix === 'libre') {
    // On s'écarte des deux valeurs rondes, sans quoi le choix ne se verrait pas.
    if (place.value !== 'libre') {
      void applySynthSettings({ ...synthSettings.value, mufflerHz: 6000 })
    }
    return
  }
  void applySynthSettings({
    ...synthSettings.value,
    mufflerHz: choix === 'dedans' ? DEDANS_HZ : DEHORS_HZ,
  })
}

/** Le choix d'échappement : une valeur de texte, pas un nombre. */
function chooseResponse(id: string): void {
  void applySynthSettings({ ...synthSettings.value, exhaustResponse: id as ExhaustResponse })
}

/**
 * Le moteur, paramètre par paramètre.
 *
 * Ils vivent dans le profil et voyagent avec lui ; ce panneau est seulement
 * l'endroit où on les tourne. L'ordre suivi est celui du contrat — le même que
 * lit le C++ — et les familles sont des tranches contiguës de cette liste, pas
 * un réarrangement.
 *
 * Des curseurs, pas de menu déroulant : le panneau se remanie à chaque mesure et
 * un menu ouvert se refermerait sous le doigt.
 */
const engineGroups = computed(() =>
  ENGINE_GROUPS.map((group) => ({
    ...group,
    fields: ENGINE_FIELDS.filter((field) => field.group === group.id),
    // Les moteurs ne sont proposés que là où ils se distinguent : sur les
    // bruits, tous portent la même valeur et les boutons seraient inertes.
    engines: groupVaries(LIBRARY_DEFINITIONS, group.id) ? ENGINE_LIBRARY : [],
  })),
)

/** Les définitions de la bibliothèque, pour savoir où les sections varient. */
const LIBRARY_DEFINITIONS = ENGINE_LIBRARY.map((entry) => entry.definition)

/**
 * Poser la section d'un moteur sur celui qui est réglé.
 *
 * David : « avoir les boutons de choix de moteur dans chaque section pour
 * essayer par exemple le moteur de la 454 avec l'échappement de la GM ». Le
 * rupteur ne suit pas — il vient du profil.
 */
function loadGroup(entry: LibraryEngine, group: EngineGroup): void {
  void applyEngineDefinition(mergeEngineGroup(engineDefinition.value, entry.definition, group))
}

/** Cette section est-elle déjà exactement celle de ce moteur ? */
function groupIsFrom(entry: LibraryEngine, group: EngineGroup): boolean {
  const pose = mergeEngineGroup(engineDefinition.value, entry.definition, group)
  return ENGINE_FIELDS.every((field) => {
    if (field.group !== group || field.fromProfile === true) return true
    const key = field.key as keyof EngineDefinition
    return Math.abs(pose[key] - engineDefinition.value[key]) < 1e-9
  })
}

/**
 * La définition de référence à laquelle se comparer.
 *
 * Celle du moteur qui a le même nombre de cylindres : comparer un quatre
 * cylindres aux cotes d'un V8 ne dirait rien. Un écart affiché est un écart
 * qu'on a choisi.
 */
const reference = computed<EngineDefinition>(() =>
  engineDefinition.value.cylinders === 4 ? SUBARU_EJ25 : GM_LS_V8,
)

/** Le rupteur ne se règle pas ici : il vient de la section moteur du profil. */
const redlineRpm = computed(() => activeProfile.value.engine.redlineRpm)

function engineValue(key: string): number {
  if (key === 'revLimit') return redlineRpm.value
  return engineDefinition.value[key as keyof EngineDefinition]
}

/** La valeur de référence, ou `null` quand celle qu'on a réglée la vaut. */
function engineGap(key: string): number | null {
  if (key === 'revLimit') return null
  const attendue = reference.value[key as keyof EngineDefinition]
  return Math.abs(attendue - engineValue(key)) < 1e-9 ? null : attendue
}

/**
 * Le nombre tel quel, à quatre décimales près.
 *
 * Pas un arrondi au pas du curseur : la section d'échappement du V8 vaut
 * 3,0625 po², et l'afficher « 3,06 » ferait croire à un écart à la référence là
 * où il n'y en a pas.
 */
function engineText(value: number): string {
  return String(Number(value.toFixed(4)))
}

function onEngine(key: string, event: Event): void {
  const target = event.target as HTMLInputElement
  void applyEngineDefinition({
    ...engineDefinition.value,
    [key]: Number(target.value),
  })
}

/**
 * Charger un moteur entier, plutôt que tourner vingt-huit boutons.
 *
 * « C'est vraiment difficile de trouver des réglages qui sont bien, ils ont
 * tous des effets les uns sur les autres et y'en a beaucoup » — et c'est exact :
 * un moteur est un ensemble où les valeurs s'accordent, pas vingt-huit chiffres
 * indépendants. On part donc d'un moteur relevé, puis on retouche.
 *
 * Le rupteur et le rendu partent avec la définition : les trois décrivent le
 * même moteur.
 */
function loadEngine(entry: LibraryEngine): void {
  void applyLibraryEngine(entry)
}

/**
 * Les valeurs comparées pour reconnaître un moteur.
 *
 * Prises sur une définition de référence plutôt qu'écrites à la main : la liste
 * suit le contrat sans qu'on ait à la tenir à jour.
 */
const ENGINE_KEYS = Object.keys(GM_LS_V8) as (keyof EngineDefinition)[]

/** Combien de valeurs séparent ce qui est réglé du moteur `entry`, rupteur compris. */
function gapsTo(entry: LibraryEngine): number {
  let gaps = entry.redlineRpm === redlineRpm.value ? 0 : 1
  for (const key of ENGINE_KEYS) {
    if (Math.abs(entry.definition[key] - engineDefinition.value[key]) > 1e-9) gaps += 1
  }
  return gaps
}

/**
 * Au-delà de la moitié des valeurs changées, plus rien ne dit d'où l'on est
 * parti : ce n'est plus un moteur retouché, c'en est un autre. On préfère ne
 * rien affirmer plutôt que désigner un départ au hasard.
 */
const ORIGIN_MAX_GAPS = Math.ceil((ENGINE_KEYS.length + 1) / 2)

/** Le moteur de la bibliothèque le plus proche de ce qui est réglé. */
const closest = computed<{ entry: LibraryEngine; gaps: number } | null>(() => {
  let best: { entry: LibraryEngine; gaps: number } | null = null
  for (const entry of ENGINE_LIBRARY) {
    const gaps = gapsTo(entry)
    if (best === null || gaps < best.gaps) best = { entry, gaps }
  }
  return best
})

/** Le moteur chargé, quand ce qui est réglé lui correspond exactement. */
const loaded = computed(() => (closest.value?.gaps === 0 ? closest.value.entry : null))

/** Le moteur dont on est parti, quand on l'a retouché sans le méconnaître. */
const origin = computed(() => {
  const near = closest.value
  if (near === null || near.gaps === 0 || near.gaps > ORIGIN_MAX_GAPS) return null
  return near
})

/** Ce qui est chargé, en une phrase. */
const loadedText = computed(() => {
  const near = closest.value
  if (near === null) return 'La bibliothèque de moteurs est vide.'
  if (near.gaps === 0) return `Chargé : ${near.entry.label}`
  if (near.gaps > ORIGIN_MAX_GAPS) {
    return 'Réglages personnels : aucun moteur de la bibliothèque ne s’en approche.'
  }
  const s = near.gaps > 1 ? 's' : ''
  return `Chargé : ${near.entry.label}, modifié — ${near.gaps} valeur${s} changée${s}`
})

function onFlag(key: keyof SynthSettings, event: Event): void {
  const target = event.target as HTMLInputElement
  void applySynthSettings({ ...synthSettings.value, [key]: target.checked })
}

/**
 * Le coefficient temps réel, et le seuil que le lot s'est fixé d'avance.
 *
 * ×3 dans la voiture : le son n'y sera pas seul. Ce poste-ci n'est pas la
 * voiture, mais un chiffre sous 1 ici veut dire que rien ne tiendra là-bas.
 */
/**
 * Au-delà de 20 kHz le passe-bas ne retire plus rien d'audible : autant le dire
 * plutôt que d'afficher un chiffre qui ne veut rien dire à cet endroit.
 */
const silencieux = computed(() =>
  synthSettings.value.mufflerHz >= 20000
    ? 'coupé'
    : `${(synthSettings.value.mufflerHz / 1000).toFixed(1)} kHz`,
)

const realtime = computed(() => synthStatus.value.realtime)
const realtimeWarn = computed(() => realtime.value > 0 && realtime.value < 1.5)

/**
 * Le régime demandé et celui que le moteur simulé tient.
 *
 * Le demandé est celui du cadran en conduite ; pendant un balayage, c'est le
 * banc qui l'impose. L'écart entre les deux est ce qui dit si le dynamomètre
 * tient — au-delà de quelques dizaines de tours, il sature et le compteur
 * ment.
 */
const gauge = computed(() => {
  // Le régime demandé vient du statut, jamais de la télémétrie — même hors
  // balayage, où l'un vaut l'autre. La télémétrie change soixante fois par
  // seconde : en dépendre faisait remanier tout le panneau à cette cadence, ce
  // qui refermait les menus déroulants sous le doigt. Mesuré : soixante-neuf
  // mutations du DOM par seconde dans la seule section des réglages.
  const asked = synthStatus.value.targetRpm
  const heard = synthStatus.value.engineRpm
  return { asked, heard, gap: heard - asked }
})
</script>

<template>
  <div class="synth">
    <section class="panel wide">
      <h2>Son synthétisé — engine-sim en direct</h2>
      <p class="note">
        Le régime du cadran est imposé au dynamomètre du moteur simulé, l'effort
        ouvre son papillon. Aucun échantillon n'est joué tant que ce mode
        tourne.
      </p>
      <div class="actions">
        <button :disabled="busy" @click="toggle()">
          {{ running ? 'Couper la synthèse' : 'Activer la synthèse' }}
        </button>
        <button :disabled="busy" @click="reset()">Réglages d'origine</button>
        <label class="silent">
          <input
            type="checkbox"
            :checked="synthSilent"
            @change="setSynthSilent(($event.target as HTMLInputElement).checked)"
          />
          Mesurer en silence
        </label>
        <span class="state">
          {{
            synthStatus.phase === 'loading'
              ? 'construction du moteur…'
              : synthStatus.phase === 'error'
                ? synthStatus.error
                : running
                  ? `${Math.round(synthStatus.sampleRate)} Hz, construit en ${Math.round(synthStatus.buildMs)} ms`
                  : 'arrêté'
          }}
        </span>
      </div>
    </section>

    <section class="panel">
      <h2>Ce qui sort</h2>
      <ValueRow label="Régime demandé" :value="Math.round(gauge.asked)" unit="tr/min" />
      <ValueRow label="Régime entendu" :value="Math.round(gauge.heard)" unit="tr/min" />
      <ValueRow
        label="Écart"
        :value="Math.round(gauge.gap)"
        unit="tr/min"
        :warn="Math.abs(gauge.gap) > 50"
        hint="Le dynamomètre tient l'arbre ; au-delà de quelques dizaines de tours, c'est qu'il sature."
      />
      <ValueRow label="Effort transmis" :value="synthStatus.effort.toFixed(2)" :bar="synthStatus.effort" />
      <ValueRow
        label="Niveau crête"
        :value="synthStatus.peak.toFixed(3)"
        :bar="synthStatus.peak"
        :warn="synthStatus.peak >= 0.999"
        hint="À 1,000 la sortie du synthétiseur bute sur son plafond — voulu en charge, pas au ralenti."
      />
      <ValueRow label="Niveau efficace" :value="synthStatus.rms.toFixed(3)" :bar="synthStatus.rms" />
      <ValueRow
        label="Brillance"
        :value="synthStatus.brightness.toFixed(3)"
        :bar="synthStatus.brightness"
        hint="Part de l'énergie au-dessus d'un kilohertz. Si elle ne bouge pas quand l'effort monte, le timbre ne suit pas."
      />
    </section>

    <section class="panel">
      <h2>Ce que ça coûte</h2>
      <ValueRow
        label="Temps réel"
        :value="realtime > 0 ? `×${realtime.toFixed(2)}` : '—'"
        :warn="realtimeWarn"
        hint="Secondes de son produites par seconde de processeur, mesurées sur la dernière fenêtre. Le seuil du lot est ×3 dans la voiture."
      />
      <ValueRow label="Charge" :value="(synthStatus.cpuLoad * 100).toFixed(0)" unit="%" :bar="synthStatus.cpuLoad" />
      <ValueRow
        label="Creux"
        :value="synthStatus.underruns"
        :warn="synthStatus.underruns > 0"
        hint="Nombre de fois où le lecteur n'avait plus rien à jouer."
      />
      <ValueRow
        label="Durée des creux"
        :value="synthStatus.underrunMs.toFixed(0)"
        unit="ms"
        :warn="synthStatus.underrunMs > 0"
      />
      <ValueRow
        label="Rendu manquant"
        :value="synthStatus.shortfall"
        unit="éch."
        :warn="synthStatus.shortfall > 0"
        hint="Échantillons que le WebAssembly n'a pas su rendre dans le bloc demandé."
      />
      <ValueRow label="Réserve du lecteur" :value="synthStatus.reserveMs.toFixed(0)" unit="ms" />
      <ValueRow label="Réserve interne" :value="synthStatus.innerLatencyMs.toFixed(0)" unit="ms" />
    </section>

    <section class="panel">
      <h2>Le calcul — coupe le son le temps de rebâtir</h2>
      <div class="field">
        <label>Simulation</label>
        <div class="choices">
          <button
            v-for="entry in FREQUENCES"
            :key="entry.id"
            :aria-pressed="synthSettings.simulationHz === entry.id"
            @click="chooseNumber('simulationHz', entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>Convolution interne</label>
        <div class="choices">
          <button
            v-for="entry in CONVOLUTIONS"
            :key="entry.id"
            :aria-pressed="synthSettings.impulseSamples === entry.id"
            @click="chooseNumber('impulseSamples', entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>Bloc rendu</label>
        <div class="choices">
          <button
            v-for="entry in BLOCS"
            :key="entry.id"
            :aria-pressed="synthSettings.blockFrames === entry.id"
            @click="chooseNumber('blockFrames', entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <label for="lev">Niveleur d'engine-sim</label>
        <input
          id="lev"
          type="checkbox"
          :checked="synthSettings.leveler"
          @change="onFlag('leveler', $event)"
        />
        <span class="numeric">{{ synthSettings.leveler ? 'actif' : 'coupé' }}</span>
      </div>
      <div class="field">
        <label for="levg">Gain fixe, niveleur coupé</label>
        <input
          id="levg"
          type="range"
          min="0.05"
          max="2"
          step="0.05"
          :value="synthSettings.levelerGain"
          @input="onNumber('levelerGain', $event)"
        />
        <span class="numeric">{{ synthSettings.levelerGain.toFixed(2) }}</span>
      </div>
      <div class="field">
        <label for="levt">Crête visée par le niveleur</label>
        <input
          id="levt"
          type="range"
          min="1000"
          max="32000"
          step="500"
          :value="synthSettings.levelerTarget"
          @input="onNumber('levelerTarget', $event)"
        />
        <span class="numeric">
          {{ (synthSettings.levelerTarget / 32768).toFixed(2) }}
          <em v-if="synthStatus.clipped > 0" class="gap">
            écrête {{ (synthStatus.clipped * 100).toFixed(1) }} %
          </em>
        </span>
      </div>
      <p class="note">
        La convolution interne n'est pas qu'un choix de coût : c'est une
        deuxième réponse impulsionnelle, en bruit blanc, empilée sur celle du
        <code>ConvolverNode</code>. Elle divise le facteur de crête par 3,5 à
        mille échantillons et par 5,7 à dix mille — elle lisse les fronts, donc
        elle enlève le mordant. Sa contrepartie est de rester loin du plafond.
      </p>
      <p class="note">
        La crête visée est le remède direct à ce plafond. engine-sim vise
        30 000 sur 32 767 et coupe au couteau ce qui dépasse : un « niveau
        crête » à 1,000 n'est pas un son fort, c'est un son écrêté. Le gain
        appliqué se lisse en environ 0,2 ms, donc le front d'une bouffée
        soudaine ne reçoit encore que 10 % du bon gain quand il arrive — plus
        le front est raide, plus il écrête. Le volume perdu se rattrape en
        aval, en flottant, où rien ne plafonne. « Écrête » compte les
        échantillons réellement butés sur ce plafond, pas la position d'un
        curseur.
      </p>
      <p class="note">
        Ce réglage change le <strong>niveau</strong>, pas le timbre. Essayé sur
        le banc à pleine charge tenue, de « n'écrête pas du tout » à « écrête
        sec » : aucune différence audible, une fois avec le son entièrement
        réverbéré, une fois avec la résonance à 0,45. Le mordant se règle avec
        la <em>résonance d'échappement</em> plus bas — la convolution étale les
        fronts, et à 1,00 plus rien du son direct n'arrive à la sortie.
      </p>
      <p class="note">
        Le niveleur vise une crête constante quel que soit le moteur — et efface
        l'effort au passage. Le couper laisse passer la dynamique du modèle.
        Ses deux bornes de gain ne sont lues qu'à la construction : le changer
        rebâtit le moteur.
      </p>
    </section>

    <section class="panel">
      <h2>Le timbre — s'applique sans coupure</h2>
      <div class="field">
        <label for="ti">Papillon au repos</label>
        <input
          id="ti"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="synthSettings.throttleIdle"
          @input="onNumber('throttleIdle', $event)"
        />
        <span class="numeric">{{ synthSettings.throttleIdle.toFixed(2) }}</span>
      </div>
      <div class="field">
        <label for="tf">Papillon à plein effort</label>
        <input
          id="tf"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="synthSettings.throttleFull"
          @input="onNumber('throttleFull', $event)"
        />
        <span class="numeric">{{ synthSettings.throttleFull.toFixed(2) }}</span>
      </div>
      <div class="field">
        <label for="vol">Volume</label>
        <input
          id="vol"
          type="range"
          min="0"
          max="6"
          step="0.05"
          :value="synthSettings.volume"
          @input="onNumber('volume', $event)"
        />
        <span class="numeric">{{ synthSettings.volume.toFixed(2) }}</span>
      </div>
      <div class="field">
        <label>Échappement</label>
        <div class="choices">
          <button
            v-for="entry in EXHAUST_RESPONSES"
            :key="entry.id"
            :aria-pressed="synthSettings.exhaustResponse === entry.id"
            @click="chooseResponse(entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>Où l'on écoute</label>
        <div class="choices">
          <button
            v-for="entry in PLACES"
            :key="entry.id"
            :aria-pressed="place === entry.id"
            @click="choosePlace(entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
      <div v-if="place === 'libre'" class="field">
        <label for="pot">Silencieux</label>
        <input
          id="pot"
          type="range"
          min="120"
          max="22000"
          step="20"
          :value="synthSettings.mufflerHz"
          @input="onNumber('mufflerHz', $event)"
        />
        <span class="numeric">{{ silencieux }}</span>
      </div>
      <div class="field">
        <label for="mix">Résonance d'échappement</label>
        <input
          id="mix"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="synthSettings.convolverMix"
          @input="onNumber('convolverMix', $event)"
        />
        <span class="numeric">{{ synthSettings.convolverMix.toFixed(2) }}</span>
      </div>
      <div v-if="synthSettings.exhaustResponse === 'tube'" class="field">
        <label for="tube">Accord de l'échappement</label>
        <input
          id="tube"
          type="range"
          min="20"
          max="400"
          step="1"
          :value="synthSettings.exhaustHz"
          @input="onNumber('exhaustHz', $event)"
        />
        <span class="numeric">{{ synthSettings.exhaustHz }} Hz</span>
      </div>
      <div v-if="synthSettings.exhaustResponse === 'tube'" class="field">
        <label for="len">Longueur de la résonance</label>
        <input
          id="len"
          type="range"
          min="20"
          max="600"
          step="10"
          :value="synthSettings.convolverMs"
          @input="onNumber('convolverMs', $event)"
        />
        <span class="numeric">{{ synthSettings.convolverMs }} ms</span>
      </div>
      <div class="field">
        <label for="res">Réserve visée</label>
        <input
          id="res"
          type="range"
          min="60"
          max="600"
          step="10"
          :value="synthSettings.reserveMs"
          @input="onNumber('reserveMs', $event)"
        />
        <span class="numeric">{{ synthSettings.reserveMs }} ms</span>
      </div>
      <p class="note">
        La réserve absorbe les pointes de calcul. Elle se paie en retard entre
        le cadran et le son : l'allonger fait disparaître les creux et éloigne
        le son de ce qu'on voit.
      </p>
    </section>

    <section class="panel wide">
      <h2>Le moteur — il vit dans le profil « {{ activeProfile.name }} »</h2>
      <p class="note">
        Ces nombres décrivent le moteur simulé et voyagent avec le profil :
        fichier, lien, stockage. Ils étaient écrits en dur dans le C++, où les
        changer demandait de recompiler. Tout, sauf les deux bruits, coupe le
        son le temps de rebâtir.
      </p>
      <h3>Charger un moteur</h3>
      <p class="loaded">{{ loadedText }}</p>
      <div v-if="ENGINE_LIBRARY.length > 0" class="library">
        <button
          v-for="entry in ENGINE_LIBRARY"
          :key="entry.id"
          :aria-pressed="entry.id === loaded?.id"
          :title="entry.source"
          @click="loadEngine(entry)"
        >
          {{ entry.label }}
        </button>
      </div>
      <div v-if="origin" class="actions">
        <button @click="loadEngine(origin.entry)">
          Annuler les retouches et recharger « {{ origin.entry.label }} »
        </button>
      </div>
      <p class="note">
        Charger écrit d'un coup les vingt-sept valeurs du moteur et son rupteur.
        Les curseurs qui suivent servent ensuite à retoucher : on charge
        d'abord, on affine après. Rien n'est perdu — recharger le moteur d'origine
        remet tout en place.
      </p>
      <div class="groups">
        <div v-for="group in engineGroups" :key="group.id" class="group">
          <h3>{{ group.label }}</h3>
          <div v-if="group.engines.length > 0" class="section-library">
            <button
              v-for="entry in group.engines"
              :key="entry.id"
              type="button"
              :aria-pressed="groupIsFrom(entry, group.id)"
              :title="`Prendre la section « ${group.label} » du ${entry.label}`"
              @click="loadGroup(entry, group.id)"
            >
              {{ entry.short }}
            </button>
          </div>
          <div v-for="field in group.fields" :key="field.key" class="field">
            <label :for="`eng-${field.key}`">{{ field.label }}</label>
            <input
              :id="`eng-${field.key}`"
              type="range"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :value="engineValue(field.key)"
              :disabled="field.fromProfile === true"
              @input="onEngine(field.key, $event)"
            />
            <span class="numeric">
              {{ engineText(engineValue(field.key)) }}{{ field.unit ? ' ' + field.unit : '' }}
              <em v-if="engineGap(field.key) !== null" class="gap">
                réf. {{ engineText(engineGap(field.key) as number) }}
              </em>
            </span>
          </div>
        </div>
      </div>
      <p class="note">
        La colonne de droite rappelle la valeur de référence quand on s'en
        écarte — celle du GM LS pour un huit cylindres, celle du Subaru EJ25
        pour un quatre. S'en écarter est un choix ; c'est ce qui a manqué au V8,
        dont l'échappement portait les cotes d'un EJ25 sans que rien ne le dise.
      </p>
      <p class="note">
        Le rupteur est en gris : il se règle dans la section moteur du profil,
        et deux réglages pour un seul chiffre finiraient par se contredire.
      </p>
    </section>

    <section class="panel">
      <h2>Le banc — écouter sans conduire</h2>
      <div class="field">
        <label for="sweep">Balayage du régime</label>
        <input
          id="sweep"
          type="checkbox"
          :checked="synthSettings.sweep"
          @change="onFlag('sweep', $event)"
        />
        <span class="numeric">{{ synthSettings.sweep ? 'en cours' : 'coupé' }}</span>
      </div>
      <div class="field">
        <label for="sweepsec">Durée d'un aller-retour</label>
        <input
          id="sweepsec"
          type="range"
          min="4"
          max="60"
          step="1"
          :value="synthSettings.sweepSeconds"
          @input="onNumber('sweepSeconds', $event)"
        />
        <span class="numeric">{{ synthSettings.sweepSeconds }} s</span>
      </div>
      <div class="field">
        <label for="fe">Effort imposé</label>
        <input
          id="fe"
          type="checkbox"
          :checked="synthSettings.forceEffort"
          @change="onFlag('forceEffort', $event)"
        />
        <span class="numeric">{{ synthSettings.forceEffort ? 'imposé' : 'suit la chaîne' }}</span>
      </div>
      <div class="field">
        <label for="fev">Valeur imposée</label>
        <input
          id="fev"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="synthSettings.forcedEffort"
          @input="onNumber('forcedEffort', $event)"
        />
        <span class="numeric">{{ synthSettings.forcedEffort.toFixed(2) }}</span>
      </div>
      <p class="note">
        Le balayage va du ralenti au rupteur du profil actif et revient, à
        cadence fixe, en remplaçant le régime que la chaîne calcule. C'est ce
        qui permet d'écouter la montée sans rouler — et de vérifier que le son
        tient en accélération, pas seulement à régime tenu. L'effort imposé
        sert à entendre ce qu'il change à régime constant : si seul le niveau
        bouge, le timbre ne suit pas.
      </p>
    </section>
  </div>
</template>

<style scoped>
.synth {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
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

.note {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0.7rem 0 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.state {
  color: var(--muted);
  font-size: 0.9rem;
}

.silent {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.field {
  display: grid;
  grid-template-columns: minmax(9rem, 1.2fr) minmax(6rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line);
}

.field:last-of-type {
  border-bottom: none;
}

.field label {
  color: var(--muted);
}

.field select {
  grid-column: 2 / -1;
}

/*
 * Des boutons, et non un menu déroulant.
 *
 * Le panneau se remanie à chaque mesure ; un menu ouvert se refermait alors sous
 * le doigt. Un bouton n'a pas d'état à perdre — et c'est le style de tout le
 * reste de l'application.
 */
.choices {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.choices button {
  padding: 0.3rem 0.6rem;
}

.field .numeric {
  text-align: right;
  min-width: 4rem;
}

.loaded {
  margin: 0.2rem 0 0.6rem;
  font-size: 0.9rem;
  color: var(--muted);
}

/*
 * La liste des moteurs — des boutons, jamais un menu déroulant.
 *
 * Elle s'allonge à mesure qu'on relève des définitions : une grille qui se
 * replie, et une hauteur bornée pour que les curseurs restent atteignables
 * sans traverser la liste entière.
 */
.library {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.4rem;
  max-height: 13rem;
  overflow-y: auto;
}

.library button {
  text-align: left;
}

/*
 * Les moteurs proposés dans une section : huit boutons sous un titre, donc
 * courts et serrés. Ils ne doivent pas prendre le pas sur les curseurs qui
 * suivent, qui sont le sujet de la section.
 */
.section-library {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0 0 0.5rem;
}

.section-library button {
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
}

.library + .actions {
  margin-top: 0.6rem;
}

/* Vingt-huit curseurs : en une colonne ils dépasseraient l'écran. */
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
  gap: 0 1.4rem;
  align-items: start;
}

h3 {
  margin: 0.9rem 0 0.2rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}

.group .field:last-of-type {
  border-bottom: 1px solid var(--line);
}

/* L'écart à la référence, sous la valeur réglée : on doit le voir sans le lire. */
.gap {
  display: block;
  font-style: normal;
  font-size: 0.75rem;
  color: var(--muted);
}

.field input:disabled {
  opacity: 0.4;
}
</style>
