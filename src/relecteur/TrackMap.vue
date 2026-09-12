<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'

import type { TrackPoint } from '../core/session/model'

/**
 * Le trajet sur une carte, et le véhicule qui suit la timeline.
 *
 * Reconnaître un endroit vaut mieux que lire un horodatage : « au rond-point
 * avant l'autoroute » se dit sans effort, « à douze minutes trente-quatre » ne
 * se dit pas du tout.
 *
 * Leaflet est la première dépendance d'interface du projet. Elle est acceptée
 * pour ce seul écran, qui vit sur une page à part et n'est jamais chargé par
 * l'application de conduite.
 */

const props = defineProps<{
  track: TrackPoint[]
  /** Position courante, ou `null` quand la session n'en a pas. */
  at: TrackPoint | null
  /** La vue suit-elle le véhicule ? */
  follow: boolean
}>()

const emit = defineEmits<{ (event: 'seek', at: number): void }>()

const holder = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let line: L.Polyline | null = null
let marker: L.CircleMarker | null = null

function latlngs(): L.LatLngExpression[] {
  return props.track.map((point) => [point.lat, point.lon])
}

/** Le point du trajet le plus proche d'un clic, pour y emmener la timeline. */
function nearest(target: L.LatLng): TrackPoint | null {
  let best: TrackPoint | null = null
  let bestD = Infinity
  for (const point of props.track) {
    const d = target.distanceTo([point.lat, point.lon])
    if (d < bestD) {
      bestD = d
      best = point
    }
  }
  return best
}

function draw(): void {
  if (map === null) return
  line?.remove()
  line = null
  if (props.track.length === 0) return

  line = L.polyline(latlngs(), { color: '#e8a33d', weight: 4 }).addTo(map)
  // Le clic va au tracé plutôt qu'à la carte : cliquer dans le vide ne veut
  // rien dire, et emmènerait la timeline n'importe où.
  line.on('click', (event: L.LeafletMouseEvent) => {
    const point = nearest(event.latlng)
    if (point) emit('seek', point.at)
  })
  map.fitBounds(line.getBounds(), { padding: [24, 24] })
}

onMounted(() => {
  if (holder.value === null) return
  map = L.map(holder.value, { attributionControl: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // L'attribution d'OpenStreetMap est obligatoire, pas décorative.
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
  map.setView([46.6, 2.5], 5)
  draw()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(() => props.track, draw)

watch(
  () => props.at,
  (point) => {
    if (map === null) return
    if (point === null) {
      marker?.remove()
      marker = null
      return
    }
    if (marker === null) {
      marker = L.circleMarker([point.lat, point.lon], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: '#e8a33d',
        fillOpacity: 1,
      }).addTo(map)
    } else {
      marker.setLatLng([point.lat, point.lon])
    }

    // Centré veut dire centré : la vue se pose sur le véhicule à chaque
    // relevé. Une première version ne recadrait qu'à la sortie du cadre — elle
    // économisait des mouvements, mais la voiture n'était jamais au centre, ce
    // qui n'est pas ce qu'on demande à un bouton nommé ainsi.
    //
    // Sans animation : Leaflet glisserait vers la nouvelle position, et vingt
    // glissements par seconde donnent une carte qui tremble.
    if (props.follow) {
      map.setView([point.lat, point.lon], map.getZoom(), { animate: false })
    }
  },
)

/** Activer le suivi recadre tout de suite : c'est ce qu'on attend d'un bouton. */
watch(
  () => props.follow,
  (actif) => {
    const point = props.at
    if (!actif || map === null || point === null) return
    map.setView([point.lat, point.lon], map.getZoom(), { animate: false })
  },
)
</script>

<template>
  <div class="map-holder">
    <div ref="holder" class="map"></div>
    <p v-if="track.length === 0" class="empty">
      Cette session ne porte aucune position. Le journal ne les inscrit qu'au dernier
      cran de la remontée.
    </p>
  </div>
</template>

<style scoped>
.map-holder {
  position: relative;
  height: 100%;
}

/* Elle prend la place que le parent lui laisse, et il lui laisse le reste. */
.map {
  height: 100%;
  min-height: 12rem;
  border-radius: 10px;
  background: #10131a;
}

.empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  margin: 0;
  color: var(--muted);
  background: var(--panel);
  border-radius: 10px;
}
</style>
