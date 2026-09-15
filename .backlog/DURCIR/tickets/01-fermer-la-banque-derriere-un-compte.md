# 01 — La banque d'échantillons ne descend plus sans compte

**Statut :** 🧑 attend David — le code est fait et mesuré, le cache hors réseau
ne se vérifie pas ici

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

- [x] Une requête sans session, sur un échantillon comme sur un listage de
      banque, reçoit un refus et pas des octets.
- [x] Une requête avec session reçoit ce qu'elle recevait avant : mêmes
      en-têtes de cache, mêmes plages d'octets.
- [x] Le jeu de requêtes d'accord couvre les deux cas.
- [ ] Un appareil qui a déjà garni son cache joue sans réseau, sans régression.
- [x] La banque livrée avec l'application suit la même règle que les banques
      déposées : une seule porte, pas deux.

## Ce qui a été mesuré, et ce qui ne l'a pas été

**Mesuré.** 57 cas du jeu d'accord passent contre un serveur qui tourne, dont
deux cas neufs qui vérifient le refus. Quatre tests du serveur couvrent le
refus, le service à qui s'annonce, l'absence d'exigence de rôle, et le cas d'un
serveur monté sans identité. 1 705 tests au vert, lint et construction compris.

**Pas mesuré : le cache hors réseau.** Le navigateur de la preview refuse
d'enregistrer un service worker, alors que le serveur rend bien le fichier. Ce
qui a pu être établi par lecture du code plutôt que par mesure :

- la mise en cache des échantillons est **commandée par l'application**, donc
  après l'ouverture du compte anonyme ;
- une réponse refusée y **échoue franchement** et se compte dans les échecs
  rapportés à l'écran : le pire cas est visible, pas silencieux ;
- les deux chemins de récupération du worker envoient le témoin, la page et le
  serveur étant sur la même origine.

Reste à confirmer en voiture : couper le réseau sur un appareil qui a déjà garni
son cache, et vérifier que le son sort.
