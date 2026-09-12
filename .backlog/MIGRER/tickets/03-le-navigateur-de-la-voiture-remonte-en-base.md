# 03 — Ce que le navigateur de la voiture portait rejoint la base

**Statut :** ⬜ prêt

**Bloqué par :** 02 — Les moteurs et les boîtes ont leur place sur le serveur.

## Ce qu'il faut obtenir

Au premier lancement après la mise à jour, ce que le navigateur de la voiture
porte depuis des mois part en base : les profils, les moteurs, les boîtes, et les
traces qui n'étaient jamais remontées. Au second lancement, rien ne repart.

Les préférences d'appareil ne bougent pas. Rien n'est effacé du stockage local.

## Ce à quoi il faut faire attention

- **Ce n'est pas une étape de chargement.** L'application démarre comme
  d'habitude et la remontée se fait derrière ; elle ne doit ni retarder l'écran,
  ni prendre le réseau au moment où le GPS s'accroche.
- **Les traces locales peuvent être grosses.** Elles partent une par une, par la
  file existante, et une remontée interrompue reprend là où elle en était.
- **Les traces remontées ainsi entrent épinglées**, comme celles du NAS, et pour
  la même raison : sans quoi la règle de rétention les effacerait un mois plus
  tard.
- **Ce qui reste local, et qu'il ne faut pas envoyer** : le volume, le visage de
  l'écran, le verrou, le mode de boîte, l'accord donné aux dépôts, l'aide déjà
  vue, l'étalonnage en cours. Ces réglages décrivent l'appareil, pas le
  conducteur.
- **Le second passage est le vrai test.** Une remontée qui se rejoue à chaque
  lancement inonderait la base de doublons sans que rien ne le signale.

## Critères d'acceptation

- [ ] Au premier lancement, les profils, moteurs, boîtes et traces du navigateur
      partent en base
- [ ] Au second lancement, rien ne repart
- [ ] Les traces ainsi remontées sont épinglées
- [ ] Les préférences d'appareil sont restées dans le navigateur
- [ ] Le stockage local n'est pas vidé
- [ ] Le démarrage n'est pas ralenti, et la remontée n'empêche pas de rouler
