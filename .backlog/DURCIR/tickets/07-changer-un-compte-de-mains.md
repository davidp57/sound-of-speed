# 07 — Les deux gestes qui font changer un compte de mains

**Statut :** ✅ fait

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

- [x] Rattacher une adresse déjà portée par un autre compte ne donne accès à rien
      de ce que celui-ci porte.
- [x] Une adresse rendue par un fournisseur ne remplace pas une adresse choisie,
      et le test le montre depuis la requête, pas depuis la fonction.
- [x] Le compte abandonné pendant un rattachement ne peut pas être celui de
      quelqu'un d'autre.
- [x] Un rattachement qui échoue laisse les deux comptes dans l'état où il les a
      trouvés.

## Ce ticket était trop large, et le dire vaut mieux que le refaire

**Trois des quatre critères étaient déjà tenus.** Le ticket a été écrit depuis un
relevé de noms de fichiers, pas depuis les tests : la couverture réelle est bien
meilleure. Étaient déjà vérifiés, et depuis l'adresse et non depuis la fonction :
l'adresse déjà prise refusée, le changement d'adresse d'un compte qui en a une
refusé, le mot de passe faux refusé sans dire lequel des deux est faux, le compte
abandonné gardé dès qu'il porte quelque chose ou qu'il a une adresse, le compte
de l'appelant jamais effacé, et l'adresse d'un fournisseur qui ne remplace pas
une adresse choisie.

**Ce qui manquait tenait sur un angle : celui d'en face.** Tout était regardé du
point de vue de qui appelle la route ; personne n'avait vérifié que la **cible** —
le compte dont l'adresse ou l'identifiant sert d'appât — ne bouge pas. Trois cas
ajoutés, sur le banc à deux comptes du ticket 06 : un refus de rattachement
n'ouvre rien et ne déplace rien, une connexion refusée n'abîme pas la cible et ne
déplace pas l'appelant, et faire passer un compte garni pour un ancien ne
l'efface pas.
