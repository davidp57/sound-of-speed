<script setup lang="ts">
import { computed } from 'vue'

/**
 * Cadran à aiguille.
 *
 * Il sert au régime et à la vitesse : même géométrie, mêmes graduations, seules
 * les bornes changent. Un cadran se lit d'un coup d'œil là où un nombre se lit
 * en le lisant, et l'aiguille donne la tendance — ça monte, ça retombe — qu'un
 * chiffre ne donne qu'en le comparant de mémoire au précédent.
 *
 * **Aucune inertie propre à l'aiguille**, et aucune transition : elle est
 * redessinée à la valeur reçue, à chaque image. Le régime est déjà lissé par le
 * conditionnement et par le volant moteur ; en rajouter la ferait mentir. C'est
 * aussi pourquoi son mouvement n'est pas de l'animation au sens que le projet
 * proscrit : il **est** la valeur.
 *
 * Le nombre reste écrit au centre, en petit. Il sert au réglage et au
 * diagnostic, où un écart de cent tours ne se voit pas sur une aiguille.
 *
 * Tout est en SVG, dans un repère fixe de 200 × 150 : le cadran garde ses
 * proportions à n'importe quelle largeur, et les textes grandissent avec lui
 * sans qu'aucune règle de style n'ait à s'en occuper.
 */

const props = withDefaults(
  defineProps<{
    /** Valeur montrée par l'aiguille. */
    value: number
    /** Borne haute de l'échelle. */
    max: number
    /** Unité, écrite sous le nombre. */
    unit: string
    min?: number
    /** Écart entre deux graduations chiffrées. */
    step?: number
    /** Graduations muettes entre deux chiffrées. */
    minorPerStep?: number
    /** Début de la zone rouge. `null` quand le cadran n'en a pas. */
    redline?: number | null
    /** Passe l'aiguille en alerte, sans rien changer à sa position. */
    alert?: boolean
  }>(),
  { min: 0, step: 1000, minorPerStep: 1, redline: null, alert: false },
)

/** Centre, rayon de l'arc et balayage : voir le repère fixe du commentaire. */
const CX = 100
const CY = 94
const R = 86
/** Angle de la borne basse, en degrés, dans le repère SVG (y vers le bas). */
const START = 150
const SWEEP = 240

/** Longueur de l'aiguille et demi-largeur de son pied. */
const NEEDLE = 64
const NEEDLE_HALF_WIDTH = 4.5

interface Point {
  x: number
  y: number
}

function polar(fraction: number, radius: number): Point {
  const angle = ((START + fraction * SWEEP) * Math.PI) / 180
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) }
}

function fractionOf(value: number): number {
  const span = props.max - props.min
  if (!(span > 0)) return 0
  const fraction = (value - props.min) / span
  return fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
}

