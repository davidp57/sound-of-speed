# IMPERFECTIONS — un moteur ne tourne pas juste

**Statut :** 🔄 en cours — tickets 01 et 02 faits, 03 en attente d'une mesure
**Branche :** `feature/imperfections`
**Version visée :** 0.3

## Le problème

Relevé en roulant, le 3 septembre 2026 : « je trouve le son pas assez réaliste.
On ne dirait pas un vrai moteur, mais plus GTA 5. On pourrait — mais c'est pas
suffisant — introduire quelques imperfections, ralenti un poil instable, etc. »

Le reproche est juste et l'intuition sur le remède aussi. Il faut d'abord dire
pourquoi, parce que la cause n'est pas où l'on croit.

### Ce qui trahit la synthèse

Cinq causes, de la plus décisive à la moins :

1. **Rien ne bouge pendant la lecture.** Chaque couche est **une seule**
   `AudioBufferSourceNode`, démarrée une fois pour toutes, en boucle sur la
   totalité du fichier. Sa position de départ est tirée au sort — bonne
   idée, mais elle n'agit qu'à l'allumage. Passé la première seconde, la même
   tranche d'enregistrement se répète à l'identique, indéfiniment. L'oreille
   apprend une répétition périodique en quelques tours, et ce qu'elle en conclut
   est exactement « c'est un échantillon ».
2. **Le régime est trop propre.** Le conditionneur produit un signal continu par
   un ressort amorti critique : sans dépassement, sans tremblement, d'une
   régularité qu'aucun moteur thermique n'a. Un moteur au ralenti oscille de
   quelques dizaines de tours ; sous charge partielle il tremble encore. Ce
   micro-tremblement est une part importante de ce qui fait « vivant ».
3. **Aucune variation cycle à cycle.** Un moteur réel a une irrégularité de
   combustion : deux cycles ne sonnent jamais tout à fait pareil. La boucle
   fige un cycle moyen et le répète.
4. **Le repitch est trop littéral.** Étirer un échantillon déplace tout
   ensemble — harmoniques d'échappement, bruit d'admission, bruit mécanique.
   En vrai ces composantes ne suivent pas le régime de la même façon. D'où un
   son qu'on entend « transposé » plutôt que « poussé ».
5. **Il n'y a aucun événement.** Le seul transitoire existant est l'à-coup de
   passage — un creux de gain en sinusoïde, pas un événement sonore. Rien ne
   claque à l'ouverture des gaz, rien ne souffle au lever de pied. La pétarade,
   elle, existe déjà et fonctionne : c'est la preuve qu'un événement bien fait
   change beaucoup.

### La limite dure, à dire tout de suite

Il a raison sur « c'est pas suffisant ». Cinq fichiers bouclés ne feront jamais
un moteur, quelles que soient les imperfections qu'on leur ajoute. Ce qui change
de catégorie, c'est **plus de bancs moteur** — des prises tous les cinq cents
tours, en charge et pied levé, entre lesquelles fondre. C'est l'objet du lot
[BANQUES](../BANQUES/spec.md), et c'est le vrai plafond.

Ce lot-ci ne prétend pas franchir ce plafond. Il prétend gagner ce qui est
gagnable sans nouvel enregistrement.

## La solution, par ordre de rapport

### a — Tremblement de régime (le plus rentable)

Un bruit lent ajouté au régime, avant le calcul des vitesses de lecture :
amplitude en tours par minute, décroissante avec le régime et avec la charge —
un moteur se stabilise en montant et sous couple, il tremble au ralenti et à
vide. C'est physiquement juste et cela répond directement au « ralenti un poil
instable ».

Tout se passe dans `core/engine/engine.ts`, en fonction pure d'un générateur
pseudo-aléatoire à graine : donc testable sans navigateur, et reproductible.

Deux réglages : l'amplitude au ralenti (défaut proposé : 25 tr/min sur Route,
35 sur Sport) et la vitesse du tremblement (autour de 6 Hz, avec une composante
lente à 0,7 Hz).

### b — Désaccord des couches

Quand deux couches jouent ensemble, les désaccorder de quelques millièmes
produit un battement lent — précisément ce que produit un V8 réel avec ses
inégalités de cylindre et ses deux lignes d'échappement. Aujourd'hui les deux
couches d'une même famille jouent au ratio exact, donc parfaitement d'accord,
donc « électroniques ».

Se fait dans `core/audio/mix.ts`, qui est une fonction pure : un facteur
constant par couche, tiré une fois. Un réglage, en centièmes de demi-ton.

### c — Dérive du point de bouclage

