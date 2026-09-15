<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  accorderUneBanque,
  chargerLaFiche,
  donnerUnRole,
  reprendreUnRole,
  retirerUneBanque,
  type Fiche,
} from './api'
import { dateLisible, poidsLisible } from './format'

/** Les trois rôles, dans l'ordre où l'application les range. */
const ROLES = ['conduite', 'atelier', 'synthese'] as const

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

const emet = defineEmits<{ change: [] }>()
const refus = ref('')

/** Ce compte porte-t-il ce rôle, à l'instant ? */
function porte(role: string): boolean {
  return fiche.value?.roles.some((droit) => droit.role === role) === true
}

async function basculerLaBanque(banque: string): Promise<void> {
  refus.value = ''
  const accordee = fiche.value?.banques.includes(banque) === true
  const rendu = accordee
    ? await retirerUneBanque(proprietes.compte, banque)
    : await accorderUneBanque(proprietes.compte, banque)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  // On relit : un accord posé par la pile tient même après un retrait, et
  // l'écran doit dire ce que le serveur fait, pas ce qu'on a demandé.
  await recharger()
  emet('change')
}

async function basculerLeRole(role: string): Promise<void> {
  refus.value = ''
  const rendu = porte(role)
    ? await reprendreUnRole(proprietes.compte, role)
    : await donnerUnRole(proprietes.compte, role)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  // On relit plutôt que de deviner : ce que le serveur accorde vraiment dépend
  // aussi de ce que la pile offre à tout le monde.
  await recharger()
  emet('change')
}
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
      <dd class="roles">
        <button
          v-for="role in ROLES"
          :key="role"
          type="button"
          :aria-pressed="porte(role)"
          @click="basculerLeRole(role)"
        >
          {{ role }}
        </button>
      </dd>

      <dt>Banques réservées</dt>
      <dd v-if="fiche.banquesReservees.length === 0" class="muet">
        la pile n’en déclare aucune
      </dd>
      <dd v-else class="roles">
        <button
          v-for="banque in fiche.banquesReservees"
          :key="banque"
          type="button"
          :aria-pressed="fiche.banques.includes(banque)"
          @click="basculerLaBanque(banque)"
        >
          {{ banque }}
        </button>
      </dd>
    </dl>

    <p v-if="refus !== ''" class="refus">{{ refus }}</p>

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

.roles {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.refus {
  color: var(--warn);
  margin-top: 0.75rem;
}

.muet {
  color: var(--muted);
}
</style>
