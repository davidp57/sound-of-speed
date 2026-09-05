# SYNTHESE — produire le son au lieu de le rejouer

**Statut :** ⬜ prêt
**Branche :** `feature/synthese-sonde` puis suivantes
**Version visée :** 0.3

## Ce qui a déclenché

David a essayé la piste de l'ancrage que proposait
[ESSAI-04/05](../ESSAI-04/tickets/05-ancrage-de-la-banque.md) — abaisser la prise
bas régime de 3128 à 1564 tr/min — et a rapporté :

> ce n'était pas mieux qu'avant ; c'était différent, mais faux quand même. On
> avait un son très aigu (genre moto de course) à faible régime et le gros son
> lourd qui revenait à partir de 5000 tours. J'ai écouté pas mal de sons de V8
> sur YouTube, c'est pas comme ça en vrai. Faut recommencer tout ça.

L'essai **écarte** l'hypothèse de l'octave : si l'ancrage déclaré avait été le
double du vrai, 1564 aurait rendu le son juste au lieu de l'aiguiser. Ce qui
reste est un défaut de modèle, et il est structurel.

**Le rééchantillonnage déplace tout le spectre.** Jouer une prise ancrée à
3128 tr/min pour représenter 1000 tr/min, c'est la lire à 0,32× : la fréquence
d'allumage descend, mais les résonances de l'échappement et de la caisse
descendent avec elle, alors qu'elles ne bougent pas sur une vraie voiture. Un
moteur change de régime sans changer de corps. Sur le profil Route, la vitesse
de lecture reste entre 0,26 et 0,81 sur **toute** la conduite ordinaire : on
n'entend jamais la banque à sa hauteur.

