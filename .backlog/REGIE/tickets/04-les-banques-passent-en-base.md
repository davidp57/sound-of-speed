# 04 — Les banques réservées passent en base

**Statut :** ⬜ prêt

**Bloqué par :** 03 — donner et reprendre un rôle, et la trace qui l'inscrit

## Ce qu'il faut obtenir

Depuis la fiche, j'accorde une banque réservée à un compte, et il l'écoute tout
de suite. Je retire l'accord, il ne l'écoute plus. Aucun redéploiement.

**Le drapeau qui marque une banque comme réservée reste dans la configuration.**
C'est la défaillance qui commande : une table de drapeaux vide ouvrirait toutes
les banques à tout le monde, ce qui est précisément le trou que le lot DURCIR
vient de fermer. Une variable, elle, suit le déploiement.

**Les accords, eux, passent en base, par identifiant de compte.** Une table
d'accords vide ne fait que refuser, ce qui est la bonne façon de tomber en
panne. La variable d'accords existante reste et **se cumule** avec la table,
comme la variable des rôles offerts se cumule déjà avec la table des droits :
c'est la façon d'accorder sans écran, et le code l'annonce déjà.

Le passage de l'adresse au compte lève une conséquence acquise : un compte sans
adresse pourra désormais écouter une banque réservée. C'est voulu — le compte
est la bonne unité, l'adresse était un pis-aller.

C'est le ticket qui touche au code le plus éprouvé du lot. La décision de jouer
une banque est sur le chemin le plus chargé du serveur : elle ne doit pas
devenir plus coûteuse pour une banque ordinaire.

## Critères d'acceptation

- [ ] Une banque accordée depuis la fiche devient écoutable pour ce compte, sans
      redéploiement.
- [ ] L'accord retiré referme l'accès.
- [ ] Un accord posé par la variable d'environnement continue de valoir, et
      s'ajoute à ceux de la table plutôt que de les remplacer.
- [ ] Une banque non marquée réservée reste jouable sans qu'aucune requête
      supplémentaire ne soit faite — la mesure le montre.
- [ ] Un refus se donne en 404, comme aujourd'hui, et le listage continue de
      cacher les banques auxquelles le compte n'a pas droit.
- [ ] Un compte sans adresse peut recevoir un accord et l'exercer.
- [ ] Chaque accord et chaque retrait écrit sa ligne de trace.
- [ ] Les essais existants sur la décision de jouer une banque passent
      inchangés, ou leur changement est justifié dans le message de commit.
- [ ] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [ ] Contrôle qualité vert.
