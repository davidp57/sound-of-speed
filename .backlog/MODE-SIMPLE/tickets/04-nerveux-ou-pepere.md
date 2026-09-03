# 04 — Un curseur « nerveux ↔ pépère », la réactivité du signal

**Statut :** ⬜ prêt

**Bloqué par :** 03 — Un curseur « calme ↔ sportif », en continu

## Ce qu'il faut obtenir

Un second curseur global, distinct du premier, qui règle la **réactivité** et non
le caractère : raideur du lissage, fenêtre d'accélération, lissage de la charge,
temporisations de passage.

La distinction est réelle et il faut qu'elle s'entende : le premier curseur dit
si la voiture pousse fort, celui-ci dit si elle répond vite. Une voiture calme
peut être vive, une voiture sportive peut être pâteuse.

Le compromis est celui du conditionnement du signal, et il n'est pas
supprimable : nerveux suit au plus près et laisse passer le bruit du GPS, pépère
est lisse et en retard. Les deux extrêmes doivent rester utilisables.

Ce curseur touche le signal de vitesse, dont le lot
[PENTE](../../PENTE/spec.md) a montré que la mesure dépend beaucoup de
l'appareil : ses bornes se choisissent après avoir vérifié la cadence réelle du
GPS de la voiture.

## Critères d'acceptation

- [ ] Le curseur change la réactivité sans toucher au caractère réglé par le 03
- [ ] Au plus nerveux, la vitesse reste continue : aucune marche audible
- [ ] Au plus pépère, le retard reste supportable en conduite
- [ ] Les deux curseurs se combinent sans produire de profil injouable
- [ ] 🧑 Vérifié en roulant : les deux extrêmes s'entendent, et se distinguent du
      curseur de caractère
