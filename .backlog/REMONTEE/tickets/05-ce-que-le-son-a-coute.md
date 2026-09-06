# 05 — Ce que le son a coûté en roulant est dans le journal

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Un seul accord, qui dit tout ce qui part

## Ce qu'il faut obtenir

Le journal porte ce que le son a coûté pendant le trajet : facteur temps réel,
creux du lecteur, écrêtage de la sortie, charge du calcul. On sait donc, après
coup, si le son a tenu dans la voiture — et à quel prix.

La question est ouverte et écrite :
[MOTEURS-EN-VOITURE](../../MOTEURS-EN-VOITURE/spec.md) note que la configuration
retenue par David écrête franchement en théorie, qu'il ne l'entend pas, et que
le taux réel n'a jamais été relevé dans cette configuration. Le seuil du lot
SYNTHESE est un facteur temps réel de trois **dans la voiture**, et personne ne
l'y a mesuré.

Rien de neuf à envoyer : le journal part déjà tout seul, et ces mesures sont des
faits de l'application, pas des données de déplacement. Elles entrent donc au
premier cran, avec le reste du journal.

Ces valeurs existent déjà et s'affichent au banc. Ce ticket les fait passer dans
le relevé périodique, à sa cadence — pas à celle de la boucle, qui en produirait
des dizaines de milliers.

Un profil qui ne synthétise pas n'a rien à dire ici, et ne dit donc rien : un
champ vide vaut mieux qu'un zéro qu'on prendrait pour une mesure.

## Critères d'acceptation

- [ ] Le relevé périodique du journal porte le facteur temps réel, les creux,
      l'écrêtage et la charge
- [ ] La cadence est celle du relevé périodique, pas celle de la boucle
- [ ] Un profil dont le son ne vient pas de la synthèse n'inscrit pas de mesure
- [ ] Rien de tout cela ne part quand l'accord est à « rien n'est envoyé »
- [ ] Le README dit ce que le journal contient, à jour
