# 01 — Découvrir les banques présentes

**Statut :** ✅ fait

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

- [x] Une fonction rend les banques présentes, avec le nombre de fichiers audio
      de chacune
- [x] Un dossier `/audio/` absent rend une liste vide, sans erreur
- [x] Un listage illisible rend une liste vide, sans erreur
- [x] Les fichiers déposés à la racine de `/audio/` sont ignorés : une banque
      est un dossier
- [x] Couvert par des tests, listage simulé, comme `library.ts`

## Ce qui a été fait

`core/audio/banks.ts` rend les banques triées par nom, chacune avec ses fichiers
audio. Huit tests couvrent le listage simulé, le dossier absent, le listage
illisible, les fichiers égarés à la racine et la banque dont le contenu ne se
lit pas — celle-là reste dans la liste, vide : son dossier existe, c'est son
contenu qu'on ignore.

**Une ligne de configuration a bien été nécessaire côté serveur**, contrairement
à ce que ce ticket annonçait : `/audio/` était servi sans `autoindex`, et rendait
donc un 403 sur un dossier. La règle ajoutée ne prend que les adresses qui se
terminent par une barre, et coupe le cache d'une semaine du bloc parent — une
banque déposée doit apparaître tout de suite. Elle n'est pas protégée par mot de
passe, à la différence des quatre dossiers de dépôt : les échantillons se
chargent déjà sans compte.

**Vérifié sur les trois banques présentes en local** (`i4-check`, `procar`,
`v8-crossplane`), à travers le serveur de développement, qui liste désormais
`public/audio/` de la même façon — sans quoi la découverte ne se serait
vérifiée qu'après un déploiement. **Non vérifié : la configuration nginx
elle-même**, aucun docker n'étant installé sur ce poste. Elle se lira au premier
déploiement de `develop`.
