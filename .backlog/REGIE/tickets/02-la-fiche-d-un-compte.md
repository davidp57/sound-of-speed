# 02 — La fiche d'un compte

**Statut :** ✅ fait

**Bloqué par :** 01 — la porte et la liste des comptes

## Ce qu'il faut obtenir

Je clique une ligne de la liste et j'obtiens tout ce que le serveur sait de ce
compte : son nom, son adresse, son portrait, s'il est anonyme, sa date de
création, les fournisseurs qui lui sont rattachés, ses sessions ouvertes, ses
rôles, les banques qui lui sont accordées.

Et ce qu'il porte, en nombres : combien de profils, de moteurs, de boîtes, de
dépôts, combien d'octets, combien de trajets mesurés. Le serveur sait déjà peser
un compte et dire ce qu'il porte ; la fiche l'affiche.

Elle ne montre **aucun contenu nommé** : pas de nom de profil, pas de date de
trajet, pas de fichier. Un nom de profil ou une date de dépôt disent où et quand
quelqu'un a roulé ; ça ne s'ouvre qu'avec son accord, et c'est un autre ticket.

La fiche est en lecture seule à ce stade. Les boutons viennent ensuite.

## Critères d'acceptation

- [x] La fiche montre l'identité complète, les rattachements, les sessions, les
      rôles et les banques accordées.
- [x] Elle montre les compteurs de ce que le compte porte, y compris le poids en
      octets et le nombre de trajets mesurés.
- [x] Elle ne montre aucun nom de profil, aucune date de trajet, aucun nom de
      fichier.
- [x] La fiche d'un compte anonyme s'affiche correctement, sans inventer
      d'adresse : l'adresse de remplacement en domaine invalide ne s'affiche
      pas.
- [x] Un compte non administrateur reçoit 404 sur la route de la fiche.
- [x] La route de la fiche est inscrite dans l'inventaire de l'essai
      d'isolation.
- [x] Contrôle qualité vert.
