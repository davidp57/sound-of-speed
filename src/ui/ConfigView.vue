<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import NumberField from './components/NumberField.vue'
import {
  describeProfile,
} from '../core/preset/wizard'
import { SIMPLE_GEAR_COUNTS } from '../core/preset/character'
import { missingSentence } from '../core/calibration/coverage'
import {
  editedProfile,
  profileList,
  resetActive,
  selectProfile,
  selectedProfileId,
  toggleFavorite,
  addProfile,
  backgroundAudio,
  setBackgroundAudio,
  offlineStatus,
  prepareOffline,
  promptInstall,
  canUndoGlobalChange,
  gearCount,
  responsiveness,
  setGearCount,
  setResponsiveness,
  setSportiness,
  sportiness,
  undoGlobalChange,
  library,
  libraryLoading,
  refreshLibrary,
  refreshBanks,
  forgetUnusedBanks,
  calibrationOverrides,
  calibrationMissing,
  uploadConsent,
  uploadError,
  uploadPending,
  uploadStorageError,
  journalDeposits,
  journalError,
  retryUploads,
  setUploadConsent,
  answerMeasuredCar,
  carDecision,
  driveFace,
  measuredCar,
  measuredOverrides,
  setDriveFace,
} from '../state'

/**
 * Écran de configuration.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ». Les profils sont enregistrés au fil de
 * l'eau dans le stockage du navigateur, et exportables en JSON pour être
 * transportés d'un appareil à l'autre.
 */

/**
 * Ce qu'on règle : le profil assemblé, sections vivantes.
 *
 * Chaque curseur écrit dans le groupe où le réglage vit — le moteur, la boîte ou
 * la voiture — et non plus dans le profil, qui ne porte plus de valeurs. Les
 * chemins n'ont pas changé pour autant : `profile.engine.idleRpm` désigne
 * toujours le ralenti, il atterrit simplement dans le moteur.
 */
const profile = editedProfile

/**
 * Le clac, coupé et rendu d'un appui.
 *
 * Il n'a pas d'interrupteur dans le profil — c'est une intensité, et zéro le
 * fait taire. Couper garde donc la valeur d'avant pour la rendre telle quelle :
 * un conducteur qui coupe le clac en ville ne doit pas retrouver un réglage
 * d'usine en le rallumant. Rechargée sans valeur retenue, la bascule repart de
 * celle des profils livrés.
 */
const CLAC_PAR_DEFAUT = 0.35
const dernierClac = ref(0)

/**
 * Le retour au profil livré, en deux temps.
 *
 * Un premier appui demande confirmation, un second agit : écraser des réglages
 * cherchés à l'oreille mérite une seconde d'hésitation, et un dialogue système
 * serait plus lourd que le geste.
 */
const retourEnAttente = ref(false)
const retourFait = ref('')

function revenirAuProfilLivre(): void {
  if (!retourEnAttente.value) {
    retourEnAttente.value = true
    return
  }
  resetActive('all')
  retourEnAttente.value = false
  retourFait.value = 'Profil rendu tel qu’il a été livré.'
  setTimeout(() => {
    retourFait.value = ''
  }, 10_000)
}

const clacActif = computed(() => profile.value.feel.shiftJolt.clack > 0)

function basculerLeClac(): void {
  const jolt = profile.value.feel.shiftJolt
  if (jolt.clack > 0) {
    dernierClac.value = jolt.clack
    jolt.clack = 0
    return
  }
  jolt.clack = dernierClac.value > 0 ? dernierClac.value : CLAC_PAR_DEFAUT
}

// Les banques se lisent à l'ouverture de l'écran : c'est le seul endroit d'où
// l'on en change, et une banque déposée entre-temps apparaît en y revenant.
onMounted(() => void refreshBanks())

/** Le compte de dépôt se retient dès la frappe : il n'y a rien à valider. */
/**
 * Cran en attente de confirmation.
 *
 * Couper la remontée est immédiat — on n'a pas à confirmer qu'on ne veut plus
 * rien envoyer. C'est l'inverse qui demande un temps d'arrêt : le reste de cet
 * écran s'applique à la frappe, et un envoi de données ne doit pas partir du
 * même geste distrait qu'un curseur qu'on déplace.
 */
const consentPending = ref<'minimal' | 'extended' | null>(null)

function onConsent(consent: 'none' | 'minimal' | 'extended'): void {
  if (consent === 'none') {
    consentPending.value = null
    setUploadConsent('none')
    return
  }
  if (uploadConsent.value === consent) return
  consentPending.value = consent
}

