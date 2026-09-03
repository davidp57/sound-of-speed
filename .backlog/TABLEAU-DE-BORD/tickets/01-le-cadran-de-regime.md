# 01 — Un cadran de régime, à la place de la réglette

**Statut :** 🧑 attend David

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

- [x] Le régime se lit sur un cadran, avec le nombre en second
- [x] La zone du rupteur est visible sans lire de valeur
- [x] L'aiguille suit le régime sans inertie propre
- [ ] Le cadran reste lisible en plein soleil et en mode plein écran
- [x] Aucune régression de cadence : la mesure de durée d'image est inchangée
- [ ] 🧑 Vérifié en roulant : le cadran se lit d'un coup d'œil, sans quitter la
      route longtemps

## Ce qui est mesuré

Durée d'image inchangée : sur une machine tranquille, 6,06 ms de moyenne et
aucune image au-delà de 20 ms, cadrans affichés, sur la même trace rejouée. Le
détail des passes est dans « Ce qui n'est pas vérifié » du README.

Le plein écran est vérifié à quatre tailles — 375 × 812, 812 × 375, 1024 × 700 et
la fenêtre du poste — sans débordement horizontal. **Le plein soleil ne l'est
pas** : il demande d'aller dehors avec le téléphone, et c'est la même sortie que
la vérification en roulant.
