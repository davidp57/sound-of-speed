<script setup lang="ts">
import { computed, ref } from 'vue'

import ValueRow from './components/ValueRow.vue'
import type { SynthSettings } from '../core/synth/settings'
import {
  applySynthSettings,
  setSynthEnabled,
  setSynthSilent,
  synthSettings,
  synthSilent,
  synthStatus,
  telemetry,
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
  const asked = synthSettings.value.sweep
    ? synthStatus.value.targetRpm
    : telemetry.value.engine.rpm
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
        hint="À 1,000 la sortie du synthétiseur bute sur son plafond : baisser le volume."
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
      <h2>Le moteur — coupe le son le temps de rebâtir</h2>
      <div class="field">
        <label for="cyl">Cylindres</label>
        <select id="cyl" :value="synthSettings.cylinders" @change="onNumber('cylinders', $event)">
          <option :value="4">4 en ligne</option>
          <option :value="8">8, vilebrequin croisé</option>
        </select>
      </div>
      <div class="field">
        <label for="hz">Simulation</label>
        <select id="hz" :value="synthSettings.simulationHz" @change="onNumber('simulationHz', $event)">
          <option :value="6000">6 kHz</option>
          <option :value="8000">8 kHz</option>
          <option :value="10000">10 kHz</option>
          <option :value="12000">12 kHz</option>
          <option :value="20000">20 kHz</option>
        </select>
      </div>
      <div class="field">
        <label for="ir">Convolution interne</label>
        <select id="ir" :value="synthSettings.impulseSamples" @change="onNumber('impulseSamples', $event)">
          <option :value="0">aucune — déportée sur Web Audio</option>
          <option :value="1000">1 000 échantillons</option>
          <option :value="10000">10 000 échantillons</option>
        </select>
      </div>
      <div class="field">
        <label for="block">Bloc rendu</label>
        <select id="block" :value="synthSettings.blockFrames" @change="onNumber('blockFrames', $event)">
          <option :value="256">256</option>
          <option :value="512">512</option>
          <option :value="1024">1024</option>
          <option :value="2048">2048</option>
        </select>
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
      <p class="note">
        La convolution interne est un produit direct : dix mille multiplications
        par échantillon. Web Audio fait la même chose en transformée de Fourier
        partitionnée, dans du code natif.
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
      <div class="field">
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
      <div class="field">
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

.field .numeric {
  text-align: right;
  min-width: 4rem;
}
</style>
