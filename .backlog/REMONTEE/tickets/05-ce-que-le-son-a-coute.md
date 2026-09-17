# 05 — Ce que le son a coûté en roulant est dans le journal

**Statut :** 🔁 reformulé le 17 septembre 2026, sur accord de David — la mesure vise désormais le chemin **échantillons**, pas la synthèse

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

- [x] Le relevé périodique du journal porte le facteur temps réel, les creux,
      l'écrêtage et la charge
- [x] La cadence est celle du relevé périodique, pas celle de la boucle
- [x] Un profil dont le son ne vient pas de la synthèse n'inscrit pas de mesure
- [x] Rien de tout cela ne part quand l'accord est à « rien n'est envoyé »
- [x] Le README dit ce que le journal contient, à jour

## Fait, le 6 septembre 2026

Les quatre mesures entrent dans le relevé périodique, et deux tests les
vérifient : les valeurs y sont, arrondies, et un profil qui joue des échantillons
n'inscrit rien plutôt qu'un zéro.

**Reste le chiffre lui-même**, qui ne se relève qu'en roulant : c'est la question
ouverte de MOTEURS-EN-VOITURE — le taux d'écrêtage réel de la configuration
retenue — et le seuil de SYNTHESE, un facteur temps réel de trois dans la
voiture.

Dernier critère établi le 12 septembre 2026 : un test nomme l'entrée du relevé dans le journal quand le son est synthétisé, et vérifie le facteur temps réel, la charge, les creux, leur durée, la crête et l'écrêtage.

## Reformulé le 17 septembre 2026 : l'écrêtage plutôt que la synthèse

**Tel qu'il était écrit, ce ticket attendait une preuve impossible.** `soundCost()`
rend `null` dès que le profil joue des échantillons — le commentaire du code le
dit : « le lecteur de synthèse ne tourne pas, et ses compteurs diraient zéro, ce
qui se lirait comme un son parfait plutôt que comme une absence de mesure ».
David roule en échantillons, et la synthèse en direct dans la voiture est
abandonnée depuis son verdict sur le processeur. Le facteur temps réel et les
creux du lecteur n'ont donc plus rien à mesurer.

**Mais une pièce du ticket garde toute sa valeur, et elle sert ailleurs :
l'écrêtage de la sortie.** Il concerne le chemin des échantillons autant que
celui de la synthèse, et personne ne l'a jamais relevé en roulant.

C'est exactement ce qui manque au ticket
[ESSAI-16/08](../../ESSAI-16/tickets/08-volume-plaque-contre-le-limiteur.md) :
David trouve le volume maximal insuffisant, la cause est qu'il est plaqué contre
un limiteur réglé à −1,5 dBFS, et on ne peut pas dire combien de décibels sont
récupérables sans savoir où le signal tape réellement.

**Ce qu'il faut obtenir, maintenant** : le journal porte, pour le chemin
échantillons, la crête de sortie et le taux d'écrêtage relevés en roulant. Rien
de neuf à envoyer — le journal part déjà tout seul, et ce sont des faits de
l'application, pas des données de déplacement.

**Ce qui est abandonné** : le facteur temps réel, les creux du lecteur et la
charge du calcul de synthèse. Ils n'ont de sens que pour une synthèse en direct
qui ne tournera pas dans cette voiture.

