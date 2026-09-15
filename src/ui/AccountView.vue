<script setup lang="ts">
/**
 * L'écran du compte : tout ce qui touche à l'identité, et nulle part ailleurs.
 *
 * **Le parcours est celui de toutes les autres applications**, et c'est voulu :
 * on se sert de l'application sans rien signer, une invitation discrète propose
 * de s'approprier le compte, et le jour où on le fait, l'invitation disparaît
 * pour de bon. Ce qui nous distingue tient en une ligne — le compte existe
 * **avant** qu'on le demande, parce que la voiture dépose ses trajets dès le
 * premier démarrage et qu'il faut bien les mettre quelque part.
 *
 * **Chaque appareil ne montre que le geste qu'il sait faire.** On n'enregistre
 * pas un compte au volant : il n'y a ni clavier commode, ni envie de partir chez
 * un fournisseur pendant qu'on conduit. La voiture donne donc un code, et tout
 * le reste se fait sur l'appareil qui l'a reçu.
 *
 * **Rien ne s'affiche au premier lancement.** Une fenêtre qui demanderait de
 * choisir au démarrage serait l'écran d'inscription que ce lot supprime.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import qrcode from 'qrcode-generator'

import { APPAREILS, lireLAppareilChoisi, NOMS_DAPPAREIL, type Appareil } from '../core/appareil'
import {
  fermerLAssistance,
  lireLAssistance,
  ouvrirLAssistance,
  type Assistance,
} from '../core/identity/assistance'
import { empreinteDeLAdresse, initialeDe, lienDeGravatar } from '../core/identity/avatar'
import { demanderUnCode } from '../core/identity/client'
import {
  ARCHIVE_DU_COMPTE,
  changerLeMotDePasse,
  possibilitesDuServeur,
  preuvesDuCompte,
  type PossibilitesDuServeur,
  type PreuvesDuCompte,
} from '../core/identity/compte'
import { lienDeLiaison } from '../core/identity/lien'
import { isReachableOrigin } from '../core/preset/share'
import {
  appareil,
  choisirLAppareil,
  identity,
  identityState,
  liaison,
  rattacherSonAdresse,
  rattacherUnCompteTenuAilleurs,
  rejoindreUnCompte,
  seConnecterAUnCompte,
  seConnecterAvecUnCompteTenuAilleurs,
  supprimerLeCompte,
} from '../state'

/**
 * Ce que chaque appareil ouvre, dit en une ligne.
 *
 * Assez pour choisir sans se tromper : ce qui distingue les trois est ce qu'on
 * y fait, pas ce qu'ils sont.
 */
const CE_QUE_LAPPAREIL_OUVRE: Record<Appareil, string> = {
  voiture: 'conduire, la télémétrie et les réglages — ni banc, ni étalonnage manuel',
  telephone: 'tout cela, plus le banc de simulation et l’étalonnage',
  poste: 'tout, y compris le réglage du timbre',
}

/**
 * L'appareil a-t-il été corrigé à la main, ou deviné ?
 *
 * Le dire évite une question sans réponse le jour où la détection se trompe :
 * on saura si ce qui s'affiche vient du navigateur ou d'un choix.
 */
const appareilCorrige = ref(lireLAppareilChoisi() !== null)

function corrigerLAppareil(lequel: Appareil): void {
  choisirLAppareil(lequel)
  appareilCorrige.value = true
}

/** On n'enregistre pas un compte au volant. Voir l'en-tête de ce fichier. */
const auVolant = computed(() => appareil.value === 'voiture')

/**
 * Le compte est-il approprié ?
 *
 * Lu sur l'identité gardée ici, donc juste **sans réseau** : ce qui compte est
 * qu'une preuve ait été rattachée un jour, et cela ne se défait pas.
 */
const approprie = computed(() => identity.value?.anonymous === false)

/**
 * Ce que ce compte-ci porte déjà comme preuves, demandé au serveur.
 *
 * Sans cela, l'écran ne sait pas s'il doit réclamer un mot de passe — et il l'a
 * réclamé à des comptes tenus par Google, qui n'en ont pas. `null` veut dire
 * qu'on ne sait pas : hors réseau, on ne montre alors que ce qui est sûr.
 */
