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

**Vingt-neuf paramètres** depuis que la longueur de collecteur s'est ajoutée — en dernier, comme la règle l'exige.

## Comment ça passe

Un **tableau de doubles**, écrit par le JavaScript dans la mémoire du module et
lu par le C++ dans l'ordre ci-dessous. Pas de JSON côté C++ : il faudrait un
analyseur, et l'ordre suffit.

L'ordre est donc **le contrat**, et il ne se réarrange pas. Un paramètre neuf
s'ajoute **à la fin**. Un paramètre retiré laisse sa place occupée plutôt que de
décaler les suivants.

```c
// C++ — le banc (cadences, convolution, niveleur) se pose d'abord : il ne
// décrit pas un moteur.
void synth_set_rig(int simFrequency, int audioSampleRate, int impulseSamples,
                   int leveler, double levelerGain);
int  synth_create_from(const double *values, int count);
```

```ts
// TypeScript
const values = ENGINE_FIELDS.map((f) => definition[f.key])
```

Un test compare la liste TypeScript à l'énumération C++ extraite de la source :
deux listes qui se désaccordent sans bruit sont exactement ce qu'on veut éviter.

## Les valeurs de référence, relevées et non déduites

**Chaque valeur des deux colonnes est relevée dans le fichier `.mr`**, à la ligne
indiquée. La première version de ce contrat en déduisait plusieurs, et neuf sur
vingt-huit étaient fausses — dont une qui a fait dévisser le V8 de 4 580 à
2 300 tr/min en roue libre. Ce qui n'est pas dans un fichier ne s'invente pas :
la colonne porte alors un tiret.

Sources : `assets/engines/atg-video-2/07_gm_ls.mr` et
`assets/engines/atg-video-1/06_subaru_ej25.mr`, dans l'arbre cloné par
`prepare.mjs`.

| # | Clé | Unité | GM LS | EJ25 | Ce que ça change |
|---|---|---|---|---|---|
| 0 | `cylinders` | — | 8 | 4 | Nombre de cylindres. Choisit le constructeur |
| 1 | `bore` | pouce | 3.78 | 3.917 (99,5 mm) | Alésage |
| 2 | `stroke` | pouce | 3.622 | 3.110 (79 mm) | Course |
| 3 | `rodLength` | pouce | 6.299 (160 mm) | 5.142 | Longueur de bielle |
| 4 | `chamberVolume` | cc | 90 | 67 | **Le taux de compression.** Avec l'alésage réel du LS (3,78), 90 cc donne 8,4:1 |
| 5 | `intakeRunnerVolume` | cc | 149.6 | 149.6 | Volume du conduit d'admission |
| 6 | `intakeRunnerArea` | pouce² | 4.84 (2,2²) | 1.8225 (1,35²) | Section du conduit d'admission |
| 7 | `exhaustRunnerVolume` | cc | 50 | 50 | Volume du conduit d'échappement |
| 8 | `exhaustRunnerArea` | pouce² | 3.0625 (1,75²) | 1.5625 (1,25²) | Section du conduit d'échappement |
| 9 | `lobeSeparation` | degré | 114 | 114 | Ne sert qu'à donner leur valeur par défaut aux deux centres de lobe |
| 10 | `intakeLobeCenter` | degré | 114 | 114 | Centre du lobe d'admission |
| 11 | `exhaustLobeCenter` | degré | 114 | 114 | Centre du lobe d'échappement |
| 12 | `intakeLift` | pouce | — | — | Levée d'admission. Garder l'existant |
| 13 | `exhaustLift` | pouce | — | — | Levée d'échappement. Garder l'existant |
| 14 | `intakeDuration` | degré | — | — | Durée d'admission. Garder l'existant |
| 15 | `exhaustDuration` | degré | — | — | Durée d'échappement. Garder l'existant |
| 16 | `plenumVolume` | litre | 1.325 | 1.325 | Volume de la boîte à air |
| 17 | `intakeFlowRate` | k_carb | **700** | **800** | Débit d'admission. **Le paramètre le plus lourd** : à 400, le V8 tombe de 4 580 à 2 300 tr/min en roue libre. Les vingt-sept autres pèsent cent tours à eux tous |
| 18 | `idleThrottlePlate` | 0-1 | **0.996** | **0.9985** | **Le papillon au ralenti.** Le débit passe en cosinus, donc l'échelle est très serrée près de un : 0,975 laisse dix-sept fois plus d'air que 0,9985 |
| 19 | `primaryTubeLength` | pouce | 29 | 10 | **La longueur du tube primaire**, qui fixe la résonance de l'échappement |
| 20 | `primaryFlowRate` | k_carb | 500 | 200 | Débit du tube primaire |
| 21 | `outletFlowRate` | k_carb | 1000 | 1000 | Débit en sortie |
| 22 | `collectorVolume` | litre | — (voir plus bas) | 100 | Volume du collecteur |
| 23 | `exhaustAudioVolume` | — | 4.0 | 4.0 (0,5 × 8) | Poids de cette ligne dans le son |
| 24 | `revLimit` | tr/min | — | 6500 | Rupteur. Vient du profil, pas du moteur |
| 25 | `limiterDuration` | seconde | — | 0.08 | Durée d'une coupure au rupteur |
| 26 | `airNoise` | 0-1 | — | — | Bruit d'air d'engine-sim. **Il multiplie le signal** : à un, le moteur disparaît derrière sa modulation. Retenu à 0,15, à l'oreille |
| 27 | `inputSampleNoise` | 0-1 | — | — | Gigue d'échantillonnage, filtrée à 10 kHz. Retenue à 0,05, à l'oreille |
| 28 | `headerLength` | pouce | 6.8 | — | **Longueur du collecteur du premier cylindre.** Sur un V8 les suivants s'en déduisent par quarts, comme le 454 qui écrit `distance * 4, 3, 2, 1` ; sur un quatre cylindres tous portent la même. Ce réglage arbitre : long, il donne le rugueux en charge **et** des parasites au ralenti ; court, il enlève les deux |

