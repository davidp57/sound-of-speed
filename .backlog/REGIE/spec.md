# RÉGIE — administrer les comptes depuis un écran

**Statut :** ⬜ prêt — cadre posé le 15 septembre 2026, pas encore découpé
**Branche :** à ouvrir
**Version visée :** à décider

## D'où vient ce lot

Le lot [DURCIR](../DURCIR/spec.md) pose les contrôles côté serveur, et les règle
par la configuration : quel compte a quel rôle, quel compte peut jouer une banque
restreinte. Ça suffit pour verrouiller, et c'est même la façon la plus sûre de le
faire — aucune route ne peut alors accorder un droit.

Mais ça ne se tient pas à l'usage : il faut redéployer pour changer un droit.
David, le 15 septembre 2026 : il faut un écran d'administration, un rôle
d'administrateur sur son compte, de quoi attribuer les rôles, la liste des
banques autorisées par compte, et les quotas plus tard.

## Ce qui est déjà tranché

- **Le rôle d'administrateur s'accorde hors bande**, par la configuration du
  serveur, et aucune route ne peut l'accorder ni le modifier. C'est ce qui rend
  l'écran sûr.
- **Ce n'est pas le fait d'être caché qui protège.** L'écran est sur le même
  serveur public que le reste : une adresse non publiée se trouve. C'est le rôle,
  gardé côté serveur comme les autres, qui garde.
- **Le modèle des banques est un drapeau, pas une liste par compte.** Une banque
  porte « restreinte » ou non ; un compte porte la liste des banques restreintes
  qu'il peut jouer, vide par défaut. « Tout sauf celle-là » tombe alors tout
  seul, sans rien avoir à écrire à chaque banque ajoutée.
- **Les quotas attendent les chiffres** du ticket 04 de DURCIR.

## Ce qu'il reste à instruire

- Ce que l'écran montre d'un compte, et ce qu'il ne montre pas : c'est un écran
  qui regarde les données d'autres personnes.
- Ce qu'il permet de faire au-delà d'attribuer : effacer un compte, régler un
  abandon, forcer une rétention.
- Si l'attribution d'un rôle laisse une trace, et où.
- Comment les quotas se présentent une fois mesurés : un nombre par compte, ou un
  cran attaché au rôle.
