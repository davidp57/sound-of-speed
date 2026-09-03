# 02 — Déposer une trace enregistrée en roulant

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le serveur accepte un dépôt, et lui seul

## Ce qu'il faut obtenir

Une trace enregistrée dans la voiture se dépose en un geste, et se retrouve
ensuite depuis n'importe quel appareil — sans manipuler de fichier dans la
voiture, ce que son navigateur interdit.

C'est le cœur du lot : les traces naissent en roulant et ne servent qu'ailleurs,
pour rejouer un trajet au poste de travail et régler sans reprendre la route.
Elles sont aussi la matière première de
[ETALONNAGE](../../ETALONNAGE/spec.md).

Le nom du fichier déposé doit permettre de retrouver la trace sans l'ouvrir :
date, durée et nom donné à l'enregistrement.

Un dépôt qui échoue le dit, et la trace reste dans le stockage local — elle n'est
jamais perdue au profit d'un dépôt raté.

## Critères d'acceptation

- [ ] Une trace se dépose depuis l'écran de télémétrie, en un geste
- [ ] Le fichier déposé se relit par la fonction d'import existante, à
      l'identique
- [ ] Le nom du fichier dit de quelle trace il s'agit
- [ ] Un dépôt qui échoue est signalé, et la trace reste enregistrée localement
- [ ] Une trace déjà déposée ne se réécrit pas en silence
- [ ] 🧑 Vérifié depuis la voiture : la trace se retrouve sur le poste de travail