### Le collecteur, deux formes pour la même chose

L'EJ25 déclare `volume: 100 L`, le GM LS `length: 100 inch` sur un banc et
`172 inch` sur l'autre. L'API C++ ne prend qu'une longueur ; notre code convertit
le volume en longueur par la section. Le paramètre reste un **volume**, la forme
de l'EJ25, faute de pouvoir porter les deux — et le V8 s'en écarte donc par
construction. C'est le seul endroit du contrat où la référence ne se transpose
pas telle quelle.

## Ce qui reste en dur, et pourquoi

- **Les courbes de débit des soupapes.** Dix points par courbe, deux courbes par
  moteur : ce sont des données de banc d'essai, pas des réglages.
- **L'ordre d'allumage et les angles de manetons.** Ils *définissent* le moteur —
  un V8 croisé cesse d'en être un si on les change.
- **L'angle de V et le point mort haut**, qui en découlent.
- Masses et inerties, démarreur, avance à l'allumage, turbulence, carburant,
  conduit d'admission, atténuation sonore. Aucun ne se juge à l'oreille.

## La règle, et ce qu'elle nous a coûté

**Une valeur qui s'écarte de la colonne de référence doit dire pourquoi.**

C'est ce qui a manqué au V8 : son échappement portait les valeurs d'un EJ25 sans
que rien ne le signale. Et c'est ce qui a manqué à ma propre correction du
papillon de ralenti — j'ai remplacé le 0,9985 du code par le 0,975 de la
structure C++ en croyant corriger, alors que 0,9985 **est** la valeur relevée de
l'EJ25. Le défaut d'une structure n'est pas une référence : c'est ce qui reste
quand personne n'a rien déclaré.

Les écarts assumés aujourd'hui :

| Paramètre | Référence | Retenu | Pourquoi |
|---|---|---|---|
| `airNoise` | — | 0.15 | Jugé à l'oreille ; à 1, le moteur disparaît derrière sa modulation |
| `inputSampleNoise` | — | 0.05 | Jugé à l'oreille ; à 0,5, le spectre remonte de 11 dB entre 2 et 8 kHz |
| `idleThrottlePlate` | 0.996 / 0.9985 | **à trancher** | 0,975 a été livré par erreur. David a trouvé le ralenti meilleur, mais le lot comportait trois autres corrections : à comparer maintenant que le réglage est à sa main |

### Le GM LS à l'oreille, le 5 septembre 2026

David a écouté le V8 avec les curseurs à sa main et retenu deux écarts —
« ce réglage est pas mal » :

| Paramètre | Référence GM LS | Retenu | Pourquoi |
|---|---|---|---|
| `primaryFlowRate` | 500 | **1130** | Jugé à l'oreille |
| `headerLength` | 6.8 | **23** | Jugé à l'oreille |

Tout le reste est celui du GM LS. Ce n'est pas un verdict : c'est le meilleur
point trouvé à ce jour, écrit pour ne pas le perdre entre deux essais.

Un premier point, 760 et 20 pouces, était « pas mal » ; celui-ci est « pas mal
du tout pour le ralenti, et pour la charge ». Les deux valeurs ont monté
ensemble, ce qui va dans le sens de ce que fait chacune : le débit donne le
mordant, la longueur sépare les coups au ralenti — l'une compense l'autre au
lieu de s'y opposer.
