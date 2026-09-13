# CLAUDE.md — Sound of Speed

Instructions pour Claude Code, et pour tout agent qui travaille sur ce dépôt. Ce
fichier est la **source de vérité du process** : langue, git flow, contrôle
qualité, backlog, release. Il n'y a pas de `copilot-instructions.md` ici.

Le fonctionnement de l'application est décrit dans [`README.md`](README.md), son
vocabulaire dans [`CONTEXT.md`](CONTEXT.md). Ce fichier ne les répète pas : il
donne ce qui ne se déduit pas de la lecture du code.

## Règles de langue

- **Identifiants du code** — types, variables, fichiers, branches : **anglais**.
- **Commentaires, docstrings, documentation, README, CHANGELOG, backlog** :
  **français**.
- **Textes affichés à l'écran** : français, écrits en clair dans les composants.
  Le projet est mono-langue, il n'y a pas d'i18n et il n'en faut pas.
- **Messages de commit** : Conventional Commits, avec la description en
  français — `feat(audio): caler les boucles sur le passage par zéro`.
- **Communication avec David** : français.

### Écrire en français ordinaire

Le dépôt a un registre d'écriture, tenu depuis le début et corrigé
explicitement par le commit `Écrire en français ordinaire` (fecdfbd). Il vaut
pour le README, les commentaires, le CHANGELOG et les messages de commit :

- Des phrases courtes, des mots courants. Pas de franglais quand le français
  existe : *couche* et non *layer*, *rapport* et non *gear*, *échantillon* et
  non *sample*.
- Pas de superlatif, pas d'emphase, pas d'emoji. Un chiffre mesuré vaut mieux
  qu'un adjectif : « l'écart reste sous 1 km/h » et non « le suivi est
  excellent ».
- Un commentaire dit **pourquoi**, pas quoi. Le quoi se lit dans le code.
- Ce qui n'est pas vérifié est annoncé comme tel. La section « Ce qui n'est pas
  vérifié » du README est une pièce du projet, pas un aveu à effacer.
- Un titre de commit dit l'effet obtenu, pas le fichier touché.

## Le projet en une page

Sound of Speed mesure la vitesse au GPS, en calcule un régime moteur et un rapport de
boîte, et joue le son correspondant à partir d'enregistrements réels. Il donne
un son de moteur à une voiture qui n'en fait pas.

**Pas de serveur, pas de compte, pas de base de données.** Tout tourne dans le
navigateur de la voiture ; les profils vivent dans le stockage local, s'exportent
en fichier et se partagent par URL. L'application est installable et fonctionne
hors réseau.

**Pile** : Vue 3 (`<script setup>`) + TypeScript + Vite. Aucune bibliothèque
d'interface, aucun gestionnaire d'état : `src/state.ts` est l'état, en `ref`
Vue. Seule dépendance de production hors Vue : `qrcode-generator`, pour le
partage de profil.

**Déploiement** : image nginx construite et publiée par GitHub Actions, tirée
par Portainer sur un NAS Synology derrière le proxy inversé DSM. Les
échantillons audio restent **hors de l'image**, dans un volume du NAS.

## Commandes

```powershell
npm run dev          # serveur de développement (http://localhost:5173)
npm run dev:mobile   # idem en HTTPS, pour tester le GPS depuis un téléphone
npm run relecteur    # idem, avec les dossiers du NAS, pour /relecteur.html
npm run typecheck    # vue-tsc --noEmit
npm run lint         # eslint
npm test             # vitest, une passe
npm run test:watch   # vitest en continu, pendant qu'on écrit
npm run coverage     # couverture de core/
npm run build        # typecheck + build de production
npm run banque       # relevé d'une banque : ancrages et gains proposés
npm run verdict      # ce que la règle de rétention emporterait, sur une copie de la base
npm run transcode    # compression des échantillons en FLAC
npm run deploy       # recopie du build vers le NAS
npm run icons        # génération des icônes de l'application
npm run htpasswd     # fichier de mots de passe nginx
```

## Contrôle qualité — avant chaque poussée

