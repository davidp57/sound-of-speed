# `native/` — le cœur d'engine-sim, compilé chez nous

Ce dossier prépare et compile le **cœur de simulation et de synthèse** de
[engine-sim](https://github.com/ange-yaghi/engine-sim) (licence MIT), sans son
interface graphique ni son langage de script. C'est la première marche du lot
[SYNTHESE](../.backlog/SYNTHESE/spec.md) : avant de porter quoi que ce soit en
WebAssembly, il faut des sources qui compilent, et un chiffre de référence en
natif auquel comparer le WASM puis la voiture.

**Rien du code d'engine-sim n'est versionné ici.** Le dépôt ne garde que les
correctifs, sous forme de patchs. Les sources sont rapatriées à la demande, à
une révision figée.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `prepare.mjs` | rapatrie engine-sim et son sous-module `simple-2d-constraint-solver`, à révision figée, dans `.work/`, puis applique les patchs |
| `patches/` | les correctifs de portabilité, un par sujet, appliqués dans l'ordre de leur numéro |
| `build-native.sh` | compile les 70 fichiers du cœur avec `g++ -std=c++17 -O2` et produit `probe.exe`, puis le lance |
| `probe.cpp` | la sonde : construit un moteur en dur, le fait tourner, chronomètre |
| `.work/`, `.build/` | plan de travail jetable, ignorés par git |

## Comment relancer

```bash
node native/prepare.mjs        # sources + patchs
bash native/build-native.sh    # compile, puis mesure sur 1 s de son
bash native/build-native.sh 5  # mesure sur 5 s de son
```

`prepare.mjs` est idempotent : il remet les deux dépôts à leur révision épinglée
avant de réappliquer les patchs. Ce qu'on aurait modifié à la main dans `.work/`
est donc perdu à chaque passage — c'est voulu.

Le compilateur se change par l'environnement :

```bash
CXX=clang++ bash native/build-native.sh
CXXFLAGS="-std=c++17 -O3 -march=native -DNDEBUG -w" bash native/build-native.sh
```

## Les révisions figées

| Dépôt | Révision |
|---|---|
| `ange-yaghi/engine-sim` | `85f7c3b959a908ed5232ede4f1a4ac7eafe6b630` (22/01/2023) |
| `ange-yaghi/simple-2d-constraint-solver` | `e009f4ff1c9c4c5874e865e893cdb62e208fb2b3` |

Elles sont écrites en dur dans `prepare.mjs`. Le dépôt amont n'a plus bougé
depuis janvier 2023 et le projet est passé en source fermée : suivre `master`
n'apporterait rien, et rendrait deux mesures de la sonde incomparables. Les
patchs sont écrits contre ces deux révisions exactement.

## Les correctifs

Sept pour engine-sim, un pour le solveur. Les cinq premiers reprennent le
travail du fork [`bobsayshilol/engine-sim`](https://github.com/bobsayshilol/engine-sim),
branche `wasm-build`.

| Patch | Ce qu'il corrige |
|---|---|
| `01-gas-system-constructeur-mix` | gcc refuse `const Mix &mix = {}` : un type dont les membres ont un initialiseur par défaut n'est pas un agrégat pour lui. Un constructeur déclaré rend l'écriture légale. |
| `02-forceinline-vers-inline` | `__forceinline` est propre à Visual C++. MinGW en donne bien une définition, mais incompatible avec une méthode de classe : on la remplace par `inline` dans les quatre filtres concernés. |
| `03-synthesizer-fpclassify` | `fpclassify` non qualifié ; libstdc++ veut `std::fpclassify`. |
| `04-piston-engine-simulator-assertion` | une assertion porte sur `m_antialiasingFilters`, membre qui n'existe pas dans l'en-tête. |
| `05-synthesizer-sans-delta-studio` | `synthesizer.cpp` inclut `delta.h`, qui tire le moteur graphique maison. L'inclusion est morte : rien du fichier ne s'en sert. C'est le seul lien du cœur vers l'interface. |
| `06-synthesizer-sans-fil` | **le plus important.** Le synthétiseur rend l'audio dans un `std::thread`, réveillé par une variable de condition. On reprend l'approche de `bobsayshilol` (commit `66562efe`) : un `#define SEPARATE_THREAD 0`, et `readAudioOutput()` appelle `renderAudio()` au lieu d'attendre. Conséquence : pas de pthreads sous Emscripten, donc **pas de SharedArrayBuffer, donc pas d'en-têtes COOP/COEP à ajouter au nginx**. |
| `07-constantes-linkage-interne` | `units.h` et `constants.h` déclarent 60 `extern constexpr double` dans un en-tête. Chaque unité de compilation qui en utilise une en émet une définition, et l'éditeur de liens les refuse en double. `inline constexpr` (C++17) n'en garde qu'une. Ce défaut n'apparaît qu'à l'édition de liens d'un programme complet, pas à la compilation fichier par fichier. |
| `simple-2d-constraint-solver/01-matrix-cstring` | `<cstring>` manquant : `memset` n'est pas déclaré. |

## Ce que la sonde mesure

`probe.cpp` construit un **quatre cylindres en ligne** codé en dur, décalqué des
valeurs du Subaru EJ25 livré avec engine-sim, sans passer par piranha (son
langage de script, dix mille lignes qu'on n'embarque pas). Il fait exactement ce
que fait `es_script::EngineNode::buildEngine()` : remplir les structures
`Parameters` et appeler les `initialize()`.

Le moteur est lancé au démarreur, puis tourne seul autour de 3 300 tr/min,
papillon à peine ouvert, boîte au point mort. La sortie audio est lue puis
jetée : **rien n'est joué**.

Le chronomètre sépare deux postes, ce que le retrait du fil rend facile :

- **sim** : `startFrame` + `simulateStep` + `endFrame` — corps rigides, dynamique
  des gaz, chambres ;
- **synth** : `readAudioOutput` — c'est là que le rendu a lieu depuis le
  patch 06, convolution comprise.

Quatre relevés : la chaîne complète à 10 kHz et à 20 kHz (la fréquence de
simulation du moteur livré), puis les mêmes avec une réponse impulsionnelle
courte (100 échantillons au lieu de 10 000) pour isoler ce que coûte la
convolution — celle que Web Audio saurait déporter sur un `ConvolverNode`.

## Le relevé sur ce poste

AMD Ryzen 7 7800X3D, un seul fil, g++ 16.2 (MinGW), `-O2`, 2 s de son par
relevé, trois passages concordants à ±3 %.

| Relevé | CPU pour 1 s de son | Temps réel |
|---|---|---|
| Chaîne complète, 10 kHz | 0,59 s (sim 0,28 + synth 0,31) | ×1,7 |
| Chaîne complète, 20 kHz | 0,83 s (sim 0,53 + synth 0,30) | ×1,2 |
| Convolution courte, 10 kHz | 0,29 s | ×3,4 |
| Convolution courte, 20 kHz | 0,53 s | ×1,9 |

La convolution pèse **52 %** du coût à 10 kHz, 36 % à 20 kHz. Passer à `-O3
-march=native` ne gagne que 8 % sur la simulation et rien sur la synthèse : le
coût n'est pas dans les options de compilation.

Ces chiffres sont un **plancher**. Ni WebAssembly, ni la Tesla.

### Ce qui n'est pas vérifié

- Le moteur codé en dur **n'a pas été comparé à l'oreille** au même moteur chargé
  par le langage de script. Il tourne et il brûle — l'instrumentation relevait
  2 400 K en pointe dans la chambre — mais rien ne dit qu'il sonne comme le EJ25
  dont il reprend les cotes. Pour une mesure de coût, ça suffit ; pour juger un
  timbre, non.
- La spécification du lot annonçait 0,41 s de CPU par seconde de son à 10 kHz sur
  le même processeur. On mesure 0,59 s. L'écart n'est pas expliqué : ni les
  options de compilation, ni le régime moteur ne le rendent. La différence tient
  probablement à la définition de moteur et à la longueur de la réponse
  impulsionnelle, qui est ici au plafond de 10 000 échantillons.
- Le poids du `.wasm` n'est pas connu : rien n'a encore été compilé pour le
  navigateur.

## Ce qui reste à faire

1. Compiler la même liste de fichiers avec Emscripten. La chaîne de compilation
   change, les sources non : c'est ce que ce dossier établit.
2. Écrire la page de la sonde (ticket
   [01](../.backlog/SYNTHESE/tickets/01-la-sonde.md)) : les mêmes relevés, plus
   le navigateur, la taille de l'écran, le nombre de cœurs annoncé et le poids du
   `.wasm`.
3. La servir par le même nginx que l'application, pour l'ouvrir dans la voiture.
4. Faire le relevé dans la Tesla et l'écrire dans le ticket 02. Le seuil est fixé
   d'avance : **×3 temps réel**.
