# 08 — Dire quand ça bouge, et reprendre ce qu'on avait refusé

**Statut :** 🧑 attend David — livré, reste l'essai en roulant

**Bloqué par :** 07 — il faut une couche appliquée pour signaler qu'elle change.

## Ce qu'il faut obtenir

Deux choses qui vont ensemble, parce qu'elles répondent au même besoin : garder
la main sur une couche qui s'affine toute seule.

**Le signalement.** Une fois acceptée, la couche se met à jour sans rien
demander — l'accord vaut pour la suite, et on ne redemande pas douze fois par
trajet. Mais quand une mesure se déplace de plus de **20 %**, un bandeau le dit,
sans rien demander. On sait alors que le son a changé, et pourquoi : pneus
d'hiver, voiture chargée, quelqu'un d'autre au volant.

Les 20 % sont un point de départ, réglable. Le défaut est assumé : vingt pour
cent sur un freinage et vingt pour cent sur une vitesse tenue ne s'entendent pas
pareil.

**La reprise.** Un bouton **Appliquer maintenant** en Configuration, avec le
nombre de trajets qui le fondent. C'est le rattrapage d'un « plus tard », pas un
export : on n'emporte pas de fichier, on applique ce qui attend.

## Critères d'acceptation

- [x] La couche acceptée se met à jour sans rien demander.
- [x] Un écart de plus de 20 % sur une mesure est signalé, en nommant la mesure
      et son déplacement.
- [x] Le seuil est un réglage, pas une constante enfouie.
- [x] Le bouton « Appliquer maintenant » applique la dernière couche disponible,
      et dit sur combien de trajets elle repose.
- [x] Contrôle qualité vert.
