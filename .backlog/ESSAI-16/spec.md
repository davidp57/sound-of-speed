# ESSAI-16 — ce que la sortie du 16 septembre a montré

**Statut :** 🔄 en cours — le rétrogradage forcé est corrigé et le curseur mort
retiré ; les huit autres points sont à faire le 17 septembre 2026
**Branches :** `fix/seuils-kickdown` (ticket 01, version 0.2.88),
`fix/retirer-le-curseur-de-seuil` (ticket 05, version 0.2.89) ; le reste à ouvrir

David a roulé le 16 septembre 2026 avec la version **0.2.76** déployée, trois
trajets, 2 h 25 en tout : 98 minutes le matin à partir de 8 h 25, puis treize et
trente-quatre minutes le soir à partir de 19 h. Les remarques sont les siennes,
sauf indication contraire ; les chiffres viennent de ses traces, rapatriées le
soir même par la liaison de compte.

## Les trois trajets

| Session | Heure locale | Durée | Relevés | Relances du suivi | Positions rejetées |
|---|---|---|---|---|---|
| `06-25-07_m39x` | 08:25 | 98 min | 32 031 | 113 | 314 |
| `17-00-16_d9nc` | 19:00 | 13 min | 6 444 | 0 | 14 |
| `17-16-31_33ma` | 19:16 | 34 min | 19 903 | 9 | 694 |

Les clés de session sont en temps universel, la colonne « heure locale » donne
l'heure réelle. C'est délibéré et la donnée est juste — `recordedAtOf()`
reconstruit l'instant correctement, et le relecteur affiche l'heure locale.

## Les tickets

| Ticket | Statut |
|---|---|
| [01 — le rétrogradage forcé ne se déclenchait presque jamais](tickets/01-kickdown-inatteignable.md) | ✅ |
| [02 — les bandeaux du bas passent sous les commandes](tickets/02-bandeaux-sous-les-commandes.md) | ⬜ repris par [INTERFACE](../INTERFACE/spec.md) |
| [03 — la télémétrie se chevauche sur l'écran de la voiture](tickets/03-telemetrie-qui-se-chevauche.md) | ⬜ repris par [INTERFACE](../INTERFACE/spec.md) |
| [04 — le suivi se relance toutes les cinquante-deux secondes](tickets/04-relances-du-suivi.md) | ⬜ |
| [05 — un curseur de réglage qui n'agit plus](tickets/05-curseur-sans-effet.md) | ✅ |
| [06 — la régie affiche l'heure universelle](tickets/06-heure-universelle-en-regie.md) | ⬜ |
| [07 — le réarmement du rétrogradage forcé travaille à l'envers en Sport](tickets/07-rearmement-proportionnel.md) | ⬜ |
| [08 — le volume maximal est plaqué contre le limiteur](tickets/08-volume-plaque-contre-le-limiteur.md) | ⬜ |
| [09 — au ralenti, le tremblement est amputé de moitié](tickets/09-tremblement-ampute-au-ralenti.md) | ⬜ |
| [10 — l'aiguille ne montre jamais le tremblement](tickets/10-aiguille-sans-tremblement.md) | ⬜ |
| [11 — des fréquences parasites sur les deux V8, à moyen régime](tickets/11-frequences-parasites-sur-les-v8.md) | ⬜ |

## Une observation levée par David

**Cent-dix km/h en septième, à 1 276 tr/min**, vu sur une photo du trajet du
matin. Relevé ici comme un écart possible avec le lot
[ETAGEMENT](../ETAGEMENT/spec.md), qui visait « 110 en sixième ».

**Ce n'en est pas un**, et David l'a tranché le 17 septembre 2026 : « c'est de la
croisière sur autoroute, c'est normal d'engager le rapport le plus haut
possible ». Le chiffre est par ailleurs exact — 884 tr/min à la roue, multipliés
par le pont 3,7 et le rapport 0,39, donnent bien 1 276.

C'est noté plutôt qu'effacé pour que l'observation ne soit pas refaite : un
rapport plus haut que celui qu'un lot nomme n'est pas un défaut quand la boîte
fait exactement ce qu'on lui demande.

## Hors périmètre

- **Le décalage entre l'intention d'ETAGEMENT et ce qui roule.** Voir ci-dessus :
  cela se tranche dans ETAGEMENT, pas ici.
- **Le rendu sonore lui-même.** Les tickets 08 à 10 portent sur le niveau et sur
  le tremblement du régime, deux choses mesurables hors de la voiture. Rien n'a
  été relevé sur le timbre, les boucles ou les passages lors de cette sortie.
