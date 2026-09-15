<script setup lang="ts">
import { ref, watch } from 'vue'

import { chargerLaFiche, type Fiche } from './api'
import { dateLisible, poidsLisible } from './format'

/**
 * La fiche d'un compte : tout ce que le serveur sait de lui.
 *
 * **Sauf ce qu'il a déposé.** Aucun nom de profil, aucune date de trajet, aucun
 * nom de fichier : un nom de profil ou une date de dépôt disent où et quand
 * quelqu'un a roulé, et ça ne s'ouvre qu'avec son accord.
 */

const proprietes = defineProps<{ compte: string }>()

const fiche = ref<Fiche | null>(null)
const etat = ref<'chargement' | 'ouverte' | 'absente' | 'panne'>('chargement')
const panne = ref('')

async function recharger(): Promise<void> {
  etat.value = 'chargement'
  const rendu = await chargerLaFiche(proprietes.compte)
  if (rendu.etat === 'fermee') {
    etat.value = 'absente'
    return
  }
  if (rendu.etat === 'panne') {
    etat.value = 'panne'
    panne.value = rendu.motif
    return
  }
  fiche.value = rendu.valeur
  etat.value = 'ouverte'
}

watch(() => proprietes.compte, recharger, { immediate: true })
</script>

<template>
  <section v-if="etat === 'ouverte' && fiche !== null" class="fiche">
    <header>
      <img v-if="fiche.portrait !== null" :src="fiche.portrait" alt="" class="portrait" />
      <div>
        <h2>{{ fiche.nom }}</h2>
        <p class="muet">{{ fiche.adresse ?? 'sans adresse' }}</p>
      </div>
    </header>

    <dl>
      <dt>Identifiant</dt>
      <dd class="numeric">{{ fiche.id }}</dd>

      <dt>Créé le</dt>
      <dd class="numeric">{{ dateLisible(fiche.creeLe) }}</dd>

      <dt>Compte</dt>
      <dd>{{ fiche.anonyme ? 'anonyme' : 'nommé' }}</dd>

      <dt>Mot de passe</dt>
      <dd>{{ fiche.motDePasse ? 'oui' : 'non' }}</dd>

      <dt>Tenu ailleurs</dt>
      <dd>{{ fiche.fournisseurs.map((f) => f.nom).join(', ') || '—' }}</dd>

      <dt>Sessions ouvertes</dt>
      <dd>
        <span v-if="fiche.sessions.length === 0">—</span>
        <ul v-else>
          <li v-for="session in fiche.sessions" :key="session.ouverteLe" class="numeric">
            depuis le {{ dateLisible(session.ouverteLe) }}, jusqu’au
            {{ dateLisible(session.expireLe) }}
          </li>
        </ul>
      </dd>

      <dt>Rôles</dt>
      <dd>
        <span v-if="fiche.roles.length === 0">aucun</span>
        <ul v-else>
          <li v-for="droit in fiche.roles" :key="droit.role">
            {{ droit.role }}
            <span v-if="droit.expireLe !== null" class="muet numeric">
              jusqu’au {{ dateLisible(droit.expireLe) }}
            </span>
          </li>
        </ul>
      </dd>

      <dt>Banques réservées</dt>
      <dd>{{ fiche.banques.join(', ') || '—' }}</dd>
    </dl>

    <h3>Ce qu’il porte</h3>
    <dl>
      <dt>Profils</dt>
      <dd class="numeric">{{ fiche.porte.profils }}</dd>
      <dt>Moteurs</dt>
      <dd class="numeric">{{ fiche.porte.moteurs }}</dd>
      <dt>Boîtes</dt>
      <dd class="numeric">{{ fiche.porte.boites }}</dd>
      <dt>Dépôts</dt>
      <dd class="numeric">{{ fiche.porte.depots }}</dd>
      <dt>Poids</dt>
      <dd class="numeric">{{ poidsLisible(fiche.porte.octets) }}</dd>
      <dt>Trajets mesurés</dt>
      <dd class="numeric">{{ fiche.porte.trajetsMesures }}</dd>
    </dl>
  </section>

  <p v-else-if="etat === 'chargement'" class="muet">Chargement…</p>
  <p v-else-if="etat === 'absente'" class="muet">Ce compte n’existe plus.</p>
  <p v-else-if="etat === 'panne'" class="muet">Le serveur n’a pas répondu : {{ panne }}</p>
</template>

<style scoped>
.fiche {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 1rem 1.25rem;
}

header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.portrait {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
}

h2 {
  font-size: 1.05rem;
  margin: 0;
}

h3 {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 1.25rem 0 0.5rem;
}

p {
  margin: 0.15rem 0 0;
}

dl {
  display: grid;
  grid-template-columns: minmax(8rem, max-content) 1fr;
  gap: 0.35rem 1rem;
  margin: 0;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
}

ul {
  margin: 0;
  padding-left: 1rem;
}

.muet {
  color: var(--muted);
}
</style>
