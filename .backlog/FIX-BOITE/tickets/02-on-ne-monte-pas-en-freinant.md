# 02 — On ne monte pas en freinant

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Une descente au freinage n'est plus défaite par une montée au régime, et elle ne
met plus le moteur au ras du rupteur.

Mesuré avant, sur une décélération de 3 km/h par seconde :

```
4->3@107  3->2@98  2->3@98  3->2@95  2->3@95  3->2@92  2->3@92  ...
```

Un aller-retour tous les trois km/h. La descente au freinage engage un rapport
dont le régime dépasse son propre seuil de montée — le plafond était le rupteur
à 0,85, soit 7225 tr/min, quand le seuil de montée de la deuxième est à 5600 —
et la montée ordinaire le défaisait aussitôt.

Deux corrections, et une leçon.

- **L'inhibition** : on ne monte pas pendant qu'on freine. C'est ce que fait une
  boîte réelle, et cela règle le va-et-vient à sa racine.
- **Le plafond utile** est le seuil de montée du rapport visé, que le profil
  règle rapport par rapport. Le rupteur ne sert plus que de garde-fou absolu.
  Mesuré avant : une descente en deuxième à 98 km/h plaçait le moteur à
  7232 tr/min, et il y restait jusqu'à l'arrêt.
- **La leçon** : l'espacement des descentes au freinage remettait à zéro le
  compteur de freinage, lequel sert aussi à l'inhibition — ce qui rouvrait la
  montée pendant une seconde, juste assez pour défaire la descente. Un compteur,
  un usage. C'est la troisième oscillation de ce module née d'un compteur portant
  deux sens.

## Critères d'acceptation

- [x] Aucune remontée pendant une phase de ralentissement soutenu
- [x] L'espacement des descentes au freinage ne lève pas l'inhibition
- [x] Aucun rapport engagé au-delà de son seuil de montée, à la dispersion de
      charge près
- [x] Les descentes au freinage restent plus précoces en vitesse que celles au
      lever de pied — 5→4 à 104 km/h contre 87
- [x] La cascade sous freinage prolongé fonctionne toujours
