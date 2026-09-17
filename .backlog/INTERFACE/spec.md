# INTERFACE — refaire l'écran pour la taille qu'il a vraiment

**Statut :** ⬜ prêt — mesurer d'abord, le reste du périmètre est à cuisiner
**Branche :** à ouvrir
**Version visée :** à décider

David, le 16 septembre 2026 au soir : « l'écran principal est très mal organisé…
je pense que c'est parce que tu l'as conçu pour une résolution plus grande. Il va
falloir refaire tout ça propre. »

Ce lot s'appelait CADRAGE à sa naissance, le temps d'une soirée. Il a été élargi
et renommé le 17 septembre sur décision de David — « on combine les lots qui
parlent de la même chose » —, parce que la place disponible et ce qu'on met
dedans ne se traitent pas séparément.

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

Les deux premières lignes sont en pixels CSS — `documentElement.clientWidth` et
`clientHeight` d'un côté, `screen.width/height` de l'autre —, donc l'écart se lit
comme une soustraction : **481 px de largeur et 209 px de hauteur** ne reviennent
pas à la page. Il lui reste 62 % de la largeur et 73 % de la hauteur.

Les chiffres sont cohérents entre eux : 1 254 × 1,53 = 1 918 et 784 × 1,53 =
1 199, soit la dalle de 1 920 × 1 200 de la Model 3 Highland.

**Où passent ces 481 et 209 px n'est pas mesuré.** Les photos montrent une
colonne à gauche, le bandeau « Vidéo bridée au son uniquement », la barre
d'adresse et une barre d'icônes en bas — mais la part de chacun n'a été relevée
nulle part, et le zoom par défaut du navigateur, que NAVIGATEUR-VOITURE signale
comme non réglable et augmenté avec le logiciel 2026.26, peut en expliquer une
partie. Le savoir changerait la conception : de la place reprise sur une barre
n'est pas de la place qu'on n'aura jamais.

C'est cette taille-là qui est la cible de conception. Pas 1 254 × 784, et surtout
pas la fenêtre d'un poste de travail.

## Ce n'est pas la première fois

Le même travers a été trouvé et corrigé le 14 septembre 2026, dans le ticket 05
de TABLEAU-DE-BORD : les cadrans étaient trop petits, et l'une des deux causes
était que l'écran de conduite, borné à 60 rem, « ne prenait pas la place
disponible parce qu'on supposait qu'on roulait en plein écran. David n'y passe
jamais. »

Corrigé alors sur un écran de 1 024 × 768 — pas sur les 773 × 575 de la voiture.
C'est précisément pour ne pas le refaire une troisième fois à l'estime que ce lot
commence par une mesure.

## Ce qui est constaté, et ce qui ne l'est pas

**Constaté sur les photos du 16 septembre**, sans interprétation :

- Le bandeau « Plus aucune position depuis 7 s » passe **par-dessus** les boutons
  P, AUTO et MAN, et les deux textes se mélangent.
- Dans l'écran Télémétrie, le bouton « Écouter l'accéléromètre » recouvre la fin
  de la phrase qui l'explique.

**Pas encore mesuré.** La mise en page n'a pas pu être inspectée dans le
navigateur de prévisualisation le soir même : le volet était masqué, et toutes
les dimensions y sortent à zéro — un rendu suspendu ne se mesure pas. Et ce que
la voiture remonte ne porte pas la page, seulement l'écran annoncé.

Mesurer est donc le **premier geste** de ce lot, avant toute décision : c'est le
[ticket 01](tickets/01-mesurer-l-espace-reel.md).

## Les tickets

