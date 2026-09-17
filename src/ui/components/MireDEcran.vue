<script setup lang="ts">
/**
 * La mire : ce que les chiffres ne peuvent pas dire.
 *
 * Deux choses qu'aucune mesure logicielle ne donne :
 *
 * 1. **Où la page s'arrête vraiment.** Un cadre qui occupe exactement la zone
 *    utile, gradué tous les cent pixels. On voit d'un coup ce que les barres
 *    prennent, et le plein écran se juge en basculant.
 * 2. **Ce qu'un pixel fait en millimètres.** Les unités physiques du CSS sont
 *    fausses par définition — la spécification les fixe à 96 px par pouce,
 *    quelle que soit la dalle. Or c'est la taille physique qui décide si un
 *    texte se lit en conduisant.
 *
 * D'où la **carte bancaire** : 85,60 × 53,98 mm, norme ISO/IEC 7810 ID-1.
 * N'importe quelle carte fait exactement cela, et on en a toujours une sur soi.
 * On la pose sur l'écran, on règle le curseur jusqu'à ce que le rectangle
 * disparaisse dessous, et la valeur est mesurée au lieu d'être calculée.
 *
 * Le calcul, lui, reposait sur une diagonale lue dans un article qui se trompait
 * par ailleurs sur le format de la dalle.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  lireLEtalonDEcran,
  mesurerLEcran,
  mesureUtilisable,
  rangerLEtalonDEcran,
} from '../../core/appareil'
import { noterLEtalonDEcran } from '../../state'

const emit = defineEmits<{ (e: 'fermer'): void }>()

/** Carte bancaire, norme ISO/IEC 7810 ID-1. */
const CARTE_MM = { largeur: 85.6, hauteur: 53.98 }

/**
 * Ce que vaut un pixel CSS, faute de mieux : 25,4 mm par pouce, 96 px par pouce.
 *
 * C'est la valeur que le CSS prétend, et le point de départ du réglage. Sur la
 * dalle de la voiture, avec une densité de 1,53, elle est probablement fausse —
 * c'est tout l'objet de la mire.
 */
const MM_PAR_PIXEL_CSS = 25.4 / 96

const mesure = ref(mesurerLEcran(window))
const mmParPixel = ref(lireLEtalonDEcran() ?? MM_PAR_PIXEL_CSS)
const retenu = ref(false)

function rafraichir(): void {
  mesure.value = mesurerLEcran(window)
}

onMounted(() => {
  window.addEventListener('resize', rafraichir)
  document.addEventListener('fullscreenchange', rafraichir)
  window.visualViewport?.addEventListener('resize', rafraichir)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', rafraichir)
  document.removeEventListener('fullscreenchange', rafraichir)
  window.visualViewport?.removeEventListener('resize', rafraichir)
})

const utilisable = computed(() => mesureUtilisable(mesure.value))

const carte = computed(() => ({
  largeur: CARTE_MM.largeur / mmParPixel.value,
  hauteur: CARTE_MM.hauteur / mmParPixel.value,
}))

/** Points par pouce de la dalle, déduits de l'étalon. */
const ppi = computed(() => (25.4 / mmParPixel.value) * mesure.value.densite)

function retenir(): void {
  rangerLEtalonDEcran(mmParPixel.value)
  noterLEtalonDEcran(mmParPixel.value)
  retenu.value = true
}

/** Les graduations du cadre, tous les cent pixels. */
const graduationsX = computed(() =>
  Array.from({ length: Math.floor(mesure.value.page.largeur / 100) }, (_, i) => (i + 1) * 100),
)
const graduationsY = computed(() =>
  Array.from({ length: Math.floor(mesure.value.page.hauteur / 100) }, (_, i) => (i + 1) * 100),
)

async function basculerLePleinEcran(): Promise<void> {
  if (document.fullscreenElement === null) await document.documentElement.requestFullscreen()
  else await document.exitFullscreen()
}
</script>

