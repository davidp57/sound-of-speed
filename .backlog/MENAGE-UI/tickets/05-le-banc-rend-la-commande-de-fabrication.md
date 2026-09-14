# 05 — Le banc rend la commande de fabrication, prête à coller

**Statut :** ✅ fait

**Bloqué par :** 03 — L'atelier : un onglet qui rassemble le son et la
fabrication de profils

## Ce qu'il faut obtenir

On règle un timbre à l'oreille au banc de synthèse, on est content, et on veut
en faire une banque. Aujourd'hui il faut retrouver les bons paramètres et les
retaper dans un terminal.

Le banc rend la commande exacte, avec les réglages qu'on vient d'entendre, dans
son état complet — prête à coller, sans rien à compléter ni à commenter. Un
geste la copie.

**Ce n'est pas le serveur qui fabrique**, et c'est une décision, pas une
limitation subie : la chaîne lance un binaire natif compilé sur le poste, le NAS
est en Linux ARM64, et une compilation croisée rouvrirait le chantier que le lot
IMAGE-ARM64 a fermé. La friction réelle n'est pas de taper une commande, c'est de
retrouver les paramètres.

C'est réversible : le jour où taper gêne encore, le bouton existe et il n'y aura
qu'à changer ce qu'il déclenche.

## Critères d'acceptation

- [x] Depuis le banc, un geste donne la commande de fabrication avec les
      réglages courants
- [x] La commande se colle telle quelle dans un terminal et produit la banque
      attendue
- [x] Les réglages qu'elle porte sont ceux qu'on vient d'entendre, sans écart
- [x] L'écran dit où la banque sera écrite, et que la commande tourne sur le
      poste

## Deux blocs, et pourquoi pas un seul

La chaîne ne prend pas d'arguments : elle lit un **fichier de définition**.
« Prêt à coller » demandait donc soit d'écrire ce fichier depuis la commande —
ce qui oblige à choisir un dialecte de terminal, et il n'y en a pas un seul sur
ce poste —, soit de rendre les deux séparément. C'est le second.

La commande elle-même tient en deux lignes plutôt qu'une : le binaire se compile
avant de servir, et l'oublier donne une erreur qui ne dit pas ce qui manque.
Séparées par un saut de ligne et non par un `&&`, qui ne s'écrit pas pareil
partout.

## Ce que la mesure a corrigé

**`limiterRpm` n'est pas le rupteur**, et je l'avais écrit comme s'il l'était.
Le test qui compare la définition produite à celle livrée pour le même moteur a
tranché : 6 950 contre 6 500. Le rupteur plafonne le moteur *joué* ; le limiteur
est le régime auquel la prise a été *enregistrée*, et il se lit sur la couche du
rupteur du profil — celle que `gm-ls` nomme `limiter_6950`.

C'est exactement ce que ce test d'accord existe pour attraper : l'application et
la chaîne ne partagent aucun type, et rien d'autre n'aurait signalé l'écart avant
une génération lancée pour rien.

**Éprouvé de bout en bout** : la définition produite a été passée à
`generate.mjs`, qui lit le moteur, calcule ses huit ancrages de 750 à
6 500 tr/min, lance vingt-cinq prises et écrit les premiers WAV. Interrompue
volontairement après trente secondes — le propos était de vérifier que le format
passe, pas de refaire une banque qui existe.

## Un défaut trouvé en chemin

Le dossier de travail de la chaîne, `.brut/`, vit **dans** la banque qu'il
produit. Or `public/audio/*` est ignoré mais les quatre banques livrées sont
ré-incluses : lancer la chaîne sur l'une d'elles faisait apparaître son dossier
de travail dans `git status` — 1,3 Mo après trente secondes, une centaine de
fichiers sur une génération complète. Exclu.

Il n'était pas visible avant parce que personne ne lançait la chaîne souvent.
Rendre la commande facile à lancer le rendait certain.
