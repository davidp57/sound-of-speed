# 05 — Générer une banque avec engine-sim, ici, et la rejouer là-bas

**Statut :** ⬜ prêt

**Bloqué par :** aucun — n'attend pas le verdict du temps réel

## Ce qui a déclenché

Idée de David, le 4 septembre 2026 :

> on peut aussi utiliser engine-sim pour qu'il tourne au design time, et nous
> génère une version « pré compilée » des sons qu'on pourra ensuite simuler dans
> la voiture

Proposée comme un repli, retenue comme une **option à part entière** : elle a son
domaine, et elle corrige un défaut que rien d'autre ne corrige.

## Ce qu'elle corrige

Le son de la banque livrée est joué entre **0,26 et 0,81 fois** sa vitesse sur
toute la conduite ordinaire. Le rééchantillonnage descend la fréquence
d'allumage, ce qu'on veut, mais il descend **avec elle** les résonances de
l'échappement et de la caisse, ce qu'on ne veut pas : un moteur change de régime
sans changer de corps. C'est la cause racine que l'essai d'ancrage a mise au
jour, et qu'aucun réglage ne rattrape.

En générant, on produit une prise **par plage de régime**, donc une lecture
proche de un, où le timbre ne se déplace plus. Et l'on obtient la prise de
ralenti et la prise bas régime qui manquent depuis le début — la seule vraie
sortie qu'avait identifiée le ticket 05 d'ESSAI-04, et qui demandait « de la
matière, pas du code ».

## Ce qu'il faut construire

Un outil qui tourne **ici**, pas dans la voiture :

1. il lit une définition de moteur en JSON — la même que le mode direct ;
2. il fait tourner le cœur d'engine-sim **hors ligne**, aussi lentement qu'il le
   faut, à un régime tenu ;
3. il enregistre une boucle par plage de régime, en charge et pied levé ;
4. il produit les fichiers **et** le fragment de profil qui les déclare :
   ancrages, gains, bornes de lecture — les chiffres que le lot BANQUES devait
   relever à la main.

Le format de sortie est celui que l'application sait déjà jouer. Rien à changer
dans le moteur de lecture.

## Deux questions à trancher en le faisant

**Combien de prises, et à quels régimes ?** Une par octave suffit-elle ? Le
rééchantillonnage reste acceptable tant qu'on ne s'éloigne pas trop de un : à une
prise par demi-octave, la lecture reste entre 0,71 et 1,41. À mesurer plutôt qu'à
décider.

**Comment fermer la boucle proprement ?** Une boucle qui claque s'entend
immédiatement. Le dépôt a déjà tout l'outillage pour cela — `core/audio/analyze.ts`
cherche le point de bouclage et **mesure** le saut d'énergie sur les deux
versions pour garder la meilleure. Un signal généré à régime tenu devrait s'y
prêter mieux qu'une prise réelle en rampe.

## Critères d'acceptation

- [ ] L'outil produit une banque complète depuis une définition de moteur, sans
      intervention à la main
- [ ] Il produit aussi les ancrages et les gains, mesurés et non estimés
- [ ] La banque produite se charge dans l'application sans rien y modifier
- [ ] Le saut d'énergie au bouclage est chiffré pour chaque prise
- [ ] La vitesse de lecture reste dans une plage annoncée sur toute la conduite
      ordinaire, et ce chiffre est écrit
- [ ] 🧑 Jugé à l'oreille contre la banque enregistrée et contre le mode direct
