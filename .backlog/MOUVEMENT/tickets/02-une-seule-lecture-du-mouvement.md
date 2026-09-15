# 02 — Une seule lecture du mouvement

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** plus rien — 01 est livré le 15 septembre 2026, et son relevé est
dans la spécification du lot.

## Ce qu'il faut obtenir

**La boîte doit avoir un seul avis sur ce que fait la voiture.** Cinq lectures
décrivent aujourd'hui le même fait — accélère, tient, ralentit — avec cinq
seuils qui ne s'accordent pas et trois formes de mémoire différentes. Le tableau
exact est dans la spécification du lot ; il a été refait le 15 septembre 2026,
PLANCHER ayant emporté deux des lectures d'origine et la relecture du code en
ayant révélé deux autres.

Une seule lecture, calculée à un endroit, avec une **hystérésis explicite** :
elle dit dans quel état on est, et depuis combien de temps. La boîte ne consulte
plus qu'elle. Monter un seuil déplacerait la contradiction sans la lever ; c'est
le nombre de mécanismes qui est le défaut, pas leur réglage.

Le lot FIX-BOITE avait déjà conclu « un compteur, un usage » : son oscillation
venait d'un compteur à deux sens, et la même erreur est revenue deux jours plus
tard sous une autre forme.

Ces compteurs ne sortent pas de la boîte — aucun autre module ne les lit. Le
changement est donc confiné, et il n'y a pas de migration à étaler.

## Critères d'acceptation

- [x] Une pièce rend l'état du mouvement — accélère, tient, ralentit — et le
      temps passé dans cet état, avec une hystérésis qui s'énonce en une phrase.
- [x] Elle est vérifiable seule, sans boîte et sans navigateur, sur des suites
      d'accélérations fabriquées.
- [x] Un état ne bascule pas sur un tremblement de mesure : une sortie brève de
      la bande ne compte pas comme un changement d'allure.
- [x] La boîte ne consulte plus qu'elle. Les cinq mécanismes concurrents et
      leurs seuils propres ont disparu du code.
- [x] **La marge de bruit augmente** — de 1,25 à 1,5 km/h à la cadence de la voiture. Les scènes du ticket 01 tiennent
      aujourd'hui jusqu'à 1,25 km/h de bruit à la cadence de la voiture et
      décrochent à 1,5 ; c'est ce chiffre qu'il faut battre, et non « zéro
      passage », que la boîte actuelle obtient déjà sur un signal réaliste. Le
      relevé de la spécification est mis à jour avec les nouveaux chiffres.
- [x] Les tests existants de la boîte passent sans être réécrits pour
      s'accommoder du changement — s'ils doivent l'être, la raison est dite.
- [x] La section « Comment ça marche » du README décrit la lecture unique.
- [x] Contrôle qualité vert.

## Ce qui a été fait

`core/speed/motion.ts` rend l'état — freine, ralentit, tient, accélère —, le temps
passé dedans, et l'accélération qui a servi à décider. Les quatre états sont
**ordonnés** : chaque usage prend le palier qui le concerne au lieu d'avoir son
propre seuil, ce qui rend les cinq lectures inutiles sans multiplier les notions.

L'hystérésis : chaque frontière a deux seuils — entrer, sortir — et tout
changement se confirme pendant trois dixièmes de seconde, **sauf** quand le seuil
est franchi si largement qu'il n'y a plus de doute à lever.

**Cette réserve n'était pas prévue au ticket, et elle est obligatoire.** Sans
elle, le premier essai faisait revenir un défaut connu : la boîte montait un
rapport au lever de pied, ce que David avait relevé en roulant — « accélération
jusqu'à 4 800 tr/min en 4ᵉ, arrêt de l'accélération, le simu passe la 5 et la 6 ».
Le raccourci qu'elle remplace (`CLEARLY_SLOWING_MS2`) existait exactement pour ça,
et le supprimer sans le reprendre aurait été une régression silencieuse : le test
de cascade l'a attrapée.

## Deux tests existants modifiés, et pourquoi

Le ticket demandait qu'ils passent sans réécriture, ou que la raison soit dite.

1. **« passe sans attendre quand le régime a dépassé la marge »** vérifiait la
   règle avec une accélération **nulle** — la valeur par défaut du banc. L'ancienne
   écriture (`accelMs2 >= 0`) l'acceptait tout juste ; la lecture unifiée ne
   confond plus « tient sa vitesse » et « accélère ». Le test déclare maintenant
   l'accélération que son énoncé suppose, et un second test couvre le revers, qui
   n'était pas vérifié : à vitesse tenue, le passage se fait après sa
   temporisation et non sans attendre.

2. Aucun autre. Les soixante-trois autres tests de la boîte passent inchangés.

## Ce qui reste, et qui n'est pas de ce ticket

Les oscillations résiduelles à 50 km/h ne viennent pas de cette lecture : elles
sont espacées de dix à trente-six secondes, là où le bruit bat dix fois par
seconde. La cause probable est la **charge**, que le moteur déduit de
l'accélération brute et qui fait flotter le seuil de montée par la demande. Elle
entre dans la boîte par l'entrée, ce n'est donc pas une lecture de la boîte — et
le ticket disait de ne pas élargir.