<template>
  <div class="mire">
    <!-- Le cadre épouse la zone utile : ses bords sont la réponse. -->
    <div class="cadre">
      <span v-for="x in graduationsX" :key="`x${x}`" class="gradx" :style="{ left: `${x}px` }">
        <b>{{ x }}</b>
      </span>
      <span v-for="y in graduationsY" :key="`y${y}`" class="grady" :style="{ top: `${y}px` }">
        <b>{{ y }}</b>
      </span>
    </div>

    <div class="carte" :style="{ width: `${carte.largeur}px`, height: `${carte.hauteur}px` }">
      <span>85,60 × 53,98 mm</span>
    </div>

    <div class="panneau">
      <h3>Mire d’écran</h3>

      <p v-if="!utilisable" class="consigne warn">
        L’écran est masqué : le navigateur suspend son rendu et tout sort à zéro. Rien n’est
        mesurable tant que cette fenêtre n’est pas devant.
      </p>
      <p class="consigne">
        Posez une carte bancaire sur le rectangle et réglez le curseur jusqu’à ce qu’elle le
        recouvre exactement.
      </p>

      <label class="reglage">
        <span>{{ mmParPixel.toFixed(4) }} mm par pixel — {{ ppi.toFixed(0) }} PPI</span>
        <input v-model.number="mmParPixel" type="range" min="0.05" max="0.6" step="0.001" />
      </label>

      <dl>
        <dt>Page</dt>
        <dd>{{ mesure.page.largeur }} × {{ mesure.page.hauteur }}</dd>
        <dt>Fenêtre</dt>
        <dd>{{ mesure.fenetre.largeur }} × {{ mesure.fenetre.hauteur }}</dd>
        <dt>Châssis</dt>
        <dd>{{ mesure.chassis.largeur }} × {{ mesure.chassis.hauteur }}</dd>
        <dt>Écran</dt>
        <dd>{{ mesure.ecran.largeur }} × {{ mesure.ecran.hauteur }}</dd>
        <dt>Densité</dt>
        <dd>{{ mesure.densite }}</dd>
        <dt>Échelle</dt>
        <dd>{{ mesure.echelle }}</dd>
        <dt>Plein écran</dt>
        <dd>{{ mesure.pleinEcran ? 'oui' : 'non' }}</dd>
        <dt>En vrai</dt>
        <dd>
          {{ (mesure.page.largeur * mmParPixel).toFixed(0) }} ×
          {{ (mesure.page.hauteur * mmParPixel).toFixed(0) }} mm
        </dd>
      </dl>

      <div class="gestes">
        <button type="button" @click="basculerLePleinEcran()">
          {{ mesure.pleinEcran ? 'Quitter le plein écran' : 'Passer en plein écran' }}
        </button>
        <button type="button" @click="retenir()">
          {{ retenu ? 'Retenu' : 'Retenir cette valeur' }}
        </button>
        <button type="button" @click="emit('fermer')">Fermer</button>
      </div>

      <p class="note">
        « Retenir » range la valeur sur cet appareil et l’inscrit au journal : elle remonte avec
        le trajet, il n’y a rien à noter.
      </p>
    </div>
  </div>
</template>

<style scoped>
.mire {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--bg);
  overflow: hidden;
}

/*
 * Le cadre occupe la zone utile entière. C'est ce qu'on vient voir : si son bord
 * droit tombe avant le bord de la dalle, la différence est une barre.
 */
.cadre {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
}

.gradx,
.grady {
  position: absolute;
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
}

.gradx {
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--line);
}

.gradx b {
  position: absolute;
  top: 2px;
  left: 3px;
  font-weight: 400;
}

.grady {
  left: 0;
  right: 0;
  border-top: 1px solid var(--line);
}

.grady b {
  position: absolute;
  top: 2px;
  left: 3px;
  font-weight: 400;
}

/* Le rectangle étalon, au coin haut gauche : une carte se pose à plat, sans viser. */
.carte {
  position: absolute;
  top: 40px;
  left: 40px;
  border: 2px solid var(--good);
  background: var(--panel-alt);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  color: var(--good);
  font-size: 12px;
  padding-bottom: 4px;
}

.panneau {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: min(360px, calc(100% - 24px));
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 12px;
  color: var(--text);
  font-size: 13px;
}

h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.warn {
  color: var(--warn);
}

.consigne,
.note {
  margin: 0 0 8px;
  color: var(--muted);
  line-height: 1.35;
}

.note {
  margin: 8px 0 0;
  font-size: 12px;
}

.reglage {
  display: block;
  margin-bottom: 8px;
}

.reglage input {
  width: 100%;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  margin: 0 0 10px;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.gestes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

button {
  background: var(--panel-alt);
  border: 1px solid var(--line);
  color: var(--text);
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}
</style>
