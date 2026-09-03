# 01 — Remesurer, et dire si le lot vaut encore

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite — mais n'a de sens qu'après
avoir roulé avec [PENTE](../../PENTE/spec.md)

## Ce qu'il faut obtenir

Une décision écrite : ce lot garde-t-il sa raison d'être ?

La spécification a été écrite en croyant tenir la cause du reproche « les
accélérations douces sont trop silencieuses ». Ce n'était pas elle : à la cadence
réelle du GPS, une reprise de 0,55 m/s² était vue à zéro, et la charge faisait
son travail sur un signal nul. Tous les niveaux du tableau de la spec ont donc
été relevés sur une accélération fausse.

Il reste un défaut mesuré, indépendant de celui-là : **la croisière est plate**.
Tenir 50 km/h et tenir 130 donnent la même charge, donc le même niveau et le même
timbre, alors que l'un ne demande rien et l'autre beaucoup.

Ce ticket refait le tableau des niveaux avec une accélération correctement
mesurée, et conclut : soit le contraste restauré suffit et le lot se réduit à ce
seul défaut de croisière — peut-être trop peu pour un lot —, soit l'écart reste
insuffisant et le lot continue.

## Critères d'acceptation

- [ ] Le tableau des niveaux est refait sur la version qui corrige la pente
- [ ] L'écart mesuré entre une reprise douce à haute vitesse et la croisière à la
      même vitesse est chiffré
- [ ] L'écart entre cette reprise et le pied levé est chiffré
- [ ] La spécification est corrigée de ses chiffres périmés
- [ ] La conclusion est écrite : le lot continue, se réduit, ou s'abandonne
- [ ] 🧑 Confirmé en roulant : une reprise douce s'entend, ou ne s'entend toujours
      pas
