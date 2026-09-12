# 02 — Un manifeste, trois dossiers, et une frontière qui tient toute seule

**Statut :** ⬜ prêt

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

- [ ] Un seul manifeste à la racine ; le cœur, l'interface et le serveur sont
      trois dossiers de sources
- [ ] Une seule installation, une seule commande de test, une seule intégration
- [ ] Le contrôle qualité passe à l'identique, sans qu'aucun test ait eu à
      changer de sens
- [ ] Un contrôle automatique refuse qu'une pièce de serveur soit importée depuis
      l'interface ou depuis le cœur, sur le modèle de celui qui garde déjà le
      cœur de toute dépendance à Vue
- [ ] Ce contrôle **échoue** quand on écrit exprès l'import qu'il doit interdire
      — un garde qu'on n'a pas vu refuser ne garde rien
