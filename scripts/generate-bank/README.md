# `generate-bank` — produire une banque avec engine-sim, ici

Cet outil fait tourner le cœur d'engine-sim **au bureau**, aussi lentement
qu'il le faut, et en tire une banque d'échantillons que la voiture rejouera
avec le moteur de lecture qui existe déjà. C'est la troisième origine de son du
lot [SYNTHESE](../../.backlog/SYNTHESE/spec.md) : *généré à l'avance*.

**Rien n'est modifié dans le moteur de lecture.** La banque produite est du WAV
16 bits mono à 44,1 kHz, dans `public/audio/<dossier>/`, avec un profil partiel
que l'application importe tel quel.

## Le défaut que ça corrige

La banque enregistrée est jouée entre 0,26 et 0,81 fois sa vitesse sur toute la
conduite ordinaire. Le rééchantillonnage descend la fréquence d'allumage — ce
qu'on veut — mais il descend **avec elle** les résonances de l'échappement et
de la caisse, ce qu'on ne veut pas. Un moteur change de régime sans changer de
corps.

La mesure le confirme sur le moteur simulé : le centroïde spectral ne suit le
régime qu'à 8 % — 0,21 octave de timbre pour 2,67 octaves de régime. Le corps du
son est presque fixe ; c'est le rééchantillonnage qui le déplace.

Sur la banque enregistrée, mesurée de la même façon, il le suit à 56 %. Une part
de cet écart tient à la réponse impulsionnelle d'échappement du banc, synthétique
et identique pour toutes les prises : voir « Ce qui n'est pas vérifié ».

La parade est d'enregistrer **une prise par plage de régime**, assez serrées
pour que la vitesse de lecture reste près de un.

## Comment on s'en sert

```bash
node native/prepare.mjs                 # sources d'engine-sim, une fois
bash native/build-generator.sh          # compile le banc hors ligne
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/v8-crossplane.json
```

La banque atterrit dans `public/audio/<dossier>/`, qui n'est pas versionné —
les échantillons vivent dans un volume du NAS, hors de l'image.

Options :

| Option | Effet |
|---|---|
| `--out <dossier>` | racine des banques, `public/audio` par défaut |

Le dossier produit contient les WAV, plus deux fichiers :

- **`profil.json`** — un profil partiel. L'application le complète avec ses
  valeurs par défaut à l'import : on le charge par « Importer un profil » dans
  l'écran de configuration, et il n'y a rien d'autre à régler. Il se déclare
  d'origine **générée à l'avance** et emporte la définition de moteur qui l'a
  produit : sans elle, la banque serait une boîte noire qu'on ne saurait plus
  refaire après avoir changé un réglage.
- **`mesures.json`** — le relevé complet : régimes tenus, sauts d'énergie,
  niveaux mesurés, centroïdes, couple au dynamomètre, température de chambre.
  Aucun chiffre annoncé ailleurs n'est invérifiable.

Les prises témoins et les prises brutes restent dans `<dossier>/.brut/`. Elles
ne partent pas dans la banque.

Le profil produit se vérifie contre la fonction d'import de l'application, sans
navigateur :

```bash
PROFIL_GENERE=public/audio/v8-crossplane/profil.json \
  npx vitest run scripts/generate-bank/profile.test.mjs
```

Sans la variable, le test se passe : il n'a pas de banque sous la main.

## La définition de moteur

Un fichier JSON, par exemple
[`engines/v8-crossplane.json`](engines/v8-crossplane.json) :