const preuves = ref<PreuvesDuCompte | null>(null)

/** Ce que ce serveur-ci sait faire. Ce qu'il ne sait pas ne s'affiche pas. */
const possibilites = ref<PossibilitesDuServeur>({ relaisCourriel: false, fournisseurs: [] })

/** Un mot de passe est rattaché : seul cas où l'écran a le droit d'en demander un. */
const aUnMotDePasse = computed(() => preuves.value?.motDePasse === true)

/** Les fournisseurs proposés par le serveur qui ne sont pas déjà rattachés. */
const fournisseursARattacher = computed(() => {
  const deja = new Set((preuves.value?.fournisseurs ?? []).map((tenu) => tenu.id))
  return possibilites.value.fournisseurs.filter((offert) => !deja.has(offert.id))
})

async function rafraichirLesPreuves(): Promise<void> {
  preuves.value = await preuvesDuCompte()
}

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
    return 'Ce compte s’est créé tout seul et porte déjà vos réglages et vos trajets. Tant qu’il n’est pas enregistré, vider les données de ce site depuis les réglages du navigateur en perdrait l’accès — et ce qui a été déposé avec.'
  }
  const adresseDuCompte = identity.value.email
  const tenuAilleurs = (preuves.value?.fournisseurs ?? []).map((tenu) => tenu.nom).join(', ')
  if (adresseDuCompte === undefined) {
    return tenuAilleurs === ''
      ? 'Ce compte est enregistré. Il se rouvre depuis n’importe quel appareil.'
      : `Ce compte est enregistré avec ${tenuAilleurs}. Il se rouvre depuis n’importe quel appareil.`
  }
  return tenuAilleurs === ''
    ? `Ce compte est enregistré au nom de ${adresseDuCompte}, et se rouvre depuis n’importe quel appareil avec son mot de passe.`
    : `Ce compte est enregistré au nom de ${adresseDuCompte}, avec ${tenuAilleurs}.`
})

/** Ce qui s'écrit en gros : l'adresse si elle existe, sinon l'étiquette tirée au sort. */
const nomAffiche = computed(() => identity.value?.email ?? identity.value?.name ?? '')

/**
 * Le portrait, et ce qui le remplace.
 *
 * Celui du fournisseur d'abord — il vient avec le compte —, Gravatar ensuite,
 * l'initiale enfin. Dans la voiture, qui est hors réseau, c'est toujours
 * l'initiale : les deux premiers sont des images servies ailleurs.
 */
const portrait = ref('')
const portraitRefuse = ref(false)
// Prise sur ce qui est écrit à côté, et non sur le nom du compte : un compte
// enregistré affiche son adresse, et un portrait marqué « F » sous le nom
// « david@… » n'a l'air de rien.
const initiale = computed(() => initialeDe(nomAffiche.value))

async function chercherLePortrait(): Promise<void> {
  portraitRefuse.value = false
  portrait.value = ''

  const compte = identity.value
  if (compte === null) return
  if (compte.image !== undefined) {
    portrait.value = compte.image
    return
  }
  if (compte.email === undefined) return

  const empreinte = await empreinteDeLAdresse(compte.email)
  if (empreinte !== null) portrait.value = lienDeGravatar(empreinte)
}

