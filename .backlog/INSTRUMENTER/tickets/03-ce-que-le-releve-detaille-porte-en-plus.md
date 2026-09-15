# 03 — Ce que le relevé détaillé porte en plus

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** plus rien — 02 est livré le 15 septembre 2026.

## Ce qu'il faut obtenir

**Qu'un passage de rapport s'explique après coup.** Un rapport monte au mauvais
moment : la boîte compare un régime à un seuil, et aucun des deux n'est inscrit
nulle part. Le relevé détaillé porte donc, en plus de ce qu'il dit déjà :

- les **seuils de la boîte** — celui de montée et celui de descente, tels
  qu'appliqués à cet instant ;
- la **demande**, qui n'est pas la charge : elle monte avec elle et n'en
  redescend qu'en trois secondes, et c'est elle qui déplace le seuil ;
- l'**accélération brute**, à côté de la lissée — c'est l'écart entre les deux
  qui dit ce que le conditionnement a absorbé.

Ces quatre grandeurs sont exactement celles dont l'absence a laissé des questions
ouvertes depuis l'essai du 10 septembre.

## Ce à quoi il faut faire attention

- **La liste doit pouvoir s'allonger sans qu'on rouvre le sujet.** Le jour où un
  essai demande autre chose, l'ajout doit tenir en **un** endroit et non en
  trois. C'est une contrainte de conception, pas une fonctionnalité de plus :
  celui qui ajoutera une grandeur dans six mois ne relira pas ce ticket.
- **Rien ne change au cran ordinaire.** Les champs d'aujourd'hui restent les
  mêmes, dans le même ordre, avec les mêmes noms : un journal relu par le
  relecteur ou par le calcul d'étalonnage ne doit pas changer de forme selon un
  réglage d'écran.
- **Les noms restent courts.** Le journal est fait de clés brèves parce qu'il y
  en a des milliers, et une ligne par seconde en fait dix fois plus.
- **Le relecteur ne doit pas s'étrangler** sur un journal dix fois plus dense. Il
  n'a rien à montrer de ces grandeurs pour l'instant — c'est une vérification,
  pas un travail à faire.

## Critères d'acceptation

- [x] Au cran détaillé, le relevé porte les deux seuils de la boîte, la demande
      et l'accélération brute.
- [x] Au cran ordinaire, les champs sont inchangés — mêmes noms, même nombre.
- [x] Ajouter une grandeur au relevé détaillé se fait à un seul endroit, et un
      test le montre plutôt qu'un commentaire.
- [x] Le relecteur ouvre sans erreur un journal enregistré au cran détaillé.
- [x] Contrôle qualité vert.

## Ce qui a été fait

Les quatre grandeurs sont groupées dans un seul type porté par le cliché, et un
seul endroit les met en forme. **Un test tient la contrainte** plutôt qu'un
commentaire : les champs ajoutés au relevé détaillé sont exactement ceux que le
type déclare, ni plus ni moins. Le jour où l'un s'ajoute d'un côté sans l'autre,
il rougit.

Le cran ordinaire est vérifié par la liste exacte de ses champs, dans l'ordre :
un journal relu par le relecteur ou par le calcul d'étalonnage garde la forme
qu'il avait.
