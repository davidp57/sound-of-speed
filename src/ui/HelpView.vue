<script setup lang="ts">
/**
 * Page d'aide.
 *
 * Affichée d'office au premier lancement, puis rappelable à tout moment. Elle
 * répond aux questions qu'on se pose en ouvrant l'application pour la première
 * fois — pourquoi il n'y a pas de son, pourquoi la vitesse reste à zéro — plutôt
 * que de décrire l'interface écran par écran.
 */
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="help">
    <article>
      <h1>Speed</h1>
      <p class="lead">
        Une voix de moteur pour une voiture qui n'en a pas. L'application lit votre
        vitesse réelle au GPS, en déduit un régime et un rapport engagé, et joue le
        moteur correspondant.
      </p>

      <h2>Pour commencer</h2>
      <ol>
        <li>
          Écran <b>Conduite</b>, appuyer sur <b>Activer le son</b>. Un navigateur
          n'autorise le son qu'après un geste : rien ne se produira tant que ce
          bouton n'aura pas été touché.
        </li>
        <li>
          Choisir la source : <b>Simulateur</b> pour essayer à l'arrêt,
          <b>GPS</b> pour rouler.
        </li>
        <li>
          En GPS, autoriser la localisation quand le navigateur le demande.
        </li>
      </ol>

      <h2>Si la vitesse reste à zéro</h2>
      <p>
        C'est presque toujours l'adresse. La géolocalisation n'est accordée qu'aux
        pages servies en <b>https</b> : sur une adresse commençant par
        <code>http://</code>, la page s'affiche normalement et le GPS refuse de
        démarrer, sans message.
      </p>

      <h2>En roulant</h2>
      <p>
        Le bouton <b>Conduite</b> passe en plein écran : les chiffres occupent
        toute la hauteur et les commandes deviennent quatre grandes cibles. On en
        sort par la croix, en haut à droite.
      </p>
      <p>
        Pensez à <b>garder l'écran allumé</b> — l'interrupteur est sur l'écran de
        conduite. Sans lui, l'écran s'éteint au bout de quelques dizaines de
        secondes.
      </p>

      <h2>Avant de partir sans réseau</h2>
      <p>
        Écran <b>Configuration</b>, section <i>Hors réseau</i> :
        <b>Préparer hors réseau</b> met les sons en mémoire. L'application démarre
        ensuite sans connexion, ce qui compte dès qu'on traverse une zone mal
        couverte.
      </p>

      <h2>Régler le son</h2>
      <p>
        Deux profils sont livrés. <b>Route</b> convient aux vitesses ordinaires :
        les six rapports servent entre 0 et 100 km/h. <b>Sport</b> étire les
        rapports et monte bien plus haut dans les tours.
      </p>
      <p>
        Tout se règle dans <b>Configuration</b>, pendant que le son tourne : chaque
        réglage porte son explication. Et si l'on casse quelque chose, le menu
        <b>Réinitialiser</b> ramène une section — ou le profil entier — à son état
        d'origine.
      </p>

      <h2>L'écran Télémétrie</h2>
      <p>
        Il montre tout ce qui alimente le son : la vitesse brute et lissée, la
        qualité du signal, le régime, la charge, le niveau de chaque couche
        sonore. C'est là qu'il faut regarder quand quelque chose paraît anormal —
        et ce qu'il faut nous rapporter le cas échéant.
      </p>

      <p class="foot">
        Cette page se rappelle à tout moment par le bouton <b>?</b>, en haut.
      </p>

      <button class="start" @click="$emit('close')">Commencer</button>
    </article>
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

ol {
  padding-left: 1.2rem;
}

li {
  margin-bottom: 0.5rem;
}

code {
  background: var(--panel-alt);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.9em;
}

.foot {
  color: var(--muted);
  font-size: 0.9rem;
  margin-top: 2rem;
}

.start {
  display: block;
  width: 100%;
  margin-top: 1rem;
  padding: 0.9rem;
  font-size: 1.05rem;
  background: var(--accent);
  border-color: var(--accent);
  color: #17130a;
  font-weight: 600;
}
</style>
