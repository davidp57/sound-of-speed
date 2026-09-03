# 01 — Un cadran de régime, à la place de la réglette

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le régime se lit sur un cadran à aiguille, et non plus sur un nombre accompagné
d'une réglette.

La justification est celle de la règle qui interdit les animations, et non son
contraire : un cadran se lit d'un coup d'œil là où un nombre se lit en le lisant,
et une aiguille dit la **tendance** — ça monte, ça retombe — qu'un chiffre ne
donne qu'en le comparant de mémoire au précédent. Le mouvement de l'aiguille
**est** la valeur ; ce n'est pas du mouvement pour le plaisir.

La zone rouge du rupteur se voit sans lire de chiffre, ce qui est tout l'intérêt
d'un cadran.

Le nombre reste affiché, en petit : il sert au réglage et au diagnostic.

Aucune inertie ajoutée à l'aiguille. Elle suit le régime, qui est déjà lissé par
le conditionnement et le moteur — en rajouter la ferait mentir.

## Critères d'acceptation

- [ ] Le régime se lit sur un cadran, avec le nombre en second
- [ ] La zone du rupteur est visible sans lire de valeur
- [ ] L'aiguille suit le régime sans inertie propre
- [ ] Le cadran reste lisible en plein soleil et en mode plein écran
- [ ] Aucune régression de cadence : la mesure de durée d'image est inchangée
- [ ] 🧑 Vérifié en roulant : le cadran se lit d'un coup d'œil, sans quitter la
      route longtemps
