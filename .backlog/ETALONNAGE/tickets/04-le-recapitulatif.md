# 04 — Le récapitulatif : mesuré face à réglé

**Statut :** ⬜ prêt

**Bloqué par :** 02 — Distinguer lever le pied d'un freinage ; 03 — Ville,
route, autoroute : ce qu'on fait vraiment

## Ce qu'il faut obtenir

Un écran unique qui met côte à côte, pour chaque réglage concerné, la valeur
**mesurée** et la valeur **du profil** — et qui laisse recopier l'une vers
l'autre, réglage par réglage.

Sans lui, l'étalonnage produit des chiffres épars qu'il faut retenir en passant
d'un écran à l'autre, ce qui ne se fait pas dans une voiture.

Une session incomplète reste utile : ce qui n'a pas été mesuré est marqué comme
tel, jamais estimé ni laissé vide sans explication. Chaque étape vaut
séparément, parce qu'un freinage franc ne se commande pas au milieu du trafic.

**Elle propose, elle n'applique pas** — sauf sur un geste explicite, réglage par
réglage, jamais en bloc. Le lot [ORIGINE](../../ORIGINE/spec.md) donne le
filet : un profil sait revenir à ce qu'il était.

## Critères d'acceptation

- [ ] Toutes les valeurs mesurées de la session sont sur un seul écran
- [ ] Chaque ligne montre le mesuré, le réglé, et l'écart entre les deux
- [ ] Ce qui n'a pas été mesuré est dit non mesuré
- [ ] Un réglage se recopie individuellement, jamais tout en bloc
- [ ] Après recopie, le profil sait revenir à ce qu'il était
- [ ] Le récapitulatif se relit sur une session enregistrée plus tôt
