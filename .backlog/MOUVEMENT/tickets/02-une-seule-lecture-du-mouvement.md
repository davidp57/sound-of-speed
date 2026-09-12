# 02 — Une seule lecture du mouvement

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le banc de positions fabriquées juge la boîte. C'est lui
qui dit si le remplacement améliore ou dégrade ; sans son relevé, ce ticket se
juge de mémoire.

## Ce qu'il faut obtenir

**La boîte doit avoir un seul avis sur ce que fait la voiture.** Cinq
mécanismes décrivent aujourd'hui le même fait — accélère, tient, ralentit —
avec des seuils qui ne s'accordent pas : la bande de croisière tient l'allure
pour stable jusqu'à −0,1 m/s² quand le compteur ajouté le 8 septembre déclare le
ralentissement dès −0,05. Deux réponses contradictoires à la même question, et
c'est la boîte qui arbitre au hasard de l'ordre des conditions.

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
- [ ] Les scènes du ticket 01 donnent au moins aussi peu de passages qu'avant,
      et le relevé est mis à jour avec les nouveaux chiffres.
- [ ] Les tests existants de la boîte passent sans être réécrits pour
      s'accommoder du changement — s'ils doivent l'être, la raison est dite.
- [ ] La section « Comment ça marche » du README décrit la lecture unique.
- [ ] Contrôle qualité vert.
