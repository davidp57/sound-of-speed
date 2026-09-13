<script setup lang="ts">
/**
 * L'écran du compte : tout ce qui touche à l'identité, et nulle part ailleurs.
 *
 * **Le chemin normal va de la voiture au poste de travail.** On relie le poste
 * par un code, et c'est là, sur un vrai clavier, qu'on se fabriquera un vrai
 * compte. La voiture n'est pas un endroit où taper une adresse.
 *
 * **Rien ne s'affiche au premier lancement.** Une fenêtre qui demanderait de
 * choisir au démarrage serait l'écran d'inscription que ce lot supprime, et elle
 * tomberait au moment où l'on veut juste rouler. L'onglet existe, on y va quand
 * on veut.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

import qrcode from 'qrcode-generator'

import { demanderUnCode } from '../core/identity/client'
import {
  ARCHIVE_DU_COMPTE,
  changerLeMotDePasse,
  possibilitesDuServeur,
  type PossibilitesDuServeur,
} from '../core/identity/compte'
import { lienDeLiaison } from '../core/identity/lien'
import { isReachableOrigin } from '../core/preset/share'
import {
  identity,
  identityState,
  liaison,
  rattacherSonAdresse,
  rejoindreUnCompte,
  seConnecterAUnCompte,
  supprimerLeCompte,
} from '../state'

/**
 * Ce que l'écran dit du compte de cet appareil.
 *
 * Le cas qui compte est le troisième : **un compte anonyme n'a rien à
 * récupérer**. Vider les données de ce site depuis le navigateur en perdrait
 * l'accès, et avec lui ce qui a été déposé sous ce compte. Le dire ici vaut
 * mieux que le laisser découvrir — et relier un second appareil n'y change
 * rien, les deux ouvrant le même compte sans mot de passe.
 */
const compteDeLAppareil = computed(() => {
  if (identity.value === null) {
    if (identityState.value === 'refusee') {
      return 'Le serveur n’a pas donné de compte à cet appareil. Il réessaiera.'
    }
    return 'Cet appareil n’a pas encore de compte : il en prendra un au prochain contact avec le serveur. Rien à saisir, et rien ne l’empêche de rouler en attendant.'
  }
  if (identityState.value === 'reprise') {
    return 'Le serveur ne reconnaissait plus le compte de cet appareil : il en a repris un neuf. Ce qui avait été déposé sous l’ancien n’est plus accessible — un compte anonyme n’a pas de mot de passe pour le reprendre.'
  }
  if (identity.value.anonymous) {
    return 'Cet appareil a son compte, créé tout seul, sans adresse rattachée. Vider les données de ce site depuis les réglages du navigateur en perdrait l’accès — et ce qui a été déposé avec.'
  }
  const adresse = identity.value.email
  return adresse === undefined
    ? `Cet appareil ouvre le compte « ${identity.value.name} ».`
    : `Ce compte est rattaché à ${adresse}. Il se rouvre depuis n’importe quel appareil, avec son mot de passe.`
})

/**
 * Une adresse et un mot de passe, pour le jour où l'on n'a plus d'appareil.
 *
 * Deux gestes que l'écran distingue, parce que tout les sépare : **rattacher**
 * garde le compte de cet appareil et lui donne une adresse ; **se connecter**
 * ouvre un compte qui existe ailleurs, et abandonne celui d'ici.
 */
const adresse = ref('')
const motDePasse = ref('')
const noteDuCompte = ref('')
const enCours = ref(false)

/** Ce que la bibliothèque exige, et ce que l'écran annonce avant de refuser. */
const MOT_DE_PASSE_MINIMUM = 8

const saisieComplete = computed(
  () => adresse.value.includes('@') && motDePasse.value.length >= MOT_DE_PASSE_MINIMUM,
)

async function onRattacher(): Promise<void> {
  if (enCours.value || !saisieComplete.value) return
  enCours.value = true
  noteDuCompte.value = ''
  try {
    const rendu = await rattacherSonAdresse(adresse.value, motDePasse.value)
    if (rendu.state === 'sans-reseau') {
      noteDuCompte.value = 'Sans réseau, on ne peut pas rattacher une adresse : elle se range sur le serveur.'
      return
    }
    if (rendu.state === 'refusee') {
      noteDuCompte.value = rendu.detail
      return
    }
    motDePasse.value = ''
    noteDuCompte.value = `Ce compte est maintenant celui de ${rendu.email}. Rien n’a bougé de ce qu’il portait.`
  } finally {
    enCours.value = false
  }
}

