# 01 — La sonde : engine-sim tient-il dans la voiture ?

**Statut :** ⬜ prêt

**Bloqué par :** aucun

## Ce qu'il faut obtenir

Une page que David ouvre dans la Tesla, et qui affiche **un chiffre** : combien
de secondes de son le cœur d'engine-sim produit par seconde de calcul.

Rien d'autre. Pas d'intégration à l'application, pas de réglages, pas de moteur
choisi, pas de son joué. Un moteur codé en dur, la simulation lancée, le temps
mesuré.

C'est le seul poste que personne ne peut borner depuis le dépôt, et il commande
tout le lot : au-dessus de **×3**, on porte engine-sim ; en dessous, on écrit la
synthèse maison.

## Ce qu'on sait déjà

Le chemin est balisé par le fork `bobsayshilol/engine-sim`, branche `wasm-build`,
dont le commit fondateur `d3dccb76` fait 35 lignes de CMake et 23 lignes de C++.
Quatre de ses commits nous servent directement :

| Commit | Ce qu'il corrige |
|---|---|
| `995d3122` | un constructeur pour `Mix`, que gcc refuse en initialisation vide |
| `f4491fa2` | `__forceinline` de Visual C++ → `inline` |
| `b89ce11c` | `fpclassify` non qualifié pour libstdc++ |
| `31ca92be` | en-têtes standard manquants |
| `66562efe` | **retrait du fil du synthétiseur** — 42 lignes, un seul fichier |

Le dernier est le plus important : il supprime la seule pièce non portable, et
son absence de `USE_PTHREADS` signifie **pas de SharedArrayBuffer, donc pas
d'en-têtes COOP/COEP à ajouter au nginx**.

À compiler : les 41 `.cpp` du cœur et les 31 de `simple-2d-constraint-solver`.
Ni `csv-io`, ni `delta-basic`, ni Boost, ni piranha — vérifié, aucun fichier du
cœur ne les référence.

## Ce qu'il faut mesurer, et comment

La sonde fait tourner la simulation **sans jouer de son** et chronomètre. Trois
relevés, parce qu'un seul ne dirait pas où passe le temps :

1. la simulation seule (corps rigides, dynamique des gaz, chambres) ;
2. la synthèse seule, réponse impulsionnelle au plafond du code — 10 000
   échantillons ;
3. la chaîne complète, à 10 kHz **et** à 20 kHz, la fréquence du moteur livré.

Elle affiche aussi **où elle tourne** : le navigateur, la taille de l'écran, le
nombre de cœurs annoncé. Un chiffre sans son contexte ne se relit pas trois
semaines plus tard — et le relevé du poste de David n'a pas la même valeur que
celui de la voiture.

## Ce que coûte WebAssembly : rien, ou presque

Mesuré sur le **vrai code**, une fois le cœur compilé par les deux chaînes depuis
le même arbre, mêmes sources, mêmes patchs, même `-O2`. Un Ryzen 7 7800X3D, un
seul fil ; le WebAssembly tourne sous Node, qui emploie le moteur de Chrome.

| Relevé | Natif, g++ | WebAssembly | Surcoût |
|---|---|---|---|
| Chaîne complète, 10 kHz | ×1,68 | ×1,76 | aucun |
| Chaîne complète, 20 kHz | ×1,13 | ×1,08 | ×1,05 |
| Convolution courte, 10 kHz | ×3,29 | ×3,17 | ×1,04 |
| Convolution courte, 20 kHz | ×1,74 | ×1,64 | ×1,06 |

**Zéro à six pour cent.** Un banc synthétique fait au préalable — une convolution
et un solveur écrits pour l'occasion — annonçait 16 à 33 % ; il **surestimait**.
Sur le vrai code, le choix de WebAssembly ne coûte rien de mesurable, et c'est la
chaîne de compilation qui s'efface devant ce que le processeur sait faire.

Le binaire pèse **128 592 octets**. Il tiendra sans peine dans le cache hors
réseau.

### Ce que ces chiffres disent déjà

La convolution longue coûte la moitié du budget : ×1,76 avec, ×3,17 sans. La
déporter sur un `ConvolverNode` de Web Audio n'est donc pas une optimisation
parmi d'autres, c'est **la** condition pour espérer passer le seuil.

Et une fois qu'elle est sortie, **c'est la simulation qui domine** — 0,310 s sur
0,315 s. Toute optimisation ultérieure portera là, pas sur l'audio.

Reste que ×3,17 est relevé sur un processeur de bureau haut de gamme, et que le
seuil est ×3 **dans la voiture**. La marge est donc mince, et c'est bien la
mesure sur place qui tranchera — mais on sait déjà qu'un portage qui garderait la
convolution dans le WebAssembly est perdu d'avance.

## Une fausse piste, pour qu'on ne la reprenne pas

Le service worker a été soupçonné de bloquer le chargement d'un module
WebAssembly : un fichier servi correctement — 200, type `application/wasm`,
vérifié à la ligne de commande — restait impossible à charger depuis la page, et
il s'est chargé après désinscription. Un correctif a été écrit sur cette base,
puis **annulé**.

En cherchant à le reproduire, tout échouait de la même façon, y compris
`/index.html` et le chemin qu'on venait d'exempter, pendant que le serveur
répondait en deux millisecondes à la ligne de commande. Ce n'était donc pas le
service worker mais **la connexion du navigateur de mise au point**, instable
pendant que plusieurs chantiers écrivaient dans le dossier. La corrélation entre
la désinscription et le retour à la normale était fortuite.

Ce qu'il faut en retenir pour la sonde : **une page qui ne charge pas dans la
voiture ne prouve rien à elle seule**. La sonde doit distinguer une panne de
réseau d'un refus du service worker et le dire à l'écran, sans quoi le verdict
du lot se jouera sur une ambiguïté du même genre.

## Critères d'acceptation

- [ ] Le cœur compile en WebAssembly, sans interface, sans piranha
- [ ] La sonde ne joue aucun son et ne demande aucune autorisation
- [ ] Elle affiche les trois relevés et le facteur temps réel de chacun
- [ ] Elle affiche le navigateur et le matériel annoncé
- [ ] Elle est servie par le même nginx que l'application, pour s'ouvrir dans la
      voiture comme le reste
- [ ] Le poids du `.wasm` est indiqué : il devra être mis en cache hors réseau
- [ ] La page se charge avec le service worker actif, module compris — vérifié,
      pas supposé
- [ ] Quand un chargement échoue, la page dit **pourquoi** : réseau injoignable,
      module absent, ou service worker qui l'intercepte
- [ ] 🧑 Relevé fait dans la Tesla, et le chiffre écrit dans le ticket 02