/**
 * Une adresse et un mot de passe, pour le jour où l'on n'a plus d'appareil.
 *
 * Deux gestes que l'écran sépare, parce que tout les sépare : **enregistrer**
 * garde le compte de cet appareil et lui donne une adresse ; **ouvrir un compte
 * qui existe** abandonne celui d'ici, et c'est pourquoi il est rangé plus bas,
 * derrière un repli.
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

async function onRattacher(): Promise<boolean> {
  if (enCours.value || !saisieComplete.value) return false
  enCours.value = true
  noteDuCompte.value = ''
  try {
    const rendu = await rattacherSonAdresse(adresse.value, motDePasse.value)
    if (rendu.state === 'sans-reseau') {
      noteDuCompte.value =
        'Sans réseau, on ne peut pas enregistrer ce compte : l’adresse se range sur le serveur.'
      return false
    }
    if (rendu.state === 'refusee') {
      noteDuCompte.value = rendu.detail
      return false
    }
    motDePasse.value = ''
    noteDuCompte.value = `Ce compte est maintenant celui de ${rendu.email}. Rien n’a bougé de ce qu’il portait.`
    await rafraichirLesPreuves()
    return true
  } finally {
    enCours.value = false
  }
}

async function onSeConnecter(): Promise<boolean> {
  if (enCours.value || !saisieComplete.value) return false
  enCours.value = true
  noteDuCompte.value = ''
  try {
    const rendu = await seConnecterAUnCompte(adresse.value, motDePasse.value)
    if (rendu.state === 'sans-reseau') {
      noteDuCompte.value = 'Sans réseau, on ne peut pas se connecter : le mot de passe se vérifie sur le serveur.'
      return false
    }
    if (rendu.state === 'refusee') {
      noteDuCompte.value = rendu.detail
      return false
    }
    motDePasse.value = ''
    adresse.value = ''
    masquerLeCode()
    await rafraichirLesPreuves()
    return true
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

/**
 * Quand le code cesse de valoir, dit en clair.
 *
 * Un compte à rebours à la seconde avait un sens quand le code vivait dix
 * minutes. Sur vingt-quatre heures, il n'annonce plus rien : l'heure d'échéance
 * suffit, et ne bouge pas pendant qu'on recopie.
 */
const echeanceDuCode = ref('')

function masquerLeCode(): void {
  codeARelier.value = ''
  lienARelier.value = ''
  qrARelier.value = ''
  echeanceDuCode.value = ''
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

  echeanceDuCode.value = new Date(demande.expireLe).toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
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
    await rafraichirLesPreuves()
  } finally {
    saisieEnCours.value = false
  }
}

onMounted(() => {
  void possibilitesDuServeur().then((rendu) => {
    possibilites.value = rendu
  })
  void rafraichirLesPreuves()
  void chercherLePortrait()
})

// Le compte peut changer sous l'écran : on rejoint un compte par un code, on en
// ouvre un autre. Le portrait suit, sans quoi on verrait celui du précédent.
watch(
  () => [identity.value?.id, identity.value?.email, identity.value?.image].join('|'),
  () => void chercherLePortrait(),
)

/**
 * Les comptes tenus ailleurs.
 *
 * Deux gestes qui se ressemblent à l'écran et que tout sépare, exactement comme
 * pour une adresse : *rattacher* ajoute une preuve au compte d'ici, *se
 * connecter* ouvre ici un compte qui existe ailleurs. Dans les deux cas la page
 * s'en va chez le fournisseur — il n'y a donc rien à afficher après, sauf quand
 * le départ lui-même a échoué.
 */
const noteDuTiers = ref('')
const tiersEnCours = ref(false)

/**
 * L'intention se déclare **avant** de choisir le moyen.
 *
 * C'est ce qui rend ce parcours possible, et non un détail d'écran. La
 * bibliothèque agit au retour de la redirection, pas sur validation : on ne
 * saurait pas, au moment de partir chez le fournisseur, si son adresse désigne
 * un compte existant. Aucune de ses deux routes ne sait faire les deux cas —
 * l'une ouvre et refuse les inconnus, l'autre rattache et refuse les connus.
 *
 * Demander l'intention lève l'inconnue : on sait laquelle appeler, sans deviner,
 * sans deux allers-retours, et sans reprendre le rappel OAuth.
 *
 * Les libellés sont des **états** et non des opérations : « rattacher un compte
 * existant » se lisait à l'envers, comme une fusion.
 */
type Intention = 'jai-un-compte' | 'jen-ai-pas'

const intention = ref<Intention | null>(null)
const fenetre = ref<HTMLDialogElement | null>(null)

