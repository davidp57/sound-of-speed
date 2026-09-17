# 01 — Un glissement vertical fait défiler, et ne dérègle rien

**Statut :** 🧑 **repris par [INTERFACE](../../INTERFACE/spec.md)**

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Sur l'écran de configuration, un glissement du doigt de haut en bas fait défiler
la page, où qu'il commence — y compris sur un curseur. Le curseur ne se déplace
plus que sur un glissement horizontal, ou sur un appui suivi d'un déplacement
franchement latéral.

Le remède est le comportement tactile déclaré par chaque curseur : le vertical
revient à la page, l'horizontal reste au curseur. Il tient en une déclaration,
appliquée une fois pour toutes au composant de saisie numérique — il y en a une
cinquantaine à l'écran, et aucun ne doit être oublié.

La saisie au clavier et à la souris ne change pas : c'est ainsi qu'on règle au
poste de travail.

## Ce qui n'a pas pu être vérifié au poste de travail

Le comportement tactile est appliqué par le compositeur du navigateur, sur de
**vraies** entrées tactiles. Un glissement simulé par l'outillage est un
événement de souris, que ce comportement ne concerne pas — essayé : la valeur du
curseur change et la page ne défile pas, exactement comme avant le ticket, parce
que la souris n'est pas visée. Et un événement tactile fabriqué en script ne
déclenche pas le défilement natif, donc il ne prouve rien non plus.

Ce qui est établi : la déclaration est bien présente sur les cinquante et un
curseurs, valeur calculée relevée dans le navigateur. Ce qui ne l'est pas : son
effet. C'est la raison pour laquelle le ticket 02 vaut par lui-même — la bande
de défilement ne dépend d'aucun comportement du navigateur.

## Critères d'acceptation

- [ ] 🧑 Un glissement vertical commencé sur un curseur fait défiler la page —
      non vérifiable au poste de travail, voir ci-dessus
- [x] Un glissement horizontal commencé sur un curseur le déplace toujours
- [x] Aucun curseur de l'écran de configuration n'est resté sans le comportement
      — cinquante et un curseurs, tous relevés
- [x] La saisie au clavier, à la souris et par le champ numérique est intacte
- [ ] 🧑 Vérifié dans la voiture : le navigateur embarqué est un Chromium ancien,
      et c'est le seul avis qui compte
