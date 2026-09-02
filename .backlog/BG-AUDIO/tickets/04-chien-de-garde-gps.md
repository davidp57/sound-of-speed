# 04 — Relancer le suivi GPS quand il se tait

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Quand la dernière mesure GPS date de plus de vingt secondes alors qu'on roule, le
suivi est relancé. Sans cela, le son tiendra en arrière-plan mais restera figé
sur la dernière vitesse connue — ce qui est pire que le silence, parce que rien
ne le signale.

Deux contraintes de conception :

- **pas de minuteur.** Un `setInterval` est gelé en arrière-plan, précisément
  là où le chien de garde sert. Il est donc interrogé à chaque tour de boucle,
  laquelle continue de battre grâce à l'horloge du fil audio ;
- **pas plus d'une relance toutes les cinq secondes**, sinon un GPS réellement
  indisponible serait relancé soixante fois par seconde.

La pièce vit dans `core/` et ne connaît que des nombres : elle est ainsi
vérifiable sans navigateur, contrairement à tout le reste de ce lot.

## Critères d'acceptation

- [x] Un silence de plus de vingt secondes déclenche une relance
- [x] Un silence plus court n'en déclenche aucune
- [x] Deux relances ne peuvent pas se suivre à moins de cinq secondes
- [x] Aucune relance quand la source n'est pas le GPS — simulateur et rejeu ne
      se relancent pas
- [x] Aucune relance quand le suivi est à l'arrêt
- [x] Le compteur de relances est visible dans le bloc « arrière-plan »
- [x] La pièce est couverte par des tests, y compris ses cas limites
