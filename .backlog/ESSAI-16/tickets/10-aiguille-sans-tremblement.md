# 10 — L'aiguille ne montre jamais le tremblement

**Statut :** ⬜ prêt — demande un arbitrage

Trouvé en instruisant le ticket 09. Le tremblement vit dans une grandeur à part,
`audibleRpm`, et le commentaire du moteur est explicite : il « n'atteint ni la
boîte, ni la télémétrie, ni les seuils de passage » (`core/engine/engine.ts`).

Le compteur affiche donc `rpm`, le régime net — 800 pile au ralenti, quoi que
fasse le son. Quand David dit « le moteur est à 800 rpm stables », c'est d'abord
cela qu'il voit, avant même l'amputation du ticket 09.

## Ce qui est bien séparé, et ce qui ne l'est pas

Que le tremblement n'atteigne ni la boîte ni les seuils est juste : une décision
de passage ne doit pas dépendre d'un frémissement décoratif, et un seuil franchi
par le tremblement produirait des passages parasites.

Mais l'**aiguille** ne relève pas de la même règle. Sur une vraie voiture, le
compte-tours frémit au ralenti : c'est même le signe qu'un moteur tourne.

## L'arbitrage à rendre

- **L'aiguille suit `audibleRpm`** — le cadran frémit comme un vrai, la boîte
  garde le régime net. Ce n'est pas une animation décorative au sens de la règle
  du dépôt : le mouvement **est** la valeur, exactement l'argument qui fonde
  l'exception des aiguilles dans `CLAUDE.md`.
- **On ne touche à rien** — le cadran reste lisible d'un coup d'œil, ce qui est
  la raison d'être de la règle « aucune animation ». Un frémissement permanent
  dans le coin de l'œil en conduisant peut fatiguer.
- **L'aiguille frémit, le nombre ne bouge pas.** Le chiffre sous le cadran reste
  le régime net, donc lisible ; seule l'aiguille vit. C'est la voie moyenne, et
  elle demande de vérifier que les deux ne se contredisent pas visiblement.

Ma recommandation : la troisième. Elle donne le signe de vie sans rendre un
nombre illisible, et elle ne demande aucun réglage nouveau.

## Critères d'acceptation

- [ ] L'arbitrage est rendu par David.
- [ ] Si l'aiguille bouge, le README dit laquelle des deux grandeurs chaque
      élément du cadran affiche.
- [ ] La boîte et ses seuils continuent de travailler sur le régime net.
