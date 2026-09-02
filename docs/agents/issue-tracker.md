# Suivi des tickets : le dossier `.backlog/`

Configuration lue par les skills `/to-spec` et `/to-tickets`. Elle remplace leur
comportement par défaut (`.scratch/…`) : **tout est versionné dans le dépôt**,
sous `.backlog/`, qui est la source de vérité du périmètre et du statut.

Les artefacts sont écrits **en français**, dans le registre du dépôt (voir
« Écrire en français ordinaire » dans [`CLAUDE.md`](../../CLAUDE.md)).

## Conventions

- **Un lot par dossier** : `.backlog/<LOT-ID>/`. Le `LOT-ID` est court, en
  majuscules, parlant : `TEST-CORE`, `GPS-BG`, `SHARE-QR`.
- **La spécification** est `.backlog/<LOT-ID>/spec.md` (une seule par lot).
- **Les tickets** sont `.backlog/<LOT-ID>/tickets/<NN>-<slug>.md`, numérotés
  depuis `01` dans l'ordre des dépendances — les bloquants d'abord. Le `<NN>`
  ne sert qu'à cet ordre : ce n'est pas un identifiant de ticket.
- **Un ticket par fichier**, jamais un fichier qui les rassemble.
- **Les arêtes de blocage** sont explicites : chaque ticket porte une ligne
  `Bloqué par :` qui cite les numéros et titres des tickets qui le bloquent, ou
  « aucun, peut démarrer tout de suite ».
- **Le statut** est une ligne `Statut :` en tête de chaque fichier — voir
  [`triage-labels.md`](triage-labels.md).
- **L'index** est [`.backlog/README.md`](../../.backlog/README.md) : un tableau
  récapitulatif de tous les lots, tenu à la main par l'agent à la création et à
  la clôture d'un lot. Pas de script générateur.
- **L'archive** : un lot clos depuis plus de trois jours quitte son dossier pour
  un fichier compact `.backlog/archive/<LOT-ID>.md`, où les tickets sont
  recompactés en un seul tableau.
- **Le séquencement n'est pas ici** : il vit dans le tableau « État du projet »
  du [`README.md`](../../README.md). `.backlog/` détient le **périmètre et le
  statut**, le README l'**ordre et l'avancement d'ensemble**.

## Quand un skill dit « publier sur le suivi de tickets »

- **Une spécification** → écrire `.backlog/<LOT-ID>/spec.md`, créer le dossier
  au besoin, et ajouter une ligne au tableau « Lots actifs » de
  `.backlog/README.md`.
- **Un ticket** → écrire `.backlog/<LOT-ID>/tickets/<NN>-<slug>.md`.
- Les artefacts neufs sont créés à `Statut : ⬜ prêt`.

## Quand un skill dit « récupérer le ticket concerné »

Lire le fichier au chemin indiqué. David passe normalement l'identifiant du lot
(`TEST-CORE`) ou le chemin du ticket directement.

## Modèle de ticket

```markdown
# <NN> — <titre du ticket>

**Statut :** ⬜ prêt

**Bloqué par :** <numéros et titres des tickets qui le bloquent, ou « aucun, peut
démarrer tout de suite »>

## Ce qu'il faut obtenir

Le comportement de bout en bout que ce ticket rend possible, vu de
l'utilisateur — pas une liste de couches à empiler.

## Critères d'acceptation

- [ ] …
- [ ] …
```

Pas de chemin de fichier ni d'extrait de code dans un ticket : ça périme vite.
Seule exception, un extrait qui encode une décision plus précisément que la
prose ne le ferait (forme d'un type, machine à états) — réduit à la décision.

## Cycle de vie d'un lot

1. `/grilling` cuisine le périmètre quand il n'est pas évident.
2. `/to-spec` écrit `.backlog/<LOT-ID>/spec.md` (⬜ prêt) et la ligne d'index.
3. `/to-tickets` le découpe en `tickets/<NN>-<slug>.md` (⬜ prêt), bloquants
   d'abord.
4. Le travail fait bouger les statuts (⬜ → 🔄 → ✅) sur le ticket, sur la spec
   et dans l'index.
5. Trois jours après la clôture, le lot est compacté dans
   `.backlog/archive/<LOT-ID>.md` et l'index est mis à jour.

**Une branche et une PR par lot** (pas par ticket), depuis `develop` et vers
`develop`. Le nom de la branche est donné par la ligne `Branche :` de la spec —
`feature/<slug>` ou `fix/<slug>`.
