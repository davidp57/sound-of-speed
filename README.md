# Speed

Une voix de moteur pour une voiture qui n'en a pas. L'application lit la vitesse
réelle au GPS, en déduit un régime et un rapport engagé, et pilotera avec ça un
moteur sonore à échantillons.

Trois écrans : la **conduite** (vitesse, rapport, régime), la **télémétrie** (tout
ce qui alimente le son) et la **configuration** (chaque paramètre, réglable
pendant que ça tourne, avec sauvegarde et chargement de profils).

## Démarrer

```bash
npm install
```

```bash
npm run dev
```

Le serveur écoute sur toutes les interfaces : depuis un téléphone sur le même
réseau, ouvrir `http://<adresse-du-poste>:5173` pour tester avec un vrai GPS.

Au clavier, en source « Simulateur » : flèches **haut** et **bas** pour
l'accélérateur et le frein, flèches **gauche** et **droite** pour les rapports en
mode manuel.

## Où en est le projet

| Lot | Contenu | État |
|---|---|---|
| 0 | Squelette, boucle, écrans, simulateur clavier | fait |
| 1 | Conditionnement du signal, GPS, enregistrement et rejeu de traces | fait |
| 2 | Modèle moteur et boîte de vitesses | fait |
| 3 | Moteur audio à échantillons, transcodage, calage des boucles | fait |
| 4 | Détection automatique du régime d'ancrage dans l'éditeur | à faire |
| 5 | Adaptation à l'écran de la voiture, Media Session, audio en arrière-plan | à faire |

Le son fonctionne. L'écran de télémétrie affiche le mixage appliqué à chaque
image — gain et vitesse de lecture de chaque couche, poids des familles, niveau
de sortie mesuré après le limiteur — ce qui rend le réglage vérifiable à l'œil
autant qu'à l'oreille.

## Architecture

```
src/
  core/
    loop.ts              cadence unique, avec repli quand la page est masquée
    speed/
      source.ts          interface commune aux trois sources
      simulator.ts       vitesse au clavier, pour travailler sur un poste fixe
      geolocation.ts     GPS réel, avec repli haversine et rejet des aberrations
      replay.ts          rejeu d'une trace enregistrée, et son enregistreur
      conditioner.ts     fenêtre glissante, extrapolation, ressort amorti
    engine/engine.ts     régime, charge, rupteur
    drivetrain/gearbox.ts  rapports, passages automatiques et manuels
    audio/
      mix.ts             gains et vitesses de lecture des couches (fonction pure)
      engine.ts          graphe Web Audio, chargement, horloge sur le fil audio
    preset/              schéma d'un profil, valeurs par défaut, persistance
  ui/                    les trois écrans
  state.ts               assemblage et télémétrie
public/audio/            échantillons, non versionnés
scripts/transcode.mjs    compression FLAC
```

Les trois sources de vitesse exposent la même interface, donc tout ce qui est en
aval ignore d'où vient le chiffre : on développe au clavier, on met au point en
rejouant un trajet capturé, et on roule pour de vrai, sans branche
conditionnelle nulle part.

### Le son

Toutes les couches jouent en permanence, en boucle, dès l'activation ; seuls
leurs gains et leurs vitesses de lecture bougent. Démarrer et arrêter des sources
au fil du régime produirait des discontinuités de phase, donc des clics.

Deux fondus se composent, tous deux à puissance constante : en régime, entre les
couches d'un même rôle ; en charge, entre « en charge » et « pied levé ». La
charge est déduite de l'accélération, faute de pédale dans une voiture
électrique.

Trois points ont demandé une attention particulière :

- **Le raccord des boucles.** Un échantillon dont le dernier point est loin du
  premier claque à chaque tour. Mesuré après décodage, canal par canal :
  `on-high` sautait de 21,6 % du pic et `limiter` de 39,4 %. Le chargement
  détecte ces cas et applique un fondu de 30 ms sur le raccord.
