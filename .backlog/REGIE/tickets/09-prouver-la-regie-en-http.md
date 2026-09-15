# 09 — Prouver la régie contre un serveur qui tourne

**Statut :** ✅ fait

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

- [x] Le contrat rejoué en HTTP couvre la page de régie et le refus 404 sans
      administrateur.
- [x] Il passe contre un serveur qui tourne, administrateur configuré et non
      configuré.
- [x] L'inventaire de l'essai d'isolation contient toutes les routes de régie
      ajoutées par le lot.
- [x] Toutes les variables du lot sont déclarées et commentées dans la
      composition de la pile.
- [x] Le poids de l'application que la voiture télécharge est relevé avant et
      après le lot. **Il a augmenté de 3,1 ko** (308,6 → 311,8 ko ; 0,9 ko
      compressé), et pas d'un octet à cause de la régie : ce sont l'autorisation
      d'assistance et la relecture de sa propre trace, deux réglages du
      conducteur ajoutés à son écran de compte par les tickets 05 et 07. L'écran
      de régie, lui, est une entrée séparée de 12,6 ko, tirée seulement quand on
      ouvre `/regie.html`.
- [x] La documentation est à jour : référence des réglages et description des
      écrans.
- [x] Contrôle qualité vert.
