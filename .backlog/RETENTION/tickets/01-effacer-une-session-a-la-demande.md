# 01 — Une session s'efface à la demande

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Devant la liste des trajets du relecteur, on désigne une session et elle
disparaît du serveur. Toutes ses tranches partent ensemble, trace et journal
compris, et la liste se met à jour.

Avant d'effacer, une confirmation dit ce qui part : la date du trajet, le nombre
de tranches, le poids. Un effacement qui surprend est un effacement qu'on
regrette.

C'est le premier geste de suppression du serveur, et il rend utile tout de suite :
la base porte six départs avortés d'un kilo-octet que rien ne peut enlever.

## Ce à quoi il faut faire attention

- **L'unité est la session, pas la tranche.** Les tranches se regroupent déjà par
  leur nom, et le cœur sait le faire ; il n'y a pas de seconde règle de
  regroupement à écrire.
- **Deux traces anciennes n'appartiennent à aucune session.** Elles portent un
  nom libre, d'avant la convention de nommage, et le regroupement ne les voit
  pas. L'effacement doit donc accepter un dépôt isolé autant qu'une session,
  sinon elles resteront là pour toujours.
- **Effacer une session qui n'existe pas n'est pas une panne.** La voiture peut
  rejouer une demande ; la seconde ne doit pas rendre une erreur.
- **Le profil mesuré ne se recalcule pas après l'effacement.** Ce qu'une trace a
  montré est déjà cumulé, et le cumul ne se défait pas — c'est toute la promesse
  du lot. Effacer une trace n'enlève rien au profil.

## Critères d'acceptation

- [ ] Une session désignée disparaît entièrement, tranches de trace et de journal
      comprises
- [ ] Un dépôt isolé, sans session, s'efface aussi
- [ ] La confirmation nomme la date, le nombre de tranches et le poids avant
      d'effacer
- [ ] Effacer deux fois la même session ne rend pas d'erreur
- [ ] Le profil mesuré est inchangé après l'effacement — vérifié sur son poids et
      sa couverture
- [ ] Les six départs avortés de la base de production sont partis
