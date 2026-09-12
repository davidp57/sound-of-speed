# 02 — Un manifeste, trois dossiers, et une frontière qui tient toute seule

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Le cœur partagé, l'interface et le serveur vivent côte à côte sous un seul
manifeste. Un `npm install`, un `npm test`, une intégration continue — c'est déjà
ce que le dépôt fait pour le profileur, qui importe cinq modules du cœur.

Et une frontière qui ne repose pas sur la bonne volonté : rien n'empêche
mécaniquement d'importer une pièce de serveur depuis une page, et le jour où ça
arrive, l'application embarque du code de base de données dans le navigateur
d'une voiture.

## Pourquoi un seul manifeste

Dix mille neuf cents des dix-neuf mille lignes du cœur sont partagées entre le
navigateur et le serveur — le format des profils, la lecture des traces,
l'étalonnage — parce que les deux doivent calculer la même chose. Le dépôt a
déjà payé le prix de deux implémentations d'une même notion : deux lectures de
« est-ce qu'on ralentit ? » se contredisent depuis le 8 septembre. On ne
recommence pas à cette échelle.

## Critères d'acceptation

- [x] Un seul manifeste à la racine ; le cœur, l'interface et le serveur sont
      trois dossiers de sources
- [x] Une seule installation, une seule commande de test, une seule intégration
- [x] Le contrôle qualité passe à l'identique, sans qu'aucun test ait eu à
      changer de sens
- [x] Un contrôle automatique refuse qu'une pièce de serveur soit importée depuis
      l'interface ou depuis le cœur, sur le modèle de celui qui garde déjà le
      cœur de toute dépendance à Vue
- [x] Ce contrôle **échoue** quand on écrit exprès l'import qu'il doit interdire
      — un garde qu'on n'a pas vu refuser ne garde rien

## Ce que la réalisation a précisé

**Le manifeste unique existait déjà.** Une seule installation, une seule commande
de test, une seule intégration : le dépôt le faisait pour le profileur depuis sa
naissance. Ce qui manquait, c'était la **place** du serveur et la **frontière**.

**Le profileur est la première pièce de `src/server/`.** Il y était déjà par
nature — il tourne sous Node, il importe cinq modules du cœur, et son fichier de
construction dit que c'est sa raison d'être. Il ne déménage pas, il rentre chez
lui.

**Trois frontières plutôt qu'une.** L'invariant connu — le cœur n'importe pas
Vue — en appelait deux autres dès que le serveur prenait sa place : le cœur ne
doit pas dépendre du serveur, puisqu'il est partagé ; et l'interface non plus,
sous peine d'embarquer un moteur de base de données dans le paquet qu'un
téléphone télécharge.

**Le garde est vérifié par neuf tests** qui écrivent exprès l'import interdit, au
chemin où il est interdit, et exigent le refus. Trois d'entre eux font l'inverse
et exigent que les imports légitimes passent — sans eux, une règle trop large
paraîtrait bonne en interdisant tout.
