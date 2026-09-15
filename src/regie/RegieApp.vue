<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { chargerLesComptes, type LigneDeCompte } from './api'

/**
 * La régie : administrer les comptes depuis un écran.
 *
 * **Elle n'annonce rien à qui n'administre pas.** Le serveur répond 404 sur
 * toutes ses routes, et cette page n'affiche alors ni liste, ni motif, ni
 * invitation à se connecter : l'existence de la régie n'a pas à être une
 * information gratuite. Ce n'est pas ce qui protège — l'adresse se trouve —,
 * c'est le contrôle serveur qui garde.
 */

const comptes = ref<LigneDeCompte[]>([])
const recherche = ref('')
const etat = ref<'chargement' | 'ouverte' | 'fermee' | 'panne'>('chargement')
const panne = ref('')

/** Le filtre porte sur le nom et sur l'adresse, sans accent ni casse. */
const filtres = computed(() => {
  const cherche = normaliser(recherche.value)
  if (cherche === '') return comptes.value
  return comptes.value.filter(
    (compte) =>
      normaliser(compte.nom).includes(cherche) ||
      normaliser(compte.adresse ?? '').includes(cherche),
  )
})

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Une date lisible d'un coup d'œil, à la minute : on cherche « celui de tout à l'heure ». */
function dateLisible(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Le poids déposé, dans l'unité qui se lit : on repère un compte qui grossit. */
function poidsLisible(octets: number): string {
  if (octets === 0) return '—'
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Kio`
  if (octets < 1024 * 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mio`
  return `${(octets / (1024 * 1024 * 1024)).toFixed(2)} Gio`
}

onMounted(async () => {
  const rendu = await chargerLesComptes()
  if (rendu.etat === 'fermee') {
    etat.value = 'fermee'
    return
  }
  if (rendu.etat === 'panne') {
    etat.value = 'panne'
    panne.value = rendu.motif
    return
  }
  comptes.value = rendu.comptes
  etat.value = 'ouverte'
})
</script>

<template>
  <main class="regie">
    <template v-if="etat === 'ouverte'">
      <header>
        <h1>Régie</h1>
        <input
          v-model="recherche"
          type="text"
          class="recherche"
          placeholder="Chercher un nom ou une adresse"
          aria-label="Chercher un compte"
        />
      </header>

      <p v-if="comptes.length === 0" class="vide">Aucun compte sur ce serveur.</p>
      <p v-else-if="filtres.length === 0" class="vide">Aucun compte ne correspond.</p>

      <table v-else class="comptes">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Adresse</th>
            <th>Créé le</th>
            <th>Rôles</th>
            <th class="nombre">Déposé</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="compte in filtres" :key="compte.id">
            <td>
              {{ compte.nom }}
              <span v-if="compte.anonyme" class="muet">(anonyme)</span>
            </td>
            <td class="muet">{{ compte.adresse ?? '—' }}</td>
            <td class="numeric">{{ dateLisible(compte.creeLe) }}</td>
            <td class="muet">{{ compte.roles.join(', ') || '—' }}</td>
            <td class="nombre numeric">{{ poidsLisible(compte.octets) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!--
      Rien à dire : ni « connectez-vous », ni « vous n'avez pas le droit ». Les
      deux apprendraient qu'il y a quelque chose ici.
    -->
    <p v-else-if="etat === 'fermee'" class="vide">Cette page n’a rien à afficher.</p>
    <p v-else-if="etat === 'panne'" class="vide">Le serveur n’a pas répondu : {{ panne }}</p>
  </main>
</template>

<style scoped>
.regie {
  max-width: 68rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

h1 {
  font-size: 1.25rem;
  margin: 0;
}

.recherche {
  max-width: 22rem;
}

.comptes {
  width: 100%;
  border-collapse: collapse;
}

.comptes th,
.comptes td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--line);
}

.comptes th {
  color: var(--muted);
  font-weight: 500;
  font-size: 0.85rem;
}

.nombre {
  text-align: right;
}

.muet {
  color: var(--muted);
}

.vide {
  color: var(--muted);
}
</style>
