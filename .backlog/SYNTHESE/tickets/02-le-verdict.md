# 02 — Remesurer à froid, et dire ce que le temps réel permet

**Statut :** ⬜ prêt

**Bloqué par :** 01 — la sonde, qui existe

## Ce qui a changé

Le premier relevé du V8 donnait ×0,82 en chaîne complète et ×1,60 avec la
convolution déportée, sur un Ryzen 7 7800X3D. J'en avais conclu que le temps réel
était hors d'atteinte.

**Ces chiffres ne valent rien** : un jeu récent tournait pendant la mesure.
Relevé après coup, la machine était encore à 25,6 % de charge moyenne et le jeu
totalisait 16 442 secondes de processeur. On n'a donc pas mesuré ce que le poste
sait faire, mais ce qu'il en restait.

C'est exactement le piège que le dépôt se donne pour règle d'éviter : mesurer
avant d'affirmer, et vérifier que l'on mesure bien ce qu'on croit.

## Ce qu'il faut obtenir

Un relevé **machine au repos**, sur les deux moteurs et aux deux fréquences, plus
une chose que la première mesure ne donnait pas : **le coût par cylindre**.

C'est lui qui décide du périmètre du mode natif. Un V8 est peut-être hors
d'atteinte quand un bicylindre passe largement — et un bicylindre bien simulé
vaut mieux qu'un V8 échantillonné. La question n'est donc pas « le temps réel
passe-t-il », mais **jusqu'à combien de cylindres il passe**.

Relevés attendus, machine au repos, charge processeur vérifiée avant et après :

| Moteur | 10 kHz | 20 kHz |
|---|---|---|
| Bicylindre | | |
| Trois cylindres | | |
| Quatre en ligne | | |
| V8 croisé | | |

Puis les mêmes avec la convolution déportée, qui vaut à elle seule un facteur
deux.

## Critères d'acceptation

- [ ] La charge processeur est relevée avant et après chaque mesure, et écrite
      à côté du chiffre. Une mesure prise sur une machine chargée est annoncée
      comme telle ou refaite
- [ ] Le coût par cylindre est chiffré, pas déduit
- [ ] Le seuil de ×3 est confronté à chaque taille de moteur
- [ ] La conclusion dit **jusqu'à combien de cylindres** le mode natif tient, et
      non pas s'il tient
- [ ] 🧑 Relevé fait dans la voiture pour au moins un moteur, afin de connaître
      le rapport entre le poste et l'appareil réel