async function onSeConnecter(): Promise<void> {
  if (enCours.value || !saisieComplete.value) return
  enCours.value = true
  noteDuCompte.value = ''
  try {
    const rendu = await seConnecterAUnCompte(adresse.value, motDePasse.value)
    if (rendu.state === 'sans-reseau') {
      noteDuCompte.value = 'Sans réseau, on ne peut pas se connecter : le mot de passe se vérifie sur le serveur.'
      return
    }
    if (rendu.state === 'refusee') {
      noteDuCompte.value = rendu.detail
      return
    }
    motDePasse.value = ''
    adresse.value = ''
    masquerLeCode()
  } finally {
    enCours.value = false
  }
}

/**
 * Donner un code : un code à scanner, ou huit caractères à taper.
 *
 * Les deux portent le même jeton. Le lien évite de recopier quand on a une
 * caméra ; le code court sauve le poste de travail qui n'en a pas — et c'est
 * justement le second appareil le plus probable.
 */
const codeARelier = ref('')
const lienARelier = ref('')
const qrARelier = ref('')
const noteDeLiaison = ref('')

/** Ce qu'il reste de validité, en secondes, remis à jour chaque seconde. */
const resteDuCode = ref(0)
let compteARebours: ReturnType<typeof setInterval> | null = null

const resteAffiche = computed(() => {
  const minutes = Math.floor(resteDuCode.value / 60)
  const secondes = resteDuCode.value % 60
  return `${minutes}:${String(secondes).padStart(2, '0')}`
})

function masquerLeCode(): void {
  if (compteARebours !== null) clearInterval(compteARebours)
  compteARebours = null
  codeARelier.value = ''
  lienARelier.value = ''
  qrARelier.value = ''
  resteDuCode.value = 0
}

async function onDonnerUnCode(): Promise<void> {
  if (codeARelier.value !== '') {
    masquerLeCode()
    return
  }

  noteDeLiaison.value = ''
  const demande = await demanderUnCode()
  if (demande.state === 'sans-reseau') {
    // Hors réseau on ne relie pas : le code vient du serveur. Le dire vaut mieux
    // que faire attendre devant un bouton qui ne répond pas.
    noteDeLiaison.value =
      'Sans réseau, il n’y a pas de code à afficher : il vient du serveur. À refaire une fois rentré.'
    return
  }
  if (demande.state === 'refusee') {
    noteDeLiaison.value = demande.detail
    return
  }

  codeARelier.value = demande.code
  const url = lienDeLiaison(window.location.origin, demande.code)
  lienARelier.value = url
  if (!isReachableOrigin(window.location.origin)) {
    noteDeLiaison.value =
      'Ce lien porte l’adresse à laquelle vous consultez l’application, qui n’est joignable que d’ici. Pour relier un appareil qui n’est pas sur ce réseau, refaire l’opération depuis l’adresse publique du serveur.'
  }

  // Correction moyenne : assez robuste pour un écran, sans gonfler le code.
  const code = qrcode(0, 'M')
  code.addData(url)
  code.make()
  qrARelier.value = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true })

  // Le compte à rebours plutôt qu'un effacement muet : un code qui disparaît
  // pendant qu'on le recopie, sans prévenir, ferait recommencer sans comprendre.
  const finit = () => Math.max(0, Math.round((demande.expireLe - Date.now()) / 1000))
  resteDuCode.value = finit()
  compteARebours = setInterval(() => {
    resteDuCode.value = finit()
    if (resteDuCode.value === 0) masquerLeCode()
  }, 1000)
}

async function onCopierLeLien(): Promise<void> {
  try {
    await navigator.clipboard.writeText(lienARelier.value)
    noteDeLiaison.value = 'Lien copié.'
  } catch {
    noteDeLiaison.value = 'Copie refusée par le navigateur : sélectionner le lien à la main.'
  }
}

/**
 * Recevoir un code : l'autre bout, et celui qui sauve l'appareil sans caméra.
 *
 * Sans ce champ, le code court ne servirait à rien — et c'est le poste de
 * travail qu'on relie le plus souvent.
 */
const codeSaisi = ref('')
const saisieEnCours = ref(false)

async function onSaisirLeCode(): Promise<void> {
  if (saisieEnCours.value || codeSaisi.value.length < 8) return
  saisieEnCours.value = true
  noteDeLiaison.value = ''
  try {
    // Le même chemin que le code scanné, et pas un raccourci à côté : c'est ce
    // qui garantit que les deux ramènent les mêmes réglages et annoncent la
    // même chose.
    await rejoindreUnCompte(codeSaisi.value)
    const faite = liaison.value
    if (faite?.etat === 'sans-reseau') {
      noteDeLiaison.value = 'Sans réseau, on ne peut pas relier : le code se vérifie sur le serveur.'
      return
    }
    if (faite?.etat === 'refusee') {
      noteDeLiaison.value = faite.detail
      return
    }
    codeSaisi.value = ''
    masquerLeCode()
  } finally {
    saisieEnCours.value = false
  }
}