Faire dériver lentement la position de lecture pour que la boucle ne se répète
jamais exactement au même endroit. Deux voies :

- redémarrer périodiquement la source à une nouvelle position aléatoire, avec un
  fondu croisé court — coûteux mais sûr ;
- entretenir **deux** instances par couche, en fondu croisé lent et permanent à
  des positions différentes.

C'est la cause n°1 et donc le plus gros gain, mais c'est aussi le seul point qui
touche le graphe Web Audio et non `core/`. À faire après a et b, et à mesurer :
un fondu croisé mal fait s'entend plus que la périodicité qu'il masque.

### d — Événement au lever de pied

Un vrai transitoire, comme la pétarade mais déclenché à la fermeture des gaz et
sans condition de régime : le souffle d'échappement qui retombe. Demande un
échantillon qu'on n'a pas. À rattacher à BANQUES.

### e — Bruit mécanique découplé

Une couche de bruit filtrée dont la bande suit le régime, mais avec une loi
différente du repitch. Corrige la cause n°4. Plus spéculatif : à essayer une
fois a, b et c en place, et à abandonner sans regret si cela sonne artificiel.

## Périmètre proposé

**a et b dans ce lot**, parce qu'ils vivent dans `core/`, sont purs, se
mesurent, et donnent le plus gros écart perçu pour le moins de risque. **c en
second ticket**, avec la mesure à l'appui. **d et e hors lot** : d dépend d'un
échantillon, e est une hypothèse.

## Ce qu'on ne peut pas mesurer ici

Les échantillons ne sont pas dans le dépôt — ils vivent dans un volume du NAS,
hors de l'image. La durée des boucles, qui décide de la période de répétition et
donc de l'urgence du point c, n'a donc pas été relevée. À mesurer avant de
commencer c : si les prises font une dizaine de secondes, la périodicité est
bien moins criante que si elles en font deux.

## Critères d'acceptation

- [x] Au ralenti, le régime tremble d'une amplitude réglable et non nulle
- [x] Le tremblement décroît quand le régime monte et quand la charge monte
- [x] Le tremblement est reproductible à graine égale — un test peut l'affirmer
- [x] Deux couches d'une même famille jouent légèrement désaccordées
- [x] Le désaccord ne dépend pas du temps : une même situation donne un même
      mixage, sinon la télémétrie devient illisible
- [x] Les deux réglages figurent dans le guide de création et dans la référence
      des réglages du README
- [ ] 🧑 Vérifié en roulant : le ralenti et la croisière sonnent moins figés

## Ce que le lot a donné

Tickets 01 et 02 faits, chacun avec ses mesures dans son fichier. Trois réglages
nouveaux : **tremblement au ralenti** et **vitesse du tremblement** dans le
moteur, **désaccord des couches** dans le mixage. Le guide de création les dérive
tous les trois du tempérament choisi.

| | Route | Sport |
|---|---|---|
| Tremblement au ralenti | 0 à +24,2 tr/min | 0 à +33,9 tr/min |
| Tremblement à 2981 tr/min, pied levé | ±11,3 | ±18,3 |
| Tremblement à 2981 tr/min, pleine charge | ±4,5 | ±7,3 |
| Battement entre couches, milieu de bascule | 1,20 Hz | 2,37 Hz |

**La décision de conception du lot** : le moteur sort désormais **deux** régimes.
Le régime net alimente la boîte, ses seuils et la télémétrie ; le régime
**entendu** porte le tremblement et ne sert qu'aux vitesses de lecture. Les
seuils de passage travaillent sur le régime, et quelques dizaines de tours de
tremblement les feraient osciller — [FIX-BOITE](../FIX-BOITE/spec.md) vient de
corriger trois oscillations venues précisément d'un compteur portant deux sens.
C'est la même séparation que celle d'[EFFORT](../EFFORT/spec.md) entre la charge
d'intention et l'effort du moteur : ce qui pilote le son n'est pas ce qui pilote
la mécanique.

**Le tremblement est déterministe** — une somme de trois sinusoïdes, dont deux
dans un rapport irrationnel, donc sans période — et non un tirage au sort. Il n'y
a par conséquent aucune graine à gérer : la reproductibilité est acquise par
construction, et une même situation donne toujours le même mixage.

307 tests.

Reste le ticket 03, et il reste **bloqué par une mesure qui ne peut pas se faire
depuis le dépôt** : la durée des boucles de la banque livrée décide de sa forme
et de son urgence, et les échantillons vivent dans un volume du NAS. À reprendre
depuis un poste qui a la banque sous la main.
