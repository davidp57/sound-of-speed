<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { EtapeDeVisite } from './visite'

const props = defineProps<{ etapes: readonly EtapeDeVisite[] }>()
const emit = defineEmits<{ fin: [] }>()

/**
 * Les bulles se posent sur la **vraie interface**, pas sur un dessin.
 *
 * Un schéma de l'écran aurait été plus simple à placer, et il aurait montré six
 * onglets là où la voiture en a quatre : ce qui est ouvert dépend du rôle du
 * compte et de l'appareil. En lisant les positions dans le document, la visite
 * décrit ce qui est réellement là — et saute ce qui n'y est pas.
 *
 * **Rien ne bouge** : une bulle apparaît, puis disparaît quand on passe à la
 * suivante. La règle « aucune animation » n'a pas d'exception.
 */
const MARGE = 12
const LARGEUR = 320
/** De quoi loger une bulle sous la cible plutôt qu'au-dessus. */
const PLACE_MINIMALE = 190
/** Entre la cible et la bulle : la flèche tient dans cet écart. */
const ECART = 14

/** Le halo déborde un peu de la cible, sinon il la serre au point de la cacher. */
const DEBORD = 6

const presentes = ref<EtapeDeVisite[]>([])
const index = ref(0)
const zone = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const cote = ref<'dessus' | 'dessous'>('dessous')
const bulle = ref<HTMLElement | null>(null)

const etape = computed(() => presentes.value[index.value])
const dernier = computed(() => index.value >= presentes.value.length - 1)

