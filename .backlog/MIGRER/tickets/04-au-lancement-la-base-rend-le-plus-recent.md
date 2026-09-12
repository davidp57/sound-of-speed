# 04 — Au lancement, la voiture prend ce que la base a de plus récent

**Statut :** ⬜ prêt

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

- [ ] Vider le stockage du navigateur puis recharger rend les profils, les
      moteurs et les boîtes
- [ ] Régler au bureau puis ouvrir dans la voiture : la voiture a la version du
      bureau
- [ ] Hors réseau, l'application démarre sur sa copie, sans attente perceptible
- [ ] Une base vide ne fait rien perdre au navigateur
- [ ] Le profil sélectionné n'est pas remplacé pendant qu'on le règle
- [ ] Un réglage fait hors réseau n'est pas perdu au retour du réseau
