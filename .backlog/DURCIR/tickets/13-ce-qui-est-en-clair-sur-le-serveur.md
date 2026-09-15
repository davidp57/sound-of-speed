# 13 — Ce qui est en clair sur le serveur

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Les traces sont des positions relevées au fil d'un trajet : c'est la donnée
sensible du projet, bien plus qu'un réglage de son. Personne n'a encore regardé
ce que ça implique.

Ce ticket rend un **verdict écrit** : ce qui est stocké et sous quelle forme, qui
peut lire la base sur la machine qui sert, ce qu'emporte une sauvegarde, et ce
qu'un chiffrement au repos achèterait réellement quand c'est le même serveur qui
tiendrait la clé.

L'issue peut très bien être « on ne chiffre pas ». Elle doit alors être écrite
avec son raisonnement, pour ne pas se reposer tous les six mois.

## Critères d'acceptation

- [ ] Le verdict dit ce qui est stocké et sous quelle forme, sans rien omettre.
- [ ] Il dit qui peut lire ces données en dehors de l'application, sauvegardes
      comprises.
- [ ] Il tranche, et le raisonnement est écrit — pas seulement la conclusion.
- [ ] Ce qui est décidé et demande du code part en ticket ; ce qui est décidé et
      n'en demande pas est écrit dans la documentation de référence.