| Champ | Rôle |
|---|---|
| `name` | nom du profil produit |
| `sampleDir` | sous-dossier de `public/audio/` |
| `base` | définition C++ utilisée : `crossplaneV8` ou `inline4` |
| `cylinders` | nombre de cylindres, repris dans le profil |
| `idleRpm`, `redlineRpm` | les deux bouts de la plage couverte |
| `simulationHz` | fréquence de simulation, 10 000 comme la sonde |
| `impulseSamples` | longueur du tube fabriqué, quand c'est lui qui sert |
| `exhaustResponse` | captation d'échappement, un nom de `public/impulse/` sans l'extension ; `smooth_39` par défaut, `"tube"` pour l'ancienne résonance fabriquée |
| `bank.spacingOctaves` | écart maximal entre deux ancrages voisins |
| `bank.takeSeconds` | longueur visée d'une prise |
| `bank.settleSeconds` | stabilisation avant enregistrement |
| `bank.idleThrottle` | ouverture de gaz de la prise de ralenti |
| `bank.limiterRpm` | régime de la prise de rupteur, 0 pour ne pas en faire |
| `bank.reliefCompression` | de combien le relief mesuré est rabattu, voir plus bas |
| `bank.witnesses` | produire les prises témoins de mesure |

### L'échappement se capte, il ne s'invente pas

Le banc fabriquait sa propre résonance : un train de pics espacés de 57 Hz, à
signe alterné, soit un filtre en peigne. Le son en direct, lui, charge une
captation réelle depuis le 8 septembre 2026. Les deux réponses mesurées, en
répartition d'énergie :

| bande | tube fabriqué | `smooth_39` |
|---|---|---|
| 250 Hz – 1 kHz | −6,5 dB | −1,2 dB |
| 4 – 8 kHz | −8,3 dB | −22,8 dB |
| 8 – 16 kHz | −10,1 dB | −32,5 dB |

Le tube creusait donc le médium de 5,3 dB et laissait passer 14 à 22 dB d'aigu
de trop. Sur la banque produite, cela s'entendait comme un son sourd doublé d'un
souffle aigu — et ce souffle battait **à contretemps** : 53,3 Hz au ralenti pour
un allumage à 26,7. Avec la captation, il retrouve exactement la fréquence
d'allumage.

Les quatre captations de `public/impulse/` n'ont pas le même caractère, et le
choix n'est pas neutre : `smooth_39` (le V8 Chevrolet 454) est la plus
silencieuse et mate le haut-médium ; `sharp_01` et `minimal_muffling_01` en
gardent beaucoup plus. Sur un quatre cylindres, `smooth_39` laisse 10 dB de
moins entre 1 et 4 kHz que la banque enregistrée de référence. C'est un réglage
à juger à l'oreille, pas un défaut à corriger au chiffre.

**La géométrie du moteur reste en C++**, dans `native/engines.h` : cotes,
came, courbes de débit, ordre d'allumage. Le JSON choisit une définition et
règle ce qui façonne la banque. Décrire un moteur entier en JSON est le travail
du mode direct (ticket 03), pas celui-ci.

## Comment le banc obtient un régime tenu

Le régime est imposé par le **dynamomètre**, pas par le papillon. On lui donne
une vitesse de rotation et il la tient dans les deux sens : il absorbe quand le
moteur pousse, il entraîne quand il freine. C'est ce qui permet d'enregistrer
un pied levé à 4 000 tr/min, ce qu'aucune prise sur route ne donne proprement.

Trois choses ont dû être réglées, et chacune s'est vue à la mesure :

1. **Le moteur démarre au démarreur avant que le dynamomètre l'engage.**
   Engager le dynamomètre sur un moteur à l'arrêt le fait tourner sans jamais
   l'allumer : à 3 000 tr/min tenus, plein gaz, la chambre la plus chaude
   plafonnait à 530 K et le couple restait négatif. Après démarrage, le même
   point donne 2 679 K et +155 ft·lb.
2. **Le correcteur de niveau d'engine-sim est neutralisé.** C'est un limiteur à
   crête qui ramène toute sortie à la pleine échelle : il rendrait le même
   niveau à 800 tr/min et à 6 000, donc une banque sans relief de régime. Son
   gain est figé à un, et l'écart entre les prises est mesuré après coup.
3. **Le volume d'enregistrement est étalonné prise par prise.** Le signal brut
   va de 830 à 1 200 000 selon le régime et la charge — près de soixante-trois
   décibels. Un volume unique écrête d'un côté ou manque de résolution de
   l'autre : on mesure la crête pendant la stabilisation, à volume réduit, en
   corrigeant le tir tant que la mesure ne vaut rien.

