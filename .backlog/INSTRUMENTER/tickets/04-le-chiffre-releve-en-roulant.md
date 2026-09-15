# 04 — Le chiffre, relevé en roulant

**Statut :** 🧑 attend David — le code du ticket 01 est livré

**Bloqué par :** plus rien — les trois autres tickets sont livrés le 15 septembre
2026.

## Ce qu'il faut obtenir

**La réponse à la question qui a déclenché ce lot.** Rien à coder : un trajet, le
chiffre lu, et la conclusion que le lot [MOUVEMENT](../../MOUVEMENT/spec.md)
dicte. Ce ticket passe à 🧑 dès que le 01 est livré, et il ne peut pas être fait
par un agent.

Ce qu'on cherche, dans l'ordre :

1. **Le bruit du récepteur de la voiture**, lu en télémétrie en roulant à allure
   tenue — c'est là qu'il se mesure le mieux, une allure qui varie mêlant le
   mouvement au bruit.
2. **Sa stabilité** : le même chiffre en ville et sur voie rapide, ou non. Un
   récepteur qui se dégrade sous les arbres ne se corrige pas de la même façon
   qu'un récepteur uniformément bruyant.
3. **Ce que le journal en garde** : le chiffre doit se retrouver dans les relevés
   déposés, sans avoir eu à activer la remontée de la conduite.

## Ce que la mesure conclut

| Bruit relevé | Ce que ça veut dire |
|---|---|
| jusqu'à 1,5 km/h | La marge mesurée au banc tient. La boîte n'oscille pas, et MOUVEMENT est clos. |
| entre 1,5 et 1,75 | La marge est épuisée. À surveiller, et l'essai de MOUVEMENT tranchera à l'oreille. |
| au-delà de 1,75 | La boîte oscille encore en roulant. MOUVEMENT n'est pas fini, et le lot suivant s'écrit à partir de ce chiffre. |

## Critères d'acceptation

- [ ] Un trajet est roulé et le bruit relevé, à allure tenue.
- [ ] La valeur est comparée aux seuils ci-dessus, et la conclusion est écrite
      dans la spécification du lot.
- [ ] Le chiffre est retrouvé dans un relevé déposé, au cran « Le minimum ».
- [ ] Si la mesure varie fortement d'un environnement à l'autre, l'écart est
      consigné — une valeur unique le cacherait.
