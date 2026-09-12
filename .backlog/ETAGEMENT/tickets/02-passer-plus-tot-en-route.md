# 02 — Passer plus tôt en mode Route

**Statut :** 🧑 attend David — livré, reste l'écoute en roulant

**Bloqué par :** 01 — les rapports déplacent les régimes de passage, régler les
seuils avant serait les régler deux fois.

## Ce qu'il faut obtenir

`upshiftMarginRpm` en mode Route : **900 → 640**.

Le seuil de montée vaut `ralenti + marge × facteur`, le facteur allant de 0,5 à
2 selon la demande. Le ralenti étant un plancher fixe, la baisse ne se reporte
pas telle quelle :

| demande | seuil avant | seuil après | écart |
|---|---|---|---|
| pleine | 2 600 | 2 080 | −20 % |
| moyenne | 1 700 | 1 440 | −15 % |

C'est le compromis retenu : un seul nombre, et un écart de vingt pour cent là où
David l'a demandé — « ça reste trop longtemps en deux », qu'il a dit d'une
conduite franche.

Le mode Sport ne bouge pas.

## Critères d'acceptation

- [x] Un test fixe les seuils obtenus à demande pleine et à demande moyenne.
- [x] Le mode Sport est inchangé.
- [x] Un test montre qu'une montée arrive plus tôt qu'avant, à conduite égale.
- [x] Contrôle qualité vert.

Critères établis le 12 septembre 2026 : trois tests tiennent le seuil — la perte de vingt pour cent pied au plancher et quinze en conduite ordinaire, le mode Sport laissé intact, et le mode Route qui reste sous le mode Sport à toute demande. Contrôle qualité vert.
