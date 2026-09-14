<script setup lang="ts">
import { bandeDeDefilement } from '../state'

/**
 * L'aide de référence, derrière le bouton `?`.
 *
 * Elle n'est plus l'écran du premier lancement depuis le 14 septembre 2026 :
 * cet écran-là accueille, celui-ci répond. Le tri s'est fait sur une question —
 * « est-ce qu'on ouvre l'aide pour ça ? ». Où se trouve D ne s'ouvre pas, la
 * visite guidée le montre ; pourquoi la vitesse reste à zéro, oui.
 *
 * Ce qui est parti : « Pour commencer » et « Les commandes de conduite », que la
 * visite désigne sur l'interface elle-même.
 */
defineEmits<{ close: []; compte: []; visite: [] }>()

/**
 * L'adresse du code source, et la version servie à cette page.
 *
 * Ce n'est pas une politesse : l'AGPL-3.0 demande, à sa section 13, que celui
 * qui fait tourner le programme comme service en offre la source aux gens qui
 * s'en servent à distance. Un lien dans l'interface est la façon que la licence
 * cite elle-même. La version l'accompagne parce qu'une offre de source qui ne
 * dit pas de quelle version elle parle n'en est pas vraiment une.
 */
const sourceUrl = 'https://github.com/davidp57/sound-of-speed'
const appVersion = __APP_VERSION__
</script>

<template>
  <div class="help">
    <div class="ecran" :class="{ 'bande-defilement': bandeDeDefilement }">
      <article>
        <h1>Aide</h1>
        <p class="lead">
          Ce que l'on se demande en roulant, et où le trouver. Les commandes elles-mêmes
          sont montrées par la visite guidée.
        </p>

        <h2>La vitesse reste à zéro ?</h2>
        <p>
          C'est presque toujours l'adresse. Le GPS n'est accessible qu'aux pages en
          <b>https</b>. Si l'adresse commence par <code>http://</code>, la page
          s'affiche normalement mais la localisation est refusée, sans message.
        </p>

        <h2>Le son est trop faible ?</h2>
        <p>
          Le curseur <b>Volume</b> se trouve sur l'écran de conduite, sous les
          cadrans, une fois le son démarré. Il peut monter
          au-delà du maximum habituel, ce qui est utile quand le volume de la voiture
          reste bas pour la musique.
        </p>
        <p>
          Si une autre application a pris le son — la musique de la voiture, un
          appel —, c'est l'icône de haut-parleur, en haut à droite, qui le récupère.
        </p>

        <h2>En roulant</h2>
        <p>
          Le bouton <b>Plein écran</b> masque la barre du haut : les chiffres
          occupent toute la hauteur et les commandes deviennent quatre grandes
          touches. Pour en sortir, la croix en haut à droite.
        </p>
        <p>
          Pensez à <b>garder l'écran allumé</b> : l'interrupteur est sur l'écran de
          conduite. Sinon l'écran s'éteint au bout d'une minute et vous perdez la
          vitesse de vue.
        </p>

        <h2>Partir sans réseau</h2>
        <p>
          Sur l'écran <b>Configuration</b>, dans <i>Hors réseau</i>, le bouton
          <b>Préparer hors réseau</b> met les sons en mémoire. L'application démarre
          ensuite sans connexion — utile dès qu'on traverse une zone mal couverte.
        </p>

        <h2>Créer sa propre voiture</h2>
        <p>
          Tout en haut de l'écran <b>Configuration</b>, <b>Créer un profil</b> pose
          quatre questions : le tempérament, l'usage, le type de moteur et le nombre
          de rapports. Le reste en découle. C'est le chemin le plus court pour
          obtenir autre chose que les deux voitures fournies.
        </p>

        <h2>Régler le son</h2>
        <p>
          Deux profils sont fournis. <b>Route</b> convient aux vitesses de tous les
          jours : les six rapports servent entre 0 et 100 km/h. <b>Sport</b> allonge
          les rapports et monte beaucoup plus haut dans les tours.
        </p>
        <p>
          Tout se règle dans <b>Configuration</b>, sans couper le son : chaque
          réglage est expliqué sous son curseur. Et si vous cassez quelque chose, le
          menu <b>Réinitialiser</b> remet une partie — ou le profil entier — comme au
          premier jour.
        </p>

        <h2>L'écran Télémétrie</h2>
        <p>
          Il affiche tout ce qui sert à fabriquer le son : la vitesse mesurée et
          lissée, la qualité du signal GPS, le régime, la charge, le niveau de chaque
          couche sonore. C'est là qu'il faut regarder quand quelque chose cloche.
        </p>

        <h2>Votre compte</h2>
        <p>
          Un compte s'est créé tout seul au premier démarrage : c'est lui qui porte
          vos profils, vos moteurs et vos trajets. Tant qu'il n'est pas enregistré,
          il ne tient qu'à ce navigateur — l'enregistrer lui donne un chemin de
          retour, et se fait depuis un ordinateur plutôt qu'au volant.
        </p>
        <p>
          <button class="lien" @click="$emit('compte')">Aller à l'écran Compte</button>
        </p>

        <h2>Revoir la visite</h2>
        <p>
          Les bulles qui désignent les commandes, une deuxième fois. Elles ne se
          montrent qu'au premier lancement, où l'on a surtout envie de démarrer.
        </p>
        <p>
          <button class="lien" @click="$emit('visite')">Revoir la visite guidée</button>
        </p>

        <h2>Code source et licence</h2>
        <p>
          Cette application est un logiciel libre, sous licence AGPL-3.0. Son code
          est public : vous pouvez le lire, le modifier, et l'installer sur votre
          propre serveur.
        </p>
        <p>
          <a :href="sourceUrl" target="_blank" rel="noopener">{{ sourceUrl }}</a>
          <span class="version">version {{ appVersion }}</span>
        </p>
        <p>
          Le son de démonstration livré avec l'application est un moteur
          <b>simulé</b>, pas l'enregistrement d'une vraie voiture. Pour un son
          enregistré, il faut déposer sa propre banque d'échantillons.
        </p>

        <button class="start" @click="$emit('close')">Fermer</button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.help {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--bg);
  overflow-y: auto;
  padding: 1.5rem 1rem 3rem;
}

/*
 * L'aide est un panneau qui couvre l'écran et qui défile lui-même : la bande se
 * pose donc sur ce conteneur-ci, qui fait toute la hauteur du texte, et non sur
 * le panneau, où elle sortirait de vue au premier glissement.
 */
.ecran {
  min-height: 100%;
}

article {
  max-width: 42rem;
  margin: 0 auto;
}

h1 {
  font-size: 2rem;
  font-weight: 300;
  margin: 0 0 0.5rem;
}

h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin: 2rem 0 0.6rem;
}

.lead {
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.5;
  margin: 0;
}

p,
li {
  line-height: 1.6;
}

code {
  background: var(--panel-alt);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.9em;
}

.version {
  color: var(--muted);
  font-size: 0.9rem;
  margin-left: 0.6rem;
}

/* Un bouton qui se comporte comme un lien : il mène ailleurs, il n'agit pas. */
.lien {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.start {
  display: block;
  width: 100%;
  margin-top: 2rem;
  padding: 0.9rem;
  font-size: 1.05rem;
  background: var(--accent);
  border-color: var(--accent);
  color: #17130a;
  font-weight: 600;
}
</style>
