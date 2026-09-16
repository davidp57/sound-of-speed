# ESSAI-16 — ce que la sortie du 16 septembre a montré

**Statut :** 🔄 en cours — le rétrogradage forcé est corrigé et le curseur mort
retiré ; les cinq autres points sont à instruire
**Branche :** `fix/seuils-kickdown` pour le ticket 01, le reste à ouvrir
**Version visée :** 0.2.88 pour le ticket 01

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
| [02 — les bandeaux du bas passent sous les commandes](tickets/02-bandeaux-sous-les-commandes.md) | ⬜ |
| [03 — la télémétrie se chevauche sur l'écran de la voiture](tickets/03-telemetrie-qui-se-chevauche.md) | ⬜ |
| [04 — le suivi se relance toutes les cinquante-deux secondes](tickets/04-relances-du-suivi.md) | ⬜ |
| [05 — un curseur de réglage qui n'agit plus](tickets/05-curseur-sans-effet.md) | ✅ |
| [06 — la régie affiche l'heure universelle](tickets/06-heure-universelle-en-regie.md) | ⬜ |
| [07 — le réarmement du rétrogradage forcé travaille à l'envers en Sport](tickets/07-rearmement-proportionnel.md) | ⬜ |

## Ce qui est observé sans être tranché

**Cent-dix km/h en septième, à 1 276 tr/min.** Vu sur une photo du trajet du
matin, en L4. Le chiffre est cohérent avec l'étagement configuré — 884 tr/min à
la roue, multipliés par le pont 3,7 et le rapport 0,39, donnent bien 1 276 —,
mais le lot [ETAGEMENT](../ETAGEMENT/spec.md) visait « 110 en sixième ». Reste à
savoir laquelle des deux intentions vaut, et si la photo montre un profil dont
l'étagement n'est pas celui du lot. Aucun verdict ici : c'est une observation, à
instruire dans ETAGEMENT.

## Hors périmètre

- **Le son.** Rien n'a été relevé sur le rendu sonore lors de cette sortie.
- **Le décalage entre l'intention d'ETAGEMENT et ce qui roule.** Voir ci-dessus :
  cela se tranche dans ETAGEMENT, pas ici.
