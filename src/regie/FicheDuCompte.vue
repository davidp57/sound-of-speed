<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  accorderUneBanque,
  chargerLaFiche,
  chargerLeVerdict,
  chargerLesDonnees,
  chargerUnContenu,
  donnerUnRole,
  effacerLeCompte,
  forcerLaRetention,
  poserUnPlafond,
  reglerLAbandon,
  reprendreUnRole,
  retirerLePlafond,
  retirerUneBanque,
  type Donnees,
  type Fiche,
  type Verdict,
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
const donnees = ref<Donnees | null>(null)
/** Pourquoi le détail n'est pas là, quand il n'y est pas. */
const donneesEnPanne = ref('')

/**
 * Le contenu d'un profil, d'un moteur ou d'une boîte.
 *
 * C'est ce pour quoi l'accord existe : lire le réglage qui cloche plutôt que de
 * demander à quelqu'un de nous envoyer toute son archive.
 */
const contenu = ref<{ nom: string; texte: string } | null>(null)
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

  // Sous accord seulement : sans lui le serveur refuse, et une demande faite
  // pour rien inscrirait une consultation qui n'a rien consulté.
  donnees.value = null
  donneesEnPanne.value = ''
  contenu.value = null
  if (rendu.valeur.assistance.ouverte) {
    const detail = await chargerLesDonnees(proprietes.compte)
    if (detail.etat === 'ouverte') donnees.value = detail.valeur
    // Sans ça, un accord expiré entre deux requêtes laisse « Chargement… »
    // pour toujours, et on cherche la panne là où il n'y en a pas.
    else if (detail.etat === 'fermee') donneesEnPanne.value = 'l’accord vient de se refermer'
    else donneesEnPanne.value = detail.motif
  }
}

watch(() => proprietes.compte, recharger, { immediate: true })

const emet = defineEmits<{ change: []; efface: [] }>()
const refus = ref('')
const note = ref('')

/**
 * Le verdict de rétention, lu **avant** de forcer.
 *
 * Aucun contrôle ne dira qu'un délai est trop court : un mauvais seuil efface
 * des données et rien ne rougit. La seule façon de le savoir est de regarder ce
 * qui partirait.
 */
const verdict = ref<Verdict | null>(null)

async function ouvrirUnContenu(
  registre: 'profils' | 'moteurs' | 'boites',
  nom: string,
): Promise<void> {
  refus.value = ''
  const rendu = await chargerUnContenu(proprietes.compte, registre, nom)
  if (rendu.etat !== 'ouverte') {
    refus.value =
      rendu.etat === 'fermee' ? 'Ce fichier n’est plus lisible : l’accord s’est refermé.' : rendu.motif
    return
  }
  contenu.value = { nom, texte: rendu.valeur }
}

async function voirLeVerdict(): Promise<void> {
  const rendu = await chargerLeVerdict(proprietes.compte)
  verdict.value = rendu.etat === 'ouverte' ? rendu.valeur : null
}

async function onForcerLaRetention(): Promise<void> {
  refus.value = ''
  const rendu = await forcerLaRetention(proprietes.compte)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  note.value = `${rendu.rendu.trajets} trajets effacés, ${rendu.rendu.tranches} tranches.`
  await voirLeVerdict()
  await recharger()
  emet('change')
}

async function onReglerLAbandon(): Promise<void> {
  refus.value = ''
  note.value = ''
  const rendu = await reglerLAbandon(proprietes.compte)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }

  // **La règle ne s'applique qu'à un compte anonyme et vide.** Un compte nommé,
  // ou qui porte quelque chose, est gardé — et l'écran doit le dire plutôt que
  // de se refermer, ce qui se lirait comme un effacement.
  if (rendu.rendu.sort === 'efface') {
    emet('efface')
    emet('change')
    return
  }
  note.value =
    'Ce compte est gardé : la règle n’efface qu’un compte anonyme qui ne porte rien.'
  await recharger()
}

/** Le plafond qu'on pose, en mébioctets — l'unité dans laquelle on décide ici. */
const plafondEnMio = ref('')

async function onPoserLePlafond(): Promise<void> {
  const mio = Number(plafondEnMio.value.replace(',', '.'))
  if (!Number.isFinite(mio) || mio <= 0) {
    refus.value = 'Un plafond se donne en mébioctets, et il est positif.'
    return
  }
  const rendu = await poserUnPlafond(proprietes.compte, mio)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  plafondEnMio.value = ''
  await recharger()
}

async function onRetirerLePlafond(): Promise<void> {
  const rendu = await retirerLePlafond(proprietes.compte)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  await recharger()
}

/**
 * Effacer, en deux temps.
 *
 * Un premier clic demande confirmation, un second agit — c'est le motif déjà
 * retenu pour le bouton que l'utilisateur a sur son propre écran. Pas de délai
 * de grâce, pas de nom à recopier : on ne fabrique pas un second comportement
 * pour le même mot.
 */
