# IMAGE-ARM64 — l'image du serveur échoue une fois sur deux en arm64

**Statut :** ✅ fait — 13 septembre 2026
**Branche :** `fix/plus-d-emulation-pour-construire-l-image`
**Version visée :** 0.2.30

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

**Et ça s'est aggravé le soir même** : les deux publications suivantes — celles
du lot COMPTES — ont échoué toutes les deux, au même endroit. « Une fois sur
deux » était optimiste.

**Ce n'est pas une gêne de confort** : l'architecture arm64 est celle du NAS, et
c'est l'image qui tourne en production.

## La cause, et ce qui la fait disparaître

`Dockerfile.serveur` a deux étages. Le premier est épinglé
`--platform=$BUILDPLATFORM` : il tourne nativement sur le runner. Le second n'en
a pas, donc buildx le construit **une fois par architecture visée**, et la
variante arm64 passe sous QEMU. S'il n'y faisait que des `COPY`, cela ne
coûterait rien — mais il y exécutait `npm ci`.

La raison écrite dans le fichier était que le pilote de la base
(`@libsql/client`) livre un binaire par plateforme, choisi à l'installation
d'après la machine qui installe : il fallait donc installer sur l'architecture
visée.

**Cette prémisse est fausse.** npm sait installer pour une autre plateforme.
Mesuré sur un poste Windows, à partir du `package-lock.json` du dépôt :

| commande | ce que `node_modules/@libsql/` contient |
|---|---|
| `npm ci --omit=dev --ignore-scripts` | `win32-x64-msvc` |
| la même, `--cpu=arm64 --os=linux --libc=musl` | `linux-arm64-musl` |
| la même, `--cpu=x64 --os=linux --libc=musl` | `linux-x64-musl` |
| la même, **`--cpu=amd64`** `--os=linux --libc=musl` | **rien** |

L'installation de production a donc été déplacée dans l'étage natif, avec ces
trois drapeaux, et `node_modules` est copié dans l'étage final. Celui-ci
n'**exécute** plus rien : que des copies, que QEMU ne touche pas.

**La quatrième ligne du tableau est le piège**, et c'est pour elle que le remède
porte un contrôle. Buildx nomme l'architecture `amd64`, npm attend `x64` : passer
`TARGETARCH` tel quel à `--cpu` fait installer **aucun** binaire, sans erreur —
et publierait une image qui refuse de démarrer. D'où la traduction explicite,
et le `test -d` qui arrête la construction si le binaire attendu manque.

## Ce qu'il faut obtenir

- [x] La publication de l'image ne rougit plus par intermittence — plus rien ne
      s'émule pendant la construction
- [x] L'image amd64 est vérifiée : le travail `essai` la construit, la démarre et
      lui fait tenir le contrat en entier, avant que la publication ne parte
- [ ] L'image arm64 est vérifiée — elle démarre. **Laissé ouvert, et c'est
      délibéré** : la seule façon de l'exécuter en intégration serait sous le
      QEMU dont on vient de se débarrasser, ce qui réintroduirait exactement la
      panne qu'on retire. À rouvrir le jour où un runner arm natif est disponible
      sur ce dépôt.
- [x] La raison du remède est écrite, pour qu'une mise à jour ne le défasse pas —
      dans `Dockerfile.serveur`, à côté de la ligne qu'elle explique

## Ce qui n'a pas été retenu

- **Relancer, et vivre avec.** Le pire des deux mondes pour un contrôle, qui
  n'apprend plus rien quand il ment une fois sur deux.
- **Épingler la version de binfmt/QEMU.** Un contournement : il garde
  l'émulation, et se défait à la prochaine mise à jour.
- **Un runner arm natif.** Il supprimerait aussi la cause, mais au prix d'une
  construction en matrice et d'une fusion de manifestes — beaucoup de plomberie
  pour le même résultat, alors qu'il n'y avait qu'une prémisse fausse à corriger.
