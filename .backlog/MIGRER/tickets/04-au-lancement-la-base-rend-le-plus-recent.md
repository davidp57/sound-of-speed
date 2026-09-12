# 04 — Au lancement, la voiture prend ce que la base a de plus récent

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** 03 — Ce que le navigateur de la voiture portait rejoint la base.

## Ce qu'il faut obtenir

Vider le stockage du navigateur de la voiture, recharger : les profils, les
moteurs et les boîtes reviennent. Régler au bureau, monter dans la voiture : elle
a la version du bureau.

Et hors réseau, l'application démarre sur sa propre copie sans attendre quoi que
ce soit.

C'est le ticket qui tient la promesse du lot : le stockage du navigateur cesse
d'être le seul dépositaire des réglages.

## Ce à quoi il faut faire attention

- **Le plus récent gagne**, ce qui suppose une date de modification fiable des
  deux côtés. Si elle manque, la règle n'arbitre rien et le dernier qui a parlé
  gagne au hasard.
- **L'application n'attend jamais le réseau pour démarrer.** Ce qui vient de la
  base arrive après l'écran, et ne remplace ce qui est affiché que s'il est plus
  ancien.
- **Une base vide ne doit rien faire perdre.** Rien en base veut dire « rien à
  dire », pas « efface ». C'est le cas de tout premier lancement.
- **Un profil qu'on est en train de régler ne se fait pas remplacer sous les
  doigts.** La reprise se joue au lancement, pas en continu.
- **On rend, on ne synchronise pas en continu.** Deux appareils qui ont bougé le
  même jour restent un cas que ce lot n'ouvre pas.

## Critères d'acceptation

- [x] Vider le stockage du navigateur puis recharger rend les profils, les
      moteurs et les boîtes
- [x] Régler au bureau puis ouvrir dans la voiture : la voiture a la version du
      bureau
- [x] Hors réseau, l'application démarre sur sa copie, sans attente perceptible
- [x] Une base vide ne fait rien perdre au navigateur
- [x] Le profil sélectionné n'est pas remplacé pendant qu'on le règle
- [x] Un réglage fait hors réseau n'est pas perdu au retour du réseau

## Comment le plus récent est reconnu

Les listages rendent de nouveau une date — celle que l'autoindex de nginx rendait
et que la réécriture avait laissée tomber, faute d'usage. L'usage est arrivé : la
voiture garde, par fichier, la date de la version qu'elle a appliquée, et prend
ce qui porte une date plus grande. **Les deux dates viennent du serveur**, jamais
de l'horloge de la voiture : comparer deux horloges différentes donnerait un
verdict au hasard.

## Ce que l'essai a trouvé

**Un profil qui redescendait recevait un identifiant neuf.** C'est la bonne règle
à l'import — recevoir le profil de quelqu'un d'autre ne doit pas écraser le sien
—, mais un profil qui revient de sa **propre** base est le même profil : il
devenait un double à chaque démarrage, et son dépôt suivant un second fichier sur
le serveur. Qui décide de l'identifiant est désormais passé en argument, pour les
profils comme pour les moteurs et les boîtes.

## La mesure

Dans un vrai navigateur, contre un serveur local. Un profil déposé côté serveur
sous le nom « Venu du bureau », puis le stockage du navigateur entièrement vidé :
au rechargement, le profil est là, avec son identifiant d'origine, et le serveur
ne porte toujours que trois fichiers — aucun double. Même essai avec un moteur
retouché : il revient sous son identifiant.

Les deux profils que la voiture venait elle-même de déposer n'ont pas été
redescendus au même lancement : ils attendaient dans la file, et le garde-fou a
joué.
