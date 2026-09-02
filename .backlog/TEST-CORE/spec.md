# TEST-CORE — mettre le cœur sous test

**Statut :** ✅ fait
**Branche :** `feature/test-core`
**Version visée :** 0.2

## Le problème

Le projet n'a aucun test. Le contrôle qualité se limite à `npm run typecheck` et
`npm run build` : il attrape les erreurs de type, rien d'autre. Or le cœur de
l'application est du calcul, et du calcul dont la justesse s'entend :

- le conditionnement du signal a un comportement mesuré — « l'écart de suivi
  reste sous 1 km/h en accélération régulière » — que rien ne vérifie plus après
  la mesure initiale ;
- le moteur, la boîte et le mixage ont accumulé des cas particuliers qui sont
  exactement le genre de chose qu'une correction ultérieure casse sans bruit :
  découplage à l'arrêt et pendant un passage, seuil qui commande le rétrogradage
  en décélération, domaine jouable d'une couche qui l'efface hors de sa plage,
  dispersion aléatoire des passages ;
- la persistance des profils doit relire des fichiers écrits par une version
  antérieure. Une régression y fait perdre les réglages de David, pas seulement
  un test.

Chaque correction du son est aujourd'hui vérifiée à l'oreille et par une mesure
ponctuelle, refaite à la main. Rien ne garantit qu'un correctif n'en défait pas
un autre.

## La solution

Poser un filet sous `core/`, et lui seul. L'interface n'est pas concernée : ce
qui se juge à l'écran ou à l'oreille continue de se juger comme ça.

Le cœur s'y prête déjà — `core/` n'importe jamais Vue, les trois sources de
vitesse passent par la même interface, et `core/audio/mix.ts` est une fonction
pure. Il n'y a donc pas de coutures à créer : elles existent, il suffit de les
utiliser.

À la fin du lot, le contrôle qualité obligatoire devient `npm run typecheck`,
`npm run lint`, `npm test` et `npm run build`, et la CI fait la même chose sur
chaque PR.

## Histoires

1. En tant que développeur, je veux qu'un test échoue quand je dégrade le suivi
   du conditionnement, pour ne pas découvrir la régression en roulant.
2. En tant que développeur, je veux pouvoir rejouer une trace synthétique
   d'entrée et vérifier la sortie du conditionnement, sans GPS ni voiture.
3. En tant que développeur, je veux qu'un test dise que le moteur retombe au
   ralenti à l'arrêt et pendant un passage, parce que c'est le comportement le
   plus facile à casser en touchant à l'inertie.
4. En tant que développeur, je veux qu'un test couvre le régime de passage
   rapport par rapport, l'écart selon la charge et le seuil de rétrogradage,
   pour pouvoir toucher à la boîte sans la faire passer au rupteur.
5. En tant que développeur, je veux qu'un test vérifie qu'une couche sortie de
   son domaine jouable est bien réduite au silence, et qu'un fondu à puissance
   constante conserve le niveau.
6. En tant que développeur, je veux qu'un test relise un fichier de profil de la
   version de format précédente et vérifie que rien n'est perdu.
7. En tant que développeur, je veux que le lancement de `npx vitest run` fasse
   partie du contrôle qualité et de la CI, pour que le filet serve.

## Décisions d'implémentation

- **Vitest**, parce que le projet est déjà sur Vite : même configuration, même
  résolution de modules, rien à ajouter au chargement de production.
- **ESLint** entre dans le même lot : c'est le seul contrôle du gate cible qui
  manque encore, et l'ajouter séparément coûterait une deuxième passe de
  configuration et de correction du code existant.
- **Périmètre : `core/` uniquement.** Pas de test de composant, pas de rendu, ni
  de bibliothèque d'essai d'interface. `src/state.ts` est de l'assemblage : il
  n'est pas visé.
- **Aucune modification du code de production pour la testabilité.** Les
  coutures existent déjà. Si un test réclame une couture nouvelle, c'est un
  signal à remonter, pas une refactorisation à faire en passant.
- Le Web Audio ne se simule pas. Ce qui se teste, c'est `mix.ts` — la fonction
  qui décide des gains et des vitesses de lecture — pas le graphe qui les
  applique. L'analyse d'échantillon (`analyze.ts`) se teste sur un signal
  synthétique construit dans le test.
- Les tests sont écrits en français dans leurs descriptions (`it('retombe au
  ralenti pendant un passage')`), comme le reste du dépôt.
- Les fichiers de test vivent à côté de leur module : `conditioner.test.ts`
  auprès de `conditioner.ts`. Pas de dossier `tests/` parallèle à maintenir.

## Décisions de test

Un bon test ici vérifie un **comportement observable** du module, pas sa
mécanique interne : on donne une suite de mesures et on regarde ce qui sort. Un
test qui inspecte un champ privé ou qui compte les appels à une fonction interne
est un test à réécrire.

Les modules visés, dans l'ordre de valeur :

