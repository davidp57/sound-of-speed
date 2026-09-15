<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import FicheDuCompte from './FicheDuCompte.vue'
import { chargerLaTrace, chargerLesComptes, type LigneDeCompte, type LigneDeTrace } from './api'
import { dateLisible, normaliser, poidsLisible } from './format'
import { phraseDuGeste } from './gestes'

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
const choisi = ref<string | null>(null)
const etat = ref<'chargement' | 'ouverte' | 'fermee' | 'panne'>('chargement')
const panne = ref('')

/** Le filtre porte sur le nom et sur l'adresse. */
const filtres = computed(() => {
  const cherche = normaliser(recherche.value)
  if (cherche === '') return comptes.value
  return comptes.value.filter(
    (compte) =>
      normaliser(compte.nom).includes(cherche) || normaliser(compte.adresse ?? '').includes(cherche),
  )
})

const trace = ref<LigneDeTrace[]>([])

async function recharger(): Promise<void> {
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
  comptes.value = rendu.valeur
  etat.value = 'ouverte'

  const lignes = await chargerLaTrace()
  if (lignes.etat === 'ouverte') trace.value = lignes.valeur
}

onMounted(recharger)
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
          <tr
            v-for="compte in filtres"
            :key="compte.id"
            :class="{ 'est-choisi': compte.id === choisi }"
            @click="choisi = compte.id === choisi ? null : compte.id"
          >
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

      <FicheDuCompte
        v-if="choisi !== null"
        :key="choisi"
        :compte="choisi"
        class="detail"
        @change="recharger"
      />

      <section class="trace">
        <h2>Ce qui a été fait</h2>
        <p v-if="trace.length === 0" class="vide">Rien encore.</p>
        <ul v-else>
          <li v-for="(ligne, rang) in trace" :key="rang">
            <span class="numeric muet">{{ dateLisible(ligne.quand) }}</span>
            — {{ ligne.admin.nom ?? 'un compte effacé' }} :
            {{ phraseDuGeste(ligne.geste, ligne.detail) }}
            <span class="muet">sur {{ ligne.cible.nom ?? 'un compte effacé' }}</span>
          </li>
        </ul>
      </section>
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

.comptes tbody tr {
  cursor: pointer;
}

.comptes tbody tr.est-choisi {
  background: var(--panel-alt);
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

.detail {
  margin-top: 1.5rem;
}

.trace {
  margin-top: 2rem;
}

.trace h2 {
  font-size: 0.95rem;
  color: var(--muted);
  font-weight: 500;
}

.trace ul {
  margin: 0;
  padding-left: 1rem;
}

.trace li {
  padding: 0.15rem 0;
}
</style>