- **La cadence en arrière-plan.** Le navigateur gèle l'affichage et ralentit les
  minuteurs dès que la page n'est plus visible, mais le fil audio continue. Une
  horloge `AudioWorklet` bat donc la mesure dès qu'elle est disponible, et la
  boucle d'affichage s'efface. Un média silencieux tourne en parallèle pour que
  le système ne libère pas la session audio.
- **La phase des couches.** Deux boucles issues du même enregistrement, démarrées
  ensemble, restent en phase et se renforcent en peigne. Chacune démarre donc à
  une position tirée au hasard.

### La pièce importante

C'est `conditioner.ts`, et ce n'est pas le son. Le GPS ne livre qu'une mesure par
seconde : piloter directement une hauteur avec ce signal donne un escalier qui
saute chaque seconde. Trois traitements se composent — une pente calculée sur une
fenêtre glissante, une extrapolation entre deux mesures, et un ressort amorti
critique intégré à pas fixe.

Mesuré sur une trace synthétique à 1 Hz : l'écart de suivi reste sous 1 km/h en
accélération régulière, et la sortie est continue. Il monte à une dizaine de
km/h sur un freinage brutal, le temps que la pente bascule — c'est le compromis
inhérent au procédé, et c'est ce qu'arbitrent les réglages « raideur du lissage »
et « fenêtre d'accélération ».

## Échantillons

Le dossier `public/audio/` **n'est pas versionné**, volontairement. Le code n'y référence
rien en dur : chaque profil déclare un sous-dossier et la liste de ses couches.
Changer de banque sonore, c'est remplacer le contenu du dossier et ajuster les
régimes d'ancrage dans l'écran de configuration.

Il faut, par moteur, des boucles stationnaires à régime connu : montée en charge
bas et haut régime, décélération bas et haut régime, un ralenti, un rupteur.
C'est le format standard de l'audio de jeu — voir
[Audiokinetic](https://www.audiokinetic.com/en/blog/loop-based-car-engine-design-with-wwise-part-2/)
et [Game Developer](https://www.gamedeveloper.com/audio/capturing-engine-sounds-for-games).

Le régime d'ancrage d'un échantillon se mesure : le pic d'allumage dominant vaut
`régime ÷ 120 × cylindres`. Le lot 4 automatisera cette détection dans l'éditeur.

### Compression

```bash
npm run transcode
```

Convertit les prises en FLAC : **−50 %** sur le jeu actuel, 5,73 Mo → 2,84 Mo,
sans aucune perte (écart maximal mesuré après décodage : 1,5 × 10⁻⁷). Les
fichiers d'origine sont conservés ; il reste à changer l'extension des couches
dans l'écran de configuration.

FLAC plutôt qu'AAC ou Opus parce que les codecs avec perte insèrent un silence
d'amorçage en tête de fichier, qui sur une boucle revient à chaque tour.

### Ce qui manque au jeu actuel

Il n'y a **pas de couche de ralenti**. Le moteur étire donc l'enregistrement bas
régime, ancré à 3128 tr/min, jusqu'au ralenti à 780 — un rapport de 4 pour 1,
bien au-delà de ce qu'un échantillon supporte. La vitesse de lecture est bornée à
0,5, ce que l'écran de télémétrie signale par la mention « bornée », et le son à
l'arrêt sonne donc une octave trop haut.

Y remédier demande de la matière, pas du code : une prise de ralenti, déclarée
comme une couche de rôle « ralenti ».

## Banc de mise au point

Le navigateur gèle `requestAnimationFrame` et ralentit les minuteurs dès que la
page passe en arrière-plan, ce qui rend toute mesure prise à la montre
inexploitable. En développement, `window.__speed` expose l'état complet et de
quoi reprendre la main sur le temps :

```js
const s = window.__speed
s.start()
s.pauseLoop()                  // coupe la cadence, garde la source active
s.setThrottle(1)
s.advanceManually(1 / 60, 600) // dix secondes simulées, à pas fixe
s.telemetry.value
```

C'est ainsi que les seuils de passage ont été vérifiés : la boîte monte un
rapport 0,6 s après avoir franchi 94 % du rupteur à pleine charge, et bien plus
tôt en charge partielle — sinon les derniers rapports ne seraient jamais engagés.
