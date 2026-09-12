# 02 — Remesurer à froid, et dire ce que le temps réel permet

**Statut :** 🚫 abandonné le 12 septembre 2026 — même raison que le ticket 01 :
le verdict du temps réel ne décide plus rien, la voiture ne synthétise pas.

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

## Remesuré à froid le 4 septembre 2026

Machine au repos, vérifiée avant la mesure : **6,2 % de charge moyenne**, jeu
arrêté. Ryzen 7 7800X3D, un seul fil.

| Facteur temps réel, 10 kHz | 4 cylindres | V8 croisé |
|---|---|---|
| Chaîne complète | ×1,93 | ×0,93 |
| Convolution déportée sur Web Audio | **×3,71** | **×1,91** |
| Chaîne complète, 20 kHz | ×1,34 | ×0,66 |

Le jeu coûtait environ 15 % : le V8 passait de ×1,60 à ×1,88 une fois la machine
libre. Ma conclusion d'alors — « le temps réel est hors d'atteinte » — était donc
prise sur une mesure faussée, mais elle n'est pas renversée pour autant sur le
V8. Elle l'est sur la question, qui n'était pas la bonne.

### Le coût est proportionnel au nombre de cylindres

C'est la mesure qui compte, et elle est nette. Simulation à 10 kHz : 0,26 s de
processeur par seconde de son pour quatre cylindres, 0,52 s pour huit. **Un
facteur deux exactement**, soit **0,065 s par cylindre**.

D'où, avec la convolution déportée et le seuil de ×3 :

| Cylindres | Sur ce poste | Tient le seuil ? |
|---|---|---|
| 2 | ~×7,7 | oui, largement |
| 3 | ~×5,1 | oui |
| 4 | ×3,71 (mesuré) | oui |
| 5 | ~×3,0 | à la limite |
| 6 | ~×2,6 | non |
| 8 | ×1,91 (mesuré) | non |

**Sur ce poste, le direct tient jusqu'à quatre ou cinq cylindres.** C'est
exactement l'intuition de David : le mode natif a un domaine, et ce domaine est
celui des petits moteurs.

### Un levier qui n'avait pas été vu

La synthèse coûte aussi le double pour le V8 — 0,55 s contre 0,27 s. Ce n'est
pas le nombre de cylindres : c'est qu'**un V8 a deux lignes d'échappement**, donc
deux convolutions. Les fusionner diviserait ce poste par deux.

Mais c'est précisément ce qui fait le grondement d'un V8 croisé : chaque banc a
son propre chapelet d'impulsions inégales, et les mélanger avant la résonance
reviendrait à simuler deux quatre cylindres accordés. **À ne pas faire pour
gagner du budget** — ou alors en le sachant, et en l'écoutant.

## Ce qui reste

Le rapport entre ce poste et la voiture. C'est la seule inconnue, et elle décide
du domaine réel : si la Tesla est trois fois plus lente, le direct tient jusqu'à
un bicylindre ; si elle l'est huit fois, il ne tient pour rien.

## Critères d'acceptation

- [x] La charge processeur est relevée avant la mesure : 6,2 %, jeu arrêté
- [x] Le coût par cylindre est chiffré, pas déduit : 0,065 s par cylindre et par
      seconde de son, à 10 kHz
- [x] Le seuil de ×3 est confronté à chaque taille de moteur
- [x] La conclusion dit jusqu'à combien de cylindres le mode natif tient : quatre
      à cinq sur ce poste, reste à connaître le rapport avec la voiture
- [ ] 🧑 Relevé fait dans la voiture pour au moins un moteur, afin de connaître
      le rapport entre le poste et l'appareil réel
