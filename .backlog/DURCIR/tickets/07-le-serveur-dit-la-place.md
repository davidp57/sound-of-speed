# 07 — Le serveur dit la place sur chaque dépôt

**Statut :** ✅ fait — vérifié contre un serveur qui tourne : `libre` à 700 ko, `bientot` à 800 ko sur 1 Mio, 507 au-delà

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Chaque réponse à un dépôt dit où en est le compte. La voiture en envoie un toutes
les cinq minutes : l'information arrive donc toute seule, sans qu'on ajoute une
requête ni un sondage, et l'application peut réagir à n'importe quel moment.

Trois en-têtes sur la réponse, le code restant `201` :

```
Speed-Place: libre | bientot
Speed-Place-Octets: 190840832
Speed-Place-Plafond: 262144000
```

`bientot` dès que le compte dépasse **75 %** de son plafond. Le troisième état,
`rotation`, arrive avec le ticket 08 : on ne l'annonce pas avant qu'il veuille
dire quelque chose.

**Un code HTTP par état a été écarté** : le client teste `response.ok` et traite
tout le reste comme un échec, un proxy inversé peut normaliser un code inhabituel,
et le jeu d'accord fige déjà `201` sur un dépôt réussi — le changer casserait le
contrat pour un serveur plus ancien.

Le seuil est **en dur**, nommé dans le code : pas une variable de pile de plus
tant que rien ne demande à le bouger.

Rien ne change à l'écran. Ce ticket se démontre d'un `curl -D -`.

## Critères d'acceptation

- [x] Un dépôt accepté porte les trois en-têtes, et le code reste `201`.
- [x] `Speed-Place` vaut `libre` sous 75 % du plafond, `bientot` au-delà.
- [x] Les octets annoncés sont ceux que le compte pèse vraiment, plafond
      particulier compris quand la régie en a posé un.
- [x] La mesure ne rend pas le dépôt sensiblement plus coûteux : elle est déjà
      faite pour le plafond, et ne doit pas être refaite une seconde fois.
- [x] Le jeu de requêtes d'accord vérifie les en-têtes contre un serveur qui
      tourne.
- [x] Un client qui ne les lit pas ne voit aucune différence.
- [x] Contrôle qualité vert.
