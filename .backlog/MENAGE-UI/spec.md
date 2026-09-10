# MENAGE-UI — faire le ménage dans l'interface

**Statut :** ⬜ prêt — périmètre à cadrer par entretien avant tout découpage
**Branche :** à ouvrir
**Version visée :** à décider

## Ce qui a déclenché

L'essai sur route du 8 septembre 2026. David, sur l'interface : « c'est vraiment
compliqué ce qu'on a fait, faut qu'on fasse une passe de consolidation ». Puis,
le même jour, sur le choix entre un lot neuf et l'élargissement de MODE-SIMPLE :
« un lot neuf, faut faire du ménage ».

Le mot compte : ce n'est pas une refonte graphique ni une couche de simplicité
par-dessus l'existant. C'est du **ménage** — retirer, regrouper, ranger ce qui
s'est accumulé.

## Ce qui est mesuré

| Écran | Lignes | Ce qu'il porte |
|---|---|---|
| `ConfigView.vue` | 2 236 | dix sections, soixante-cinq champs |
| `SynthView.vue` | 1 052 | le banc de synthèse |
| `DriveView.vue` | 889 | les cadrans, la barre d'outils, les messages |
| `TelemetryView.vue` | 747 | tout ce qui alimente le son |
| `CalibrationPanel.vue` | 541 | le protocole en six étapes |
| `BenchView.vue` | 384 | le simulateur, sorti de l'écran de conduite le 8 septembre |
| `HelpView.vue` | 182 | l'aide |

Six mille lignes d'interface pour une application qui affiche trois chiffres.

Relevé le 8 septembre 2026, après la sortie du simulateur hors de l'écran de
conduite : celle-ci a retiré 210 lignes à `DriveView.vue` et fait tomber sa
hauteur en mode simulateur d'environ six cents pixels à quatre cent sept.

## Ce que ce lot n'est pas

- **Pas MODE-SIMPLE.** Ce lot-là ajoute quelques curseurs globaux qui commandent
  les autres : il met une couche par-dessus. Ici on enlève. Les deux peuvent se
  suivre, dans cet ordre — ranger d'abord, résumer ensuite —, et c'est
  précisément la question que l'entretien doit trancher.
- **Pas UI-DEFILEMENT**, qui traite un défaut précis : dérégler un curseur en
  faisant défiler l'écran de configuration.

## Ce qui n'est pas tranché

Tout, et c'est voulu : écrire des tickets avant l'entretien donnerait des
frontières qui ne survivraient pas à la première décision. Les questions à poser,
au moins :

1. qu'est-ce qui se **supprime** ? Soixante-cinq champs de configuration, tous
   n'ont pas fait la preuve qu'on y touche ;
2. qu'est-ce qui appartient au **banc** plutôt qu'à la voiture, et devrait donc
   suivre le simulateur hors de la construction de production ;
3. quels réglages sont des **conséquences** d'autres réglages, et n'ont donc rien
   à faire à côté d'eux ;
4. ce qui se lit **en roulant** contre ce qui se règle **garé** — deux publics,
   deux écrans, et aujourd'hui ils se mélangent ;
5. dans quel ordre : ranger avant de résumer, ou l'inverse.

## L'écran de conduite, dessiné par David

Le 10 septembre 2026, David a envoyé un croquis de l'écran principal plutôt
qu'une liste. Ce qu'il y demande, et ce qui en est fait :

| Demandé | État |
|---|---|
| Deux cadrans grands, qui remplissent l'écran | ✅ la place libérée leur revient |
| Les commandes de boîte **entre les cadrans**, au-dessus du rapport | ✅ |
| Le tempérament sous le rapport | ✅ |
| **Un seul bouton par choix**, qui change de valeur au clic | ✅ auto ⇄ manuelle, route ⇄ sport |
| Pas de sélecteur GPS / simulateur / rejeu | ✅ en production ; ⬜ reste visible sur l'image `develop` |
| **Aucun bouton en haut** | ⬜ la barre d'onglets demande les trois applications |
| Plus de doublon « Route / Sport » | ✅ un seul profil livré, nommé d'après son moteur |

**Ce qui bloque les deux points restants** : ils supposent que la version
embarquée n'embarque pas les écrans de l'atelier. C'est le volet « trois
applications » de [REFONTE](../REFONTE/spec.md), pas un ménage d'écran — le
drapeau de construction qui met le simulateur et les bancs dans l'image
`develop` les met aussi dans la voiture, et c'est ce que David voit.

**Le doublon qui n'en était pas.** Son croquis relevait deux boutons
« Route / Sport ». Ce n'était pas un doublon : l'un choisissait le profil,
l'autre le tempérament, et ils portaient le même nom. Les profils livrés se
nomment donc désormais d'après leur moteur — « V8 » —, et il n'y en a plus
qu'un : leur différence tenait à leurs seuils de passage, qui ont déménagé vers
le tempérament.

