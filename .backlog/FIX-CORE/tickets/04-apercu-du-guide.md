# 04 — Annoncer le passage que l'aperçu calcule

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La dernière ligne de l'aperçu du guide de création annonce le passage dont elle
donne la vitesse.

Elle annonce « Passage 2 → 3 » mais s'appuie sur le seuil de régime du premier
rapport et la démultiplication du deuxième : deux rapports différents dans le
même calcul. La vitesse affichée ne correspond donc à aucun passage réel.

Deux issues, à trancher en écrivant : soit annoncer « 1 → 2 » et prendre la
démultiplication du premier rapport, soit garder « 2 → 3 » et prendre le seuil
du deuxième. La seconde est probablement la bonne — la première n'est qu'une
amorce de lancement, son seuil de régime ne sert jamais — mais c'est un détail
d'aperçu, pas une décision d'architecture.

## Critères d'acceptation

- [x] Le libellé et le calcul portent sur le même passage
- [x] La vitesse annoncée correspond à celle où la boîte passe réellement, à
      quelques km/h près, vérifié contre le banc de la boîte
- [x] L'aperçu reste sans terme d'implémentation
- [x] Le test qui constatait l'incohérence a été réécrit
