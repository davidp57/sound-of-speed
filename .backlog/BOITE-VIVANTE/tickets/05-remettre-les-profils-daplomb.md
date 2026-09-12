# 05 — Remettre les deux profils livrés d'aplomb

**Statut :** ✅ fait

**Bloqué par :** 02, 03 et 04 — les trois règles nouvelles

## Ce qu'il faut obtenir

Les profils **Route** et **Sport** restent cohérents avec la boîte nouvelle :
chaque rapport à sa place, aucun régime absurde à une vitesse ordinaire, et un
caractère qui correspond à leur nom.

Leurs valeurs actuelles ont été réglées contre une boîte qui ne montait jamais
en croisière et ne descendait qu'au régime. Il manque donc les trois valeurs
nouvelles, et il faut vérifier que les anciennes tiennent encore.

Les **seuils de passage** ne changent pas, et c'est un choix examiné : le README
dit qu'ils ont été placés en **vitesse** — 35, 55, 75, 96 et 115 km/h à charge
moyenne — et non pour compenser l'absence de montée en croisière. Ils gardent
exactement leur rôle, celui des passages en accélération. Les toucher ici
brouillerait l'écoute qui suivra.

Ce ticket règle par le **calcul**, pas à l'oreille : on établit le tableau des
régimes de croisière à toutes les vitesses ordinaires et on choisit les valeurs
qui le rendent sensé. Le goût viendra ensuite, en roulant.

La cible, pour chacun des deux profils :

- **Route** — croiser bas et sans bruit aux vitesses réellement pratiquées, la
  6e engagée sur route ouverte, aucun régime au-dessus de 2500 tr/min à vitesse
  tenue en dessous de 130 km/h.
- **Sport** — garder ses rapports plus longtemps, croiser plus haut, descendre
  franchement au freinage. La différence entre les deux doit rester **un
  réglage** et non une nature, comme le dit le README.

## Critères d'acceptation

- [x] Le tableau des régimes à vitesse tenue est établi pour les deux profils,
      de 30 à 130 km/h, et figure dans la spécification du lot
- [x] Aucun régime de croisière absurde : rien au-dessus de 2500 tr/min sur
      Route en dessous de 130 km/h
- [x] Aucun broutement : rien sous le plancher de croisière du profil
- [x] Le profil Route engage bien sa 6e en croisière sur route ouverte
- [x] Le profil Sport croise plus haut que Route à la même vitesse, à chaque
      vitesse du tableau
- [x] Les trois réglages nouveaux sont renseignés dans les deux profils, et
      cohérents avec leur tempérament
- [x] Un test tient le tableau : il échouera si un réglage futur rend un régime
      de croisière absurde
- [x] Les tests des profils livrés passent, y compris ceux qui vérifient que les
      seuils de passage restent entre le ralenti et le rupteur
- [x] Le README est mis à jour là où il chiffre le comportement des deux profils
