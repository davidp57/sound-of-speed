<script setup lang="ts">
import { computed } from 'vue'

import { appareil, bandeDeDefilement } from '../state'

/**
 * L'écran du premier lancement.
 *
 * Il est court, et c'est tout son propos. L'aide qui vivait là comptait onze
 * sections : un manuel, montré à quelqu'un qui veut rouler. Elle est restée
 * derrière le bouton `?`, où elle répond à une question qu'on se pose ; ici on
 * dit trois choses et on s'efface.
 *
 * Le compte passe en premier, en gros, parce que c'est la chose que personne
 * n'a demandée et que tout le monde a déjà : il s'est créé tout seul, il porte
 * ce qui remonte du volant, et il ne tient qu'à ce navigateur tant qu'on ne
 * l'enregistre pas.
 */
defineEmits<{ close: []; compte: [] }>()

/** Au volant on ne s'enregistre pas : ni clavier commode, ni envie de partir
 * chez un fournisseur en conduisant. L'écran Compte tient déjà cette
 * distinction ; l'accueil ne peut pas proposer l'inverse de ce qu'il dira. */
const auVolant = computed(() => appareil.value === 'voiture')

/**
 * L'adresse du code source, et la version servie à cette page.
 *
 * L'AGPL-3.0 demande, à sa section 13, que celui qui fait tourner le programme
 * comme service en offre la source aux gens qui s'en servent à distance. Cet
 * écran est le premier qu'ils voient : l'offre y est, en petit, et elle reste
 * aussi dans l'aide de référence.
 */
const sourceUrl = 'https://github.com/davidp57/sound-of-speed'
const appVersion = __APP_VERSION__
</script>

<template>
  <div class="welcome">
    <div class="ecran" :class="{ 'bande-defilement': bandeDeDefilement }">
      <article>
        <h1>Sound of Speed</h1>
        <p class="lead">
          Cette application donne un son de moteur à une voiture qui n’en fait pas.
          Elle mesure votre vitesse au GPS et joue le son qui correspond.
        </p>

        <section class="compte">
          <h2>Vous avez déjà un compte</h2>
          <p>
            Il s’est créé tout seul, et c’est lui qui portera vos réglages, vos
            moteurs et vos trajets — il n’y a rien à saisir pour rouler.
          </p>
          <p v-if="auVolant">
            Tant qu’il n’est pas enregistré, il ne tient qu’à ce navigateur. Pas
            au volant : donnez-vous un code, et enregistrez-le depuis un
            ordinateur. Ce sera le même compte.
          </p>
          <p v-else>
            Tant qu’il n’est pas enregistré, il ne tient qu’à ce navigateur.
          </p>
          <button class="lien" @click="$emit('compte')">Aller à l’écran Compte</button>
        </section>

        <h2>Pour rouler</h2>
        <ol>
          <li>
            Sur l’écran <b>Conduite</b>, appuyez sur <b>D</b>. Un navigateur
            n’ouvre le son et la position qu’après un appui.
          </li>
          <li>Autorisez la localisation quand il la demande, la première fois.</li>
          <li>
            En arrivant, appuyez sur <b>P</b>. Tout s’arrête et le trajet part
            vers le serveur.
          </li>
        </ol>

        <button class="start" @click="$emit('close')">Commencer</button>

        <p class="foot">
          Logiciel libre sous AGPL-3.0 —
          <a :href="sourceUrl" target="_blank" rel="noopener">{{ sourceUrl }}</a>
          <span class="version">version {{ appVersion }}</span>
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--bg);
  overflow-y: auto;
  padding: 1.5rem 1rem 3rem;
}

/* Le panneau couvre l'écran et défile lui-même : la bande se pose sur ce
   conteneur-ci, qui fait toute la hauteur du texte. */
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
  line-height: 1.5;
  margin: 0;
}

/*
 * Le bloc du compte, en gros.
 *
 * « En premier, en gros, clair » est la demande, et le corps agrandi est ce qui
 * la tient : trois phrases seulement, sinon l'agrandissement ferait un pavé
 * qu'on saute au lieu d'un bloc qu'on lit.
 */
.compte {
  margin-top: 1.75rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--panel);
}

.compte h2 {
  font-size: 1.3rem;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text);
  margin: 0 0 0.6rem;
}

.compte p {
  font-size: 1.1rem;
  line-height: 1.5;
  margin: 0 0 0.6rem;
}

p,
li {
  line-height: 1.6;
}

ol {
  padding-left: 1.2rem;
}

li {
  margin-bottom: 0.5rem;
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

.foot {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 1.5rem;
}

.version {
  margin-left: 0.6rem;
}
</style>
