# 01 — Découvrir les banques présentes

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'application sait dire quelles banques sont déposées sur le serveur, et
combien de fichiers chacune contient.

Le mécanisme existe déjà : `library.ts` obtient la liste des profils déposés sur
le NAS par le listage JSON que nginx sait produire, et il **écarte** les entrées
de type `directory`. Il suffit de faire l'inverse sur `/audio/`. Rien à ajouter
côté serveur, aucune base, et la protection reste celle qui garde déjà l'accès
au site.

Un dossier absent ou un serveur qui ne sait pas lister ne sont pas des erreurs :
l'application retombe sur le nom déclaré par le profil, comme aujourd'hui.

## Critères d'acceptation

- [ ] Une fonction rend les banques présentes, avec le nombre de fichiers audio
      de chacune
- [ ] Un dossier `/audio/` absent rend une liste vide, sans erreur
- [ ] Un listage illisible rend une liste vide, sans erreur
- [ ] Les fichiers déposés à la racine de `/audio/` sont ignorés : une banque
      est un dossier
- [ ] Couvert par des tests, listage simulé, comme `library.ts`
