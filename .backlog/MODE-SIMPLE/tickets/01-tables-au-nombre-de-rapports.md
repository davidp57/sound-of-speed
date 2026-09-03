# 01 — Les tables suivent le nombre de rapports

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Changer le nombre de rapports d'un profil donne une boîte cohérente, et non une
boîte dont la moitié des rapports hérite de réglages qui ne leur appartiennent
pas.

C'est déjà possible aujourd'hui — le champ des démultiplications accepte la liste
et la réécrit — mais bancal : les régimes de passage et les temporisations
gardent leur ancienne longueur. Un rapport ajouté prend le seuil de son
prédécesseur et une temporisation par défaut étrangère au profil, et un rapport
retiré laisse des valeurs orphelines.

Désormais, ajouter ou retirer un rapport redimensionne ces tables dans le même
mouvement, en répartissant les seuils comme le guide de création le fait depuis
le tempérament. Les temporisations restent volontairement inégales : des valeurs
égales donnent une boîte qui sonne comme un métronome.

C'est un préfactoring : il rend faciles les tickets 03 et 05, et il vaut par
lui-même puisqu'il corrige un défaut existant.

## Critères d'acceptation

- [x] Ajouter un rapport donne un seuil de passage et une temporisation cohérents
      avec les rapports voisins
- [x] Retirer un rapport ne laisse aucune valeur orpheline
- [x] Les temporisations produites restent inégales entre elles
- [x] Un profil dont on ne touche pas le nombre de rapports est inchangé
- [x] Le rapport le plus long garde une vitesse de croisière tenable après
      redimensionnement
