# 04 — Le panneau d'étalonnage manuel s'en va

**Statut :** ⬜ prêt

**Bloqué par :** 02 — Le simulateur et le sélecteur de source rejoignent le
second niveau, hors voiture

## Ce qu'il faut obtenir

Le panneau d'étalonnage manuel disparaît, avec son protocole en six étapes et
son code devenu inutile. Le serveur étalonne tout seul depuis les trajets
ordinaires, et l'écran de conduite propose déjà le profil mesuré quand il y a de
quoi conclure.

**Ce qui n'est pas perdu, et qu'il faut vérifier avant de supprimer.** Le panneau
portait aussi l'enregistrement et le rejeu des traces. La capture du trajet
démarre seule au démarrage du GPS et se dépose par tranches ; le rejeu se pilote
depuis la télémétrie et se choisit par le sélecteur de source, qui vit désormais
au second niveau. Ce qui disparaît vraiment est le déclenchement manuel d'une
trace et la liste locale des traces.

**Le code du cœur ne se supprime pas en bloc.** Une partie du dossier
d'étalonnage sert à la mesure automatique et doit rester. Ce ticket n'est fini
que lorsque ce qui ne sert plus a été retiré et que ce qui sert encore est
intact.

## Critères d'acceptation

- [ ] L'écran d'étalonnage n'existe plus, ni son onglet
- [ ] Rejouer un trajet capturé reste possible depuis le second niveau
- [ ] L'étalonnage automatique fonctionne comme avant : le profil mesuré se
      propose et s'applique
- [ ] Le code du cœur devenu inutile est retiré, et les tests de ce qui sert
      encore passent sans modification
- [ ] Le contrôle qualité est vert, sans import mort ni export inutilisé
