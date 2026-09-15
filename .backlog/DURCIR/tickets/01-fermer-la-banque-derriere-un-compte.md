# 01 — La banque d'échantillons ne descend plus sans compte

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Les échantillons se servent aujourd'hui sans session : qui connaît l'adresse
tire toute la banque du serveur. C'est le plus gros poste de trafic du projet —
c'est pour son poids que les banques vivent dans un volume et non dans l'image —
et c'est la seule ressource que rien ne garde.

Après ce ticket, il faut un compte pour les obtenir. Pas un rôle : un compte, que
l'application se crée toute seule au démarrage. Un utilisateur légitime ne voit
aucune différence ; un tiers qui passe par l'adresse reçoit un refus.

Le refus doit être de ceux que le client ne rejoue pas. Et le cache hors réseau
doit continuer de tenir : une voiture qui a déjà pris ses échantillons roule sans
réseau comme avant.

## Critères d'acceptation

- [ ] Une requête sans session, sur un échantillon comme sur un listage de
      banque, reçoit un refus et pas des octets.
- [ ] Une requête avec session reçoit ce qu'elle recevait avant : mêmes
      en-têtes de cache, mêmes plages d'octets.
- [ ] Le jeu de requêtes d'accord couvre les deux cas.
- [ ] Un appareil qui a déjà garni son cache joue sans réseau, sans régression.
- [ ] La banque livrée avec l'application suit la même règle que les banques
      déposées : une seule porte, pas deux.