function cibleDe(nom: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-visite="${nom}"]`)
}

/**
 * Ce qui n'est pas dans le document ne se montre pas.
 *
 * Le verrou d'écran n'existe pas sur tous les navigateurs, le volume n'apparaît
 * qu'une fois le son prêt, et un rôle peut fermer un onglet. Filtrer une fois au
 * début donne en prime un décompte juste — « 3 / 7 » et non « 3 / 8 » avec une
 * case qu'on ne verra jamais.
 */
function releverLesCibles(): void {
  presentes.value = props.etapes.filter((e) => cibleDe(e.cible) !== null)
}

/**
 * Poser la bulle, puis vérifier qu'elle tient.
 *
 * Le premier choix se fait sur la place disponible, estimée. La vérification,
 * elle, **mesure la bulle rendue** : sa hauteur dépend de la longueur du texte,
 * et une estimation faisait sortir le pied de l'écran — donc les deux boutons —
 * sur une cible basse et un texte de cinq lignes.
 */
async function placer(): Promise<void> {
  const courante = etape.value
  if (courante === undefined) return
  const el = cibleDe(courante.cible)
  if (el === null) {
    // Disparue entre-temps : on passe plutôt que de pointer le vide.
    suivant()
    return
  }
  const r = el.getBoundingClientRect()
  zone.value = { x: r.left, y: r.top, w: r.width, h: r.height }
  const dessous = window.innerHeight - r.bottom
  cote.value = dessous >= PLACE_MINIMALE || dessous >= r.top ? 'dessous' : 'dessus'

  await nextTick()
  const rendue = bulle.value?.getBoundingClientRect()
  if (rendue === undefined) return
  if (cote.value === 'dessous' && rendue.bottom > window.innerHeight - MARGE) {
    cote.value = 'dessus'
  } else if (cote.value === 'dessus' && rendue.top < MARGE) {
    cote.value = 'dessous'
  }
}

/** Les écouteurs veulent une fonction qui ne rend rien. */
function replacer(): void {
  void placer()
}

const largeurUtile = computed(() =>
  Math.min(LARGEUR, Math.max(200, window.innerWidth - 2 * MARGE)),
)

const styleDuTrou = computed(() => {
  const z = zone.value
  if (z === null) return {}
  return {
    left: `${z.x - DEBORD}px`,
    top: `${z.y - DEBORD}px`,
    width: `${z.w + 2 * DEBORD}px`,
    height: `${z.h + 2 * DEBORD}px`,
  }
})

/** Le bord gauche de la bulle : centrée sur la cible, sans sortir de l'écran. */
const gauche = computed(() => {
  const z = zone.value
  if (z === null) return MARGE
  const centre = z.x + z.w / 2
  const max = window.innerWidth - largeurUtile.value - MARGE
  return Math.max(MARGE, Math.min(centre - largeurUtile.value / 2, max))
})

const styleDeLaBulle = computed(() => {
  const z = zone.value
  if (z === null) return {}
  const base = { left: `${gauche.value}px`, width: `${largeurUtile.value}px` }
  // Vers le haut, on ancre par le bas : la hauteur de la bulle dépend de son
  // texte, et la mesurer obligerait à un second rendu.
  return cote.value === 'dessous'
    ? { ...base, top: `${z.y + z.h + DEBORD + ECART}px` }
    : { ...base, bottom: `${window.innerHeight - z.y + DEBORD + ECART}px` }
})

const styleDeLaFleche = computed(() => {
  const z = zone.value
  if (z === null) return {}
  const centre = z.x + z.w / 2 - gauche.value
  return { left: `${Math.max(14, Math.min(centre - 8, largeurUtile.value - 30))}px` }
})

function suivant(): void {
  if (dernier.value) terminer()
  else index.value += 1
}

function terminer(): void {
  emit('fin')
}

watch(index, replacer)

onMounted(() => {
  releverLesCibles()
  if (presentes.value.length === 0) {
    terminer()
    return
  }
  replacer()
  // La barre du haut se replie sur deux lignes sous 655 pixels, et tout ce qui
  // est en dessous descend : une bulle posée avant le repli montrerait le vide.
  window.addEventListener('resize', replacer)
  window.addEventListener('scroll', replacer, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', replacer)
  window.removeEventListener('scroll', replacer, true)
})
</script>

<template>
  <div v-if="etape" class="visite">
    <!-- Ce calque prend les appuis : pendant la visite, on lit, on ne conduit
         pas. Le fond sombre, lui, vient de l'ombre portée du halo. -->
    <div class="bloqueur" />
    <div class="trou" :style="styleDuTrou" />
    <div ref="bulle" class="bulle" :class="`vers-${cote}`" :style="styleDeLaBulle">
      <div class="fleche" :style="styleDeLaFleche" />
      <h2>{{ etape.titre }}</h2>
      <p>{{ etape.texte }}</p>
      <div class="pied">
        <span class="rang">{{ index + 1 }} / {{ presentes.length }}</span>
        <button class="passer" @click="terminer()">Passer</button>
        <button class="suivant" @click="suivant()">
          {{ dernier ? 'Terminé' : 'Suivant' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.visite {
  position: fixed;
  inset: 0;
  z-index: 30;
}

.bloqueur {
  position: absolute;
  inset: 0;
}

/*
 * Le halo est un rectangle vide dont l'ombre portée couvre tout le reste de
 * l'écran : c'est ce qui fait le « trou » sans découper quoi que ce soit.
 */
.trou {
  position: fixed;
  border: 2px solid var(--accent);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72);
  pointer-events: none;
}

.bulle {
  position: fixed;
  padding: 0.9rem 1rem 0.75rem;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
}

.fleche {
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  transform: rotate(45deg);
}

/* La flèche est un carré tourné dont on ne garde que le coin qui dépasse. */
.vers-dessous .fleche {
  top: -9px;
  border-right: none;
  border-bottom: none;
}

.vers-dessus .fleche {
  bottom: -9px;
  border-left: none;
  border-top: none;
}

.bulle h2 {
  font-size: 1rem;
  margin: 0 0 0.35rem;
  color: var(--accent);
}

.bulle p {
  margin: 0;
  line-height: 1.45;
  font-size: 0.95rem;
}

.pied {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.rang {
  color: var(--muted);
  font-size: 0.85rem;
  margin-right: auto;
}

.passer {
  background: none;
  border-color: transparent;
  color: var(--muted);
  padding: 0.35rem 0.5rem;
}

.suivant {
  background: var(--accent);
  border-color: var(--accent);
  color: #17130a;
  font-weight: 600;
  padding: 0.35rem 0.9rem;
}
</style>
