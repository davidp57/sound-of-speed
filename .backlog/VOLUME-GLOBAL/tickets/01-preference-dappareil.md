# 01 — Le volume devient une préférence de l'appareil

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le volume général est rangé à côté du profil choisi et du réglage de son en
arrière-plan : dans le stockage local de l'appareil, hors du profil. C'est lui
que le moteur audio lit.

Il reste sur l'écran de conduite, à sa place — c'est le seul réglage qu'on touche
en roulant — et il survit à un changement de profil : passer de Route à Sport
change la voix, pas le niveau.

**Le niveau déjà réglé ne se perd pas.** Au premier chargement après la mise à
jour, la préférence d'appareil prend la valeur du profil actif. C'est le seul
moment où le champ du profil est encore lu.

Le champ reste présent dans le schéma à ce stade : le retirer est l'objet du 03,
et cet ordre garantit qu'aucune version intermédiaire ne perde le réglage.

## Critères d'acceptation

- [x] Le volume général vit dans le stockage local, hors du profil
- [x] Changer de profil ne change pas le niveau
- [x] Le niveau survit à un rechargement de l'application
- [x] À la première ouverture après la mise à jour, le niveau est celui que
      portait le profil actif
- [x] La reprise ne se rejoue pas au chargement suivant
- [x] Un appareil sans stockage disponible retombe sur une valeur par défaut
      plutôt que sur le silence
