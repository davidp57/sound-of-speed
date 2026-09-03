# 04 — Un paysage qui défile

**Statut :** ⬜ prêt

**Bloqué par :** 02 — La vitesse et le rapport, en tableau de bord

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
- [ ] Le défilement suit la vitesse et s'arrête à l'arrêt
- [ ] Le paysage se coupe, et coupé il ne coûte rien
- [ ] Il ne masque ni ne gêne la lecture des cadrans
- [ ] Il s'arrête quand la page passe en arrière-plan, le son continuant
- [ ] 🧑 Vérifié en roulant : le son reste régulier avec le paysage actif