/**
 * Ce que ce serveur-ci sait faire.
 *
 * Demandé une fois à l'ouverture de l'écran : ce qui n'est pas configuré ne doit
 * pas apparaître, et un bouton qui mène à une erreur est pire que pas de bouton.
 */
const possibilites = ref<PossibilitesDuServeur>({ relaisCourriel: false, fournisseurs: [] })

onMounted(() => {
  void possibilitesDuServeur().then((rendu) => {
    possibilites.value = rendu
  })
})

/**
 * Tenir son compte : changer le mot de passe, emporter, supprimer.
 */
const ancienMotDePasse = ref('')
const nouveauMotDePasse = ref('')
const noteDeTenue = ref('')
const tenueEnCours = ref(false)

async function onChangerLeMotDePasse(): Promise<void> {
  if (tenueEnCours.value || nouveauMotDePasse.value.length < MOT_DE_PASSE_MINIMUM) return
  tenueEnCours.value = true
  noteDeTenue.value = ''
  try {
    const rendu = await changerLeMotDePasse(ancienMotDePasse.value, nouveauMotDePasse.value)
    if (rendu.state === 'sans-reseau') {
      noteDeTenue.value = 'Sans réseau, on ne change pas de mot de passe : il vit sur le serveur.'
      return
    }
    if (rendu.state === 'refusee') {
      noteDeTenue.value = rendu.detail
      return
    }
    ancienMotDePasse.value = ''
    nouveauMotDePasse.value = ''
    noteDeTenue.value = 'Mot de passe changé.'
  } finally {
    tenueEnCours.value = false
  }
}

/**
 * Le navigateur de la voiture refuse les téléchargements.
 *
 * C'est un fait constaté, et la raison d'être de la remontée au serveur. On ne
 * sait pas le deviner d'avance ; ce qu'on peut faire est de le dire, et de
 * renvoyer vers un poste de travail plutôt que de laisser un bouton sans effet.
 */
const lienDArchive = ARCHIVE_DU_COMPTE

/**
 * Supprimer, en deux temps.
 *
 * Un premier clic demande confirmation, un second agit — c'est déjà le motif de
 * la réinitialisation par section dans l'écran de configuration. Effacer des
 * mois de trajets mérite une seconde d'hésitation, et un dialogue du système
 * serait plus lourd que le geste.
 */
const suppressionEnAttente = ref(false)
const motDePasseDeSuppression = ref('')

async function onSupprimer(): Promise<void> {
  if (!suppressionEnAttente.value) {
    suppressionEnAttente.value = true
    return
  }
  if (tenueEnCours.value) return
  tenueEnCours.value = true
  noteDeTenue.value = ''
  try {
    const rendu = await supprimerLeCompte(motDePasseDeSuppression.value)
    if (rendu.state === 'sans-reseau') {
      noteDeTenue.value = 'Sans réseau, on ne supprime rien : le compte vit sur le serveur.'
      return
    }
    if (rendu.state === 'refusee') {
      noteDeTenue.value = rendu.detail
      return
    }
    suppressionEnAttente.value = false
    motDePasseDeSuppression.value = ''
    noteDeTenue.value =
      'Compte supprimé. Cet appareil en prendra un neuf, vide, au prochain contact avec le serveur. Ce qui est réglé ici, sur cet appareil, n’a pas bougé.'
  } finally {
    tenueEnCours.value = false
  }
}

onUnmounted(() => {
  masquerLeCode()
})
</script>

