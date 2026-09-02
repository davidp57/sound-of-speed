# 02 — Écarter une mesure aberrante au lieu de la plafonner

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Une mesure GPS absurde est ignorée, et la vitesse conditionnée n'en bouge pas.

Aujourd'hui elle est **ramenée au plafond** de vitesse plausible : une valeur de
9000 km/h reçue alors qu'on roule à 90 devient une mesure à 260 km/h, que le
conditionnement suit. Le moteur monte donc au rupteur sur une seule mesure
fausse, puis redescend. Le README annonce d'ailleurs le bon comportement — « au
delà, la mesure est rejetée comme aberrante » — c'est le code qui ne le tient
pas.

Le réglage garde son sens : ce qui dépasse la vitesse plausible maximale n'est
pas une vitesse, c'est une erreur de mesure. La différence est qu'on n'en tire
rien du tout, au lieu d'en tirer le plafond.

## Critères d'acceptation

- [ ] Une mesure au-delà de la vitesse plausible maximale ne modifie ni la cible,
      ni la pente, ni l'historique
- [ ] La vitesse conditionnée reste sur sa trajectoire, comme si la mesure
      n'était pas arrivée
- [ ] Une mesure exactement égale au plafond est acceptée : c'est la borne du
      plausible, pas de l'aberrant
- [ ] Une salve de mesures aberrantes consécutives ne fait pas dériver la sortie
- [ ] Le test qui décrivait le plafonnement a été réécrit
