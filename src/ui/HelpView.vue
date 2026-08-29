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
        Cette application ajoute un son de moteur à une voiture qui n'en fait pas.
        Elle mesure votre vitesse au GPS, en calcule un régime moteur et un rapport
        de boîte, et joue le son qui correspond.
      </p>

      <h2>Pour commencer</h2>
      <ol>
        <li>
          Sur l'écran <b>Conduite</b>, appuyez sur <b>Activer le son</b>. Un
          navigateur n'autorise le son qu'après un appui : sans ce geste, il ne se
          passera rien.
        </li>
        <li>
          Choisissez la source de vitesse : <b>Simulateur</b> pour essayer à
          l'arrêt, <b>GPS</b> pour rouler.
        </li>
        <li>
          Avec le GPS, autorisez la localisation quand le navigateur la demande.
        </li>
      </ol>

      <h2>La vitesse reste à zéro ?</h2>
      <p>
        C'est presque toujours l'adresse. Le GPS n'est accessible qu'aux pages en
        <b>https</b>. Si l'adresse commence par <code>http://</code>, la page
        s'affiche normalement mais la localisation est refusée, sans message.
      </p>

      <h2>Le son est trop faible ?</h2>
      <p>
        Le curseur <b>Volume</b> se trouve sur l'écran de conduite. Il peut monter
        au-delà du maximum habituel, ce qui est utile quand le volume de la voiture
        reste bas pour la musique.
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

      <p class="foot">
        Vous pouvez revenir ici à tout moment par le bouton <b>?</b>, en haut.
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