<template>
  <section class="account">
    <h2>Le compte</h2>

    <p class="note">
      <strong>Le compte de cet appareil.</strong> {{ compteDeLAppareil }}
    </p>
    <p class="note">
      Il sert à tout ce qui remonte sur le serveur depuis la voiture, dont le
      navigateur refuse les téléchargements : traces, journal, relevés de mesure,
      profils, moteurs et boîtes. Il n’y a rien à saisir — l’appareil s’annonce
      tout seul.
    </p>

    <!--
      Donner un code. Deux rendus du même jeton : le lien à scanner, et huit
      caractères à recopier sur un appareil sans caméra.
    -->
    <h3>Relier un autre appareil</h3>
    <p class="note">
      Un téléphone qui scanne le code, ou un poste de travail où l’on recopie
      huit caractères, ouvre le <strong>même compte</strong> : les mêmes profils,
      les mêmes moteurs, les mêmes boîtes, les mêmes trajets. Aucune adresse,
      aucun service tiers.
    </p>
    <div class="choices">
      <button :class="{ 'is-active': !!codeARelier }" @click="onDonnerUnCode()">
        {{ codeARelier ? 'Masquer le code' : 'Donner un code…' }}
      </button>
    </div>

    <div v-if="codeARelier" class="share">
      <p class="note warn">
        Qui voit ce code ouvre ce compte. Il ne sert qu’<strong>une fois</strong>,
        et il expire dans <strong>{{ resteAffiche }}</strong>.
      </p>
      <p class="code-court">{{ codeARelier }}</p>
      <p class="note">
        Sur un appareil sans caméra : ouvrir cette application, écran Compte, et
        recopier ces huit caractères. Les traits et la casse n’ont pas
        d’importance.
      </p>
      <div class="qr" v-html="qrARelier" />
      <input :value="lienARelier" readonly @focus="($event.target as HTMLInputElement).select()" />
      <div class="choices">
        <button @click="onCopierLeLien()">Copier le lien</button>
        <button @click="masquerLeCode()">Masquer</button>
      </div>
    </div>

    <!-- Recevoir un code : l'autre bout du même geste. -->
    <h3>Rejoindre un compte</h3>
    <p class="note">
      Si un autre appareil vous a donné un code, le recopier ici. Celui-ci
      rejoindra son compte ; le compte qu’il porte aujourd’hui est effacé s’il
      est vide, gardé sinon — et la bannière le dira.
    </p>
    <div class="choices">
      <input
        v-model="codeSaisi"
        type="text"
        inputmode="text"
        autocapitalize="characters"
        spellcheck="false"
        placeholder="Code lu sur l’autre appareil"
        @keyup.enter="onSaisirLeCode()"
      />
      <button :disabled="codeSaisi.length < 8 || saisieEnCours" @click="onSaisirLeCode()">
        Rejoindre ce compte
      </button>
    </div>

    <p v-if="noteDeLiaison" class="note">{{ noteDeLiaison }}</p>

    <!--
      Une adresse et un mot de passe : la voie qui survit à l'appareil. Les deux
      boutons partagent les mêmes champs parce que la saisie est la même ; ce
      qu'ils font, lui, n'a rien de commun, et les phrases le disent.
    -->
    <h3>Une adresse et un mot de passe</h3>
    <p class="note">
      Le code ci-dessus relie les appareils qu’on a <strong>sous la main</strong>.
      Une adresse sert au jour où l’on n’en a plus aucun : navigateur nettoyé,
      téléphone perdu, voiture changée. C’est le moment de la saisir sur un vrai
      clavier — pas au volant.
    </p>
    <div class="choices">
      <input
        v-model="adresse"
        type="email"
        inputmode="email"
        autocomplete="username"
        spellcheck="false"
        placeholder="Adresse"
      />
      <input
        v-model="motDePasse"
        type="password"
        autocomplete="current-password"
        :placeholder="`Mot de passe (${MOT_DE_PASSE_MINIMUM} caractères au moins)`"
      />
    </div>
    <div class="choices">
      <button
        v-if="identity?.anonymous !== false"
        :disabled="!saisieComplete || enCours"
        @click="onRattacher()"
      >
        Rattacher au compte d’ici
      </button>
      <button :disabled="!saisieComplete || enCours" @click="onSeConnecter()">
        Ouvrir un compte qui existe
      </button>
    </div>
    <p v-if="identity?.anonymous !== false" class="note">
      <strong>Rattacher</strong> donne cette adresse au compte de cet appareil :
      ses profils, ses moteurs et ses trajets ne bougent pas.
      <strong>Ouvrir un compte qui existe</strong> fait l’inverse — cet appareil
      rejoint un compte d’ailleurs, et celui qu’il porte aujourd’hui est effacé
      s’il est vide, gardé sinon.
    </p>
    <p v-else class="note">
      Ce compte a déjà son adresse. <strong>Ouvrir un compte qui existe</strong>
      fait passer cet appareil sur un autre compte ; celui d’ici est gardé, et se
      rouvre avec son adresse.
    </p>
    <p class="note">
      Aucun courriel n’est envoyé, et l’adresse n’est pas vérifiée : il n’y a pas
      de relais à configurer, et celui qui déploie chez lui n’en fournira pas.
      Tant qu’il n’y en a pas, un mot de passe perdu l’est pour de bon.
    </p>
    <p v-if="noteDuCompte" class="note">{{ noteDuCompte }}</p>

    <!--
      Tenir son compte. Trois gestes de nature différente, dans l'ordre où on les
      fait : on change un mot de passe parce qu'on garde le compte, on emporte
      parce qu'on va peut-être le quitter, on supprime parce qu'on le quitte.
    -->
    <template v-if="identity?.anonymous === false">
      <h3>Changer le mot de passe</h3>
      <div class="choices">
        <input
          v-model="ancienMotDePasse"
          type="password"
          autocomplete="current-password"
          placeholder="Mot de passe actuel"
        />
        <input
          v-model="nouveauMotDePasse"
          type="password"
          autocomplete="new-password"
          :placeholder="`Nouveau mot de passe (${MOT_DE_PASSE_MINIMUM} caractères au moins)`"
        />
        <button
          :disabled="nouveauMotDePasse.length < MOT_DE_PASSE_MINIMUM || tenueEnCours"
          @click="onChangerLeMotDePasse()"
        >
          Changer
        </button>
      </div>
      <p v-if="!possibilites.relaisCourriel" class="note">
        <strong>Pas de « j’ai oublié » sur ce serveur</strong> : aucun relais de
        courriel n’y est configuré, et rien ne peut donc vous renvoyer votre mot
        de passe. Le ranger dans un gestionnaire de mots de passe est le seul
        filet.
      </p>
    </template>

    <h3>Emporter ses données</h3>
    <p class="note">
      Un fichier avec tout ce que ce compte porte sur le serveur : profils,
      moteurs, boîtes, trajets, journal, relevés de mesure et profil mesuré, dans
      les mêmes dossiers qu’ici. Il se reverse tel quel dans une installation
      neuve.
    </p>
    <div class="choices">
      <a class="bouton" :href="lienDArchive" download>Emporter (fichier .zip)</a>
    </div>
    <p class="note">
      <strong>Depuis un poste de travail.</strong> Le navigateur de la voiture
      refuse les téléchargements — c’est ce qui a fait naître la remontée au
      serveur —, et ce lien n’y donnera rien.
    </p>

    <h3>Supprimer ce compte</h3>
    <p class="note">
      Tout part avec lui : les profils, les moteurs, les boîtes, les trajets, le
      journal, les relevés et le profil mesuré déposés sur le serveur.
      <strong>C’est sans retour.</strong> Ce qui est réglé sur cet appareil, lui,
      ne bouge pas — c’est un autre bouton, dans l’écran de configuration.
    </p>
    <div class="choices">
      <input
        v-if="identity?.anonymous === false"
        v-model="motDePasseDeSuppression"
        type="password"
        autocomplete="current-password"
        placeholder="Mot de passe, pour confirmer"
      />
      <button :disabled="tenueEnCours" @click="onSupprimer()">
        {{ suppressionEnAttente ? 'Confirmer la suppression' : 'Supprimer ce compte…' }}
      </button>
      <button v-if="suppressionEnAttente" @click="suppressionEnAttente = false">Annuler</button>
    </div>
    <p v-if="suppressionEnAttente" class="note warn">
      Un second clic efface tout ce que ce compte porte sur le serveur.
    </p>

    <p v-if="noteDeTenue" class="note">{{ noteDeTenue }}</p>
  </section>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  max-width: 46rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

