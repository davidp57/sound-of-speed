# 02 — Distinguer lever le pied d'un freinage

**Statut :** 🚫 abandonné le 17 septembre 2026, et pour une raison de fond — mesuré sur 13 108 relevés de ralentissement des trajets du 16 : la distribution n'a **qu'une bosse et une queue**, sans rupture. Lever le pied dans une Tesla déclenche la régénération, qui freine déjà fort : il n'y a pas de roue libre, donc pas deux façons de ralentir à distinguer. Voir [PROFIL-REEL/03](../../PROFIL-REEL/tickets/03-separer-le-pied-leve-du-freinage.md)

**Bloqué par :** 01 — Une étape, de la consigne à la valeur proposée

## Ce qu'il faut obtenir

Deux étapes de plus, et ce sont les deux qui manquent le plus : une décélération
**pied levé**, sans toucher au frein, puis un **freinage franc**.

Elles donnent la frontière que la boîte utilise pour décider de rétrograder afin
de ralentir. Ce seuil vaut aujourd'hui −1 m/s² sur le profil Route et −0,7 sur
Sport, choisis pour que le rétrogradage ne se déclenche pas sur un simple lever
de pied. Personne n'a mesuré ce que valent réellement l'un et l'autre dans cette
voiture — d'autant qu'une électrique récupère au lever de pied, ce qui rapproche
les deux cas au lieu de les séparer.

Elles donnent aussi les bornes réelles de la décélération, aujourd'hui posées à
−14 m/s², une valeur qui n'est jamais atteinte et qui ne protège donc de rien.

Chaque étape garde son critère de validité, et l'analyse dit ce qu'elle n'a pas
pu mesurer. Un freinage franc ne se commande pas au milieu du trafic.

## Critères d'acceptation

- [x] Les deux étapes s'enregistrent séparément
- [x] La décélération pied levé et celle du freinage sont mesurées et distinguées
- [x] Un seuil de rétrogradage au freinage est proposé, entre les deux valeurs
- [x] Les bornes réelles de décélération sont proposées
- [x] Une étape non faite est dite non mesurée, jamais estimée
- [ ] 🧑 Vérifié en roulant : les deux valeurs sont distinctes sur cette voiture
