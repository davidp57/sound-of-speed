# 01 — Le contrat avec le client est figé avant qu'on touche au serveur

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Un jeu de requêtes qui décrit **ce que le serveur d'aujourd'hui rend**, rejouable
contre n'importe quelle implémentation. Il passe sur nginx — par construction,
puisqu'il en est tiré — et il devient le juge du serveur neuf.

C'est le premier ticket parce que c'est le seul filet qui existera. Les tests du
dépôt tournent sur les sources et ne voient rien de ce que le serveur rend ; le
12 septembre 2026, une image cassée est passée à travers une PR entièrement
verte pour cette raison exacte.

## Ce que le relevé a trouvé, et qui ne se devine pas

Vingt-deux requêtes distinctes, et quatre contraintes qu'une réécriture casserait
sans bruit :

- **La forme du listage** est celle de l'autoindex JSON de nginx, un tableau
  d'entrées `{ name, type }` où `type` vaut `directory` ou `file`. Quatre modules
  du cœur s'y appuient, le service worker distingue un listage d'un échantillon
  **à la seule barre oblique finale**, et la configuration de développement
  l'émule déjà.
- **Deux types MIME sont obligatoires** : sans `application/wasm`, le chargement
  du moteur simulé échoue ; sans un type JavaScript, son module ne s'importe pas.
- **Les codes portent du sens** : 401 et 403 disent « refusé », et le client
  n'essaie pas de rejouer ; 413 non plus ; un 404 sur un dossier de données est
  une situation **normale**, pas une panne.
- **Le repli d'application à page unique ne doit pas manger les chemins de
  données.** Quand il le fait, le client reçoit du HTML là où il attend du JSON,
  et le traite comme « illisible » — le cas est déjà connu et contourné.

## Critères d'acceptation

- [ ] Le jeu de requêtes couvre les vingt-deux appels relevés : lectures
      publiques, listages, lectures authentifiées, dépôts, et les deux types MIME
- [ ] Il vérifie les **codes** attendus, et pas seulement le succès : le refus
      non rejouable, la charge refusée, le dossier absent
- [ ] Il vérifie qu'un chemin de données absent rend un vrai 404, et non la page
      d'application
- [ ] Il se lance contre une adresse quelconque, donc contre les deux serveurs
- [ ] Il tourne dans l'intégration continue, contre l'image d'aujourd'hui
- [ ] Un contributeur comprend, en le lisant, ce que le serveur doit rendre —
      c'est la seule description exécutable de ce contrat