function onConsentConfirm(): void {
  if (consentPending.value === null) return
  setUploadConsent(consentPending.value)
  consentPending.value = null
}

/** Ce qui attend de partir, rangé par nature pour être dit en une phrase. */
const enAttente = computed(() => {
  const noms: Record<string, string> = {
    trace: 'trace',
    profile: 'profil',
    journal: 'journal',
    measurement: 'relevé',
  }
  const compte = new Map<string, number>()
  for (const item of uploadPending.value) {
    compte.set(item.kind, (compte.get(item.kind) ?? 0) + 1)
  }
  return [...compte.entries()].map(([kind, n]) => {
    const nom = noms[kind] ?? kind
    return `${n} ${nom}${n > 1 ? 's' : ''}`
  })
})


/**
 * Curseurs globaux du mode simplifié.
 *
 * Exprimés de zéro à cent plutôt que de zéro à un : ce sont des positions, pas
 * des grandeurs, et un pour-cent est le plus petit pas qui se voie encore.
 */
const sportinessPercent = computed<number>({
  get: () => Math.round(sportiness.value * 100),
  set: (value: number) => setSportiness(value / 100),
})

const responsivenessPercent = computed<number>({
  get: () => Math.round(responsiveness.value * 100),
  set: (value: number) => setResponsiveness(value / 100),
})

/** Ce que donne le profil courant, dans les mêmes termes que la création. */
const simplePreview = computed(() => describeProfile(profile.value))

/**
 * Une valeur d'étalonnage, avec son unité. Un tableau se lit d'une traite :
 * les seuils de passage n'ont de sens que les uns par rapport aux autres.
 */
function showOverride(
  value: number | number[],
  entry: { unit: string; decimals: number },
): string {
  const one = (v: number): string => v.toFixed(entry.decimals)
  const body = Array.isArray(value) ? value.map(one).join(' / ') : one(value)
  return `${body} ${entry.unit}`
}

