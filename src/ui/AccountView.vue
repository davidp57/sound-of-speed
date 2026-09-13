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
import { computed, onUnmounted, ref } from 'vue'

import qrcode from 'qrcode-generator'

import { demanderUnCode } from '../core/identity/client'
import { lienDeLiaison } from '../core/identity/lien'
import { isReachableOrigin } from '../core/preset/share'
import { identity, identityState, liaison, rejoindreUnCompte } from '../state'

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
  return `Cet appareil ouvre le compte « ${identity.value.name} ».`
})

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
      La place de la seconde voie est prise dès maintenant, et le champ est
      inerte : ce qui la remplira est le ticket 11. Un écran qui n'aurait pas
      prévu la place serait à refaire, et un champ actif qui ne mène nulle part
      serait pire que pas de champ du tout.
    -->
    <h3>Se connecter avec une adresse</h3>
    <p class="note">
      Pas encore : aucun compte n’a d’adresse aujourd’hui. Ce qui existe est le
      code ci-dessus, qui relie les appareils qu’on a sous la main. Une adresse
      et un mot de passe viendront pour le jour où l’on n’a plus aucun appareil —
      navigateur nettoyé, téléphone perdu, voiture changée.
    </p>
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
