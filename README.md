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
| 3 | Moteur audio à échantillons, transcodage, calage des boucles | à faire |
| 4 | Détection automatique du régime d'ancrage dans l'éditeur | à faire |
| 5 | Adaptation à l'écran de la voiture, Media Session, audio en arrière-plan | à faire |

Rien n'émet encore de son. En revanche l'écran de télémétrie affiche déjà le
mixage que le lot 3 appliquera — gain et vitesse de lecture de chaque couche,
calculés à chaque image. Le réglage est donc vérifiable à l'œil avant même qu'il
y ait quelque chose à entendre.

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
    audio/mix.ts         gains et vitesses de lecture des couches (fonction pure)
    preset/              schéma d'un profil, valeurs par défaut, persistance
  ui/                    les trois écrans
  state.ts               assemblage et télémétrie
```

Les trois sources de vitesse exposent la même interface, donc tout ce qui est en
aval ignore d'où vient le chiffre : on développe au clavier, on met au point en
rejouant un trajet capturé, et on roule pour de vrai, sans branche
conditionnelle nulle part.

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

Le dossier `audio/` **n'est pas versionné**, volontairement. Le code n'y référence
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
