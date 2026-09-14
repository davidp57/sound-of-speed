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
node scripts/generate-bank/moteur.mjs   # les moteurs qu'on sait construire
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/gm-ls-long-header.json
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
  d'origine **générée à l'avance** et emporte **le moteur** qui a fait le son,
  les vingt-neuf nombres du contrat. Conséquence utile : basculer ce profil en
  son direct joue le moteur qui a produit ses échantillons.
- **`mesures.json`** — le relevé complet : la définition de banque, le moteur,
  les régimes tenus, sauts d'énergie, niveaux mesurés, centroïdes, couple au
  dynamomètre, température de chambre. C'est la recette, à côté des fichiers
  qu'elle a produits : une banque se refait en la relisant, et le `sampleDir` du
  profil est ce qui y mène. Aucun chiffre annoncé ailleurs n'est invérifiable.

Les prises témoins et les prises brutes restent dans `<dossier>/.brut/`, avec
`moteur.txt` — les vingt-neuf nombres tels que le banc les a lus. Rien de tout
cela ne part dans la banque.

Le profil produit se vérifie contre la fonction d'import de l'application, sans
navigateur :

```bash
PROFIL_GENERE=public/audio/gm-ls-long-header/profil.json \
  npx vitest run scripts/generate-bank/profile.test.mjs
```

Sans la variable, les cas qui demandent une vraie banque se passent — mais le
reste du fichier tourne, et il tourne donc en intégration continue. Il ne le
faisait pas : le fichier entier était sauté faute de banque, et le défaut qu'il
devait attraper y est resté du 5 au 14 septembre 2026.

## La définition de banque

Un fichier JSON, par exemple
[`engines/gm-ls-long-header.json`](engines/gm-ls-long-header.json). Elle dit
**quel moteur** et **quelles prises** ; le moteur lui-même vit dans
l'application :

| Champ | Rôle |
|---|---|
| `name` | nom du profil produit |
| `sampleDir` | sous-dossier de `public/audio/` |
| `engine` | **un identifiant de la bibliothèque de l'application** — `node scripts/generate-bank/moteur.mjs` les liste |
| `idleRpm` | le bas de la plage couverte |
| `redlineRpm` | le haut, facultatif : le moteur choisi porte le sien |
| `simulationHz` | fréquence de simulation, 10 000 comme la sonde |
| `impulseSamples` | longueur du tube fabriqué, quand c'est lui qui sert |
| `exhaustResponse` | captation d'échappement, un nom de `public/impulse/` sans l'extension ; `smooth_39` par défaut, `"tube"` pour l'ancienne résonance fabriquée |
| `exhaustMix` | part d'énergie qui passe par cette captation ; `0.45` par défaut, la valeur du mode direct |
| `bank.spacingOctaves` | écart maximal entre deux ancrages voisins |
| `bank.takeSeconds` | longueur visée d'une prise |
| `bank.settleSeconds` | stabilisation avant enregistrement |
| `bank.idleThrottle` | ouverture de gaz de la prise de ralenti |
| `bank.limiterRpm` | régime de la prise de rupteur, 0 pour ne pas en faire |
| `bank.reliefCompression` | de combien le relief mesuré est rabattu, voir plus bas |
| `bank.witnesses` | produire les prises témoins de mesure |

### L'échappement ne prend que 45 % de la sortie

Le banc s'appuyait sur la convolution interne d'engine-sim, qui est **entière**.
Le mode direct, lui, n'en mélange que 45 % et garde 55 % de son sec — réglage de
David du 6 septembre 2026, étendu à toute la bibliothèque le 8, avec cette
raison : « à cent pour cent, tout le son passait par la réponse d'échappement —
celle d'un V8 Chevrolet, y compris sous un quatre cylindres ».

La correction n'avait jamais atteint le banc. Mesuré le 14 septembre sur le
quatre cylindres à 2 245 tr/min, part d'énergie entre 1 et 4 kHz :

| | 1 – 4 kHz |
|---|---|
| sec, sans convolution | −21,7 dB |
| convolué entièrement — ce que le banc produisait | −26,3 dB |
| **prise réelle, le repère** | **−18,6 dB** |

Le sec colle presque à la vraie prise ; c'est la convolution intégrale qui
l'enfonce. David, sur la banque livrée : « ça sonne synthétique, électronique ».
Sur le mélange à 45 % : « c'est pas mal, on garde ça ».

Le banc rend donc désormais le son **sec** — `--exhaust none` installe une
impulsion unité — et c'est `echappement.mjs` qui pose la captation, avec le
mélange en racine d'énergie de la chaîne du direct.

**Ce que ça ne corrige pas.** Au-dessus de 4 kHz, tout ce que produit le banc
reste 30 à 45 dB sous une vraie prise, sec comme convolué. Le modèle ne fabrique
pas ce grain-là, et aucun filtre ne crée ce qui n'existe pas.

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

Les quatre captations de `public/impulse/` n'ont pas le même caractère.
`smooth_39` est retenue par défaut, et ce choix a été fait à l'oreille sur trois
banques produites du même moteur. Le classement obtenu suit exactement l'énergie
entre 4 et 8 kHz :

| Rang | Captation | 1 – 4 kHz | 4 – 8 kHz |
|---|---|---|---|
| 1er | `smooth_39` | −8,1 dB | **−22,8 dB** |
| 2e | `sharp_01` | −2,0 dB | −9,1 dB |
| 3e, « très synthé » | `minimal_muffling_01` | −3,3 dB | −6,1 dB |

