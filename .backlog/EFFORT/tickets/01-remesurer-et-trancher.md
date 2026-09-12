# 01 — Remesurer, et dire si le lot vaut encore

**Statut :** ✅ fait — le lot continue, inchangé. Un critère reste ouvert et ne
sera pas tenu ici : le tableau en niveaux acoustiques absolus demande le niveau
efficace de chaque échantillon, et les échantillons vivent dans un volume du NAS.
La spec le dit déjà à sa section « Ce qui n'a pas pu être chiffré, et pourquoi » ;
le critère est laissé décoché plutôt que tenu pour acquis.

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
- [x] L'écart mesuré entre une reprise douce à haute vitesse et la croisière à la
      même vitesse est chiffré
- [x] L'écart entre cette reprise et le pied levé est chiffré
- [x] La spécification est corrigée de ses chiffres périmés
- [x] La conclusion est écrite : le lot continue, se réduit, ou s'abandonne
- [ ] 🧑 Confirmé en roulant : une reprise douce s'entend, ou ne s'entend toujours
      pas

## Conclusion, le 4 septembre 2026

**Le lot continue, sans réduction de périmètre.** Le tableau des charges refait
au banc, sur la version qui corrige la pente et l'accélération, donne 0,50 à
toute vitesse tenue — de l'arrêt à 130 km/h. Le défaut n'était donc pas un
artefact du bruit de mesure, et la solution écrite dans la spec garde sa raison
d'être.

Le tableau des **niveaux en décibels** n'a pas été refait : il demande le niveau
efficace de chaque échantillon, et les échantillons vivent dans un volume du NAS.
Les charges, elles, suffisent à trancher — les niveaux s'en déduisent par le
mixage, qui n'a pas changé.

Relevé aussi : la roue libre à 110 km/h donne 0,07, contre 0,33 dans la spec.
L'écart vient de la correction de l'accélération, qui voit désormais la
décélération réelle au lieu d'un signal bruité. Le contraste entre pied levé et
croisière est donc **déjà** meilleur qu'annoncé, ce qui ne change pas la
conclusion : c'est la croisière qui est plate.

Critères relus le 12 septembre 2026. Les quatre cochés le sont sur la section
« Remesuré le 4 septembre 2026 » de la spec. Le défaut d'horodatage trouvé le
10 septembre ne les périme pas : il touche le navigateur de la voiture, pas les
mesures prises au banc.
