# 04 — Le panneau d'étalonnage manuel s'en va

**Statut :** ✅ fait

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

- [x] L'écran d'étalonnage n'existe plus, ni son onglet
- [x] Rejouer un trajet capturé reste possible depuis le second niveau
- [x] L'étalonnage automatique fonctionne comme avant : le profil mesuré se
      propose et s'applique
- [x] Le code du cœur devenu inutile est retiré, et les tests de ce qui sert
      encore passent sans modification
- [x] Le contrôle qualité est vert, sans import mort ni export inutilisé

## Ce qui a été fait, et ce qui ne l'a pas été

547 lignes d'écran retirées, et neuf exports de `src/state.ts` avec elles :
l'enregistrement et l'arrêt d'une trace, le rejeu d'une trace, le compte de
relevés, l'erreur de stockage, l'étape d'étalonnage en cours, la pose d'une
session, la recopie d'un réglage mesuré, et le mode avancé devenu sans objet au
ticket 01. L'enregistreur de traces et la mise en file d'une trace partent avec.

**Rien n'a été supprimé dans `core/calibration/`**, et c'est le résultat d'une
vérification, pas d'une prudence : les quatre modules qu'on pouvait croire liés
au panneau — `analyze`, `protocol`, `suggest`, `settings` — servent tous à la
mesure automatique, par `onboard`, `braking`, `from-aggregate` et `segments`.

Les 1 585 tests passent sans qu'aucun ait été touché.

Le morceau principal descend à 97,5 ko compressés.
