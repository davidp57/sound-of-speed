# Le contrat de définition de moteur

Ce fichier est la **source de vérité** de ce qui passe du profil au moteur
simulé. Les deux côtés — le C++ de `probe.cpp` et le TypeScript de
`core/synth/` — s'y réfèrent, et un test vérifie qu'ils ne divergent pas.

## Pourquoi

Les moteurs étaient écrits en dur dans `probe.cpp`. Changer un volume de chambre
demandait d'éditer du C++, de recompiler le WebAssembly et de recharger : une
minute, et personne d'autre que la machine ne pouvait le faire. Or c'est à
l'oreille que ces valeurs se trouvent.

La spécification du lot [SYNTHESE](../.backlog/SYNTHESE/spec.md) l'avait prévu
dès le début :

> Un moteur se décrit en JSON, dans une section du profil, et le liant remplit
> directement la structure C++ d'engine-sim. On n'embarque pas son
> interpréteur : dix mille lignes, Flex et Bison en moins.

C'est ce que fait ce contrat. David l'a formulé autrement : « le mieux serait
d'avoir des paramètres, qu'on pourrait retenir dans des profils — exactement ce
que sont les fichiers `.mr` finalement, non ? ». Oui, à ceci près qu'un `.mr`
est un langage et que ceci est un tableau de nombres.

## Comment ça passe

Un **tableau de doubles**, écrit par le JavaScript dans la mémoire du module et
lu par le C++ dans l'ordre ci-dessous. Pas de JSON côté C++ : il faudrait un
analyseur, et l'ordre suffit.

L'ordre est donc **le contrat**, et il ne se réarrange pas. Un paramètre neuf
s'ajoute **à la fin**. Un paramètre retiré laisse sa place occupée plutôt que de
décaler les suivants.

```c
// C++
int synth_create_from(const double *values, int count);
```

```ts
// TypeScript
const values = ENGINE_FIELDS.map((f) => definition[f.key])
```

Un test compare la liste TypeScript à l'énumération C++ extraite de la source :
deux listes qui se désaccordent sans bruit sont exactement ce qu'on veut éviter.

## Les paramètres

Les colonnes « GM LS » et « EJ25 » donnent les valeurs des définitions livrées
avec engine-sim, dont nos deux moteurs sont tirés. Elles servent de valeurs par
défaut et de repère : s'en écarter est un choix, pas un accident.

| # | Clé | Unité | GM LS | EJ25 | Ce que ça change |
|---|---|---|---|---|---|
| 0 | `cylinders` | — | 8 | 4 | Nombre de cylindres. Rebâtit tout |
| 1 | `bore` | pouce | 4.065 | 3.898 | Alésage |
| 2 | `stroke` | pouce | 3.622 | 3.11 | Course |
| 3 | `rodLength` | pouce | 6.098 | 5.5 | Longueur de bielle |
| 4 | `chamberVolume` | cc | 90 | 51 | **Le taux de compression.** À 90 cc le LS3 est à 9,6:1 ; à 68, à 12,3:1 — un moteur de compétition. C'est la violence de la combustion, donc celle de l'impulsion d'échappement |
| 5 | `intakeRunnerVolume` | cc | 149.6 | 149.6 | Volume du conduit d'admission |
| 6 | `intakeRunnerArea` | pouce² | 4.84 | 4.0 | Section du conduit d'admission (2,2 × 2,2) |
| 7 | `exhaustRunnerVolume` | cc | 50 | 50 | Volume du conduit d'échappement |
| 8 | `exhaustRunnerArea` | pouce² | 3.0625 | 2.25 | Section du conduit d'échappement (1,75 × 1,75) |
| 9 | `lobeSeparation` | degré | 114 | 114 | Écartement des lobes de came |
| 10 | `intakeLobeCenter` | degré | 114 | 116 | Centre du lobe d'admission |
| 11 | `exhaustLobeCenter` | degré | 114 | 116 | Centre du lobe d'échappement |
| 12 | `intakeLift` | pouce | 0.551 | 0.395 | Levée d'admission |
| 13 | `exhaustLift` | pouce | 0.551 | 0.377 | Levée d'échappement |
| 14 | `intakeDuration` | degré | 234 | 220 | Durée d'ouverture d'admission |
| 15 | `exhaustDuration` | degré | 234 | 220 | Durée d'ouverture d'échappement |
| 16 | `plenumVolume` | litre | 1.325 | 2.0 | Volume de la boîte à air |
| 17 | `intakeFlowRate` | k_carb | 400 | 400 | Débit d'admission |
| 18 | `idleThrottlePlate` | 0-1 | 0.975 | 0.975 | **Le papillon au ralenti.** Le débit passe en cosinus : 0,9985 laisse dix-sept fois moins d'air que 0,975, et le moteur s'asphyxie |
| 19 | `primaryTubeLength` | pouce | 29 | 10 | **La longueur du tube primaire**, qui fixe la résonance de l'échappement |
| 20 | `primaryFlowRate` | k_carb | 500 | 200 | Débit du tube primaire |
| 21 | `outletFlowRate` | k_carb | 1000 | 1000 | Débit en sortie |
| 22 | `collectorVolume` | litre | 100 | 100 | Volume du collecteur |
| 23 | `exhaustAudioVolume` | — | 4.0 | 4.0 | Poids de cette ligne dans le son |
| 24 | `revLimit` | tr/min | — | — | Rupteur. Vient du profil, pas du moteur |
| 25 | `limiterDuration` | seconde | 0.2 | 0.08 | Durée d'une coupure au rupteur |
| 26 | `airNoise` | 0-1 | 0.15 | 0.15 | Bruit d'air d'engine-sim. **Il multiplie le signal** : à un, le moteur disparaît derrière sa modulation |
| 27 | `inputSampleNoise` | 0-1 | 0.05 | 0.05 | Gigue d'échantillonnage, filtrée à 10 kHz |

## Ce qui reste en dur, et pourquoi

- **Les courbes de débit des soupapes.** Dix points par courbe, deux courbes par
  moteur : ce sont des données de banc d'essai, pas des réglages. Elles restent
  dans `probe.cpp`, où elles sont déjà relevées sur les fichiers de référence.
- **L'ordre d'allumage et les angles de manetons.** Ils *définissent* le moteur —
  un V8 croisé cesse d'en être un si on les change. Ils suivent le nombre de
  cylindres.
- **L'angle de V et le point mort haut**, qui en découlent.

## La règle

Une valeur qui s'écarte de la colonne de référence doit dire pourquoi, dans le
profil ou dans un commentaire. C'est ce qui a manqué au V8 : son échappement
portait les valeurs d'un EJ25 Subaru sans que rien ne le signale, et il a fallu
comparer ligne à ligne pour s'en apercevoir.
