# 01 — Le rétrogradage forcé ne se déclenchait presque jamais

**Statut :** ✅ fait — reste l'écoute en roulant

David : « j'ai jamais eu de kickback ». Vérifié sur les 58 000 relevés de ses
trois trajets du 16 septembre : il avait raison. L'automate rejoué sur ses traces
rend **deux** déclenchements en 2 h 25, et aucun sur les deux trajets du soir.

## La cause

La charge est rapportée à `mix.fullLoadAccelMs2`, que l'étalonnage fixe au pic de
la reprise franche — **5,5 m/s²** sur sa voiture. Une charge de 1 vaut donc
« aussi fort que le jour de l'étalonnage », et une conduite ordinaire ne
reproduit jamais ce pic.

| Trajet | Accélération maximale | Charge maximale | Seuil d'alors |
|---|---|---|---|
| 08:25 | 5,18 m/s² | 0,97 | 0,95 |
| 19:00 | 4,49 m/s² | 0,82 | 0,95 |
| 19:16 | 3,51 m/s² | 0,64 | 0,95 |

**Baisser ce seul seuil n'aurait rien donné.** La seconde condition — une montée
de charge de 0,35 sur une fenêtre d'une seconde et demie — bloquait à son tour.
Les deux étaient chacune au bord : aux vingt plus fortes charges du trajet du
matin, la montée médiane valait 0,36 pour un seuil à 0,35, si bien que leur
conjonction ne tombait presque jamais.

| Charge | Montée | Déclenchements sur 2 h 25 |
|---|---|---|
| 0,95 | 0,35 | 2 |
| 0,80 | 0,25 | 4 |
| **0,75** | **0,25** | **11** — un toutes les treize minutes |
| 0,70 | 0,20 | 25 — un toutes les six minutes |

## Ce qui a été retenu

David a tranché : **0,75 de charge et 0,25 de montée**. En Sport, l'écart de dix
centièmes avec Route est conservé — 0,65 —, cet essai s'étant fait en Route.

**Sa première proposition a été écartée, mesure à l'appui**, et c'est noté ici
pour qu'on ne la refasse pas : exprimer le seuil en pourcentage de l'accélération
maximale étalonnée est **déjà** ce que fait le code, puisque la charge est
normalisée par `fullLoadAccelMs2`. Appliquée telle quelle, la règle ne changeait
rien. Ce qu'il fallait changer, c'est la **référence** : le rétrogradage forcé ne
se cale pas sur ce que la voiture peut faire, mais sur ce qu'on lui demande
franchement en roulant — le p99,9 de l'accélération vaut 3,2 à 4,25 m/s² chez
David, soit 0,58 à 0,77 de charge. 0,75 tombe là.

## Critères d'acceptation

- [x] Le seuil de charge du mode Route est sous la charge maximale mesurée sur
      une conduite ordinaire, et un test le tient.
- [x] Les deux seuils descendent ensemble : baisser le seul seuil de charge
      n'aurait rien changé.
- [x] Le commentaire du code porte la mesure, pas le raisonnement.
- [ ] Écouté en roulant : le rétrogradage forcé se fait entendre quand on écrase,
      et ne part pas en remettant délicatement les gaz.

## Réserve

La simulation approxime le lissage interne de la charge : les comptes sont à ±1.
Le classement des options, lui, est net — et c'est sur lui que la décision s'est
prise.