**Obligatoire, et c'est exactement ce que fait la CI.**

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run coverage` mesure la couverture de `core/` quand on veut la vérifier —
elle n'est pas dans le contrôle qualité, un chiffre n'étant pas un critère de
fusion.

Jamais de `--no-verify` sans raison écrite dans le message de commit.

## Architecture

### Une boucle, une chaîne

`core/loop.ts` cadence tout le reste, à un seul endroit, avec un repli quand la
page est masquée. À chaque tour, la chaîne se déroule dans cet ordre :

```
source de vitesse → conditioner → engine → gearbox → mix → audio/engine
   (brut, 1 Hz)      (continu)    (régime,  (rapport)  (gains,   (Web Audio)
                                   charge)              vitesses)
```

`src/state.ts` assemble ces pièces, expose l'état aux écrans et produit la
télémétrie. `src/ui/` contient les trois écrans (Conduite, Télémétrie,
Configuration) et l'aide.

### Trois invariants à ne pas casser

1. **Les trois zones ne se mélangent pas.** `core/` est le calcul, partagé entre
   le navigateur et le serveur ; `ui/` est l'affichage ; `server/` est ce qui
   tourne sur la machine qui sert. Le cœur n'importe ni Vue, ni un écran, ni le
   serveur — c'est ce qui le rend testable sans navigateur ; l'interface
   n'importe pas le serveur, sinon la voiture téléchargerait un moteur de base
   de données ; et le serveur n'importe pas d'écran.

   **Ce n'est plus une consigne mais une règle** : `npm run lint` refuse ces
   imports, et `src/core/frontieres.test.ts` vérifie qu'il les refuse
   réellement. Cet invariant a tenu des mois sur un `grep` lancé à la main ; il
   a tenu, mais rien ne le tenait.
2. **Les sources de vitesse passent toutes par `SpeedSource`**
   (`core/speed/source.ts`). Simulateur, GPS et rejeu sont interchangeables et
   rien en aval ne sait d'où vient le chiffre — aucune branche conditionnelle
   sur la source dans le moteur, la boîte ou l'audio. Une nouvelle source
   implémente l'interface, un point c'est tout.
3. **`core/audio/mix.ts` est une fonction pure.** Toute règle de mixage nouvelle
   va là, pas dans le graphe Web Audio : c'est ce qui permet de la vérifier sans
   sortir un son.

### Les pièces délicates

Le détail est dans la section « Comment ça marche » du README, à lire **avant**
d'y toucher :

- **`core/speed/conditioner.ts`** — la pièce importante du projet, et ce n'est
  pas le son. Le GPS ne livre qu'une mesure par seconde ; trois traitements se
  composent pour en faire un signal continu (pente sur fenêtre glissante,
  extrapolation, ressort amorti critique à pas fixe). Le compromis
  réactivité/douceur y est réglable, pas supprimable.
- **Le raccord des boucles** (`core/audio/engine.ts`, `analyze.ts`) — le
  chargement cherche où boucler, puis **mesure** le saut d'énergie sur les deux
  versions et garde la meilleure. Ne jamais remplacer cette mesure par un
  critère indirect : sur une prise en rampe, l'alignement dégrade au lieu
  d'améliorer.
- **La phase des couches** — chaque boucle démarre à une position tirée au sort,
  sinon deux couches du même enregistrement se renforcent en peigne.
- **L'horloge** — un `AudioWorklet` bat la mesure quand il est disponible, parce
  que le navigateur ralentit les minuteurs dès que la page n'est plus visible.
  Un média silencieux tourne en parallèle pour garder la session.
- **Le domaine jouable d'une couche** — l'ancrage règle la justesse, la bascule
  règle le point d'entrée : deux réglages distincts qu'on confond facilement.
  Une couche sortie de son domaine est effacée par le mixage, ce qui explique un
  gain nul là où le fondu devrait la faire entrer.

### Toucher aux réglages

Un réglage nouveau, c'est cinq choses et pas une :

1. un champ dans le schéma de profil (`core/preset/schema.ts`) ;
2. une valeur dans les profils par défaut (`core/preset/defaults.ts`) ;
3. un contrôle dans `ui/ConfigView.vue`, curseur **et** saisie ;
4. une ligne dans la « Référence des réglages » du README ;
5. si le format de profil change de forme, une montée de
   `PROFILE_FORMAT_VERSION` et la reprise des profils déjà enregistrés
   (`core/preset/store.ts`) — les profils des utilisateurs ne se perdent pas.

## Conventions de code

- **Vue 3 avec `<script setup>`** uniquement. Pas d'Options API.
- **Pas de bibliothèque d'interface, pas de gestionnaire d'état.** Si une
  dépendance semble nécessaire, la proposer avant de l'ajouter : elle pèsera sur
  une application qui doit se charger hors réseau.
- **Aucune animation.** Les valeurs changent, rien ne bouge pour le plaisir.
  C'est une règle d'ergonomie, pas un goût : l'écran se lit en conduisant.

  **La règle n'a pas d'exception.** Elle en a eu une, levée par David le
  3 septembre 2026 pour le décor qui défilait derrière les cadrans ; le décor
  s'est révélé raté, il a été retiré le 4 septembre, et le lot qui devait le
  redessiner est abandonné depuis le 7 septembre 2026 — l'exception est retirée
  avec lui. L'arbitrage est rendu : voir
  [DECOR-PERSPECTIVE](.backlog/archive/DECOR-PERSPECTIVE.md) avant de reproposer un
  décor.

  Une **aiguille de cadran** n'a jamais relevé de cette règle : son mouvement
  **est** la valeur, et un cadran se lit d'un coup d'œil là où un nombre se lit
  en le lisant. C'est le même argument d'ergonomie qui fonde la règle.
- **TypeScript strict.** Pas de `any` neuf, pas de `@ts-ignore` sans commentaire
  qui l'explique.
- Le calcul reste dans `core/`, l'affichage dans `ui/`. Un composant qui calcule
  un régime est un composant à refactoriser.

## Git flow

```
main                 production — c'est cette branche qui publie l'image :latest
develop              intégration, toujours déployable — publie l'image :develop
feature/<slug>       nouveauté, depuis develop
fix/<slug>           correction, depuis develop
hotfix/<slug>        urgence, depuis main
release/x.y.z        préparation de version, depuis develop, PR vers main
```

- **Jamais de commit direct sur `main` ni `develop`**, à deux exceptions près :
  les correctifs de phase de recette, et les commits **de documentation seule**
  (voir « Hygiène de documentation »), qui vont directement sur `develop`.
- **Une release se prépare uniquement sur `release/x.y.z`.** Ni depuis
  `develop`, ni depuis une branche de travail.
- **Un lot = une branche = une PR**, pas une PR par ticket.
- **Multi-poste** : `git pull --rebase` avant de commencer, et sur tout push
  rejeté. Jamais `git merge` pour rattraper.
- `main` reste la branche par défaut du dépôt : c'est à elle que `:latest`
  s'accroche, et c'est `:latest` que tire la pile de production.

### Repères

Un **repère** est un tag posé sur un état auquel on veut pouvoir revenir, sans
que ce soit une version publiée. Il ne suit donc pas `vX.Y.Z`, que la procédure
de release réserve aux versions taguées sur `main` : un nom en clair, et un
message qui dit de quoi c'est le repère.

| Repère | Ce qu'il marque |
|---|---|
| `avant-refonte` | `develop` en version 0.1.83, dernier état à avoir roulé avant la refonte décidée le 10 septembre 2026 — nouvelle origine du son, modèle mécanique revu, interface refaite, comptes utilisateurs. |

Y revenir sans rien perdre : `git switch --detach avant-refonte`.

### Messages de commit

Conventional Commits, description en français, à l'impératif ou au nominal :

```
feat(gearbox): rétrograder en décélération sous le régime plancher
fix(audio): ne plus faire jouer une couche hors de son domaine
docs(readme): décrire le domaine jouable des couches
chore(deps): passer vite en 6.0.7
ci(docker): publier aussi l'image depuis develop
refactor(state): sortir la télémétrie de l'assemblage
test(conditioner): couvrir l'extrapolation entre deux mesures
```

Types : `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`,
`ci`. Portées usuelles : `audio`, `engine`, `gearbox`, `speed`, `preset`, `ui`,
`offline`, `session`, `docker`, `ci`, `readme`, `backlog`.

Chaque commit porte le trailer d'attribution demandé par la configuration de
Claude Code.

## Workflow par défaut (autorisation permanente)

Pour tout changement non trivial, sauf consigne contraire, dérouler de bout en
bout sans attendre de feu vert intermédiaire :

0. **Se synchroniser d'abord** — `git fetch`, puis mettre la branche à jour
   (`git pull --ff-only` sur `develop`, ou rebase de la branche de travail sur
   `origin/develop`). Ne jamais raisonner sur « ce qui reste à faire » depuis un
   checkout périmé.
1. **Analyser** le périmètre et les fichiers touchés. Si la demande est
   exploratoire (question, analyse, pas de changement de code), s'arrêter là.
2. **Brancher** depuis `develop` (`feature/<slug>` ou `fix/<slug>`).
3. **Implémenter**, avec la checklist par changement ci-dessous.
4. **Contrôle qualité vert** avant de pousser.
5. **Si David doit essayer à la main** — tout ce qui ne se voit qu'en roulant :
   GPS, verrou d'écran, rendu sonore — s'arrêter et attendre son accord
   explicite avant de continuer.
6. **Commit + push.**
7. **Ouvrir la PR** vers `develop` et en donner l'URL.
8. **La merger dans `develop` quand la CI est verte** — tous les contrôles
   passés, aucun conflit. Un contrôle rouge ou en attente n'est pas un merge :
   attendre, ou dire ce qui bloque.

Cela vaut autorisation permanente de **committer, pousser, ouvrir des PR, les
merger quand la CI est verte — dans `develop` comme dans `main` — et poser le
tag de version**. Cela **n'autorise pas** de forcer une poussée : c'est le seul
geste qui reste à David, parce que c'est le seul qui détruise du travail.

**Ce que le tag engage, et qui ne disparaît pas avec la règle.** Le pousser
publie l'image : la version part en production dans la minute. Donc on ne tague
pas une version dont le contrôle qualité n'est pas vert, ni une version que
David n'a pas confirmée au numéro près. La procédure de release le demande
explicitement, et cette confirmation-là tient toujours.

Les deux restrictions ont été levées par David le 12 septembre 2026, en
préparant la version 0.2.0 : celle sur `main` d'abord, celle sur le tag dans la
foulée.

## Règles de travail (mode chirurgical)

- **Chirurgical** : ne jamais modifier du code, un commentaire ou une mise en
  forme sans rapport avec la demande. Pas de refactorisation d'un code qui
  marche, sauf si c'est *ça*, la demande.
- **Minimalisme** : le strict nécessaire. Pas de fonctionnalité ni d'abstraction
  spéculative.
- **Zéro supposition** : si une consigne est ambiguë ou contradictoire,
  s'arrêter et demander avant de coder.
- **Mesurer avant d'affirmer.** Ce projet vit de mesures : niveaux, sauts
  d'énergie, écarts de suivi. Un correctif audio ou de signal se justifie par un
  chiffre, pas par un raisonnement. Et ce qui n'a pas pu être vérifié se dit.

## Hygiène de documentation

| Document | Rôle | Mis à jour quand |
|---|---|---|
| [`README.md`](README.md) | documentation de référence, écrans, réglages, fonctionnement, installation | un comportement, un réglage ou une étape d'installation change |
| « État du projet » du README | **roadmap** — les lots et leur état | un lot est planifié, livré, ou abandonné |
| [`CONTEXT.md`](CONTEXT.md) | glossaire du vocabulaire du projet | un terme du domaine apparaît ou se précise |
| [`CHANGELOG.md`](CHANGELOG.md) | ce qui est **livré**, format Keep a Changelog, en français | chaque changement, sous `[Non publié]` |
| [`.backlog/`](.backlog/README.md) | ce qui est **prévu ou en cours** : périmètre et statut | un ticket est créé, avance ou se termine |
| [`docs/agents/`](docs/agents/) | configuration lue par les skills | la convention de backlog change |

`CHANGELOG.md` reflète le livré, `.backlog/` le prévu : rien ne doit être actif
dans les deux.

**Les commits de documentation seule vont directement sur `develop`** — un
commit dont le diff ne touche **que** du Markdown (`README.md`, `CHANGELOG.md`,
`CLAUDE.md`, `CONTEXT.md`, `docs/**`, `.backlog/**`) n'a besoin ni de branche ni
de PR. Dès qu'il touche aussi du code, un test, ou une configuration, il repasse
par le flux normal.

## Backlog et skills

Le backlog est le dossier **`.backlog/`**, source de vérité du **périmètre et du
statut**. Le séquencement, lui, reste le tableau « État du projet » du README —
ce projet n'a pas de `docs/roadmap.md` et n'en a pas besoin.

- Lot actif : `.backlog/<LOT-ID>/spec.md` + `tickets/<NN>-<slug>.md`.
- Index des lots : [`.backlog/README.md`](.backlog/README.md), tenu à la main.
- Lot clos depuis plus de trois jours : compacté en
  `.backlog/archive/<LOT-ID>.md`.
- Statut : une ligne `Statut :` par fichier (⬜ prêt · 🔄 en cours · 🧑 attend
  David · ✅ fait · 🚫 abandonné).

Quand David mentionne un point à suivre, il est écrit dans `.backlog/`
immédiatement — pas laissé dans la conversation.

### Les skills

Trois skills travaillent avec ce backlog, et lisent leur configuration dans
[`docs/agents/`](docs/agents/) :

- **`/grilling`** — cuisiner une idée ou une décision jusqu'à l'accord, par
  tournées de questions numérotées avec une recommandation par question. C'est
  l'entrée normale d'un lot dont le périmètre n'est pas évident.
- **`/to-spec`** — transformer la conversation en spécification, sans nouvel
  entretien : écrit `.backlog/<LOT-ID>/spec.md` et ajoute la ligne d'index.
- **`/to-tickets`** — découper en tickets « balle traçante » (tranches
  verticales complètes, chacune vérifiable seule), avec leurs arêtes de blocage
  explicites : écrit `.backlog/<LOT-ID>/tickets/<NN>-<slug>.md`.

Les trois fichiers de configuration :
[`issue-tracker.md`](docs/agents/issue-tracker.md) (où et comment écrire),
[`triage-labels.md`](docs/agents/triage-labels.md) (le vocabulaire de statut),
[`domain.md`](docs/agents/domain.md) (où est le vocabulaire du projet).

## Checklist par changement

1. Mettre à jour ou ajouter les tests dès que le changement touche `core/`. Le
   test s'écrit **avant** le code quand il s'agit d'un comportement ; les tests
   existants vivent à côté de leur module (`conditioner.test.ts` auprès de
   `conditioner.ts`).
2. Contrôle qualité vert (voir plus haut).
3. `CHANGELOG.md`, section `[Non publié]`.
4. `README.md` si un comportement, un réglage ou une étape d'installation
   change ; `CONTEXT.md` si un terme du domaine bouge.
5. Statut du ticket dans `.backlog/<LOT-ID>/` et ligne d'index, si le changement
   fait avancer ou clôt un ticket.
6. Monter la version de correctif dans `package.json` (`0.1.0` → `0.1.1`).

## Release

La commande [`/release`](.claude/commands/release.md) déroule la procédure. En
résumé :

1. Branche `release/x.y.z` depuis `develop` — jamais ailleurs.
2. Version proposée en semver, **confirmée par David** avant toute écriture.
3. `package.json` (seul fichier de version), `CHANGELOG.md` daté, notes de
   version en français.
4. Commit `chore(release): version X.Y.Z`, PR **vers `main`**.
5. Merge dans `main` quand la CI est verte, retour de `main` dans `develop`,
   puis tag `vX.Y.Z` et poussée du tag — c'est elle qui publie l'image, donc
   la mise en production. Elle suppose la version confirmée par David à
   l'étape 2 et le contrôle qualité vert.
