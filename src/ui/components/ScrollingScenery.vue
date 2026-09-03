<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { telemetry } from '../../state'

/**
 * Paysage qui défile derrière le tableau de bord.
 *
 * **C'est de l'agrément, et rien ne s'y lit.** La règle « aucune animation » du
 * projet a été levée pour ce décor seul, le 3 septembre 2026, en connaissance de
 * cause : la justification n'est pas la lisibilité mais le fait qu'un décor rend
 * l'attente moins vide. Les cadrans, eux, tiennent par la lisibilité.
 *
 * Trois choix suivent directement de la contrainte de cadence.
 *
 * **Une boucle d'images à part, qui ne touche pas au son.** L'horloge de la
 * simulation bat sur le fil audio, parce que le navigateur ralentit les
 * minuteurs dès que la page n'est plus visible. Faire dessiner le décor depuis
 * cette horloge mettrait du travail d'affichage sur le chemin qui doit rester
 * régulier. Le décor a donc son propre `requestAnimationFrame`, qui ne fait que
 * **lire** la vitesse déjà calculée.
 *
 * **Rien que des translations.** Chaque couche est une bande large, remplie d'un
 * motif qui se répète, déplacée par `translate3d`. Le navigateur la recompose
 * sans la redessiner : pas de trait tracé à chaque image, pas de canevas à
 * repeindre.
 *
 * **Coupé, il ne coûte rien** : le composant n'est pas monté, donc il n'y a pas
 * de boucle. Et en arrière-plan, `requestAnimationFrame` est gelé par le
 * navigateur — le décor s'arrête de lui-même, le son continue.
 */

/**
 * Pixels parcourus à l'écran par mètre parcouru par la voiture.
 *
 * Calé sur les pointillés de la chaussée : leur motif fait 80 pixels, ce qui à
 * 50 km/h en fait passer un peu plus d'un par seconde — la cadence qu'on voit
 * par la vitre.
 */
const PX_PER_METRE = 6

/** Largeur du motif de chaque couche, et sa part du déplacement. */
const LAYERS = [
  { name: 'far', tile: 240, factor: 0.15 },
  { name: 'near', tile: 160, factor: 0.45 },
  { name: 'road', tile: 80, factor: 1 },
] as const

const far = ref<HTMLElement | null>(null)
const near = ref<HTMLElement | null>(null)
const road = ref<HTMLElement | null>(null)

let handle: number | null = null
let lastAt = 0
/** Distance parcourue depuis le montage, en mètres. */
let travelledM = 0

function frame(now: number): void {
  // Le gel de l'arrière-plan peut avoir duré : on borne l'écart, sinon le décor
  // ferait un saut au retour.
  const dt = lastAt > 0 ? Math.min(0.25, (now - lastAt) / 1000) : 0
  lastAt = now

  // `atStandstill` plutôt que « la vitesse vaut zéro » : à l'arrêt, le ressort
  // du conditionnement laisse un résidu de quelques millièmes de km/h. Mesuré,
  // il faisait glisser le décor d'un pixel par minute — invisible, mais un
  // paysage qui bouge voiture arrêtée est un paysage qui ment.
  const speed = telemetry.value.speed
  if (!speed.atStandstill) travelledM += (Math.max(0, speed.kmh) / 3.6) * dt

  const elements = [far.value, near.value, road.value]
  for (let i = 0; i < LAYERS.length; i += 1) {
    const layer = LAYERS[i]
    const element = elements[i]
    if (!layer || !element) continue
    const shift = (travelledM * PX_PER_METRE * layer.factor) % layer.tile
    element.style.transform = `translate3d(${-shift}px, 0, 0)`
  }

  handle = requestAnimationFrame(frame)
}

onMounted(() => {
  handle = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (handle !== null) cancelAnimationFrame(handle)
  handle = null
})
</script>

<template>
  <div class="scenery" aria-hidden="true">
    <div ref="far" class="layer far" />
    <div ref="near" class="layer near" />
    <div ref="road" class="layer road" />
  </div>
</template>

<style scoped>
/*
 * Les couleurs sont écrites en clair : un motif dans une adresse `data:` ne peut
 * pas lire les variables de la feuille de style. Elles sont volontairement
 * ternes — le décor doit rester derrière les cadrans, pas leur disputer l'œil.
 */
.scenery {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(to bottom, #0f141c 0%, #1e2a3b 55%, #26344a 100%);
}

/*
 * Chaque bande dépasse largement des deux côtés : la translation vers la gauche
 * ne peut donc pas découvrir de vide à droite.
 */
.layer {
  position: absolute;
  left: -300px;
  right: -300px;
  background-repeat: repeat-x;
  will-change: transform;
}

.far {
  bottom: 34%;
  height: 30%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 100' preserveAspectRatio='none'%3E%3Cpath fill='%23324459' d='M0 100V62c20-12 40 10 60-2 25-14 40 12 70 0s55 14 80 0c15-8 25-2 30 2v38z'/%3E%3C/svg%3E");
  background-size: 240px 100%;
  background-position: left bottom;
}

.near {
  bottom: 24%;
  height: 30%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='none'%3E%3Cpath fill='%231b2735' d='M0 100V72c18-12 34 10 52-2 20-14 36 10 58-2 20-11 36 8 50 4v28z'/%3E%3C/svg%3E");
  background-size: 160px 100%;
  background-position: left bottom;
}

.road {
  bottom: 0;
  height: 24%;
  background-color: #0f1319;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 40' preserveAspectRatio='none'%3E%3Crect x='0' y='18' width='38' height='4' fill='%233a4250'/%3E%3C/svg%3E");
  background-size: 80px 100%;
  background-position: left center;
}
</style>
