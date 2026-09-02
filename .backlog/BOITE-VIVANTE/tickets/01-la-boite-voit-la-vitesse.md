# 01 — La boîte reçoit l'accélération

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La boîte reçoit un objet d'entrée plutôt que cinq paramètres positionnels, et cet
objet porte l'**accélération**. Aucun changement de comportement : à la fin de ce
ticket, la boîte décide exactement comme avant.

C'est un préalable, pas une amélioration. Les trois règles qui suivent ont
besoin de l'accélération, et un sixième paramètre positionnel rendrait l'appel
indéchiffrable. Le moteur a déjà un `EngineInput` ; la boîte aura un
`GearboxInput`, ce qui aligne les deux pièces au lieu de les faire diverger.

Fait d'abord et séparément pour que les tickets suivants se lisent : un
déplacement de signature mêlé à un changement de comportement donne un diff
qu'on ne peut plus relire.

## Critères d'acceptation

- [x] `tick` prend `(dt, input)` où `input` porte le régime par rapport, l'arrêt,
      la charge, la vitesse et l'accélération en m/s²
- [x] L'assemblage passe l'accélération déjà conditionnée, celle qui pilote la
      charge du moteur — pas une seconde estimation
- [x] Les 25 tests de la boîte passent sans qu'aucune assertion ne change : seul
      leur appel est réécrit
- [x] Aucune décision de la boîte ne dépend encore de l'accélération
