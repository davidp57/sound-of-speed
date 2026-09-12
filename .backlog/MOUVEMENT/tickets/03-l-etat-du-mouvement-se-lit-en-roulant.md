# 03 — L'état du mouvement se lit en roulant

**Statut :** ⬜ prêt

**Bloqué par :** 02 — Une seule lecture du mouvement. Il n'y a rien à montrer
tant qu'il y a cinq réponses à la question.

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

- [ ] La télémétrie montre l'état courant et depuis combien de temps il tient.
- [ ] Le journal inscrit chaque changement d'état, avec la vitesse et
      l'accélération de l'instant.
- [ ] Le relecteur les montre sans saturer la barre des faits marquants — les
      passages de rapport ont déjà posé cette question, la réponse doit être la
      même.
- [ ] Contrôle qualité vert.
