# 07 — Fermer la lecture des dossiers, pas seulement l'écriture

**Statut :** ✅ fait — vérifié sur le NAS le 6 septembre 2026

**Bloqué par :** aucun

## Ce qu'il faut obtenir

Les quatre dossiers du serveur — traces, journal, mesures, profils — ne se
lisent plus sans mot de passe.

**Le trou, relevé par David le 6 septembre 2026** en ouvrant `/mesures/` :
« l'accès aux folders est libre, on n'a pas besoin du mot de passe ? c'est pas
une faille de sécu ça ? ». Il l'est. La règle du serveur protégeait tout **sauf
la lecture**, ce qui était un choix : la bibliothèque de profils se lit sans
compte, et une trace n'a pas de coordonnées.

Ce choix ne tient pas ici, et pour une raison que David a dite en une phrase :
« c'est accessible de l'extérieur, bien sûr — sur la Tesla je ne suis pas en LAN,
ça ferait un très long câble ». L'adresse est donc publique, et il n'y a qu'un
nom d'hôte à connaître pour lister les trajets et les télécharger. Le journal, au
cran étendu, porte en plus la position à un point par seconde.

Ce n'est pas un défaut du lot REMONTEE : la lecture de `traces/` était ouverte
depuis le 3 septembre, celle de `journal/` depuis le 4. Ce que le lot a changé,
c'est la quantité de données qui arrive là toute seule.

**Fermé jusqu'au bout, profils compris**, sur la décision de David : « ferme
tout en utilisant le mot de passe du dépôt ». La conséquence est assumée — une
bibliothèque vide sur un appareil où le compte n'est pas saisi — et elle vaut
mieux qu'une règle à trous qu'on croira uniforme le jour où l'on y ajoutera un
dossier.

## Ce que cela ne couvre pas

L'application elle-même, ses échantillons et la page de mesure restent
accessibles sans mot de passe. Ils ne portent aucune donnée de conduite. Les
protéger demanderait l'authentification générale du site, qui existe déjà dans la
configuration du serveur, en commentaire — c'est une décision distincte, dont le
prix est de s'annoncer sur chaque appareil, la voiture comprise.

## Critères d'acceptation

- [x] Les quatre dossiers refusent la lecture à qui ne s'annonce pas
- [x] L'application s'annonce pour lire la bibliothèque de profils
- [x] Elle s'annonce pour vérifier qu'une trace n'est pas déjà déposée
- [x] Sans compte saisi, la bibliothèque est vide et n'interroge pas le serveur
- [x] Le README dit que la lecture est fermée, et ce que cela coûte
- [x] Vérifié sur le NAS le 6 septembre 2026 : `/traces/` demande le mot de
      passe, et la bibliothèque fonctionne toujours avec le compte saisi