| Module | Ce qu'on vérifie |
|---|---|
| `core/speed/conditioner.ts` | continuité de la sortie, écart de suivi sur une trace synthétique à 1 Hz, zone morte, sort des mesures aberrantes |
| `core/engine/engine.ts` | découplage à l'arrêt et au passage, montée à vide, frein moteur, plafonnement au rupteur, déduction de la charge |
| `core/drivetrain/gearbox.ts` | passage rapport par rapport, écart selon la charge, seuil de rétrogradage, rétrogradage forcé, temporisations |
| `core/audio/mix.ts` | fondus à puissance constante, effacement hors domaine jouable, effacement du ralenti |
| `core/preset/store.ts` et `share.ts` | relecture d'un profil de format antérieur, aller-retour export/import, profil transporté par URL |
| `core/audio/analyze.ts` | ancrage proposé sur un signal synthétique de raie d'allumage connue |

Il n'y a pas d'art antérieur dans le dépôt : ce lot est le premier. La
convention qu'il pose est celle que les lots suivants reprendront.

**Couverture visée : environ 80 % sur `core/`**, et rien d'exigé ailleurs. Le
chiffre est un garde-fou, pas un but : un module de calcul non couvert est un
oubli, une ligne de garde défensive non couverte ne l'est pas.

## Hors périmètre

- Les tests d'interface, de rendu et de bout en bout.
- Tout ce qui ne se vérifie qu'en roulant : GPS écran éteint, verrou d'écran,
  justesse du rendu sonore. Ces points restent dans « Ce qui n'est pas vérifié »
  du README, et le lot ne prétend pas les couvrir.
- La couverture de `src/state.ts` et de `src/ui/`.
- Toute correction de bug découverte en écrivant les tests : elle sort du lot et
  part en `fix/…`, avec son propre ticket. Un lot qui installe un filet ne
  répare pas en même temps ce que le filet attrape.

## Ce que le lot a donné

**211 tests**, et **94,6 % des lignes de `core/`** couvertes (83,8 % des
branches, 91,7 % des fonctions) — au-delà des 80 % visés. Mesuré par
`npm run coverage`.

| Module | Lignes |
|---|---|
| `audio/analyze.ts` | 100 % |
| `audio/mix.ts` | 100 % |
| `preset/defaults.ts` | 100 % |
| `preset/schema.ts` | 100 % |
| `preset/wizard.ts` | 100 % |
| `speed/replay.ts` | 100 % |
| `speed/simulator.ts` | 100 % |
| `speed/source.ts` | 100 % |
| `speed/conditioner.ts` | 98,8 % |
| `preset/store.ts` | 98,6 % |
| `engine/engine.ts` | 96,5 % |
| `drivetrain/gearbox.ts` | 93,2 % |
| `preset/share.ts` | 79,6 % |
| `preset/library.ts` | 0 % |

Le périmètre a été élargi en cours de route à `simulator.ts`, `replay.ts`,
`wizard.ts` et `defaults.ts`, que la liste des tickets ne nommait pas : ce sont
des modules de calcul, et la règle posée plus haut dit qu'un module de calcul
non couvert est un oubli.

`preset/library.ts` reste à zéro et c'est délibéré : il ne calcule rien, il va
chercher la bibliothèque de profils sur le réseau. Le reste non couvert de
`share.ts` est le repli sans compression et la lecture de l'adresse du
navigateur, qui demandent une fenêtre.

## Ce que le lot a trouvé

Quatre défauts, dont un audible en roulant. Aucun n'a été corrigé ici — le lot
[FIX-CORE](../FIX-CORE/spec.md) s'en charge, et chaque défaut est tenu en
attendant par un test qui décrit le comportement actuel :

1. **La pente d'accélération est calculée sur tout l'historique** (seize
   secondes) et non sur la fenêtre déclarée. Deux conséquences : le réglage
   « fenêtre d'accélération » ne commande rien, et après une accélération suivie
   d'une vitesse tenue, le régime reste trop haut une quinzaine de secondes.
2. **Une mesure GPS aberrante est plafonnée, non rejetée** : une valeur absurde
   fait monter la vitesse conditionnée jusqu'au plafond de plausibilité.
3. **La boucle locale IPv6 n'est pas reconnue** dans l'avertissement de partage.
4. **L'aperçu du guide annonce un passage** dont il calcule un autre.

Un cinquième point était une erreur de **documentation**, corrigée ici même : le
README attribuait au réglage « Ne jamais monter sous » la vitesse à laquelle la
boîte rétrograde en décélération. La mesure montre que ce réglage n'y change
rien — c'est « Descente sous » qui commande — et un test tient désormais la
correction.

## Notes

Le lot est écrit à la main, sans passer par `/to-spec` : il naît de la mise en
place du process elle-même. Les suivants passeront par les skills.

L'ordre des tickets suit la valeur décroissante : le conditionnement d'abord,
parce que c'est la pièce importante du projet et celle dont le comportement est
déjà chiffré, donc immédiatement vérifiable.

Une leçon d'écriture, pour les lots suivants : sur les onze premières
assertions écrites de mémoire, **neuf bornes étaient fausses** — arrondis,
limites asymptotiques, rapports de boîte irréalistes, et surtout des chiffres
supposés au lieu d'être mesurés. La méthode qui a marché est celle du dépôt :
instrumenter, relever la valeur, puis écrire l'assertion autour du chiffre
obtenu, en le notant en commentaire.