function arc(from: number, to: number, radius: number): string {
  const a = polar(from, radius)
  const b = polar(to, radius)
  const large = (to - from) * SWEEP > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

const track = computed(() => arc(0, 1, R))

/**
 * Zone rouge : elle commence au seuil de coupure et va jusqu'au bout de
 * l'échelle. C'est tout l'intérêt d'un cadran — le plafond se voit sans lire un
 * seul chiffre.
 */
const redlineArc = computed(() => {
  if (props.redline === null) return ''
  const from = fractionOf(props.redline)
  return from >= 1 ? '' : arc(from, 1, R)
})

/** Nombre d'intervalles chiffrés. Au moins un, sinon il n'y a pas d'échelle. */
const majorCount = computed(() => {
  const step = props.step > 0 ? props.step : props.max - props.min
  return Math.max(1, Math.round((props.max - props.min) / step))
})

interface Tick extends Point {
  x2: number
  y2: number
  major: boolean
}

const ticks = computed<Tick[]>(() => {
  const out: Tick[] = []
  const perStep = Math.max(0, Math.round(props.minorPerStep)) + 1
  const total = majorCount.value * perStep
  for (let i = 0; i <= total; i += 1) {
    const major = i % perStep === 0
    const fraction = i / total
    const from = polar(fraction, R - 7)
    const to = polar(fraction, major ? R - 20 : R - 13)
    out.push({ x: from.x, y: from.y, x2: to.x, y2: to.y, major })
  }
  return out
})

const labels = computed(() =>
  Array.from({ length: majorCount.value + 1 }, (_, i) => {
    const fraction = i / majorCount.value
    const at = polar(fraction, R - 33)
    return { x: at.x, y: at.y, text: String(Math.round(props.min + fraction * (props.max - props.min))) }
  }),
)

const needle = computed(() => {
  const fraction = fractionOf(props.value)
  const tip = polar(fraction, NEEDLE)
  const angle = ((START + fraction * SWEEP) * Math.PI) / 180
  // Perpendiculaire à l'aiguille : le pied s'élargit, l'aiguille se voit de loin.
  const nx = -Math.sin(angle) * NEEDLE_HALF_WIDTH
  const ny = Math.cos(angle) * NEEDLE_HALF_WIDTH
  return `${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${(CX + nx).toFixed(2)},${(CY + ny).toFixed(2)} ${(CX - nx).toFixed(2)},${(CY - ny).toFixed(2)}`
})

const shown = computed(() => Math.round(props.value))
</script>

<template>
  <svg class="dial" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
    <!--
      Fond opaque du cadran : il garantit le contraste de l'aiguille et des
      graduations quel que soit ce qui passe derrière — le paysage, notamment.
      Le bas du disque sort du cadre et s'y trouve coupé net, ce qui est voulu :
      le balayage ne descend pas jusque-là, et le nombre y gagne un fond plein.
    -->
    <circle class="face" :cx="CX" :cy="CY" :r="R + 4" />

    <path class="track" :d="track" />
    <path v-if="redlineArc" class="redline" :d="redlineArc" />

    <line
      v-for="(tick, index) in ticks"
      :key="index"
      :class="tick.major ? 'tick major' : 'tick'"
      :x1="tick.x.toFixed(2)"
      :y1="tick.y.toFixed(2)"
      :x2="tick.x2.toFixed(2)"
      :y2="tick.y2.toFixed(2)"
    />

    <text
      v-for="(label, index) in labels"
      :key="index"
      class="graduation numeric"
      :x="label.x.toFixed(2)"
      :y="label.y.toFixed(2)"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ label.text }}
    </text>

    <polygon class="needle" :class="{ alert }" :points="needle" />
    <circle class="hub" :cx="CX" :cy="CY" r="7" />

    <text class="value numeric" x="100" y="130" text-anchor="middle">{{ shown }}</text>
    <text class="unit" x="100" y="143" text-anchor="middle">{{ unit }}</text>
  </svg>
</template>

<style scoped>
.dial {
  display: block;
  width: 100%;
  height: auto;
  max-height: 100%;
}

.face {
  fill: var(--panel);
  stroke: var(--line);
  stroke-width: 1;
}

.track {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 10;
  stroke-linecap: butt;
}

.redline {
  fill: none;
  stroke: var(--warn);
  stroke-width: 10;
  stroke-linecap: butt;
}

.tick {
  stroke: var(--muted);
  stroke-width: 2;
}

.tick.major {
  stroke: var(--text);
  stroke-width: 3.5;
}

/*
 * Chiffres des graduations : petits et gras plutôt que grands et fins. Dix
 * graduations sur le compteur laissent 26 unités de repère à repère ; au-delà
 * de dix unités de corps, elles se touchent, et l'aiguille passe dessus.
 */
.graduation {
  fill: var(--text);
  font-size: 10px;
  font-weight: 600;
}

.needle {
  fill: var(--accent);
}

.needle.alert {
  fill: var(--warn);
}

.hub {
  fill: var(--line-strong);
  stroke: var(--panel);
  stroke-width: 2;
}

.value {
  fill: var(--text);
  font-size: 22px;
  font-weight: 300;
}

.unit {
  fill: var(--muted);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
