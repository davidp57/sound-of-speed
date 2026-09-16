# 07 — Le réarmement du rétrogradage forcé travaille à l'envers en Sport

**Statut :** ⬜ prêt — trouvé en relisant la PR du ticket 01, pas bloquant

Après un rétrogradage forcé, la boîte attend que la charge redescende sous
`seuil × 0,7` pour se réarmer (`gearbox.ts`). Le facteur est **proportionnel au
seuil**, alors que l'échelle de charge n'a pas zéro pour origine : une
accélération nulle vaut **0,5**, mesuré sur les traces du 16 septembre (109 km/h
tenus, charge 0,5000000002).

Conséquence, avec les seuils posés par le ticket 01 :

| Mode | Seuil | Réarme sous | Temps passé sous ce niveau, en roulant |
|---|---|---|---|
| Route | 0,75 | 0,525 | 70 à 75 % |
| Sport | 0,65 | 0,455 | 13 à 23 % |

**L'ordre est inversé.** Sport est censé rétrograder plus volontiers que Route —
son seuil de charge est plus bas pour cela — mais il devient plus long à se
réarmer, puisqu'il faut un levé de pied franc là où Route se réarme en simple
croisière.

Ce n'est pas bloquant : Sport se réarme quand même, treize à vingt-trois pour
cent du temps de conduite, et l'essai du 16 septembre s'est fait en Route. Le
défaut n'a donc jamais été entendu.

## La piste

Rapporter le réarmement au **neutre** de l'échelle plutôt qu'à zéro : réarmer
sous `0,5 + (seuil − 0,5) × 0,7`, soit 0,675 en Route et 0,605 en Sport. L'ordre
redevient celui qu'on attend.

Cela change le comptage validé au ticket 01 — le réarmement devenant plus facile,
les onze déclenchements sur 2 h 25 augmenteraient. **À re-simuler sur les traces
du 16 septembre avant de proposer**, et à soumettre à David : c'est lui qui a
arbitré la fréquence.

## Critères d'acceptation

- [ ] Le réarmement est plus facile en Sport qu'en Route, et un test le tient.
- [ ] La fréquence obtenue en Route est re-mesurée sur les traces du
      16 septembre, et soumise à David si elle s'écarte d'un toutes les treize
      minutes.
