# 02 — Le média de maintien, construit et inséré comme celui qui marche

**Statut :** ✅ fait

**Bloqué par :** 01 — Un fichier de silence réel, servi et long

## Ce qu'il faut obtenir

Le média qui maintient la session audio est un élément du document, et non un
objet détaché : `<audio>` portant un `<source type="audio/mpeg">`, avec `loop`,
`volume = 1`, `preload="auto"`, `playsinline`, masqué par `display:none`, et
ajouté à `document.body`.

C'est l'écart le plus vraisemblable avec Dribe. Un élément jamais inséré dans le
document joue, mais rien ne garantit qu'un navigateur ancien le compte comme une
lecture véritable — et c'est de ce décompte que dépend le droit de continuer en
arrière-plan.

Quand on coupe le maintien, l'élément est arrêté **et** retiré du document :
laisser traîner un lecteur muet servirait à embrouiller le diagnostic suivant.

## Critères d'acceptation

- [x] L'élément est dans `document.body`, masqué, et porte un `<source>` typé
- [x] Il joue le fichier servi, en boucle
- [x] Couper le maintien l'arrête et le retire du document
- [x] Le rallumer en recrée un, sans laisser d'ancien derrière — vérifié dans le
      navigateur : coupé 0, rallumé 1, recoupé 0, re-rallumé 1. Ce critère a
      découvert un défaut au passage : basculer le réglage avant d'activer le son
      créait un média, puis l'activation en créait un second. Détachés du
      document les doublons passaient inaperçus ; insérés, ils auraient brouillé
      le diagnostic. `startKeepAlive` est désormais idempotent, et l'activation
      respecte le réglage au lieu de le forcer
- [x] Le réglage « son en arrière-plan » commande toujours l'ensemble, pour
      pouvoir comparer au volant
