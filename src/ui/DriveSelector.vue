<script setup lang="ts">
/**
 * Les commandes de conduite, entre les deux cadrans.
 *
 * C'est un **interrupteur d'application qui a la forme d'un sélecteur de
 * boîte** : D met en route, P met au repos. Le conducteur touche un objet qu'il
 * connaît, et l'application y gagne ce qui lui manquait — un geste, au sens du
 * navigateur, sur le démarrage de la géolocalisation. Le 11 septembre 2026, la
 * localisation n'a jamais démarré de tout un trajet et il a fallu lancer une
 * autre version de l'application pour s'en sortir ; il n'existait aucun bouton
 * pour la relancer, celui des sources ayant été retiré de l'image la veille.
 *
 * **Les deux commandes de boîte sont montrées côte à côte**, l'une active et
 * l'autre grise. Nommer le mode — un bouton « AUTO » qu'on bascule — disait
 * qu'il en existait un second sans dire ce qu'il changeait ; les deux colonnes
 * le montrent. Les touches grises ne sont donc pas un décor : elles sont ce
 * qu'on obtient en touchant l'autre étiquette.
 *
 * Le tempérament — route ou sport — vit sur la touche de marche, qui affiche
 * « D » ou « S ». Il **survit à la boîte manuelle**, où il ne commande plus les
 * passages mais commande encore le son ; il ne survit **pas** au repos, où la
 * touche affiche toujours « D » : la garder en « S » ferait lire une lettre et
 * repartir sur l'autre réglage.
 */
import { computed } from 'vue'

import {
  currentDriveMode,
  isRunning,
  setDriveMode,
  setShiftMode,
  shiftMode,
  shiftDown,
  shiftUp,
  start,
  stop,
} from '../state'

const manual = computed(() => shiftMode.value === 'manual')
const sport = computed(() => currentDriveMode.value === 'sport')

/**
 * La touche de marche : elle démarre, puis elle bascule le tempérament.
 *
 * Rien n'annonce que « D » cache « S » — décision de David, le 11 septembre
 * 2026 : la lettre change dès le premier appui donné en route, donc
 * l'apprentissage coûte un appui, et l'aide le dit. Un second caractère en
 * indice sur chaque touche aurait chargé l'écran pour l'économie de celui-là.
 */
function pressDrive(): void {
  if (!isRunning.value) start()
  else setDriveMode(sport.value ? 'road' : 'sport')
}

const driveLabel = computed(() => {
  if (!isRunning.value) return 'Démarrer l’application'
  return sport.value
    ? 'Mode sport — toucher pour revenir en route'
    : 'Mode route — toucher pour passer en sport'
})
</script>

<template>
  <div class="selector">
    <div class="modes">
      <!--
        La boîte automatique : une seule touche, qui porte la marche et le
        tempérament.
      -->
      <div class="mode" :class="{ 'is-on': !manual }">
        <div class="keys">
          <button
            type="button"
            class="key"
            :class="{ 'is-active': isRunning }"
            :aria-label="driveLabel"
            @click="pressDrive()"
          >
            <span class="letter">{{ isRunning && sport ? 'S' : 'D' }}</span>
            <svg v-if="!isRunning" class="power" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v9" />
              <path d="M6.8 6.8a7.5 7.5 0 1 0 10.4 0" />
            </svg>
          </button>
          <!--
            P est sous la touche de marche, et jamais estompé : il commande les
            deux colonnes, pas seulement celle où il se trouve. L'icône de veille
            ne s'y pose que quand l'application tourne — c'est elle qui dit qu'on
            a affaire à un interrupteur, et non à une vraie boîte.
          -->
          <button
            type="button"
            class="key park"
            :class="{ 'is-active': !isRunning }"
            :aria-label="isRunning ? 'Mettre au repos' : 'Au repos'"
            @click="stop()"
          >
            <span class="letter">P</span>
            <svg v-if="isRunning" class="power" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v9" />
              <path d="M6.8 6.8a7.5 7.5 0 1 0 10.4 0" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="tag"
          :aria-pressed="!manual"
          aria-label="Boîte automatique"
          @click="setShiftMode('auto')"
        >
          AUTO
        </button>
      </div>

      <!-- La boîte manuelle : les deux touches de passage. -->
      <div class="mode" :class="{ 'is-on': manual }">
        <div class="keys">
          <button
            type="button"
            class="key"
            :disabled="!manual || !isRunning"
            aria-label="Monter un rapport"
            @click="shiftUp()"
          >
            <span class="letter">+</span>
          </button>
          <button
            type="button"
            class="key"
            :disabled="!manual || !isRunning"
            aria-label="Rétrograder"
            @click="shiftDown()"
          >
            <span class="letter">−</span>
          </button>
        </div>
        <button
          type="button"
          class="tag"
          :aria-pressed="manual"
          aria-label="Boîte manuelle"
          @click="setShiftMode('manual')"
        >
          MAN
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.modes {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
}

/*
 * Les deux étiquettes sont sur la même ligne, quel que soit le nombre de
 * touches au-dessus : c'est par elles qu'on compare les deux modes.
 */
.mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.keys {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 0.4rem;
}

/*
 * On n'atténue que ce qui ne fait réellement rien, et c'est asymétrique
 * exprès : les touches de passage ne commandent rien en boîte automatique,
 * mais la touche de marche garde le tempérament en boîte manuelle — elle ne
 * décide plus des rapports, elle décide encore du son. La griser dirait le
 * contraire de ce qu'on a voulu en la laissant là.
 */
.mode:not(.is-on) .tag {
  opacity: 0.45;
}

.key:disabled {
  opacity: 0.3;
  cursor: default;
}

/*
 * Les touches sont les plus grandes de l'écran après les cadrans : elles se
 * touchent sans viser, en conduisant.
 */
.key {
  position: relative;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 0.8rem;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  padding: 0;
}

.letter {
  line-height: 1;
}

.power {
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  opacity: 0.8;
}

/* L'étiquette dit quel mode tient la main, et le donne d'un appui. */
.tag {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
}
</style>