/**
 * Les comptes tenus ailleurs qu'on peut proposer, selon l'intention.
 *
 * Pour ouvrir, tous ceux que le serveur a montés ; pour créer, seulement ceux
 * qui ne sont pas déjà rattachés — en proposer un qui l'est n'ouvrirait rien.
 */
const moyensTiers = computed(() =>
  intention.value === 'jai-un-compte' ? possibilites.value.fournisseurs : fournisseursARattacher.value,
)

function ouvrirLaFenetre(voulu: Intention): void {
  intention.value = voulu
  noteDuTiers.value = ''
  noteDuCompte.value = ''
  motDePasse.value = ''
  fenetre.value?.showModal()
}

function fermerLaFenetre(): void {
  fenetre.value?.close()
  intention.value = null
}

/** Le moyen choisi appelle la route que l'intention désigne. */
function onMoyenTiers(fournisseur: string): void {
  // Pas de fermeture ici : la page s'en va chez le fournisseur, et tout ce qui
  // suivrait ne s'afficherait jamais.
  void onTiers(fournisseur, intention.value === 'jai-un-compte' ? 'connecter' : 'rattacher')
}

/**
 * Le moyen par adresse, et la fenêtre qui se ferme quand c'est fait.
 *
 * Elle reste ouverte sur un échec — c'est là qu'on corrige sa saisie —, et se
 * referme sur un succès : l'écran derrière a changé, et laisser « Créer votre
 * compte » par-dessus un compte qui vient d'être créé se lit comme un échec.
 */
async function onMoyenAdresse(): Promise<void> {
  const fait = await (intention.value === 'jai-un-compte' ? onSeConnecter() : onRattacher())
  if (fait) fermerLaFenetre()
}

async function onTiers(fournisseur: string, geste: 'rattacher' | 'connecter'): Promise<void> {
  if (tiersEnCours.value) return
  tiersEnCours.value = true
  noteDuTiers.value = ''
  try {
    const rendu =
      geste === 'rattacher'
        ? await rattacherUnCompteTenuAilleurs(fournisseur)
        : await seConnecterAvecUnCompteTenuAilleurs(fournisseur)
    if (rendu.state === 'sans-reseau') {
      noteDuTiers.value =
        'Sans réseau, on ne peut pas passer par un compte tenu ailleurs : il faut aller le lui demander.'
      return
    }
    if (rendu.state === 'refusee') noteDuTiers.value = rendu.detail
    // `part` ne rend rien à dire : la page est déjà en train de s'en aller.
  } finally {
    tiersEnCours.value = false
  }
}

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

/**
 * Autoriser l'assistance : ouvrir ses données à qui administre, pour 24 heures.
 *
 * **On ne reçoit aucune demande** : le serveur ne sait pas parler à une voiture,
 * et la voiture roule souvent hors réseau. C'est donc de vive voix qu'on nous
 * l'aura demandé, et ce bouton-ci est la réponse.
 *
 * `null` veut dire « on ne sait pas » — hors réseau, l'écran ne doit pas
 * affirmer que rien n'est ouvert.
 */
const assistance = ref<Assistance | null>(null)
const assistanceEnCours = ref(false)

