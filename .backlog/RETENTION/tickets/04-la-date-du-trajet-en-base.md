# 04 — Le dépôt sait quand le trajet a eu lieu

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Un dépôt porte deux dates : celle où il est arrivé sur le serveur, qu'il avait
déjà, et **celle où le trajet a été enregistré**, qui est nouvelle. C'est la
seconde qui décidera de l'effacement.

Les dépôts déjà en base la reçoivent au passage : les 94 de la production
prétendent tous dater du 12 septembre 2026 à 20 h 32, qui est l'heure de la
reprise, pas celle des trajets.

## Ce à quoi il faut faire attention

- **La date se lit dans le nom.** Les tranches la portent déjà, et le cœur sait
  déjà découper un nom de tranche ; il lui manque seulement de rendre un instant
  plutôt qu'une chaîne. C'est là que la conversion va, avec ses tests, pas dans
  le serveur.
- **Le nom et l'en-tête disent la même chose.** Vérifié le 12 septembre sur les
  six sessions lisibles : l'horodatage du nom concorde avec le `startedAt` de
  l'en-tête. Lire l'en-tête donnerait la même date mais obligerait à décompresser
  la première tranche à chaque passage de la règle. Le nom suffit.
- **Le défaut n'est pas propre à la reprise.** Une trace enregistrée hors réseau
  et remontée trois jours plus tard porte elle aussi une date de dépôt
  postérieure au trajet. Le nouveau champ vaut pour tous les dépôts, pas
  seulement pour les repris.
- **Deux traces anciennes n'ont pas de date lisible dans leur nom.** Elles
  portent un nom libre d'avant la convention. Leur donner la date de dépôt à
  défaut est acceptable — elles sont archivées et ne s'effaceront pas — mais il
  faut que ce soit un choix écrit, pas un trou.
- **La migration ne perd rien.** Le décompte avant et après doit montrer 94
  dépôts des deux côtés, et les mêmes octets.

## Critères d'acceptation

- [ ] Un dépôt qui arrive porte la date d'enregistrement tirée de son nom
- [ ] Les 94 dépôts déjà en base la reçoivent, et elle correspond à la date de
      leur nom
- [ ] Le découpage d'un nom de tranche rend un instant, et c'est couvert par des
      tests
- [ ] Un nom qui ne porte pas de date lisible reçoit la date de dépôt, et c'est
      documenté
- [ ] Le listage des dépôts rend la date du trajet, pas celle de l'arrivée
- [ ] Décompte avant et après la migration : même nombre de dépôts, mêmes octets
