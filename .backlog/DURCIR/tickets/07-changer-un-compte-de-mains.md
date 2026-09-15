# 07 — Les deux gestes qui font changer un compte de mains

**Statut :** ⬜ prêt

**Bloqué par :** 06 — Prouver l'isolation entre comptes, route par route

## Ce qu'il faut obtenir

Rattacher une adresse, et rattacher un compte tenu ailleurs : ce sont les deux
moments où un compte change de propriétaire. Le code dit qu'une adresse choisie
ne se fait jamais remplacer, et qu'un rattachement ne se fait pas sur la seule
foi d'une adresse. Rien ne le prouve depuis une requête.

Après ce ticket, c'est prouvé de bout en bout : on ne prend pas un compte qui
porte déjà une vraie adresse, une adresse donnée par un fournisseur n'écrase
jamais une adresse choisie, et le règlement du compte abandonné ne sert pas à
s'approprier celui d'à côté.

## Critères d'acceptation

- [ ] Rattacher une adresse déjà portée par un autre compte ne donne accès à rien
      de ce que celui-ci porte.
- [ ] Une adresse rendue par un fournisseur ne remplace pas une adresse choisie,
      et le test le montre depuis la requête, pas depuis la fonction.
- [ ] Le compte abandonné pendant un rattachement ne peut pas être celui de
      quelqu'un d'autre.
- [ ] Un rattachement qui échoue laisse les deux comptes dans l'état où il les a
      trouvés.
