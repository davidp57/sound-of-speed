# 09 — Prouver la régie contre un serveur qui tourne

**Statut :** ⬜ prêt

**Bloqué par :** 01 à 08 — tous les autres tickets du lot

## Ce qu'il faut obtenir

Les essais du dépôt tournent sur les sources : aucun ne voit passer une réponse
HTTP. Le 12 septembre 2026, une image qui ne se construisait plus est passée à
travers une pull request entièrement verte, pour cette seule raison. Le contrat
rejoué contre un serveur qui tourne est le seul contrôle qui regarde ce qu'un
serveur rend vraiment.

Ce ticket ferme le lot en vérifiant sur un serveur réel ce que les essais ne
peuvent que supposer :

- la page de régie est servie par l'image construite, et c'est bien elle qu'on
  obtient, pas l'application de conduite ;
- les routes de régie répondent 404 sans administrateur, et répondent avec ;
- les variables de configuration du lot sont déclarées dans la composition de la
  pile et prises en compte au démarrage.

Et il complète l'inventaire : toutes les routes de régie figurent dans la liste
de l'essai d'isolation. C'est ce qui fera rougir le jour où quelqu'un ajoutera
une route sans son contrôle, dans six mois, sans avoir lu cette spécification.

C'est un ticket de vérification, donc horizontal. Le dépôt a le précédent : la
même démarche, appliquée à l'isolation entre comptes, a trouvé de vrais défauts
au lieu d'entériner ce qu'on croyait.

## Critères d'acceptation

- [ ] Le contrat rejoué en HTTP couvre la page de régie et le refus 404 sans
      administrateur.
- [ ] Il passe contre un serveur qui tourne, administrateur configuré et non
      configuré.
- [ ] L'inventaire de l'essai d'isolation contient toutes les routes de régie
      ajoutées par le lot.
- [ ] Toutes les variables du lot sont déclarées et commentées dans la
      composition de la pile.
- [ ] Le poids de l'application que la voiture télécharge est relevé avant et
      après le lot, et il n'a pas augmenté.
- [ ] La documentation est à jour : référence des réglages et description des
      écrans.
- [ ] Contrôle qualité vert.
