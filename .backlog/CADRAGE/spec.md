# CADRAGE — refaire l'écran de conduite à la taille qu'il a vraiment

**Statut :** ⬜ prêt — le périmètre n'est pas tranché, à cuisiner avec David
**Branche :** à ouvrir
**Version visée :** à décider

David, le 16 septembre 2026 au soir : « l'écran principal est très mal organisé…
je pense que c'est parce que tu l'as conçu pour une résolution plus grande. Il va
falloir refaire tout ça propre. »

## Le chiffre qui manquait

Le lot [NAVIGATEUR-VOITURE](../NAVIGATEUR-VOITURE/spec.md) attendait ce relevé
depuis le 4 septembre — « la largeur utile, pour caler la mise en page ». Il est
arrivé, lu sur l'écran Télémétrie de la voiture :

| | |
|---|---|
| **Largeur utile** | **773 px** |
| **Hauteur utile** | **575 px** |
| Écran annoncé | 1 254 × 784 px |
| Densité de pixels | 1,53 |

L'écart entre l'annoncé et l'utile se voit sur les photos : la voiture garde pour
elle une colonne à gauche, le bandeau « Vidéo bridée au son uniquement », la
barre d'adresse du navigateur et sa barre d'icônes en bas. Il reste **moins des
deux tiers de la largeur, et les trois quarts de la hauteur**.

C'est cette taille-là qui est la cible de conception. Pas 1 254 × 784, et surtout
pas la fenêtre d'un poste de travail.

## Ce qui est constaté, et ce qui ne l'est pas

**Constaté sur les photos du 16 septembre**, sans interprétation :

- Le bandeau « Plus aucune position depuis 7 s » passe **par-dessus** les boutons
  P, AUTO et MAN, et les deux textes se mélangent.
- Dans l'écran Télémétrie, le bouton « Écouter l'accéléromètre » recouvre la fin
  de la phrase qui l'explique.

**Pas encore mesuré.** La mise en page n'a pas pu être inspectée dans le
navigateur de prévisualisation le soir même : le volet était masqué, et toutes
les dimensions y sortent à zéro — un rendu suspendu ne se mesure pas. Le relevé
élément par élément à 773 × 575 est donc le **premier geste** de ce lot, avant
toute décision. Tant qu'il n'est pas fait, on ne sait pas si le défaut est un
débordement de quelques pixels ou une mise en page qui ne tient pas.

## Ce que ce lot reprend

Deux tickets d'[ESSAI-16](../ESSAI-16/spec.md) sont des symptômes de ce
chantier-ci, et non des travaux séparés :

- [02 — les bandeaux du bas passent sous les commandes](../ESSAI-16/tickets/02-bandeaux-sous-les-commandes.md)
- [03 — la télémétrie se chevauche](../ESSAI-16/tickets/03-telemetrie-qui-se-chevauche.md)

Les rustiner un par un donnerait deux correctifs qui ne tiennent que jusqu'au
prochain bandeau. Ils restent listés là-bas, marqués comme repris ici.

## Ce qu'il faut trancher avec David

Rien de ceci n'est décidé, et le découpage en tickets attend ces réponses.

1. **Qu'est-ce qui doit tenir sans défiler ?** Les deux cadrans, le rapport, le
   bloc de commandes, le volume, les bandeaux, la barre d'onglets, la barre
   d'outils. En 575 px de haut, tout ne tiendra pas confortablement : qu'est-ce
   qui est vital en roulant, et qu'est-ce qui peut descendre d'un cran ?
2. **Le plein écran change-t-il la donne ?** Le bouton existe. S'il récupère la
   barre d'adresse et le bandeau vidéo, la hauteur utile n'est plus la même — et
   la question devient : conçoit-on pour l'écran réduit, pour le plein écran, ou
   pour les deux ?
3. **Les bandeaux : superposés ou dans le flux ?** Un bandeau qui pousse le
   contenu fait bouger les commandes sous le doigt en roulant. Un bandeau qui se
   superpose masque ce qu'il recouvre. Il y a un troisième terme — une zone
   réservée, toujours présente, vide la plupart du temps.
4. **Jusqu'où va « refaire propre » ?** Une reprise de la mise en page de l'écran
   de conduite, ou aussi Télémétrie et les autres ? Et faut-il en profiter pour
   ce que [TABLEAU-DE-BORD](../TABLEAU-DE-BORD/spec.md) voulait, ou garder les
   deux chantiers séparés ?

L'entrée normale est `/grilling`, puis `/to-spec` et `/to-tickets`.

## Ce qui ne changera pas

- **Aucune animation.** La règle tient, et un écran qu'on refait n'est pas une
  occasion de la lever.
- **L'écran se lit en conduisant.** C'est le critère qui tranche chaque choix de
  ce lot : ce qui se lit d'un coup d'œil reste, ce qui demande à être cherché
  descend.
