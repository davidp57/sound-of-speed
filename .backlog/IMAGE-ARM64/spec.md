# IMAGE-ARM64 — l'image du serveur échoue une fois sur deux en arm64

**Statut :** ⬜ prêt
**Branche :** à ouvrir
**Version visée :** à décider

Constaté le 13 septembre 2026, en publiant l'image `:develop` du lot
[RETENTION](../RETENTION/spec.md).

## Le constat

La construction multi-architecture de `Dockerfile.serveur` échoue par
intermittence, toujours au même endroit :

```
[linux/arm64 stage-1 4/7] RUN npm ci --omit=dev --ignore-scripts
qemu: uncaught target signal 4 (Illegal instruction) - core dumped
ERROR: process "/bin/sh -c npm ci …" did not complete successfully: exit code: 132
```

L'émulation arm64 tourne sous QEMU sur un runner amd64
(`docker/setup-qemu-action@v3`, sans version d'image épinglée). Le processus
`npm ci` y reçoit une instruction illégale — signal 4, code de sortie 132.

**Trois passages le 13 septembre : deux échecs, une réussite.** Le même commit a
construit ses trois images à la seconde tentative. Ce n'est donc pas le code du
dépôt, c'est l'émulation.

**Ce n'est pas une gêne de confort** : l'architecture arm64 est celle du NAS, et
c'est l'image qui tourne en production.

## Les pistes, non arbitrées

- **Relancer**, et vivre avec. Coût : une publication sur deux à reprendre à la
  main, et un rouge dans l'historique qui ne veut rien dire — le pire des deux
  mondes pour un contrôle, qui n'apprend plus rien quand il ment une fois sur
  deux.
- **Épingler la version de binfmt/QEMU** dans `docker/setup-qemu-action`. C'est
  le contournement habituel de ce défaut ; il faut trouver la version qui ne le
  porte pas, et l'écrire avec sa raison, sinon la prochaine mise à jour la
  remettra.
- **Construire l'arm64 sur un runner arm natif**, et supprimer l'émulation. Les
  runners arm hébergés existent chez GitHub pour les dépôts publics — **à
  confirmer sur ce dépôt**. Cela supprimerait la cause au lieu de la contourner,
  et raccourcirait probablement la construction.

## Ce qu'il faut obtenir

- [ ] La publication de l'image ne rougit plus par intermittence
- [ ] L'image arm64 est vérifiée — elle démarre, comme le fait déjà `essai` pour
      amd64
- [ ] La raison du remède est écrite, pour qu'une mise à jour ne le défasse pas