Ce n'est pas le haut-médium qui décide — `sharp_01` en porte plus que
`minimal_muffling_01` et passe devant. **C'est l'aigu de 4 à 8 kHz qui fait
sonner synthétique**, la bande même du souffle que le tube laissait passer.
Surveiller celle-là d'abord sur une banque produite.

### Le moteur vient de la bibliothèque de l'application

`engine` nomme un moteur de `ENGINE_LIBRARY` — la liste que l'écran de synthèse
propose, celle d'où viennent les réglages que David a trouvés à l'oreille. Le
banc reçoit ses **vingt-neuf nombres**, ceux de
[`CONTRAT-MOTEUR.md`](../../native/CONTRAT-MOTEUR.md), par un fichier que l'outil
écrit dans `.brut/moteur.txt`.

Ce n'était pas le cas jusqu'au 14 septembre 2026 : la géométrie vivait en dur
dans `native/engines.h`, et le banc ne savait construire que deux moteurs. Une
banque du GM à collecteur long était donc impossible — le moteur n'existait que
du côté TypeScript. Les constructeurs paramétrés de `probe.cpp` ont déménagé
dans `engines.h`, que les deux programmes incluent désormais.

Ce qui reste en dur, et ne se règle pas : les courbes de débit des soupapes,
l'ordre d'allumage et les angles de manetons. Ils *définissent* un moteur, ils ne
le règlent pas ; le contrat le dit et en donne la raison.

**Régénérer une banque d'avant ne rend pas le même son.** Les deux sources
avaient divergé, et c'est le TypeScript qui porte les valeurs corrigées : cinq
écarts sur le V8, sept sur le quatre cylindres. Le plus audible est
`inputSampleNoise`, 0,05 en C++ contre 0 depuis la mesure du 8 septembre —
mesurée à 8,7 dB à 5 600 Hz et 25,5 dB à 8 000 Hz, c'est le cliquetis que David
a traqué toute cette journée-là. La correction n'avait jamais atteint le banc.

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

## La fenêtre qui se referme le mieux

Une prise fait un nombre entier de cycles moteur, donc ses deux bouts sont en
phase par construction. Cela suffisait tant que le banc rendait un signal lissé
par une convolution entière : le son sec a des transitoires plus raides, et le
raccord se voit — le saut au bouclage du V8 est passé de 11,4 % à 26,4 % le jour
où l'échappement est descendu à 45 %.

Or un cycle ne vaut pas l'autre. On essaie donc **toutes** les fenêtres d'un
nombre entier de cycles, à tous les décalages d'un cycle, et l'on garde la plus
longue dont le raccord tient sous 8 % — le seuil est celui de la banque
enregistrée, qui est à 10,8 % et que personne n'a signalée.

Le critère a d'abord été une longueur minimale, et c'était une erreur : le
chiffre trouvé sur le quatre cylindres ne valait pas pour le V8. À neuf dixièmes
de la prise, le premier restait à 7,05 % quand le second remontait à 18,9 %. Ce
qui fait le raccord, c'est **où** l'on coupe, pas combien.

| Banque | Saut au pire, avant | après |
|---|---|---|
| `gm-ls` | 26,4 % | **6,7 %** |
| `gm-ls-long-header` | 28,8 % | **5,7 %** |
| `subaru-ej25` | 39,7 % | **7,7 %** |

Les prises gardent leur longueur : 2,72 à 3,08 secondes pour trois visées.

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
- **Le moteur n'a pas été comparé au même moteur chargé par le langage de
  script d'engine-sim.** Même réserve que la sonde, avec qui il partage
  désormais ses constructeurs.
- **Le son du banc n'est pas celui du mode direct.** Le correcteur de niveau est
  neutralisé ici — c'est ce qui donne à la banque son relief — là où le direct
  passe par un niveleur visant seize mille. Comparer les deux à l'oreille ne
  compare donc pas deux réglages du même appareil.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `generate.mjs` | l'outil : plan, banc, mesures, profil |
| `moteur.mjs` | la bibliothèque de moteurs, lue dans le TypeScript de l'application |
| `profil.mjs` | le profil produit, à part pour qu'il se vérifie sans banque |
| `plan.mjs` | quels régimes, quelle charge, quelle longueur |
| `loop.mjs` | fermeture de boucle, portée de `core/audio/engine.ts` ; choix de la fenêtre |
| `echappement.mjs` | la captation posée après le banc, avec le mélange du direct |
| `spectrum.mjs` | centroïde spectral, porté de `core/audio/analyze.ts` |
| `wav.mjs` | lecture et écriture de WAV 16 bits mono |
| `plan.test.mjs` | l'arithmétique des ancrages et des longueurs de boucle |
| `profile.test.mjs` | le profil produit passe-t-il l'import de l'application |
| `engines/*.json` | les définitions de moteur |
| `../../native/generator.cpp` | le banc hors ligne, en C++ |
| `../../native/engines.h` | les constructeurs de moteur, partagés avec la sonde |
| `../../native/build-generator.sh` | la compilation |

`loop.mjs` et `spectrum.mjs` sont des **portages**, pas des inventions : les
fonctions d'origine sont privées à leur module et travaillent sur des
`AudioBuffer`, que Node n'a pas. Toute correction portée là-bas doit l'être
ici, et l'inverse.
