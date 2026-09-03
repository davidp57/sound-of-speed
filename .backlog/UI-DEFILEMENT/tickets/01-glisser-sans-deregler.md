# 01 — Un glissement vertical fait défiler, et ne dérègle rien

**Statut :** ⬜ prêt

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

## Critères d'acceptation

- [ ] Un glissement vertical commencé sur un curseur fait défiler la page
- [ ] Un glissement horizontal commencé sur un curseur le déplace toujours
- [ ] Aucun curseur de l'écran de configuration n'est resté sans le comportement
- [ ] La saisie au clavier, à la souris et par le champ numérique est intacte
- [ ] 🧑 Vérifié dans la voiture : le navigateur embarqué est un Chromium ancien,
      et c'est le seul avis qui compte
