# 02 — La compensation là où le déficit se mesure

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Chaque prise « pied levé » est rattrapée de son propre déficit, et non d'un
facteur commun à toute la famille.

Mesuré avec ffmpeg sur la banque livrée : `off-low` est 9,6 dB plus faible que
`on-low`, `off-high` 6,5 dB plus faible que `on-high`. Ils recevaient tous deux
+12,4 dB — gain de couche ×1,3 et `offLoadGain` ×3,2 — soit 2,8 dB de trop pour
l'un et 5,9 dB pour l'autre. C'est ce qui rendait le lever de pied plus fort que
la pleine charge.

Les gains des couches `on` ne bougent pas : l'écart de 4,8 dB entre la prise bas
régime et la haute est ce qui fait rugir le moteur dans les tours, et c'est
apprécié.

`offLoadGain` reste, mais neutre : il devient un curseur de goût sur toute la
famille.

## Critères d'acceptation

- [x] Le gain de chaque couche « pied levé » rattrape son déficit mesuré —
      ×3,0 pour la basse, ×2,1 pour la haute
- [x] Les gains des couches « en charge » sont inchangés
- [x] `offLoadGain` vaut 1 dans les deux profils livrés, et son infobulle dit ce
      qu'il fait désormais
- [x] Un test vérifie que la compensation vit dans les couches et non dans le
      facteur commun
