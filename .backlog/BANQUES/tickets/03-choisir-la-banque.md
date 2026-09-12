# 03 — Choisir la banque d'un profil

**Statut :** ✅ fait

**Bloqué par :** 01 — Découvrir les banques présentes

## Ce qu'il faut obtenir

La banque d'un profil se choisit dans une liste, et l'écran dit si les fichiers
que le profil déclare y sont bien.

Aujourd'hui c'est une saisie de texte libre : on tape un nom de dossier en
aveugle, et une faute de frappe se découvre à l'activation du son, sous la forme
d'un silence.

Quand une banque est choisie et qu'un fichier déclaré manque, l'écran le dit
tout de suite, nommément. C'est aussi ce qui permet de comprendre qu'une banque
nouvelle n'a pas les mêmes noms de fichiers que l'ancienne — le cas le plus
courant.

## Critères d'acceptation

- [x] La banque se choisit dans la liste des banques présentes
- [x] La saisie libre reste possible : une banque peut exister sans que le
      serveur sache lister
- [x] Les fichiers déclarés par le profil et absents de la banque sont nommés
- [x] Changer de banque ne touche à aucun autre réglage du profil
- [x] La réinitialisation de la section des couches remet la banque d'usine

## Ce qui a été fait

Un menu au-dessus du champ de saisie, alimenté par la découverte du ticket 01 —
c'est elle qui trouve enfin son emploi. Le champ reste, toujours visible : la
liste le remplit, et il se tape à la main pour une banque que le serveur ne sait
pas lister. Sans aucune banque listée, l'écran est exactement celui d'avant.

Quand la valeur tapée ne correspond à aucune banque de la liste, le menu affiche
« Réglée à la main » — le même motif que le menu « On écoute », qui affiche
« Réglé à la main » hors de ses deux préréglages.

`missingFiles` (`core/audio/banks.ts`) compare les fichiers des couches
**actives** à ceux de la banque : une couche éteinte peut porter un nom laissé
pour plus tard. Sans banque listée, rien n'est signalé — ne rien savoir n'est
pas savoir qu'il manque quelque chose.

**Réinitialiser « les couches » emporte la banque**, ce qui a demandé de toucher
`resetProfileSection` : `sampleDir` n'était dans aucune portée, et remettre des
noms de fichiers d'usine dans un autre dossier aurait donné un profil qui ne
joue plus rien. Le libellé du menu le dit — « les couches et la banque ».

### Vérifié dans le navigateur

Sur les trois banques présentes en local, à travers le serveur de
développement :

| Ce qui est vérifié | Résultat |
|---|---|
| La liste s'affiche | `i4-check — 15 fichiers`, `procar — 10`, `v8-crossplane — 18` |
| Choisir `i4-check` sur le profil Sport | `sampleDir` suit, les cinq `procar-*.wav` sont nommés à l'écran |
| Taper un nom absent de la liste | le menu passe à « Réglée à la main », rien n'est signalé manquant |
| Revenir à `procar` | plus aucun manquant, plus aucun message |
| Après ces trois changements | moteur, mixage et couches inchangés, comparés champ à champ |

Douze tests couvrent `banks.ts`, deux de plus la réinitialisation.
