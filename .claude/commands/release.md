# Préparer une version de Speed

Tu prépares une version de **Speed**. Déroule les étapes ci-dessous **une par
une**, en attendant la réponse de David à chacune. Ne regroupe pas, ne saute
rien.

**Langue** : tu parles français, et tout ce que tu écris est en français.

**Ce qui fait foi.** Les règles — git flow, contrôle qualité, hygiène de
documentation, format du CHANGELOG — sont dans [`CLAUDE.md`](../../CLAUDE.md).
Cette commande n'ajoute aucune règle : elle donne l'ordre des opérations et la
manière d'écrire des notes de version lisibles. En cas de contradiction,
`CLAUDE.md` gagne.

## Le contexte à ne pas oublier

- Branche de release : **`release/x.y.z`, créée depuis `develop`**. Jamais
  depuis `main`, jamais depuis une branche de travail, jamais directement sur
  `develop`.
- La PR d'une branche de release cible **`main`**.
- **Un seul fichier de version** : `package.json`. Il n'y en a pas d'autre.
- Le merge dans `main` et le tag `vX.Y.Z` sont **la main de David**. Ne les fais
  pas, ne les propose pas comme faits.
- La poussée sur `main` et le tag publient l'image Docker : une version sortie
  part en production dans la minute.

## Étape 1 — Ce qui a changé

Relève les changements depuis la dernière version : `git log` depuis le dernier
tag (ou depuis le début s'il n'y en a pas), et la section `[Non publié]` du
`CHANGELOG.md`.

Présente à David un relevé court, groupé par nature : nouveautés, corrections,
ce qui touche au son, ce qui touche à l'installation. Signale ce que tu trouves
dans les commits et qui **manque** au CHANGELOG — c'est le principal intérêt de
cette étape.

Attends sa réponse.

## Étape 2 — Le numéro

Propose un numéro en gestion sémantique, et dis en une phrase pourquoi :

- **MAJOR** — un profil enregistré par la version précédente ne se relit plus,
  ou un réglage disparaît. C'est le seul vrai cas de rupture ici.
- **MINOR** — une nouveauté, un réglage nouveau, un comportement nouveau.
- **PATCH** — des corrections seulement.

**Attends sa confirmation explicite avant d'écrire quoi que ce soit.**

## Étape 3 — La branche

Vérifie la branche courante. Si ce n'est pas `release/x.y.z`, crée-la depuis
`develop` à jour (`git fetch`, puis `git pull --ff-only`). Aucune écriture de
release avant ça.

## Étape 4 — Les notes de version

Écris `docs/releases/vX.Y.Z.md`, en français, pour quelqu'un qui conduit la
voiture — pas pour quelqu'un qui lit le code.

- Une phrase d'introduction qui dit ce que cette version change à l'usage.
- Des paragraphes courts par thème, pas une liste plate de commits.
- Ce qui s'entend se décrit par ce qu'on entend. Ce qui se mesure se donne
  chiffré.
- Pas de nom de fichier, pas de nom de fonction, pas de jargon.
- Si un point de la version n'a pas pu être vérifié en roulant, dis-le : le
  dépôt a une section « Ce qui n'est pas vérifié » et c'est une qualité, pas un
  défaut à masquer.

Présente-les à David et attends son accord.

## Étape 5 — Les écritures

Une fois les notes validées :

1. `package.json` — le numéro de version.
2. `CHANGELOG.md` — `[Non publié]` devient `[X.Y.Z] — AAAA-MM-JJ`, et une
   nouvelle section `[Non publié]` vide est ouverte au-dessus.
3. `README.md` — le tableau « État du projet » si un lot se termine avec cette
   version.
4. `.backlog/` — statuts des tickets livrés, index à jour, et compactage dans
   `archive/` des lots clos depuis plus de trois jours.
5. Contrôle qualité complet, vert.
6. Commit : `chore(release): version X.Y.Z`.

## Étape 6 — La PR

Ouvre la PR de `release/x.y.z` vers **`main`**.

- Titre : `release: vX.Y.Z`
- Corps : le résumé de la version, les ruptures s'il y en a, et ce que David
  doit faire après le merge — tirer la nouvelle image dans Portainer, et
  vérifier en roulant ce qui ne se vérifie qu'ainsi.

Donne l'URL de la PR, puis **arrête-toi**. Rappelle à David ce qui lui reste :
merger dans `main`, poser le tag `vX.Y.Z`, le pousser, et remettre `main` dans
`develop`.
