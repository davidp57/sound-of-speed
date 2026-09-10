# 02 — La boîte se déduit du moteur et du mode

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le moteur devient une entité qu'on nomme. Le rupteur
appartient au moteur, et c'est de lui que les seuils se dérivent.

## Ce qu'il faut obtenir

**Changer de moteur doit changer la façon de conduire.** Aujourd'hui non : les
seuils de passage sont en tours absolus, si bien qu'un moteur de moto qui monte
à 11 000 tr/min passe ses rapports au même endroit qu'un V8 qui s'arrête à
6 500. Mesuré au banc sur le profil Sport, accélération franche de 0 à
150 km/h :

| Moteur | Rupteur | Passage 3ᵉ → 4ᵉ |
|---|---|---|
| GM LS | 6 500 | 136 km/h |
| Chevrolet 454 | 5 500 | 116 km/h |
| Honda B18C5 | 8 400 | 142 km/h |
| Hayabusa | 11 000 | 144 km/h |

Le Hayabusa n'exploite pas sa plage. Le 454, à l'inverse, **tape son rupteur
avant d'avoir le droit de monter** — les seuils de Sport vont jusqu'à 6 500 pour
un rupteur à 5 500, et seul un plafonnement de dernier recours l'empêche de
rester coincé.

Les seuils de montée s'expriment donc en **fraction du rupteur**, comme la
descente le fait déjà (`downshiftAtRedlineRatio`) : l'asymétrie est dans le code
depuis le début, et c'est elle qui produit ce défaut. Un **mode de conduite** —
route ou sport — module ces fractions, et devient le seul réglage de tempérament.

Ramenés en fraction, les deux profils livrés révèlent deux philosophies opposées
que personne n'avait énoncées : Route monte de plus en plus tôt (0,57 → 0,45),
Sport de plus en plus tard (0,61 → 0,77). Le mode doit rendre ce choix
explicite au lieu de le laisser dans cinq nombres.

Cinq curseurs disparaissent de l'écran au passage.

## Critères d'acceptation

- [ ] Les seuils de montée sont exprimés en fraction du rupteur du moteur
      désigné, et non plus en tours absolus.
- [ ] Un mode de conduite — route ou sport — module ces fractions ; c'est lui
      qui porte le tempérament de la boîte.
- [ ] Mesuré au banc : les quatre moteurs de la bibliothèque passent leurs
      rapports à des vitesses **proportionnées à leur rupteur**, et le Hayabusa
      tient chaque rapport plus longtemps que le GM LS.
- [ ] Mesuré au banc : aucun moteur ne peut se retrouver avec un seuil de montée
      au-dessus de son propre rupteur. Le plafonnement de dernier recours devient
      inutile — s'il reste, c'est comme garde-fou, plus comme mécanisme.
- [ ] Les cinq curseurs de régimes de passage quittent l'écran de réglage.
- [ ] Les profils déjà enregistrés sont repris : les seuils absolus qu'ils
      portent se convertissent en fractions, et le comportement de chacun ne
      change pas — sauf là où il était incohérent avec son moteur.
- [ ] 🧑 Vérifié en roulant : essayer deux moteurs de rupteurs très différents
      sur le même trajet s'entend comme deux voitures différentes.
- [ ] README et CHANGELOG à jour ; contrôle qualité vert.
