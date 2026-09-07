# 07 — le décor qui défilait est retiré

**Statut :** ✅ fait

**Bloqué par :** aucun

> **Suite, le 7 septembre 2026.** Le décor ne reviendra pas : le lot
> [DECOR-PERSPECTIVE](../../DECOR-PERSPECTIVE/spec.md) est abandonné, et
> l'exception à la règle « aucune animation » est retirée de `CLAUDE.md`. Ce qui
> suit reste écrit tel qu'il l'était le 4 septembre, quand la refonte était
> encore prévue.

## Ce qu'il faut obtenir

Le décor derrière les cadrans ne s'affiche plus, et son bouton non plus. Il
reviendra, autrement.

Il défilait **de côté**, comme un jeu de plateforme, là où l'écran est vu depuis
la place du conducteur : un décor y défile en perspective, d'avant en arrière,
et se rapproche. Le rendu latéral n'est pas un réglage à corriger, c'est un
autre dessin — la refonte fait l'objet du lot
[DECOR-PERSPECTIVE](../DECOR-PERSPECTIVE/spec.md).

Retiré plutôt que caché derrière un bouton coupé : un décor faux qu'on peut
activer par erreur ne vaut pas mieux qu'un décor faux. Et le garder en place
laisserait croire qu'il sert de base à la refonte, alors qu'il n'en sert pas.

Le composant est supprimé, sa préférence d'appareil avec. L'ancien code reste
dans l'historique, au commit qui l'a introduit.

## Ce qui n'est pas remis en cause

L'exception à la règle « aucune animation », levée par David le 3 septembre 2026
pour ce seul décor, **tient toujours** : le lot est reporté, pas abandonné. La
note de `CLAUDE.md` le dit.

La mesure qui l'avait autorisée reste vraie et servira à la refonte : sur la
même trace rejouée, l'écart de durée d'image entre décor coupé et décor actif
était de 0,2 ms, plus petit que l'écart de passe à passe du même état, et aucune
image ne dépassait 33 ms. Un rendu en perspective coûtera davantage, et la
mesure sera à refaire.

## Critères d'acceptation

- [x] Le bouton **Paysage** n'existe plus sur l'écran de conduite.
- [x] Aucun décor ne s'affiche derrière les cadrans.
- [x] Ni code mort ni préférence orpheline : le composant, l'import, la clé de
      stockage et les deux fonctions d'état sont retirés.
- [x] Le README ne décrit plus un bouton qui n'existe pas.