/** Une échéance dite comme on la lit : le jour et l'heure, pas la seconde. */
function quandLisible(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function onBasculerLAssistance(): Promise<void> {
  if (assistanceEnCours.value) return
  assistanceEnCours.value = true
  try {
    const rendu =
      assistance.value?.ouverte === true ? await fermerLAssistance() : await ouvrirLAssistance()
    assistance.value = rendu
    if (rendu === null) {
      noteDeTenue.value = 'Sans réseau, on ne change pas cette autorisation : elle vit sur le serveur.'
    }
  } finally {
    assistanceEnCours.value = false
  }
}

onMounted(async () => {
  assistance.value = await lireLAssistance()
})

onUnmounted(() => {
  masquerLeCode()
})
</script>

<template>
  <section class="account">
    <h2>Le compte</h2>

    <!--
      Qui l'on est, en haut et en un coup d'œil : c'est ce que montre n'importe
      quelle application, et ce que cet écran noyait dans un paragraphe.
    -->
    <div class="identite">
      <img
        v-if="portrait !== '' && !portraitRefuse"
        class="portrait"
        :src="portrait"
        alt=""
        referrerpolicy="no-referrer"
        @error="portraitRefuse = true"
      />
      <p v-else class="portrait initiale" aria-hidden="true">{{ initiale }}</p>
      <div class="qui">
        <p class="nom">{{ nomAffiche }}</p>
        <p class="note">{{ compteDeLAppareil }}</p>
      </div>
    </div>

    <p class="note">
      Ce compte porte tout ce qui remonte du volant : traces, journal, relevés de
      mesure, profils, moteurs et boîtes. Il n’y a jamais rien à saisir pour
      rouler — l’appareil s’annonce tout seul.
    </p>

    <!--
      S'approprier le compte. Le bloc disparaît une fois que c'est fait : une
      application qui continue de proposer de créer un compte qu'on a déjà est
      une application qui ne sait pas où elle en est.
    -->
    <template v-if="!approprie && identity !== null">
      <h3>Enregistrer ce compte</h3>

      <template v-if="auVolant">
        <p class="note">
          <strong>Pas au volant.</strong> Cela demande un clavier, et parfois un
          détour par un autre site : ce n’est pas un geste à faire en voiture.
          Donnez-vous un code ci-dessous, ouvrez l’application sur un ordinateur
          ou un téléphone, et enregistrez le compte là-bas. Ce sera le même — les
          mêmes profils, les mêmes trajets.
        </p>
      </template>

      <template v-else>
        <p class="note">
          Tant qu’il n’est pas enregistré, ce compte ne tient qu’à ce navigateur.
          L’enregistrer lui donne un chemin de retour : on le rouvre ailleurs, et
          on ne le perd plus en nettoyant un navigateur.
        </p>

        <!--
          L'intention d'abord, le moyen ensuite. Deux états et non deux
          opérations : « rattacher un compte existant » se lisait comme une
          fusion. Ce que chacun déclenche est dit dans la fenêtre.
        -->
        <div class="choices intentions">
          <button class="is-active big" @click="ouvrirLaFenetre('jen-ai-pas')">
            Je n’ai pas encore de compte
          </button>
          <button class="big" @click="ouvrirLaFenetre('jai-un-compte')">
            J’ai déjà un compte
          </button>
        </div>
        <p class="note">
          Aucun courriel n’est envoyé, et l’adresse n’est pas vérifiée : il n’y a
          pas de relais à configurer, et celui qui déploie chez lui n’en fournira
          pas. Tant qu’il n’y en a pas, un mot de passe perdu l’est pour de bon.
        </p>
      </template>
    </template>

    <!--
      Déjà enregistré : plus d'invitation, seulement ce qui reste à ajouter. Un
      fournisseur de plus est une preuve de plus, jamais un remplacement.
    -->
    <template v-else-if="approprie && fournisseursARattacher.length > 0 && !auVolant">
      <h3>Ajouter une façon de se reconnecter</h3>
      <p class="note">
        <strong>En plus, jamais à la place.</strong> Rattacher l’un de ces
        comptes ajoute un chemin de retour ; l’adresse et le mot de passe restent
        le filet, et ne sont pas remplacés.
      </p>
      <div class="choices">
        <button
          v-for="fournisseur in fournisseursARattacher"
          :key="fournisseur.id"
          :disabled="tiersEnCours"
          @click="onTiers(fournisseur.id, 'rattacher')"
        >
          Rattacher {{ fournisseur.nom }}
        </button>
      </div>
      <p v-if="noteDuTiers" class="note">{{ noteDuTiers }}</p>
    </template>

    <!--
      Donner un code. Deux rendus du même jeton : le lien à scanner, et huit
      caractères à recopier sur un appareil sans caméra.
    -->
    <h3>Ouvrir ce compte sur un autre appareil</h3>
    <p class="note">
      Un téléphone qui scanne le code, ou un ordinateur où l’on recopie huit
      caractères, ouvre le <strong>même compte</strong> : les mêmes profils, les
      mêmes moteurs, les mêmes boîtes, les mêmes trajets.
    </p>
    <div class="choices">
      <button :class="{ 'is-active': !!codeARelier }" @click="onDonnerUnCode()">
        {{ codeARelier ? 'Masquer le code' : 'Donner un code…' }}
      </button>
    </div>

    <div v-if="codeARelier" class="share">
      <p class="note warn">
        Qui voit ce code ouvre ce compte. Il ne sert qu’<strong>une fois</strong>,
        et il vaut jusqu’à <strong>{{ echeanceDuCode }}</strong>.
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
      L'appareil : le second axe. Il ne protège rien — c'est le compte qui porte
      les droits —, il range l'écran selon ce qu'on fait là où l'on est.
    -->
    <h3>Cet appareil</h3>
    <p class="note">
      Ce qui s’affiche dépend d’où l’on est : un banc de simulation n’a rien à
      faire sur l’écran d’une voiture qui roule. On devine, et si c’est faux, on
      corrige ici — le choix reste sur cet appareil.
    </p>
    <div class="choices">
      <button
        v-for="lequel in APPAREILS"
        :key="lequel"
        :aria-pressed="appareil === lequel"
        @click="corrigerLAppareil(lequel)"
      >
        {{ NOMS_DAPPAREIL[lequel] }}
      </button>
    </div>
    <p class="note">
      <strong>{{ NOMS_DAPPAREIL[appareil] }}</strong> — {{ CE_QUE_LAPPAREIL_OUVRE[appareil] }}.
      <template v-if="!appareilCorrige">Deviné d’après ce navigateur.</template>
    </p>

    <!--
      Autoriser l'assistance. Placée avant « emporter » et « supprimer », parce
      qu'elle se coche le jour où l'on vient de signaler un défaut.
    -->
    <h3>Autoriser l’assistance</h3>
    <p class="note">
      Quand quelque chose ne marche pas et qu’on nous le signale, personne ne
      peut regarder ce que ce compte porte : il n’y a pas de porte pour ça. Ce
      bouton en ouvre une pour <strong>24 heures</strong>, et elle se referme
      toute seule.
    </p>
    <div class="choices">
      <button
        :aria-pressed="assistance?.ouverte === true"
        :disabled="assistanceEnCours"
        @click="onBasculerLAssistance()"
      >
        {{ assistance?.ouverte === true ? 'Refermer maintenant' : 'Autoriser pour 24 heures' }}
      </button>
    </div>
    <p v-if="assistance === null" class="note">
      Sans réseau, on ne sait pas si c’est ouvert : cette autorisation vit sur le
      serveur.
    </p>
    <p v-else-if="assistance.ouverte && assistance.jusquau !== null" class="note">
      <strong>Ouvert jusqu’au {{ quandLisible(assistance.jusquau) }}.</strong> Ce
      qui sera regardé s’inscrira, et vous pourrez le relire.
    </p>
    <p v-else class="note">Fermé. Rien de ce compte n’est visible d’ailleurs.</p>

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

    <!--
      Changer le mot de passe : seulement pour les comptes qui en ont un. Un
      compte enregistré chez un fournisseur n'en a pas, et le lui demander était
      un cul-de-sac.
    -->
    <template v-if="aUnMotDePasse">
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

    <h3>Supprimer ce compte</h3>
    <p class="note">
      Tout part avec lui : les profils, les moteurs, les boîtes, les trajets, le
      journal, les relevés et le profil mesuré déposés sur le serveur.
      <strong>C’est sans retour.</strong> Ce qui est réglé sur cet appareil, lui,
      ne bouge pas — c’est un autre bouton, dans l’écran de configuration.
    </p>
    <div class="choices">
      <input
        v-if="aUnMotDePasse"
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

    <!--
      Ouvrir un autre compte, pour qui a déjà enregistré celui-ci. Le bouton
      remplace le repli qui logeait ce geste tout en bas : ce qui le protège
      d'un geste distrait n'est plus d'être caché, mais la fenêtre — elle
      demande un choix explicite et dit ce que ça coûte.
    -->
    <template v-if="approprie && !auVolant">
      <h3>Ouvrir un autre compte sur cet appareil</h3>
      <div class="choices">
        <button @click="ouvrirLaFenetre('jai-un-compte')">J’ai un autre compte…</button>
      </div>
    </template>

    <!--
      Le moyen, une fois l'intention dite.

      `<dialog>` natif : aucune bibliothèque, et le piégeage du focus vient
      avec. Le même contenu sert les deux intentions — seul change ce que le
      moyen déclenche, et ce que la fenêtre annonce.
    -->
    <dialog v-if="!auVolant" ref="fenetre" class="fenetre" @close="intention = null">
      <h3>
        {{ intention === 'jai-un-compte' ? 'Ouvrir votre compte' : 'Créer votre compte' }}
      </h3>

      <p v-if="intention === 'jai-un-compte'" class="note">
        Cet appareil <strong>quittera</strong> le compte qu’il porte aujourd’hui
        pour ouvrir le vôtre. Le compte quitté est effacé s’il est vide, gardé
        sinon — et il ne se rouvre que s’il a été enregistré.
      </p>
      <p v-else class="note">
        Rien ne bouge de ce que ce compte porte déjà : lui donner une adresse ne
        le remplace pas, ses profils et ses trajets restent les siens.
      </p>

      <div v-if="moyensTiers.length > 0" class="choices">
        <button
          v-for="fournisseur in moyensTiers"
          :key="fournisseur.id"
          :disabled="tiersEnCours"
          @click="onMoyenTiers(fournisseur.id)"
        >
          Continuer avec {{ fournisseur.nom }}
        </button>
      </div>
      <p v-if="noteDuTiers" class="note">{{ noteDuTiers }}</p>
      <p v-if="moyensTiers.length > 0" class="ou">ou</p>

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
          :autocomplete="intention === 'jai-un-compte' ? 'current-password' : 'new-password'"
          :placeholder="
            intention === 'jai-un-compte'
              ? 'Mot de passe'
              : `Mot de passe (${MOT_DE_PASSE_MINIMUM} caractères au moins)`
          "
        />
        <button :disabled="!saisieComplete || enCours" @click="onMoyenAdresse()">
          {{ intention === 'jai-un-compte' ? 'Ouvrir ce compte ici' : 'Créer ce compte' }}
        </button>
      </div>
      <p v-if="noteDuCompte" class="note">{{ noteDuCompte }}</p>

      <div class="choices">
        <button @click="fermerLaFenetre()">Fermer</button>
      </div>
    </dialog>
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

/* Qui l'on est : un portrait et un nom, comme partout ailleurs. */
.identite {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.25rem 0;
}

.portrait {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}

.portrait.initiale {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  border: 1px solid currentColor;
  opacity: 0.8;
}

.qui {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.nom {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* La séparation entre les deux façons de s'enregistrer. */
.ou {
  margin: 0.25rem 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
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

/*
 * Les deux intentions, côte à côte et de même poids.
 *
 * Elles se répartissent la largeur plutôt que de se suivre : deux boutons de
 * tailles différentes se lisent comme un principal et un secondaire, alors
 * qu'ici aucun des deux n'est le bon par défaut — cela dépend de qui regarde.
 */
.intentions button {
  flex: 1;
  min-width: 12rem;
}

/*
 * La fenêtre du moyen.
 *
 * `<dialog>` porte le fond, le centrage et le piégeage du focus ; il ne reste
 * qu'à lui donner la mise en page de l'écran. Une largeur bornée en `min()`
 * pour qu'elle tienne sur un téléphone sans déborder, et un défilement propre
 * si le clavier virtuel mange la hauteur.
 */
.fenetre {
  width: min(28rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.2rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
}

.fenetre::backdrop {
  background: rgb(0 0 0 / 0.6);
}

.fenetre h3 {
  margin-top: 0;
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
