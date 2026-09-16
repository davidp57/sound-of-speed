# 04 — Le suivi se relance toutes les cinquante-deux secondes

**Statut :** ⬜ prêt — à instruire avant de corriger

Relevé dans le journal du 16 septembre. David ne l'a pas signalé comme tel, mais
ses photos le montrent : « Plus aucune position depuis 7 s », « depuis 9 s ».

| Trajet | Durée | Relances du suivi | Positions rejetées |
|---|---|---|---|
| 08:25 | 98 min | **113** | 314 |
| 19:00 | 13 min | 0 | 14 |
| 19:16 | 34 min | 9 | **694** |

Soit une relance toutes les cinquante-deux secondes sur le trajet du matin. Tous
les rejets portent le motif `inaccurate`, et les premiers de la session annoncent
une précision de **9 999,99 m** — une valeur sentinelle, pas une mesure.

## Ce qu'il faut d'abord savoir

Rien n'est tranché ici, et c'est volontaire : on ne sait pas encore si la relance
est le remède qui fonctionne ou le symptôme d'autre chose.

- Ces relances **réparent-elles** quelque chose ? Autrement dit, après une
  relance, les positions reviennent-elles, et en combien de temps ?
- Les 9 999,99 m sont-ils ce que le récepteur annonce vraiment, ou une valeur que
  l'application fabrique quand elle n'a rien ?
- Le rapport entre les deux trajets du soir est inversé — zéro relance pour
  quatorze rejets, neuf relances pour six cent quatre-vingt-quatorze. Qu'est-ce
  qui les sépare ?

Le lot [INSTRUMENTER](../../INSTRUMENTER/spec.md) a posé de quoi mesurer le bruit
du récepteur à bord : c'est là qu'il faut regarder avant d'écrire une ligne. Les
traces des trois trajets sont sur le serveur, et suffisent à répondre aux trois
questions sans rouler.

## Critères d'acceptation

- [ ] On sait, chiffres en main, ce qui déclenche ces relances et si elles
      servent.
- [ ] Le cas échéant, la correction est proposée avec la mesure qui la justifie.
