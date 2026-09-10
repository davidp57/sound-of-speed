# HORODATAGE — la Tesla compte en microsecondes

**Statut :** 🔄 en cours — le conditionnement est corrigé, le rejeu des traces
reste à reprendre
**Branche :** `fix/mouvement`
**Version visée :** 0.1.85

## Ce qui a déclenché

Le rapatriement du journal et des traces de l'essai du 9 septembre 2026, obtenu
le 10 septembre par le paquet du lot [RAPATRIER](../RAPATRIER/spec.md). Il
cherchait la cause d'un défaut de boîte ; il a trouvé un défaut de mesure qui
explique bien plus.

Deux diagnostics avaient été avancés avant lui, et démentis tous les deux : une
accélération bruitée par le GPS — écartée par David, qui avait éprouvé le lot
PENTE en roulant —, puis deux compteurs de ralentissement aux seuils
contradictoires, démentie par un banc de quatorze scénarios. La cause réelle
n'était visible que dans les données de la voiture.

## La cause

**Le navigateur de la Tesla horodate ses positions en microsecondes**, là où la
norme du web dit millisecondes. Tout le code divise par mille en croyant
convertir.

L'accélération étant une pente, donc une division par une durée, elle sort
**mille fois trop petite** : 0,0028 m/s² pour une vraie valeur de 2,78. Elle
disparaît sous le seuil d'arrondi partout où on la regarde.

### Les preuves, toutes concordantes

| Relevé | Valeur |
|---|---|
| Écart entre deux positions | 100 000 unités pour 100 ms → cadence réelle **10 Hz** |
| Étendue d'une trace | 60 700 000 unités : **16,9 h** en millisecondes, **60,7 s** en microsecondes |
| Nom du fichier déposé | `…_test2_60700s.json` — le défaut est écrit dans le nom |
| Accélération au journal | sous le seuil d'arrondi dans **476 relevés sur 480**, 99 % |
| Les 4 valeurs non nulles | −5,48 · −0,25 · +0,94 · +3,60 m/s² — aberrantes |
| Charge qui en découle | figée à **0,50 dans 99 %** des relevés |
| `derived` | `false` partout : la vitesse est bien celle que la voiture annonce |

La cadence de 10 Hz corrige au passage ce que le README annonçait : « une
position toutes les quelques dizaines de millisecondes », soit trente fois par
seconde. C'est dix.

### Ce que cela explique d'un coup

- **Le relief de charge plat**, donc l'effort qui ne s'entend pas : la charge se
  déduit de l'accélération, et 0,50 est exactement la valeur d'une accélération
  nulle.
- **Les garde-fous de la boîte inertes** : `slowing` exige moins de
  −0,05 m/s² et reçoit des millièmes ; `braking` de même. La contradiction de
  seuils relevée le 10 septembre existe donc, mais elle ne peut pas se
  manifester.
- **La croisière qui se croit éternelle**, donc les rapports qui montent pendant
  un ralentissement. Relevé dans le journal : quatre montées pendant que la
  vitesse baisse, dont un 3ᵉ → 5ᵉ à 64 km/h.
- **Le rejeu des traces mille fois trop lent**, donc des traces injouables.
- **La vitesse affichée, elle, était juste** — c'est pourquoi David n'avait rien
  à reprocher au suivi. Seule sa dérivée était morte.

## Ce qui est corrigé

Le conditionnement ramène l'horodatage en millisecondes, en déduisant l'échelle
du **plus petit écart strictement positif** observé entre deux mesures.

Pourquoi le minimum et non la moyenne : un récepteur qui roule produit
forcément des écarts courts, alors qu'un arrêt les espace. L'écart nul est
écarté parce qu'il existe — deux positions consécutives portent parfois le même
horodatage dans les traces relevées — et qu'il ne dit rien de l'échelle.

Pourquoi le seuil de dix secondes ne peut pas nuire : **si le plus petit écart
entre deux positions dépassait vraiment dix secondes, l'accélération serait
inexploitable de toute façon.** L'heuristique ne dégrade donc aucun cas sain, et
elle ne suppose aucun navigateur particulier — elle mesure ce qui arrive.

Changer d'échelle vide l'historique : une pente calculée à cheval sur deux
échelles serait fausse des deux façons à la fois.

### Mesuré

Quatre tests neufs verrouillent le comportement, dont deux échouaient avant le
correctif en donnant exactement le facteur mille — 0,0028 pour 2,78 attendu.

Sur les deux traces réelles du 9 septembre, rejouées dans le conditionnement
corrigé :

| | Dans la voiture | Après correctif |
|---|---|---|
| Mesures portant une accélération exploitable | 1 % | **83 %** et **70 %** |
| Médiane de l'accélération absolue | sous l'arrondi | **0,36 m/s²** |
| Étendue signée | — | **−1,39 à +3,37 m/s²** |

Des valeurs crédibles pour de la conduite, là où il n'y avait rien.

## Ce qui reste

- **Le rejeu des traces.** Il compare les horodatages bruts à son temps écoulé
  et sera donc mille fois trop lent sur une trace de la voiture ; la durée
  affichée l'est aussi. Rejouer la trace du 9 septembre est le meilleur banc
  possible pour la boîte : c'est du signal réel, avec sa quantification au
  kilomètre-heure et ses paliers.
- **La vitesse dérivée de deux positions.** Elle divise elle aussi par mille des
  microsecondes. Elle ne sert pas dans cette voiture — `derived` est `false`
  partout — mais elle servirait le jour où la vitesse annoncée manquerait, et
  elle serait alors mille fois trop faible.
- **L'écoute en roulant.** Le relief de charge et la boîte n'ont jamais été
  entendus sur une accélération juste. C'est le lot [MOUVEMENT](../MOUVEMENT/spec.md)
  qui reprendra là-dessus, et une bonne partie de son réglage est à réévaluer
  plutôt qu'à jeter.

## Hors périmètre

- **La quantification de la vitesse au kilomètre-heure entier**, relevée sur les
  traces : la Tesla n'annonce que des valeurs rondes, et seuls 9 à 11 % des
  échantillons portent une valeur nouvelle. Ce n'est pas un défaut de notre
  côté, mais cela borne ce qu'on peut tirer du signal, et le conditionnement
  devra en tenir compte.
- **Le relevé à 211 km/h** et les dix redémarrages de la localisation, à
  regarder à part.
- **La refonte de la boîte**, qui attend une écoute sur signal juste.
