# 08 — La télémétrie se lit d'un coup d'œil en roulant

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La télémétrie reste ouverte à tous et lisible en roulant : lire n'est pas
régler, et un écran sans champ modifiable ne présente pas le risque que la garde
couvre. C'est aussi le seul endroit où l'on voit ce que le GPS donne vraiment
pendant un trajet.

Mais ses dix sections ne se lisent pas au volant. Quatre valeurs montent en
haut, **agrandies** :

- la précision annoncée, en mètres — le défaut numéro un, les 9 999,99 m de
  l'essai du 11 septembre ;
- le temps depuis la dernière mesure — il dit si le GPS s'est tu ;
- la vitesse lissée et la vitesse brute côte à côte — leur écart dit si le
  conditionneur suit ;
- l'état du son.

Elles répondent à la seule question qu'on se pose en roulant : est-ce que ça
marche, et sinon où ça casse. Le régime et le rapport n'y sont pas — ils sont
sur les cadrans, à un onglet de là.

Tout le reste passe dessous, à sa taille actuelle, dans un repli libellé
« avancé — à lire à l'arrêt ». C'est un avertissement, pas un verrou : il
s'ouvre quand on le touche.

## Critères d'acceptation

- [ ] Les quatre valeurs de santé se lisent en haut, agrandies, sans faire
      défiler
- [ ] Le reste est replié derrière un libellé qui prévient
- [ ] Le repli s'ouvre et se ferme sans rien verrouiller
- [ ] L'écran reste ouvert en roulant, quel que soit l'appareil
- [ ] Aucune valeur n'a disparu : ce qui était affiché l'est toujours, ailleurs