h3 {
  margin: 1rem 0 0;
  font-size: 0.95rem;
  color: var(--accent, #e0a020);
}

.note {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  opacity: 0.85;
}

.note.warn {
  opacity: 1;
  color: var(--warn, #e06060);
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.25rem 0;
}

button {
  padding: 0.4rem 0.8rem;
  font: inherit;
}

button.is-active {
  outline: 2px solid var(--accent, #e0a020);
}

input {
  padding: 0.4rem 0.6rem;
  font: inherit;
  min-width: 16rem;
  flex: 1 1 16rem;
}

/* Un lien qui se comporte comme un bouton : c'est un téléchargement, donc un
   lien, mais rien ne le distingue à l'usage des boutons voisins. */
.bouton {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  font: inherit;
  text-decoration: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
}

.share {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid currentColor;
  border-radius: 4px;
  margin: 0.5rem 0;
}

.code-court {
  /*
   * Gros, espacé, à chasse fixe : il se lit à bout de bras sur l'écran d'une
   * voiture, et se recopie sans confondre deux caractères.
   */
  font-family: ui-monospace, 'SFMono-Regular', 'Consolas', monospace;
  font-size: 2rem;
  letter-spacing: 0.25em;
  text-align: center;
  margin: 0.5rem 0;
  user-select: all;
}

.qr {
  align-self: center;
  width: min(14rem, 60vw);
}

.qr :deep(svg) {
  width: 100%;
  height: auto;
  background: #fff;
}
</style>