const effacementEnAttente = ref(false)

async function onEffacer(): Promise<void> {
  if (!effacementEnAttente.value) {
    effacementEnAttente.value = true
    return
  }
  const rendu = await effacerLeCompte(proprietes.compte)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  effacementEnAttente.value = false
  emet('efface')
  emet('change')
}

/** Ce compte porte-t-il ce rôle, à l'instant ? */
function porte(role: string): boolean {
  return fiche.value?.roles.some((droit) => droit.role === role) === true
}

/**
 * Ce droit vient-il de la configuration de la pile ?
 *
 * **Alors il ne se touche pas d'ici**, et le bouton doit le dire avant le clic
 * plutôt qu'après : un interrupteur qui reste pressé quoi qu'on fasse est un
 * interrupteur qui ment. Relevé par David le 16 septembre 2026, sur les trois
 * rôles offerts par défaut et sur une banque accordée par l'environnement.
 */
function vientDeLaPile(role: string): boolean {
  return fiche.value?.roles.some((droit) => droit.role === role && droit.source === 'pile') === true
}

function banqueAccordee(banque: string): { accordee: boolean; pile: boolean } {
  const trouvee = fiche.value?.banques.find((accord) => accord.banque === banque)
  return { accordee: trouvee !== undefined, pile: trouvee?.source === 'pile' }
}

async function basculerLaBanque(banque: string): Promise<void> {
  refus.value = ''
  note.value = ''
  const accordee = banqueAccordee(banque).accordee
  const rendu = accordee
    ? await retirerUneBanque(proprietes.compte, banque)
    : await accorderUneBanque(proprietes.compte, banque)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }
  // **Un accord posé par la pile tient même après un retrait.** Le serveur le
  // dit ; le taire laisserait un bouton qui ne se relève pas, sans raison
  // visible.
  if ('peutEncore' in rendu.rendu && rendu.rendu.peutEncore) {
    note.value = `${banque} reste jouable : la configuration de la pile l’accorde à ce compte, et cela ne se retire pas d’ici.`
  }
  await recharger()
  emet('change')
}