## La fermeture de boucle

À régime tenu, le son se répète exactement tous les deux tours de vilebrequin.
Les prises font donc un **nombre entier de cycles moteur** : les deux bouts sont
en phase par construction, sans rien couper ni fondre.

Le reste vient de l'application elle-même. `core/audio/engine.ts` cherche le
point de bouclage au chargement, mesure le saut d'énergie sur les deux versions
et garde la meilleure. L'outil ne recolle donc pas les fichiers — il le ferait
deux fois — mais il **rejoue le même calcul** pour chiffrer ce que la passe de
l'application donnera. C'est la colonne « saut joué » du relevé.

## Le relief, et le seul choix qui n'est pas mesuré

Tout ce que le profil produit est mesuré, sauf une chose : de combien on rabat
le relief de niveau.

Mesuré sur le quatre cylindres, l'écart entre le pied levé au ralenti et le
plein gaz au rupteur atteint **64 dB**. Joué tel quel, il n'y a plus rien à
entendre sous 2 000 tr/min. À l'inverse, engine-sim lui-même sort à niveau
constant, son correcteur ramenant tout à la pleine échelle : aucun relief du
tout. Ni l'un ni l'autre ne convient.

`bank.reliefCompression` est donc un choix déclaré, appliqué en décibels : à
0,35, les 64 dB du quatre cylindres deviennent 22 dB, et les 37,4 dB du V8
deviennent 13,1 dB. Le chiffre brut reste écrit dans `mesures.json`. **C'est le
réglage à juger à l'oreille en premier.**

Conséquence dans le profil produit : `loadReliefDb`, `rpmReliefDb`,
`idleLevelDb` sont mis à zéro et `offLoadGain` à un. Ces quatre réglages
compensaient à la main ce que la banque enregistrée ne portait pas ; les gains
de couche le portent désormais, et les laisser en place appliquerait deux fois
le même relief.

## Ce qui n'est pas vérifié

- **Le timbre n'a pas été jugé à l'oreille.** L'outil mesure ce qui se mesure ;
  il ne dit pas si le moteur sonne juste. C'est à David, et le lot le dit
  depuis le début.
- **La réponse impulsionnelle d'échappement est synthétique** : un bruit qui
  décroît, repris de la sonde, identique pour toutes les prises. C'est elle qui
  fait le corps du son, et sa fixité d'une prise à l'autre est donc en partie
  posée par construction, pas seulement mesurée — d'où les 8 % du moteur simulé
  contre les 56 % de la banque enregistrée. Cela joue **en faveur** du chiffre
  annoncé : plus le timbre suit le régime, moins le rééchantillonnage a tort. Une
  vraie réponse d'échappement changerait le timbre, pas la méthode.
- **Le moteur codé en dur n'a pas été comparé au même moteur chargé par le
  langage de script d'engine-sim.** Même réserve que la sonde, dont il reprend
  les définitions.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `generate.mjs` | l'outil : plan, banc, mesures, profil |
| `plan.mjs` | quels régimes, quelle charge, quelle longueur |
| `loop.mjs` | fermeture de boucle, portée de `core/audio/engine.ts` |
| `spectrum.mjs` | centroïde spectral, porté de `core/audio/analyze.ts` |
| `wav.mjs` | lecture et écriture de WAV 16 bits mono |
| `plan.test.mjs` | l'arithmétique des ancrages et des longueurs de boucle |
| `profile.test.mjs` | le profil produit passe-t-il l'import de l'application |
| `engines/*.json` | les définitions de moteur |
| `../../native/generator.cpp` | le banc hors ligne, en C++ |
| `../../native/engines.h` | les définitions de moteur, copiées de `probe.cpp` |
| `../../native/build-generator.sh` | la compilation |

`loop.mjs` et `spectrum.mjs` sont des **portages**, pas des inventions : les
fonctions d'origine sont privées à leur module et travaillent sur des
`AudioBuffer`, que Node n'a pas. Toute correction portée là-bas doit l'être
ici, et l'inverse.