/** Taille lisible, pour l'état du cache hors réseau. */
function megabytes(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`
}
</script>

<template>
  <div class="config">
    <section class="panel wide simple">
      <h2>Réglage</h2>

      <!--
        Ce qui se règle une fois et ne se touche plus en roulant. Ces deux
        rangées vivaient sur l'écran de conduite, où elles prenaient la place de
        ce qu'on lit au volant — et où le choix de la source n'était qu'un moyen
        de se tromper sur ce qu'on entend.
      -->
      <!--
        Le rattrapage d'un « plus tard » : la mesure attend, et ce bouton
        l'applique. Pas un export — on n'emporte pas de fichier, on applique ce
        qui est là.
      -->
      <template v-if="measuredCar !== null">
        <p class="choice-label">Profil mesuré de la voiture</p>
        <div class="choices">
          <button
            v-if="carDecision?.answer !== 'accepted'"
            :disabled="!measuredCar.coverage.complete"
            @click="answerMeasuredCar('accepted')"
          >
            Appliquer maintenant
          </button>
          <button v-else @click="answerMeasuredCar('later')">Ne plus l’appliquer</button>
        </div>
        <p class="note">
          {{ measuredCar.aggregate.tripCount }}
          {{ measuredCar.aggregate.tripCount === 1 ? 'trajet mesuré' : 'trajets mesurés' }}
          par le serveur.
          <template v-if="measuredCar.coverage.complete">
            De quoi régler la reprise, le freinage et les passages de rapport,
            sans toucher au son du profil choisi.
          </template>
          <template v-else>{{ missingSentence(measuredCar.coverage) }}</template>
        </p>
      </template>

      <p class="choice-label">Affichage de la conduite</p>
      <div class="choices">
        <button :aria-pressed="driveFace === 'dials'" @click="setDriveFace('dials')">
          Cadrans
        </button>
        <button :aria-pressed="driveFace === 'numbers'" @click="setDriveFace('numbers')">
          Chiffres
        </button>
      </div>
      <p class="note">
        Les cadrans se lisent mieux en roulant ; les chiffres servent au réglage,
        où cent tours d'écart ne se voient pas sur une aiguille. C'est une
        préférence de cet appareil, comme le volume : elle ne voyage pas avec un
        profil partagé.
      </p>

        <NumberField
          v-model="sportinessPercent"
          label="Calme ↔ sportif"
          :min="0"
          :max="100"
          :step="1"
          hint="Le caractère du moteur et de la boîte : inertie, régimes de passage, plancher et délai de croisière, rétrogradage, pétarade, à-coup. Vers zéro la boîte monte tôt et tourne bas ; vers cent elle étire les rapports. Ce curseur refait ces réglages, et le bouton de retour annule le geste."
        />
        <NumberField
          v-model="responsivenessPercent"
          label="Pépère ↔ nerveux"
          :min="0"
          :max="100"
          :step="1"
          hint="La réactivité du signal, et non le caractère : raideur du lissage, fenêtre d'accélération, lissage de la charge, temporisations de passage. Le premier curseur dit si la voiture pousse fort, celui-ci si elle répond vite. Vers cent elle suit au plus près et les sauts du GPS s'entendent ; vers zéro elle est lisse et en retard d'une demi-seconde."
        />

        <p class="choice-label">Nombre de rapports</p>
        <div class="choices">
          <button
            v-for="n in SIMPLE_GEAR_COUNTS"
            :key="n"
            :aria-pressed="gearCount === n"
            @click="setGearCount(n)"
          >
            {{ n }}
          </button>
        </div>
        <p class="note">
          Le premier et le dernier rapport sont conservés, avec le pont : le
          régime en dernier rapport à une vitesse donnée ne bouge pas. Seuls les
          rapports intermédiaires se redistribuent, avec les régimes de passage
          et les temporisations.
        </p>
        <div class="global-actions">
          <button :disabled="!canUndoGlobalChange" @click="undoGlobalChange()">
            Revenir aux réglages d'avant
          </button>
          <span class="note">
            Un curseur global recalcule : il écrase les réglages qu'il commande.
            Ce retour rend l'état du profil tel qu'il était avant le premier
            mouvement.
          </span>
        </div>
        <div class="preview">
          <p class="choice-label">Ce que ça donne</p>
          <p v-for="line in simplePreview" :key="line">{{ line }}</p>
        </div>
    </section>

    <!--
      Les deux effets qui restent réglables au volant.

      Ce n'est pas un compte mais une frontière : le rétrogradage forcé et les
      rapports descendus au plus changent la façon de conduire, donc ils
      appartiennent au tempérament. Ces deux-ci sont du décor sonore, qu'on veut
      couper en ville ou avec un passager sans changer de caractère.
    -->
    <section class="panel wide">
      <h2>Effets sonores</h2>
      <div class="toggle">
        <button
          :aria-pressed="profile.feel.backfire.enabled"
          @click="profile.feel.backfire.enabled = !profile.feel.backfire.enabled"
        >
          Pétarade
        </button>
        <span class="note">Claquements à l'échappement quand on lève le pied.</span>
      </div>
      <div class="toggle">
        <button :aria-pressed="clacActif" @click="basculerLeClac()">Clac de boîte</button>
        <span class="note">Le bruit sec du passage de rapport.</span>
      </div>
      <p class="note">
        Leur réglage fin — seuil, intensité, nombre de claquements — est dans
        l'écran Avancé.
      </p>
    </section>


    <section class="panel wide">
      <h2>Profils</h2>
      <!--
        Choisir et épingler, rien d'autre : créer, renommer, dupliquer,
        supprimer, exporter et partager sont des gestes d'atelier. La voiture
        reçoit ce qu'on lui a livré, elle ne le fabrique pas.
      -->
      <div class="profiles">
        <select
          :value="selectedProfileId"
          @change="selectProfile(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="entry in profileList" :key="entry.id" :value="entry.id">
            {{ entry.name }}
          </option>
        </select>
        <button
          :aria-pressed="profile.favorite"
          :title="
            profile.favorite
              ? 'Retirer de l’écran de conduite'
              : 'Épingler sur l’écran de conduite'
          "
          @click="toggleFavorite(selectedProfileId)"
        >
          {{ profile.favorite ? '★ Épinglé' : '☆ Épingler' }}
        </button>
      </div>
      <!--
        Le seul retour qui survit à un redémarrage.

        « Revenir aux réglages d'avant », sous les curseurs, ne s'enregistre pas :
        il vit dans cette session et sur cet appareil. On bricole en roulant, on
        coupe le contact, et le lendemain il n'y a plus rien. Celui-ci rend le
        profil tel qu'il a été livré.

        Un seul bouton, et non le sélecteur de sections qui est parti à
        l'atelier : proposer « réinitialiser le mixage » à qui n'a jamais vu le
        mixage ne l'aide pas.
      -->
      <div class="choices">
        <button :class="{ 'is-active': retourEnAttente }" @click="revenirAuProfilLivre()">
          {{ retourEnAttente ? 'Confirmer' : 'Revenir au profil d’usine' }}
        </button>
        <button v-if="retourEnAttente" @click="retourEnAttente = false">Annuler</button>
        <span class="note">
          Efface les ajustements faits ici et rend le profil tel qu'il a été
          livré.
        </span>
      </div>
      <p v-if="retourFait" class="note">{{ retourFait }}</p>

      <div class="library">
        <div class="choices">
          <button :disabled="libraryLoading" @click="refreshLibrary()">
            {{ libraryLoading ? 'Recherche…' : 'Profils du serveur' }}
          </button>
          <span class="note">
            Vos profils y remontent tout seuls dès que la remontée est
            acceptée, et vous pouvez aussi déposer des fichiers dans
            <code>profiles/</code> sur le NAS : ils apparaîtront sur tous vos
            appareils.
          </span>
        </div>
        <ul v-if="library.length" class="library-list">
          <li v-for="entry in library" :key="entry.file">
            <span>{{ entry.profile.name }}</span>
            <span class="muted">{{ entry.file }}</span>
            <button @click="addProfile(entry.profile)">Ajouter</button>
          </li>
        </ul>
      </div>

      <!--
        Ce que la mesure du serveur remplace, dit comme l'étalonnage le dit
        déjà. Les deux couches se composent et l'étalonnage guidé passe en
        dernier : quand on prend la peine de dérouler le protocole, c'est lui
        qui décide.
      -->
      <div v-if="measuredOverrides.length > 0" class="calibrated">
        <p class="note">
          <strong>{{ measuredOverrides.length }}</strong> réglage{{
            measuredOverrides.length > 1 ? 's' : ''
          }}
          de ce profil {{ measuredOverrides.length > 1 ? 'viennent' : 'vient' }} de ce que le
          serveur a mesuré de votre voiture, sur
          {{ measuredCar?.aggregate.tripCount }}
          {{ measuredCar?.aggregate.tripCount === 1 ? 'trajet' : 'trajets' }}. Ce que vous
          réglez ici reste inchangé.
        </p>
        <ul class="note">
          <li v-for="entry in measuredOverrides" :key="entry.path">
            {{ entry.label }} — <strong>{{ showOverride(entry.proposed, entry) }}</strong>
            au lieu de {{ showOverride(entry.current, entry) }}
          </li>
        </ul>
      </div>

      <div v-if="calibrationOverrides.length > 0" class="calibrated">
        <p class="note">
          <strong>{{ calibrationOverrides.length }}</strong> réglage{{
            calibrationOverrides.length > 1 ? 's' : ''
          }}
          de ce profil {{ calibrationOverrides.length > 1 ? 'sont' : 'est' }} remplacé{{
            calibrationOverrides.length > 1 ? 's' : ''
          }}
          par les mesures de votre voiture. Ce que vous réglez ici reste
          inchangé — c'est la valeur mesurée que le moteur emploie.
        </p>
        <ul class="note">
          <li v-for="entry in calibrationOverrides" :key="entry.path">
            {{ entry.label }} — <strong>{{ showOverride(entry.proposed, entry) }}</strong>
            au lieu de {{ showOverride(entry.current, entry) }}
          </li>
        </ul>
      </div>

      <div v-else-if="calibrationMissing.length > 0" class="calibrated">
        <p class="note">
          <strong>L'étalonnage ne s'applique pas</strong> : il manque
          {{ calibrationMissing.join(', ').toLowerCase() }}. Un étalonnage
          incomplet décrit le bout de route enregistré, pas la voiture — une
          seule étape de ville dans un bouchon a déjà plafonné la vitesse
          acceptée à 40 km/h, au-delà de laquelle plus rien ne bougeait. Les
          mesures déjà prises restent visibles dans l'écran d'étalonnage, et se
          recopient à la main.
        </p>
      </div>

      <p class="note">
        <strong>Le compte de cet appareil</strong> vit dans l'écran
        <strong>Compte</strong>, avec de quoi relier un autre appareil au même
        compte. C'est lui qui porte tout ce qui remonte d'ici.
      </p>

      <!--
        La remontée au serveur. Trois positions, et la troisième est un choix
        distinct : la position et la trace sont des données de déplacement, et
        cela se dit avant l'envoi, pas après. La confirmation est un temps
        d'arrêt volontaire — le réglage s'applique sinon à la frappe partout
        ailleurs dans cet écran.
      -->
      <div class="journal">
        <span class="note">Remontée au serveur</span>
        <button
          :class="{ 'is-active': uploadConsent === 'none' }"
          @click="onConsent('none')"
        >
          Rien n’est envoyé
        </button>
        <button
          :class="{ 'is-active': uploadConsent === 'minimal' }"
          @click="onConsent('minimal')"
        >
          Le minimum
        </button>
        <button
          :class="{ 'is-active': uploadConsent === 'extended' }"
          @click="onConsent('extended')"
        >
          Et la conduite
        </button>
      </div>

      <p v-if="consentPending" class="confirm">
        <strong>{{ consentPending === 'minimal' ? 'Le minimum' : 'Le minimum et la conduite' }}</strong>
        sera déposé sur votre serveur, tout seul.
        <span v-if="consentPending === 'minimal'">
          Ce qui part : le journal de bord — source de vitesse, vitesses,
          accélérations, régimes, rapports, relances du suivi, mesures rejetées,
          ce que le son a coûté, et les erreurs —, les relevés de mesure, et vos
          profils, qui rejoignent la bibliothèque partagée. Aucune coordonnée.
        </span>
        <span v-else>
          Ce qui part : tout ce que contient « le minimum », <strong>plus votre
          position</strong> — un point par seconde — et <strong>la capture
          complète de vos trajets</strong>, qui démarre toute seule avec le GPS
          et porte toute la conduite, à la cadence de l’appareil. C’est ce qui
          permet de rejouer un trajet au poste de travail et de comprendre un
          défaut lié à un endroit précis.
        </span>
        Les fichiers arrivent dans les dossiers <code>journal/</code>,
        <code>traces/</code>, <code>mesures/</code> et <code>profiles/</code> de
        votre serveur, et rien ne sort d’ici : l’application ne sait pas les
        effacer, c’est à vous de faire le ménage.
        <span class="confirm-actions">
          <button class="is-active" @click="onConsentConfirm()">J’accepte</button>
          <button @click="consentPending = null">Annuler</button>
        </span>
      </p>
      <p class="note">
        Sert à retrouver ailleurs ce qui naît dans la voiture, dont le navigateur
        refuse les téléchargements, et à comprendre après coup ce que
        l’application a vécu en roulant. Le dépôt emploie le compte ci-dessus.
        <span v-if="journalDeposits.length > 0">
          Journal déposé jusqu’ici : <strong>{{ journalDeposits.length }}</strong>
          fichier{{ journalDeposits.length > 1 ? 's' : '' }},
          {{ Math.round(journalDeposits.reduce((total, entry) => total + entry.bytes, 0) / 1024) }} Ko.
        </span>
      </p>
      <p v-if="enAttente.length > 0" class="note">
        En attente de dépôt : <strong>{{ enAttente.join(', ') }}</strong>.
        <button @click="retryUploads()">Réessayer</button>
      </p>
      <p v-if="uploadError" class="note warn">{{ uploadError }}</p>
      <p v-if="uploadStorageError" class="note warn">{{ uploadStorageError }}</p>
      <p v-if="journalError" class="note warn">{{ journalError }}</p>

    </section>

    <section class="panel wide">
      <h2>Hors réseau</h2>
      <p class="note">
        Une voiture traverse des zones sans couverture, et une application chargée
        depuis Internet n'y démarre pas. Une fois les échantillons en cache, tout
        fonctionne sans connexion — et le serveur n'a plus besoin d'être joignable
        pour rouler, seulement pour mettre à jour.
      </p>

      <div class="offline">
        <div class="offline-state">
          <span :class="{ warn: !offlineStatus.active }">
            {{ offlineStatus.active ? 'Prise en charge active' : 'Prise en charge inactive' }}
          </span>
          <span>
            {{ offlineStatus.cachedFiles }} / {{ offlineStatus.totalFiles }} échantillons en cache
            <template v-if="offlineStatus.cachedBytes > 0">
              · {{ megabytes(offlineStatus.cachedBytes) }}
            </template>
          </span>
          <span v-if="offlineStatus.installed">Lancée depuis l'écran d'accueil</span>
          <span v-else-if="!offlineStatus.online" class="warn">Hors réseau</span>
        </div>

        <div class="offline-actions">
          <button :aria-pressed="backgroundAudio" @click="setBackgroundAudio(!backgroundAudio)">
            Son en arrière-plan
          </button>
          <button
            :disabled="offlineStatus.caching || !offlineStatus.active || offlineStatus.totalFiles === 0"
            @click="prepareOffline()"
          >
            {{ offlineStatus.caching ? 'Mise en cache…' : 'Préparer hors réseau' }}
          </button>
          <button v-if="offlineStatus.installable" @click="promptInstall()">
            Installer sur l'écran d'accueil
          </button>
          <button :disabled="!offlineStatus.active" @click="forgetUnusedBanks()">
            Libérer les banques inutilisées
          </button>
        </div>
      </div>

      <p v-if="offlineStatus.freed" class="note">
        <template v-if="offlineStatus.freed.files > 0">
          {{ offlineStatus.freed.files }} fichier{{ offlineStatus.freed.files > 1 ? 's' : '' }}
          libéré{{ offlineStatus.freed.files > 1 ? 's' : '' }}
          <template v-if="offlineStatus.freed.bytes > 0">
            · {{ megabytes(offlineStatus.freed.bytes) }}
          </template>
          — ils se retéléchargeront si un profil y revient.
        </template>
        <template v-else>
          Rien à libérer : le cache ne garde que des banques utilisées.
        </template>
      </p>

      <p v-if="offlineStatus.error" class="error">{{ offlineStatus.error }}</p>
      <p v-else-if="!offlineStatus.supported" class="note">
        Ce navigateur ne prend pas en charge le fonctionnement hors réseau.
      </p>
    </section>

  </div>
</template>

<style scoped>
/*
 * La bande de défilement était déclarée ici ; elle vit maintenant dans
 * `style.css` et se pose sur tous les écrans qui défilent, en voiture et sur
 * téléphone. Cet écran ne la porte donc plus lui-même.
 */
.config {
  display: grid;
  /*
   * Le `min()` est ce qui empêche la grille de déborder en portrait : une
   * colonne d'au moins vingt rem, plus la bande, dépasse la largeur d'un
   * téléphone, et la page se décale alors horizontalement. Mesuré avant
   * correction sur un écran de 375 px : soixante-cinq pixels de débordement.
   */
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
  align-items: start;
  max-width: 80rem;
  margin: 0 auto;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.panel.wide {
  grid-column: 1 / -1;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

.note {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.4rem 0 0.6rem;
}

/*
 * Une note qui avertit. La classe était déjà employée dans cet écran sans être
 * définie : l'avertissement s'y lisait dans le gris de tout le reste, donc il ne
 * se lisait pas.
 */
.note.warn {
  color: var(--warn);
}

.error {
  color: var(--warn);
  margin: 0.5rem 0 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.78rem;
  padding-bottom: 0.3rem;
}

td {
  padding: 0.2rem 0.3rem 0.2rem 0;
  border-top: 1px solid var(--line);
}

td input[type='number'] {
  width: 6rem;
  text-align: right;
}

.share,
.library {
  margin-top: 0.8rem;
  padding: 0.9rem;
  background: var(--panel-alt);
  border-radius: 8px;
}

.library-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
}

.library-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--line);
}

.library-list li span:first-child {
  flex: 1;
}

.creation,
.simple {
  border-color: var(--line-strong);
}

.mode .note {
  flex: 1 1 16rem;
  margin: 0;
}

.global-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-top: 0.6rem;
}

.global-actions .note {
  flex: 1 1 16rem;
  margin: 0;
}

.creation-pitch .note {
  flex: 1 1 18rem;
  margin: 0;
}

.choice-label {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0.9rem 0 0.35rem;
}

.choices {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.preview {
  margin-top: 1rem;
  padding: 0.7rem 0.9rem;
  background: var(--bg);
  border-radius: 6px;
}

.preview p:not(.choice-label) {
  margin: 0.2rem 0;
  color: var(--text);
  font-size: 0.9rem;
}

.journal {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/*
 * La demande de confirmation : encadrée, pour qu'on la lise.
 *
 * Elle dit ce qui part avant que cela ne parte, et c'est le seul endroit de cet
 * écran où un réglage attend un second geste.
 */
.confirm {
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0.5rem 0;
  padding: 0.7rem 0.9rem;
}

/*
 * Un bloc et non une colonne souple : en `flex-direction: column`, chaque bout
 * de phrase — un `span`, un `code` — prenait sa propre ligne, et le texte se
 * lisait en trois morceaux.
 */
.confirm-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.reset .note {
  margin: 0;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.6rem 0 0.3rem;
  border-top: 1px solid var(--line);
}

.toggle .note {
  margin: 0;
  flex: 1 1 12rem;
}

.offline {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.offline-state {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.offline-state .warn {
  color: var(--warn);
}

.offline-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.facts .warn {
  color: var(--warn);
}
</style>