David a ensuite trouvé [engine-sim](https://github.com/ange-yaghi/engine-sim)
(MIT), qui prend le problème par l'autre bout : il **simule** la physique du
moteur et en tire le son, sans le moindre échantillon.

## Ce qu'on cherche

Un **V8 américain à vilebrequin croisé** — le grondement inégal des muscle cars,
qui vient de l'ordre d'allumage vu de chaque banc de cylindres. Mais pas figé :
« l'exemple que je t'ai trouvé propose de *charger un moteur* ». Un moteur doit
donc être une **définition**, pas un jeu d'enregistrements.

### Comment on jugera

**Par le jugement de David, engine-sim tournant à côté comme étalon vivant.**
Pas de comparaison automatique contre un enregistrement de référence : il l'a
écartée, et pour trois raisons justes — l'encodage du fichier masque des
fréquences, la chaîne de lecture aussi, et un son de moteur évolue, si bien
qu'aucun enregistrement ne correspondra jamais à ce qu'on teste.

Conséquence assumée : **la machine ne peut pas juger ce lot.** Son travail est de
fournir les réglages, de mesurer ce qui se mesure, et de rendre les allers-retours
rapides.

Le jugement se fait sur la **chaîne complète**, en conduisant à la manette — pas
sur un régime tenu isolé. C'est le choix de David, et il tient depuis que le banc
GPS et la manette permettent de conduire au bureau.

## Trois origines de son, et non une

Décidé par David le 4 septembre 2026, après les premières mesures : un profil
choisit **d'où vient son son**, parmi trois origines.

| Origine | Ce que c'est | Coût dans la voiture |
|---|---|---|
| **Enregistré** | la banque d'échantillons d'aujourd'hui | l'existant |
| **Généré en direct** | engine-sim tourne dans la voiture | tout le budget processeur |
| **Généré à l'avance** | engine-sim tourne ici, la voiture rejoue | comme l'enregistré |

Le troisième mode vient d'une idée de David, proposée comme repli et retenue
comme option : faire tourner engine-sim au moment de la conception, produire une
banque, et la rejouer avec le moteur de lecture existant. Il corrige un défaut
que ni l'un ni l'autre des deux autres ne corrige — voir le ticket 05.

Et le choix par profil évite de trancher globalement une question qui n'a pas de
réponse unique : **il se peut que le direct ne tienne que pour les petits
moteurs**. Un bicylindre bien simulé en direct vaudrait mieux qu'un V8
échantillonné. La question du ticket 02 n'est donc pas « le temps réel
passe-t-il » mais « jusqu'à combien de cylindres ».

## Le temps réel, et son inconnue

**On tente engine-sim en WebAssembly, et on mesure avant de s'engager.**

Une exploration du dépôt a établi, code compilé à l'appui :

- **le cœur est déjà séparé de l'interface** dans le `CMakeLists` : 41 `.cpp` et
  46 `.h`, simulation et synthèse. Zéro symbole du moteur graphique maison, zéro
  SDL, zéro API Windows, zéro accès disque, zéro SIMD explicite. Compilé hors de
  tout CMake avec cinq correctifs triviaux — des `__forceinline` de Visual C++,
  un en-tête manquant ;
- **une seule vraie dépendance**, `simple-2d-constraint-solver`, portable. Boost
  et `csv-io` sont des liens morts du CMake : aucun fichier du cœur ne les
  référence ;
- **un seul fil d'exécution**, isolé dans le synthétiseur, retirable en une
  quarantaine de lignes. Donc **ni SharedArrayBuffer ni en-têtes COOP/COEP**, ce
  qui aurait été un obstacle sur le NAS ;
- **environ 11 000 lignes** à compiler ;
- **le portage existe déjà** : fork `bobsayshilol/engine-sim`, branche
  `wasm-build`, en ligne et fonctionnel. Son commit fondateur fait 58 lignes.

**Le risque n'est pas la compilation, c'est le processeur.** Mesuré en natif sur
un Ryzen 7 7800X3D, un seul fil :

| | CPU pour 1 s de son | Temps réel |
|---|---|---|
| Chaîne complète, 4 cylindres à 10 kHz | 0,41 s | ×2,4 |
| À 20 kHz, la fréquence du moteur livré | — | ×1,5 |
| Convolution déportée sur un `ConvolverNode` | — | ×6,5 |

Soixante-cinq pour cent du coût est une convolution par produit direct — dix
mille multiplications par échantillon — que Web Audio sait faire nativement en
FFT partitionnée. Le fork WASM avait dû dérouler des boucles et passer la
dynamique des gaz en simple précision pour tenir, sur un navigateur de bureau.

Ces chiffres sont un **plancher** : ni WASM, ni la Tesla.

**Et le premier relevé du V8 est à refaire.** Il donnait ×0,82 en chaîne complète
et ×1,60 avec la convolution déportée, ce dont j'avais conclu que le temps réel
était hors d'atteinte. Un jeu récent tournait pendant la mesure : la machine
était encore à 25,6 % de charge après coup, le jeu totalisant 16 442 secondes de
processeur. On n'a donc pas mesuré ce que le poste sait faire, mais ce qu'il en
restait. La conclusion est retirée, la mesure est à reprendre à froid.

### Le seuil, fixé d'avance

**×3 temps réel mesuré dans la voiture** — mais il ne condamne plus le lot, il
**borne le mode direct**. En dessous pour un moteur donné, ce moteur-là ne se
génère pas en direct ; il se génère à l'avance. Le seuil décide donc d'un
domaine, pas d'un abandon.

Trois, parce que le son ne sera pas seul : l'écran se rafraîchit, le GPS livre
une position toutes les trente millisecondes, le service worker travaille. Un
moteur qui tient tout juste au repos craquera dès que l'écran s'anime — et un
craquement est bien pire qu'un son moins riche.

Le seuil est écrit **avant** la mesure, exprès : sinon il se discuterait en
fonction du résultat obtenu.

### Le repli, si la sonde échoue

Une **synthèse maison** : une impulsion par allumage, espacées selon l'ordre
d'allumage, passées dans une résonance d'échappement. Son coût est déjà mesuré —
rendre dix secondes d'audio coûte 67 ms avec un `ConvolverNode`, contre 66 ms
pour les cinq boucles actuelles : **identique à l'existant**. Elle donne le
grondement inégal du V8 croisé par construction, puisque l'inégalité est dans les
espacements.

## Les choix de forme

**Un moteur se décrit en JSON**, dans une section du profil, et le liant remplit
directement la structure C++ d'engine-sim. On n'embarque pas son interpréteur :
dix mille lignes, Flex et Bison en moins. On perd les moteurs écrits en `.mr` par
la communauté — le projet dont ils viennent est passé en source fermée, et cet
écosystème ne grandira plus.

Le moteur vit dans le profil parce que tout l'outillage existe déjà : export en
fichier, partage par URL et par QR, reprise des profils enregistrés, retour aux
valeurs d'origine. « Charger un moteur » devient « charger un profil ».

**Les deux mondes coexistent, le profil choisit.** Un profil sonne par
échantillons ou par synthèse. Rien n'est retiré : ni la banque, ni les couches,
ni l'analyse d'échantillon, ni le lot [BANQUES](../BANQUES/spec.md), qui garde sa
raison d'être. La bascule ne demande **aucun bouton neuf** — deux profils, et les
boutons de profil de l'écran de conduite font la comparaison d'un clic.

**Le banc de réglage est un onglet réservé au développement**, comme le
simulateur : on ne règle pas un timbre en conduisant, et l'écran embarqué reste
sobre. Les réglages trouvés partent dans le profil, qui, lui, voyage.

**L'effort change le timbre, pas seulement le volume.** Sur un vrai moteur,
ouvrir les gaz remplit le spectre d'harmoniques ; un moteur à pleine charge et le
même au ralenti ne diffèrent pas d'un coup de volume. C'est le défaut que le
relief de charge compensait à la main.

**Les effets se réécrivent, ou disparaissent.** Le tremblement de régime et
l'inégalité entre cylindres sortent du modèle tout seuls — il suffit de décaler
les allumages, ce qu'un vrai moteur fait. Le rupteur, les pétarades et l'à-coup
de passage restent, exprimés en allumages : couper l'allumage, en retarder un,
sauter un cycle. **Uniquement sur un profil synthétisé** : un profil à
échantillons ne change en rien.

## Hors périmètre

L'interface d'engine-sim, son moteur graphique, ses jauges : abandonnés, 8 256
lignes. Son langage `.mr` et son interpréteur. Et la conception d'un moteur
sur mesure : on part de définitions existantes traduites en JSON, régler un
moteur cylindre par cylindre est un autre métier.

## Ce qui reste ouvert

Rien, sauf ce que la sonde dira. Le découpage au-delà du ticket 02 dépend de son
verdict et s'écrira à ce moment-là — écrire aujourd'hui les tickets d'un portage
qu'on abandonnera peut-être donnerait des frontières qui ne survivraient pas à la
première mesure.
