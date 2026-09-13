# 18 — Un compte vide doit pouvoir s'effacer

**Statut :** ⬜ prêt

**Vient d'**un relevé fait sur la base de production le 13 septembre 2026, en
cherchant autre chose.

## Ce qui se passe

Quand un appareil rejoint un autre compte, celui qu'il portait est effacé s'il
est vide, gardé sinon — c'est `reglerLAncien`, dans `server/abandon.ts`.

Or un compte qui vient de naître n'est **jamais vide au sens de cette règle** :
l'application y écrit un profil mesuré dès les premières secondes, à zéro trajet.
Mesuré en production : un compte créé à 20:43, qui n'a jamais rien porté, avait
son profil mesuré à 20:46. Il sera donc gardé, et personne ne le rouvrira jamais.

## Ce qu'il faut obtenir

Qu'un compte que rien ne distingue d'un compte neuf s'efface quand on le quitte.

## Ce à quoi il faut faire attention

- **Un profil mesuré qui a vu des trajets n'est pas rien.** Ce qui ne compte pas,
  c'est celui qui n'a rien appris — `tripCount` à zéro. La distinction est dans
  le contenu, pas dans la présence de la ligne.
- **Ne pas élargir la règle.** Elle décide d'un effacement sans retour ; la
  rendre plus gourmande coûterait plus cher que le compte orphelin qu'elle
  laisse.
- Le relevé de production donne de quoi vérifier : deux comptes, dont un vide
  avec un profil mesuré à zéro trajet.
