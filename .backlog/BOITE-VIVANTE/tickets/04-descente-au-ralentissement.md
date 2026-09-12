# 04 — Descendre pour ralentir

**Statut :** ✅ fait

**Bloqué par :** 01 — La boîte reçoit l'accélération

## Ce qu'il faut obtenir

Un freinage franc fait descendre la boîte, plus tôt qu'un lever de pied. Le
rétrogradage retrouve ainsi la moitié de son métier : aider à ralentir, et pas
seulement rattraper un régime tombé trop bas.

Aujourd'hui un seul seuil de régime décide, le même dans les deux cas — sous
1820 tr/min sur Route. Les descentes tombent donc toujours aux mêmes vitesses,
85, 71, 59 et 45 km/h, qu'on lève le pied doucement ou qu'on freine fort.

Quand l'accélération reste sous −0,8 m/s² pendant une seconde, descendre d'un
rapport tant que le rapport visé reste sous 0,85 du rupteur — et recommencer à
mesure que la vitesse tombe, comme une vraie boîte sous freinage.

## Critères d'acceptation

- [x] Un freinage soutenu fait descendre plus tôt, en vitesse, qu'un simple
      lever de pied — c'est une comparaison entre deux trajectoires
- [x] Un freinage prolongé fait descendre les rapports en cascade
- [x] Une décélération douce ne déclenche pas la règle : le seuil de régime
      ordinaire s'en charge, comme avant
- [x] Le rapport visé ne dépasse jamais le plafond déclaré, quelle que soit la
      violence du freinage
- [x] Un freinage bref n'y suffit pas : la durée compte
- [x] La règle respecte l'amorce de lancement — la première n'est pas engagée
      par elle
- [x] Un réglage nouveau à l'écran de configuration, avec sa ligne dans la
      « Référence des réglages » du README
