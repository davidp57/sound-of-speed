# 03 — L'état du mouvement se lit en roulant

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** plus rien — 02 est livré le 15 septembre 2026.

## Ce qu'il faut obtenir

**Quand la boîte fait quelque chose d'inattendu, savoir ce qu'elle croyait que
la voiture faisait.** C'est la question qu'on s'est posée tout l'été sans
pouvoir y répondre : le rapport monte pendant qu'on ralentit, mais la boîte
pensait-elle qu'on ralentissait ?

L'état — accélère, tient, ralentit — s'affiche en télémétrie avec le temps
passé dedans, et s'inscrit au journal **à chaque changement**, comme les
passages de rapport depuis le 10 septembre. Une ligne par bascule, pas une par
image : un trajet ordinaire en produit quelques centaines.

## Critères d'acceptation

- [x] La télémétrie montre l'état courant et depuis combien de temps il tient.
- [x] Le journal inscrit chaque changement d'état, avec la vitesse et
      l'accélération de l'instant.
- [x] Le relecteur les montre sans saturer la barre des faits marquants — les
      passages de rapport ont déjà posé cette question, la réponse doit être la
      même.
- [x] Contrôle qualité vert.

## Ce qui a été fait

La boîte rend son allure dans `GearboxState` — elle la calcule déjà pour décider,
et personne ne la recalcule : une seconde lecture serait un second avis, ce que
le lot vient de supprimer.

- **Télémétrie**, sous la transmission : « ralentit depuis 0,8 s ».
- **Journal**, genre `pace` : ce qu'on quitte, ce qu'on prend, la durée de l'état
  quitté, la vitesse et l'accélération. La durée est celle de l'état **quitté**,
  la relecture n'ayant aucun moyen de la reconstituer autrement.
- **Relecteur** : l'allure à l'instant lu, sous le rapport. Elle n'entre pas dans
  la barre des faits marquants — même réponse que pour les passages, et pour la
  même raison : elle bascule plus souvent qu'un rapport ne passe.

**Vérifié dans l'application** et pas seulement en test : au simulateur, l'écran
passe de « accélère » à « ralentit depuis 0,8 s », puis 5,8 s, puis « freine ».

## Un renommage, et pourquoi

La pièce du ticket 02 s'appelait `core/speed/motion.ts`. Elle est devenue
`core/speed/pace.ts` — l'**allure** — en la branchant à l'écran : `motion.ts`
existe déjà dans `core/input/`, et c'est la sonde de l'accéléromètre. Deux
fichiers du même nom pour deux notions voisines auraient coûté plus cher que ce
paragraphe.
