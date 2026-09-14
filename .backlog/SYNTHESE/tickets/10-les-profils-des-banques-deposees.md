# 10 — Un profil d'usine pour les banques déposées

**Statut :** ✅ fait

**Bloqué par :** aucun — suite directe du ticket 09

## Ce qui a déclenché

David, le 14 septembre 2026, juste après la livraison des trois banques :

> on n'a pas de profil pour l'ancien « v8 » ? la banque `procar`

Non. Et c'était un trou que le ticket 09 venait de creuser : en retirant le
profil V8 des profils livrés — parce qu'il désignait une banque non
redistribuable et restait donc **muet** chez qui découvre l'application — on a
supprimé du même coup le seul moyen de le retrouver depuis l'interface. Chez
David, qui a la banque, c'était une perte sèche : il venait de supprimer ses
profils.

## Ce qui est fait

**`missingFactoryProfiles` prend les banques listées par le serveur.** Un profil
d'usine réglé sur une banque déposée est proposé **quand cette banque est là**,
et jamais sinon. La liste vient de `banks`, que l'application peuple déjà en
interrogeant `/audio/` : rien de neuf à demander au serveur.

Une liste dédiée le déclare, plutôt que de le déduire : `depositFactoryProfiles()`
dans `core/preset/defaults.ts`. La déduction aurait ressuscité « Route » et
« Sport », deux anciens calibrages qui vivent dans `knownFactoryProfiles()` pour
la seule reprise et que personne ne veut revoir dans une liste.

Vérifié dans le navigateur, stockage vidé puis « Profils d'usine » : quatre
profils reviennent — les trois livrés plus **V8 musclecar**, parce que le serveur
de développement liste sa banque.

## Le renommage

David, dans le même message :

> renommons ce « procar » parce que je ne veux pas que ça fasse des vagues si
> jamais quelqu'un regarde ce que le serveur propose, même si c'est juste mon
> NAS. on pourrait mettre V8-musclecar

| | avant | après |
|---|---|---|
| dossier | `procar` | `v8-musclecar` |
| fichiers | `procar-on-low.wav`… | `on-low.wav`, `on-high.wav`, `off-low.wav`, `off-high.wav`, `limiter.wav` |
| nom du profil | « V8 » | « V8 musclecar » |
| identifiant du profil | `v8` | `v8` — inchangé |

Trois choix qui n'étaient pas dans la demande, et qui se défont si besoin :

1. **Minuscules et tirets**, comme `gm-ls` et `subaru-ej25`. Les dossiers d'une
   même liste se lisent mieux avec une seule convention.
2. **Le préfixe des fichiers disparaît.** Le dossier porte déjà le nom ; le
   répéter était la seconde trace à effacer, et les banques produites au banc
   n'en ont jamais eu.
3. **Le nom affiché devient « V8 musclecar »**, sans quoi deux profils
   s'appelleraient « V8 » dans la même liste — celui de la banque livrée et
   celui-ci.

**Les identifiants internes ne bougent pas** — ni `v8`, ni `procar` qui est celui
de l'ancien profil « Sport ». Ce sont les clés par lesquelles un profil
enregistré retrouve sa base : les changer ferait compléter un profil avec les
valeurs d'un autre, pour un gain nul du côté du serveur, où un identifiant ne
s'affiche pas.

## Ce qui reste à faire à la main

**Renommer le dossier sur le NAS.** L'application ne peut pas le faire : les
échantillons vivent dans un volume qui ne lui appartient pas. Tant que ce n'est
pas fait, le profil désigne des fichiers absents et reste muet.

```bash
cd "$SPEED_DATA/audio" && mv procar v8-musclecar && cd v8-musclecar \
  && for f in procar-*; do mv "$f" "${f#procar-}"; done
```

## Ce qui n'est pas vérifié

- **Le renommage sur le NAS**, qui appartient à David.
- **Rien n'a été écouté** : le profil désigne les mêmes échantillons qu'avant,
  sous d'autres noms.