async function basculerLeRole(role: string): Promise<void> {
  refus.value = ''
  note.value = ''
  const rendu = porte(role)
    ? await reprendreUnRole(proprietes.compte, role)
    : await donnerUnRole(proprietes.compte, role)
  if (!rendu.fait) {
    refus.value = rendu.motif
    return
  }

  // **Un rôle offert à tout le monde ne se reprend pas d'ici.** C'est le cas par
  // défaut — la pile offre les trois —, et sans ce mot les trois boutons
  // paraissent pressés en permanence et chaque clic semble ne rien faire.
  if ('offertAtous' in rendu.rendu && rendu.rendu.offertAtous) {
    note.value = `Le rôle ${role} est offert à tout le monde par la configuration de la pile : le reprendre ici ne le referme pas.`
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
          :disabled="vientDeLaPile(role)"
          :title="
            vientDeLaPile(role)
              ? 'Offert à tout le monde par la configuration de la pile : ne se reprend pas ici.'
              : ''
          "
          @click="basculerLeRole(role)"
        >
          {{ role }}<span v-if="vientDeLaPile(role)"> · pile</span>
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
          :aria-pressed="banqueAccordee(banque).accordee"
          :disabled="banqueAccordee(banque).pile"
          :title="
            banqueAccordee(banque).pile
              ? 'Accordée par la configuration de la pile : ne se retire pas ici.'
              : ''
          "
          @click="basculerLaBanque(banque)"
        >
          {{ banque }}<span v-if="banqueAccordee(banque).pile"> · pile</span>
        </button>
      </dd>

      <dt>Assistance</dt>
      <dd v-if="fiche.assistance.ouverte && fiche.assistance.jusquau !== null">
        ouverte jusqu’au
        <span class="numeric">{{ dateLisible(fiche.assistance.jusquau) }}</span>
      </dd>
      <!--
        Rien à cliquer ici : l'accord appartient au conducteur, et la régie n'a
        aucune route pour l'ouvrir. On le lui demande de vive voix.
      -->
      <dd v-else class="muet">fermée — à demander au conducteur</dd>

      <dt>Plafond</dt>
      <dd>
        <span class="numeric">{{ poidsLisible(fiche.plafond.octets) }}</span>
        <span class="muet">{{ fiche.plafond.particulier ? ' — particulier' : ' — commun' }}</span>
      </dd>
    </dl>

    <!--
      Ce qu'un geste a répondu, **juste sous les boutons qui l'ont déclenché**.
      En bas de fiche, on ne le voit pas : c'est ce qui est arrivé le 16
      septembre 2026, où deux clics ont paru sans effet alors que l'écran
      l'expliquait — vingt lignes plus bas.
    -->
    <p v-if="note !== ''" class="note">{{ note }}</p>
    <p v-if="refus !== ''" class="refus">{{ refus }}</p>

    <h3>Agir sur ce compte</h3>
    <div class="gestes">
      <input
        v-model="plafondEnMio"
        type="text"
        inputmode="decimal"
        placeholder="Plafond en Mio"
        aria-label="Plafond en mébioctets"
      />
      <button type="button" @click="onPoserLePlafond()">Poser ce plafond</button>
      <button
        type="button"
        :disabled="!fiche.plafond.particulier"
        @click="onRetirerLePlafond()"
      >
        Revenir au plafond commun
      </button>
    </div>

    <div class="gestes">
      <button type="button" @click="voirLeVerdict()">Voir ce que la rétention emporterait</button>
      <button type="button" :disabled="verdict === null" @click="onForcerLaRetention()">
        Forcer le passage
      </button>
      <button type="button" @click="onReglerLAbandon()">Régler l’abandon</button>
    </div>

    <p v-if="verdict !== null" class="note">
      <template v-if="verdict.aEffacer.length === 0">Rien ne partirait.</template>
      <template v-else>
        {{ verdict.aEffacer.length }} trajets partiraient
        ({{ poidsLisible(verdict.octets) }}) ; {{ verdict.retenus.length }} seraient retenus.
      </template>
    </p>

    <div class="gestes">
      <button type="button" class="danger" @click="onEffacer()">
        {{ effacementEnAttente ? 'Confirmer : effacer définitivement' : 'Effacer ce compte' }}
      </button>
    </div>
    <p class="note">
      L’effacement emporte tout ce que ce compte porte, sans retour. La ligne de
      trace reste, sans son nom ni son adresse.
    </p>



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

    <!--
      Ce que le compte porte pour de bon, et seulement sous accord. Le serveur
      refuse tant que l'assistance est fermée ; l'écran ne demande donc rien
      dans ce cas, plutôt que de montrer un vide ambigu.
    -->
    <template v-if="fiche.assistance.ouverte">
      <h3>Ce qu’il porte, en détail</h3>
      <p v-if="donneesEnPanne !== ''" class="muet">
        Rien à montrer : {{ donneesEnPanne }}.
      </p>
      <p v-else-if="donnees === null" class="muet">Chargement…</p>
      <dl v-else>
        <dt>Profils</dt>
        <dd class="fichiers">
          <button
            v-for="entree in donnees.profils"
            :key="entree.name"
            type="button"
            @click="ouvrirUnContenu('profils', entree.name)"
          >
            {{ entree.name }}
          </button>
          <span v-if="donnees.profils.length === 0" class="muet">—</span>
        </dd>
        <dt>Moteurs</dt>
        <dd class="fichiers">
          <button
            v-for="entree in donnees.moteurs"
            :key="entree.name"
            type="button"
            @click="ouvrirUnContenu('moteurs', entree.name)"
          >
            {{ entree.name }}
          </button>
          <span v-if="donnees.moteurs.length === 0" class="muet">—</span>
        </dd>
        <dt>Boîtes</dt>
        <dd class="fichiers">
          <button
            v-for="entree in donnees.boites"
            :key="entree.name"
            type="button"
            @click="ouvrirUnContenu('boites', entree.name)"
          >
            {{ entree.name }}
          </button>
          <span v-if="donnees.boites.length === 0" class="muet">—</span>
        </dd>
        <dt>Trajets</dt>
        <dd>{{ donnees.trajets.map((trajet) => trajet.cle).join(', ') || '—' }}</dd>
        <dt>Journal</dt>
        <dd class="muet">{{ donnees.journal.length }} tranches</dd>
        <dt>Relevés</dt>
        <dd class="muet">{{ donnees.mesures.length }} fichiers</dd>
      </dl>

      <!-- Le réglage qu'on vient chercher : lisible sans demander l'archive. -->
      <template v-if="contenu !== null">
        <h3>{{ contenu.nom }}</h3>
        <pre class="contenu">{{ contenu.texte }}</pre>
      </template>

      <p class="note">
        Cette consultation est inscrite, et le conducteur peut la relire.
      </p>
    </template>

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

.roles,
.gestes {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.gestes {
  margin-top: 0.6rem;
}

.gestes input {
  width: 10rem;
}

.danger {
  border-color: var(--warn);
  color: var(--warn);
}

/* Un droit qui vient de la pile se lit, il ne se clique pas. */
.roles button:disabled {
  opacity: 0.75;
  cursor: default;
}

.fichiers {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.fichiers button {
  padding: 0.2rem 0.5rem;
  font-size: 0.85rem;
}

/* Un contenu se lit, il ne se parcourt pas : borné en hauteur, et il défile. */
.contenu {
  max-height: 22rem;
  overflow: auto;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.refus {
  color: var(--warn);
  margin-top: 0.75rem;
}

.note {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.muet {
  color: var(--muted);
}
</style>
