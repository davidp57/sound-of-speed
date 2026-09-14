# 07 — Le générateur construit le moteur que décrit le contrat

**Statut :** 🧑 attend David — la banque du GM à collecteur long est produite,
reste à l'écouter

**Bloqué par :** aucun — le contrat et les constructeurs paramétrés existent

## Ce qui a déclenché

David, le 14 septembre 2026 :

> peut-on utiliser l'engine-sim pour générer une banque de son de la GM
> échappement long ?

Non, pas en l'état. Le moteur qu'il désigne — `gm-ls-long-header`, le GM LS dont
il a trouvé l'échappement à l'oreille le 8 septembre — n'existe que du côté
TypeScript, dans `core/preset/engine-library.ts`. Le banc hors ligne, lui, ne
sait construire que deux moteurs écrits en dur.

## Le constat, vérifié

Le mode direct passe par le contrat des vingt-neuf nombres
([CONTRAT-MOTEUR](../../../native/CONTRAT-MOTEUR.md)) :
`probe.cpp` porte un `buildCrossplaneV8(const EngineDefinition &def)` **paramétré**,
alimenté par `synth_create_from`.

Le banc hors ligne appelle `engines::buildCrossplaneV8()` **sans argument** :
`native/engines.h` est une copie figée d'avant le contrat, et son propre en-tête
l'assume — « la copie est le prix de ce partage ». Il porte donc le GM LS de
référence, pas le réglage retenu :

| paramètre | ce que porte `engines.h` | `gm-ls-long-header` |
|---|---|---|
| `primaryTubeLength` | 29″ | 30″ |
| `primaryFlowRate` | 500 | 1000 |
| `outletFlowRate` | 1000 | 2000 |
| collecteurs | 29, 31, 33, 35″ | 30, 22,5, 15, 7,5″ |

Et `--engine` ne connaît que `crossplaneV8` et `inline4`.

La dernière ligne est celle qui compte : le banc posait des collecteurs **cinq à
dix fois trop longs, et croissants là où les fichiers décroissent**. C'est le
défaut que `probe.cpp` avait corrigé — « des fréquences parasites par dessus,
qu'on dirait synchro sur le côté rugueux mais plus aiguës », David le
8 septembre — et que le banc portait encore, faute d'être la même source.

C'est la réserve que le ticket 05 avait écrite : « la géométrie du moteur n'est
pas encore dans le JSON […] les deux formats devront converger ».

## Ce qu'on fait

**La copie disparaît.** `native/engines.h` devient le fichier partagé et porte
les constructeurs **paramétrés**, extraits de `probe.cpp` ; `probe.cpp` l'inclut
au lieu de les porter. Une seule source pour la géométrie, celle du contrat.

**La définition de banque nomme un moteur de la bibliothèque.** `base:
"crossplaneV8"` devient `engine: "gm-ls-long-header"` : l'identifiant de
`ENGINE_LIBRARY`, la même liste que l'écran de synthèse. `generate.mjs` la lit
par esbuild — déjà la dépendance qui construit le serveur — et écrit les
vingt-neuf nombres dans un fichier que le banc relit. Le nombre de cylindres
vient de la définition, plus du JSON.

**Le niveleur reste neutralisé**, comme aujourd'hui. C'est ce qui donne à la
banque son relief de régime et son étalonnage prise par prise. Conséquence
assumée, et à dire : le son ne sera pas celui du mode direct, qui passe par un
niveleur visant seize mille. David le jugera à l'oreille — décidé le 14 septembre.

## Le défaut du profil produit, corrigé au passage

Le second test de `profile.test.mjs` échoue depuis le 5 septembre : le profil
produit met la **définition de banque** dans `engineDefinition`, qui est le champ
des vingt-neuf nombres du moteur. `clampEngineDefinition` la borne au contrat à
l'import, et `sampleDir` comme `bank` disparaissent.

La correction n'ajoute rien au schéma de profil : `engineDefinition` reçoit ce
qu'il doit recevoir — **le moteur**, les vingt-neuf nombres —, et la recette de
la banque reste où elle est déjà écrite, dans `mesures.json`, à côté des fichiers
qu'elle a produits et que `sampleDir` désigne.

Un profil de banque générée porte donc désormais un moteur valide : le basculer
en direct joue le même moteur que celui qui a produit ses échantillons.

**Et le test tourne enfin.** Il est en `describe.skipIf(!PROFIL_GENERE)`, donc
jamais en CI — « un test qui ne tourne nulle part ne protège rien ». La
construction du profil sort de `generate.mjs` dans un module à part, et le test
la vérifie sans banque sous la main.

## Critères d'acceptation

- [x] `native/engines.h` porte les constructeurs paramétrés, `probe.cpp` les
      inclut au lieu de les porter, et la sonde rend les mêmes chiffres qu'avant :
      1 841 tr/min et ×0,96 le temps réel, mesuré avant et après
- [x] Une définition de banque nomme un moteur de `ENGINE_LIBRARY` et le banc le
      construit — vérifié sur `gm-ls-long-header`, 18 fichiers produits
- [x] Le profil produit porte les vingt-neuf nombres du moteur et les garde à
      l'import
- [x] Les cas de `profile.test.mjs` qui n'ont pas besoin d'une banque tournent
      en CI
- [ ] 🧑 La banque du GM à collecteur long, jugée à l'oreille

## Ce qui n'est pas vérifié

- **Le timbre**, comme toujours sur ce lot : la machine mesure, elle n'écoute pas.
- **Le son du banc n'est pas celui du direct.** Niveleur neutralisé d'un côté,
  visant seize mille de l'autre ; la comparaison n'est donc pas à égalité, et le
  verdict portera sur ce que la banque vaut, pas sur l'écart entre les deux.

## Ce que la banque produite vaut, mesuré

`public/audio/gm-ls-long-header/`, 18 fichiers, 221 s de calcul pour 25 prises.

| | |
|---|---|
| Vitesse de lecture | 0,74 à 1,35 |
| Erreur de timbre | 1,14 demi-ton |
| Saut d'énergie au bouclage, une fois joué | 13,6 % au pire, 3,3 % en médiane |
| Relief brut rabattu | 0,35, soit 23 dB retenus sur 65,7 mesurés |

Points de comparaison, mesurés avec les mêmes outils : la banque enregistrée est
à 0,26–0,81 de vitesse de lecture et 10,8 % de saut ; le V8 généré du
5 septembre à 0,74–1,36 et 1,30 demi-ton.

## Ce que la convergence a révélé

Les deux sources avaient divergé sans que rien ne le dise — c'est ce que les
copies font. Écarts relevés entre la géométrie figée du banc et la bibliothèque
de l'application :

| Moteur | Écarts | Le plus lourd |
|---|---|---|
| V8 croisé vs `gm-ls` | 5 sur 29 | `inputSampleNoise` 0,05 contre 0 |
| Quatre cylindres vs `subaru-ej25` | 7 sur 29 | les durées de came, 220 contre 232 et 236 |

`inputSampleNoise` est celui qui s'entend : mesuré le 8 septembre, il ajoutait
8,7 dB à 5 600 Hz et 25,5 dB à 8 000 Hz — le cliquetis que David a traqué toute
la journée. La correction n'avait jamais atteint le banc, qui a donc produit
trois banques avec.

**Conséquence : régénérer `v8-crossplane` ou `i4-check` ne rendra pas le son
d'avant.** C'est voulu, le TypeScript portant les valeurs corrigées, mais il
fallait le dire.

Et le contrat annonçait un test d'accord entre ses deux listes qui **n'existait
pas**. Il existe : `src/core/preset/engine-contract.test.ts`.
