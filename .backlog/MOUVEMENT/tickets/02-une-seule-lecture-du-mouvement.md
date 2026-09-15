# 02 — Une seule lecture du mouvement

**Statut :** ⬜ prêt

**Bloqué par :** plus rien — 01 est livré le 15 septembre 2026, et son relevé est
dans la spécification du lot.

## Ce qu'il faut obtenir

**La boîte doit avoir un seul avis sur ce que fait la voiture.** Cinq lectures
décrivent aujourd'hui le même fait — accélère, tient, ralentit — avec cinq
seuils qui ne s'accordent pas et trois formes de mémoire différentes. Le tableau
exact est dans la spécification du lot ; il a été refait le 15 septembre 2026,
PLANCHER ayant emporté deux des lectures d'origine et la relecture du code en
ayant révélé deux autres.

Une seule lecture, calculée à un endroit, avec une **hystérésis explicite** :
elle dit dans quel état on est, et depuis combien de temps. La boîte ne consulte
plus qu'elle. Monter un seuil déplacerait la contradiction sans la lever ; c'est
le nombre de mécanismes qui est le défaut, pas leur réglage.

Le lot FIX-BOITE avait déjà conclu « un compteur, un usage » : son oscillation
venait d'un compteur à deux sens, et la même erreur est revenue deux jours plus
tard sous une autre forme.

Ces compteurs ne sortent pas de la boîte — aucun autre module ne les lit. Le
changement est donc confiné, et il n'y a pas de migration à étaler.

## Critères d'acceptation

- [ ] Une pièce rend l'état du mouvement — accélère, tient, ralentit — et le
      temps passé dans cet état, avec une hystérésis qui s'énonce en une phrase.
- [ ] Elle est vérifiable seule, sans boîte et sans navigateur, sur des suites
      d'accélérations fabriquées.
- [ ] Un état ne bascule pas sur un tremblement de mesure : une sortie brève de
      la bande ne compte pas comme un changement d'allure.
- [ ] La boîte ne consulte plus qu'elle. Les cinq mécanismes concurrents et
      leurs seuils propres ont disparu du code.
- [ ] **La marge de bruit augmente.** Les scènes du ticket 01 tiennent
      aujourd'hui jusqu'à 1,25 km/h de bruit à la cadence de la voiture et
      décrochent à 1,5 ; c'est ce chiffre qu'il faut battre, et non « zéro
      passage », que la boîte actuelle obtient déjà sur un signal réaliste. Le
      relevé de la spécification est mis à jour avec les nouveaux chiffres.
- [ ] Les tests existants de la boîte passent sans être réécrits pour
      s'accommoder du changement — s'ils doivent l'être, la raison est dite.
- [ ] La section « Comment ça marche » du README décrit la lecture unique.
- [ ] Contrôle qualité vert.
