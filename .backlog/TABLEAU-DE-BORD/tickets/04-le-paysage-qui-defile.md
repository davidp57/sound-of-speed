# 04 — Un paysage qui défile

**Statut :** 🚫 abandonné le 7 septembre 2026

**Bloqué par :** 02 — La vitesse et le rapport, en tableau de bord

Le paysage a été livré, puis jugé « complètement raté » en roulant le
4 septembre : il défilait de côté, là où l'écran se voit de la place du
conducteur. Le composant a été supprimé (ESSAI-04, ticket 07) et sa refonte en
perspective, [DECOR-PERSPECTIVE](../../DECOR-PERSPECTIVE/spec.md), est abandonnée
à son tour — les raisons y sont écrites.

Ses deux critères non cochés ne le seront donc jamais : ils attendaient une
mesure pour un composant qui n'existe plus. Le tableau de chiffres plus bas
reste, c'est le seul relevé de cadence d'affichage du projet.

## Ce qu'il faut obtenir

Un décor simplifié défile derrière le tableau de bord, à la vitesse du véhicule.

**C'est de l'agrément, et il faut l'assumer** : rien ne s'y lit. La règle
« aucune animation » a été levée pour ce cas précis, en connaissance de cause —
la justification n'est pas l'ergonomie mais le fait qu'un décor rend l'attente
moins vide. Les tickets 01 à 03 tiennent, eux, par la lisibilité.

**La mesure vient avant la promesse.** L'horloge du projet bat sur le fil audio
précisément parce que le navigateur ralentit les minuteurs ; ajouter un rendu
continu, sur un navigateur de bord ancien, à côté d'un graphe audio qui ne doit
pas hoqueter, ne se décide pas au raisonnement. Si le son se dégrade, le paysage
ne se fait pas — c'est le son, le produit.

Le paysage se coupe. Quelqu'un le trouvera distrayant, et il aura raison.

## Critères d'acceptation

- [ ] Le coût du rendu continu est mesuré sur le navigateur de la voiture :
      durée d'image, régularité du son, échauffement
- [ ] Le son ne se dégrade pas, mesuré avant et après sur la même trace rejouée
- [x] Le défilement suit la vitesse et s'arrête à l'arrêt
- [x] Le paysage se coupe, et coupé il ne coûte rien
- [x] Il ne masque ni ne gêne la lecture des cadrans
- [x] Il s'arrête quand la page passe en arrière-plan, le son continuant
- [ ] 🧑 Vérifié en roulant : le son reste régulier avec le paysage actif

## Ce qui est mesuré, et ce qui ne l'est pas

Mesuré au poste de travail, Chrome 152 sans interface, même trace rejouée à
chaque passe (montée jusqu'à 116 km/h, moyenne 86), trois passes coupé alternées
avec trois passes actif :

| | durée d'image moyenne | p95 | images > 33 ms | style / image | script / image | tâches / image |
|---|---|---|---|---|---|---|
| coupé | 9,3 ms | 11,6 ms | 0 | 0,023 ms | 0,063 ms | 0,80 ms |
| actif | 9,5 ms | 11,2 ms | 0 | 0,050 ms | 0,078 ms | 0,93 ms |

L'écart de durée d'image entre les deux états (0,2 ms) est plus petit que l'écart
de passe à passe du même état (1,8 ms) : la machine bouge plus que le décor ne
coûte. Sur une machine tranquille, les deux états donnent la même cadence à un
centième de milliseconde près — 6,06 ms —, sans une seule image longue. Le décor
ajoute 0,13 ms de temps de tâche par image, un peu plus d'un centième d'image, et
**ne bouge pas la mise en page** : ce ne sont que des translations, comme voulu.

**Deux choses ne sont pas mesurées.** Le navigateur de la voiture, plus ancien
que celui du poste. Et la régularité du **son** : il n'a jamais été activé
pendant ces mesures, donc c'est la cadence de l'affichage qui est établie, pas
celle du fil audio. C'est ce que la dernière ligne des critères attend.
