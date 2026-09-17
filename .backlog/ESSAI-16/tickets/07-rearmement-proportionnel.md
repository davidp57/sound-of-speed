# 07 — Le réarmement du rétrogradage forcé travaille à l'envers en Sport

**Statut :** 🧑 attend une donnée — les traces du 16 septembre ne sont pas sur
ce poste, et le ticket demande de re-simuler dessus avant de proposer. Un code
de liaison suffit (écran Compte, « Donner un code… »)

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

## Deux remarques avant de coder

**Le critère d'acceptation tel qu'il est écrit ne peut pas être tenu**, et c'est
ma formulation qui cloche, pas le constat. « Le réarmement est plus facile en
Sport qu'en Route » demande que Sport réarme à une charge **plus haute** ; or
tout réarmement est une hystérésis, donc un niveau **sous** le seuil de
déclenchement, et le seuil de Sport est par construction le plus bas. Quelle que
soit la marge retranchée — proportionnelle, absolue, rapportée au neutre — Sport
réarmera toujours plus bas que Route.

Ce qui est réellement en cause est ailleurs, et la piste le dit bien : **les deux
points de réarmement sont sous le neutre de l'échelle**, 0,5, donc les deux
demandent un levé de pied franc là où une croisière ordinaire devrait suffire.
La formule proposée — `0,5 + (seuil − 0,5) × 0,7` — les remonte tous les deux
au-dessus du neutre, 0,675 en Route et 0,605 en Sport. C'est cela, le correctif :
non pas inverser l'ordre, mais faire que les deux modes se réarment en roulant
normalement. Le critère est à réécrire ainsi.

**La mesure manque, et c'est le ticket qui l'exige.** Les traces du 16 septembre
vivent dans la base du serveur ; ce poste n'en a aucune copie. Rien ne se code
avant, puisque le nombre de déclenchements est justement ce que David a arbitré.

## Critères réécrits

- [ ] Les deux modes se réarment au-dessus du neutre de l'échelle de charge,
      c'est-à-dire en croisière ordinaire, et un test le tient.
- [ ] La fréquence obtenue en Route est re-mesurée sur les traces du
      16 septembre, et soumise à David si elle s'écarte d'un toutes les treize
      minutes.
