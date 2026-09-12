# 03 — La voiture réelle existe

**Statut :** ✅ fait — l'entité existe ; sa sortie effective du profil est passée
au ticket 04, décidé par David le 10 septembre 2026

**Bloqué par :** aucun.

**Périmètre revu en cours de route.** Ce ticket devait aussi retirer la section
du profil. Ce n'est pas faisable séparément : l'étalonnage écrit dans quatre de
ces six réglages par un aiguillage explicite, et il superpose ses mesures au
profil pour fabriquer le profil effectif que la chaîne consomme. Retirer la
section sans le suivre laisserait ses recopies écrire dans un champ mort — pire
que de ne rien faire. Et le ticket 04 vide le profil de toute façon : le faire
deux fois coûterait deux migrations et deux fois le même travail. David a
tranché : « on regroupe avec le 04 ».

## Ce qu'il faut obtenir

Les six réglages du signal de vitesse — raideur du lissage, fenêtre
d'accélération, vitesse plausible, précision acceptée, bornes d'accélération —
ne décrivent ni un moteur, ni une boîte, ni un goût. Ils décrivent **la vraie
voiture** et son récepteur GPS. Ils n'ont donc rien à faire dans un profil de
son.

C'est David qui l'a formulé, en remplissant le relevé des réglages :

> tous les params « signal de vitesse » sont liés au profil de la voiture (la
> vraie) — donc valeurs par défaut en atelier, potentiellement adaptées avec le
> profil « voiture réelle » quand il est disponible

Et cette entité a une propriété qu'aucune des quatre autres n'a : **il n'y en a
qu'une**. On ne choisit pas sa vraie voiture comme on choisit un V8 — c'est
celle qu'on a. Elle appartient donc à l'appareil, et plus tard au compte, jamais
à un profil.

Au bout : changer de profil ne change plus le comportement de la mesure, et
l'étalonnage écrit à un endroit qui ne dépend pas du son qu'on écoutait ce
jour-là.

Ce que ce ticket ne fait pas : le catalogue de modèles de voiture, et l'analyse
automatique des données remontées pour bâtir ce profil tout seul. Ce sont deux
idées de David qui vivent dans la spécification du lot, et elles supposent le
serveur.

## Critères d'acceptation

- [x] L'entité « voiture réelle » existe : les six réglages du signal, une seule
      par appareil, avec son modèle quand on le connaît.
- [x] Ses valeurs par défaut sont celles qui ont roulé — celles des profils
      livrés —, et non des valeurs choisies en la déplaçant.
- [x] Chaque valeur est ramenée dans son domaine à la lecture : un stockage local
      se modifie à la main, et une fenêtre d'accélération nulle rendrait la pente
      indéfinie.
- [x] La reprise depuis un profil déjà réglé garde **ses** valeurs, au lieu
      d'imposer celles d'usine à quelqu'un qui avait réglé les siennes.
- [x] Contrôle qualité vert.

Passés au ticket 04, avec la contraction :

- [ ] Les six réglages quittent le profil.
- [ ] Changer de profil ne change plus aucun réglage de mesure.
- [ ] L'étalonnage recopie ses valeurs mesurées dans la voiture réelle.
- [ ] Un profil importé n'écrase jamais la voiture réelle de celui qui le
      reçoit.