| Ticket | Statut |
|---|---|
| [01 — mesurer vraiment l'espace dont on dispose](tickets/01-mesurer-l-espace-reel.md) | ⬜ |

Le reste du découpage attend les réponses aux questions ouvertes, et les chiffres
du ticket 01.

## Ce que ce lot reprend

**Deux tickets d'[ESSAI-16](../ESSAI-16/spec.md)**, qui sont des symptômes de ce
chantier et non des travaux séparés — les rustiner un par un donnerait des
correctifs qui ne tiennent que jusqu'au prochain bandeau :

- [02 — les bandeaux du bas passent sous les commandes](../ESSAI-16/tickets/02-bandeaux-sous-les-commandes.md)
- [03 — la télémétrie se chevauche](../ESSAI-16/tickets/03-telemetrie-qui-se-chevauche.md)

**Ce qui restait ouvert dans deux lots livrés**, sur décision du 17 septembre. Ni
l'un ni l'autre n'avait de travail en cours : seulement des vérifications au
volant, qu'il serait absurde de mener sur un écran qu'on va refaire.

| Venant de | Ce qui est repris |
|---|---|
| [TABLEAU-DE-BORD](../TABLEAU-DE-BORD/spec.md) | le cadran de régime, à lire en roulant et en plein soleil (ticket 01) |
| [UI-DEFILEMENT](../UI-DEFILEMENT/spec.md) | glisser sans dérégler un curseur, et la bande de défilement (tickets 01 et 02) |

Leurs tickets clos restent chez eux : c'est l'histoire de ce qui a été fait, et
la déplacer ne servirait personne. Les deux lots sont clos et renvoient ici.

## Ce que David a montré : les deux blocs du milieu se rejoignent

Le 17 septembre 2026 au soir, une capture annotée de l'écran de conduite, deux
flèches rouges et pas un mot. Elles convergent vers la **colonne centrale entre
les deux cadrans**, qui est aujourd'hui vide sur toute sa hauteur :

- la vignette **RAPPORT**, aujourd'hui collée en haut, **descend** ;
- le **sélecteur de boîte** (D/P, AUTO/MAN, + et −), aujourd'hui collé en bas,
  **monte**.

Les deux occuperaient donc le couloir du milieu, à hauteur des aiguilles, au
lieu d'être renvoyés aux deux bords de l'écran. C'est cohérent avec le reste du
lot : la hauteur est la dimension qui manque, et ces deux blocs sont les seuls à
la consommer alors qu'il y a de la place à côté d'eux.

**L'ordre est tranché** par David le 17 septembre 2026 : **le rapport au-dessus
du sélecteur**, les deux entre les compteurs. Reste à décider ce qu'il advient
du bandeau d'alerte, aujourd'hui sous le tout et qui recouvre justement ces
commandes ([ESSAI-16/02](../ESSAI-16/tickets/02-bandeaux-sous-les-commandes.md)).

## Ce qu'il faut trancher

1. **Qu'est-ce qui doit tenir sans défiler ?** Les deux cadrans, le rapport, le
   bloc de commandes, le volume, les bandeaux, la barre d'onglets, la barre
   d'outils. En 575 px de haut, tout ne tiendra pas confortablement : qu'est-ce
   qui est vital en roulant, et qu'est-ce qui peut descendre d'un cran ?
2. **Le plein écran change-t-il la donne ?** La réponse se mesure au lieu de se
   supposer, et c'est le ticket 01 qui la donne. Si l'écart vient d'un zoom et
   non des barres, le plein écran ne rendra rien. La question devient alors :
   conçoit-on pour l'écran réduit, pour le plein écran, ou pour les deux ?
3. **Les bandeaux : superposés ou dans le flux ?** Un bandeau qui pousse le
   contenu fait bouger les commandes sous le doigt en roulant. Un bandeau qui se
   superpose masque ce qu'il recouvre. Il y a un troisième terme — une zone
   réservée, toujours présente, vide la plupart du temps.
4. **Jusqu'où va « refaire propre » ?** L'écran de conduite seul, ou aussi
   Télémétrie et les autres ?

L'entrée normale est `/grilling`, puis `/to-spec` et `/to-tickets`.

## Ce qui ne changera pas

- **Aucune animation, et le paysage qui défile est abandonné.** Confirmé par
  David le 17 septembre 2026. Son ticket était déjà marqué abandonné depuis le
  7 septembre ; c'était la spécification de TABLEAU-DE-BORD qui affirmait le
  contraire, et elle est corrigée. La règle n'a donc plus d'exception, et un
  écran qu'on refait n'est pas une occasion de la lever.
- **Une aiguille de cadran n'a jamais relevé de cette règle** : son mouvement est
  la valeur, et c'est ce qui fonde son exception dans
  [`CLAUDE.md`](../../CLAUDE.md).
- **L'écran se lit en conduisant.** C'est le critère qui tranche chaque choix de
  ce lot : ce qui se lit d'un coup d'œil reste, ce qui demande à être cherché
  descend.

## Hors périmètre

- **[MODE-SIMPLE](../MODE-SIMPLE/spec.md)** — quelques curseurs globaux qui en
  commandent quarante-huit autres. C'est du réglage, pas de la mise en page : le
  lot reste séparé.
- **Ce que l'appareil impose**, qui vit dans
  [NAVIGATEUR-VOITURE](../NAVIGATEUR-VOITURE/spec.md) : précision du signal,
  verrou d'écran, autorisations. Seul le relevé de la place utile est repris ici.
