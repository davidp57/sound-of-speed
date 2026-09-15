# SUITE-ESSAI-11 — ce que l'essai du 11 septembre a laissé de côté

**Statut :** 🧑 attend David — les deux points sont livrés ; la relance de la
localisation (commits `51b7af4` et `f2826d0`) et le recul entre deux dépôts
restent à éprouver en roulant
**Branche :** à ouvrir
**Version visée :** à décider

Deux points relevés en dépouillant la trace du 11 septembre 2026, sans rapport
entre eux, et qu'aucun lot ne couvre. Ni l'un ni l'autre n'a empêché quoi que ce
soit : ce sont des défauts vus en passant.

## 01 — La numérotation des tranches saute

Statut : 🧑 attend David — cause trouvée et corrigée le 15 septembre 2026,
reste à le constater sur un trajet

Sur la session `2026-09-11-06-24-01_da2m`, les tranches déposées sont numérotées
**001 à 015, puis 741, 742, 743**. Et côté traces, la même session va de 001 à
022 en **sautant le 020**.

Rien n'est perdu — le paquet rapatrié contient bien toutes les tranches — mais
un compteur qui saute de 15 à 741 n'est pas un compteur, et le trou du 020
signale soit un dépôt manqué sans relance, soit une numérotation qui s'incrémente
sans qu'un fichier parte.

**Ce qu'il faut chercher :** d'où vient le numéro d'une tranche, s'il dérive
d'un compteur en mémoire ou du temps écoulé, et ce qui se passe quand la page
est mise en veille puis reprise — les deux sauts tombent sur le trajet le plus
long, avec quarante-quatre minutes d'arrêt au milieu.

**Ce qui est vérifiable sans rouler :** la trace du 11 septembre est rapatriée,
les noms de fichiers suffisent à reproduire le raisonnement.

**Trouvé — et ce n'est pas le défaut qu'on croyait.**

Le rang vient d'un compteur incrémenté dans `takeSlice`, et il ne monte pas à
vide : une tranche sans contenu n'en consomme pas. Ce qui le fait sauter, c'est
`restore` : une tranche dont le dépôt a échoué revient en file et rejoint la
suivante, mais son numéro reste consommé.

**C'est délibéré, et il faut le laisser.** Le test qui le fixe porte sa raison :
« deux fichiers de même nom sur le serveur seraient un dépôt qui en écrase un
autre ; un numéro sauté se lit et ne coûte rien ». Un dépôt qu'on croit manqué a
pu aboutir — une réponse perdue, un réseau qui coupe après l'écriture. Réemployer
le rang échangerait une numérotation continue contre une perte de données
possible.

**Le vrai sujet est donc ailleurs, et il est plus sérieux :** le saut de 015 à
741 dit que **sept cent vingt-six dépôts ont manqué** pendant les quarante-quatre
minutes d'arrêt du 11 septembre. Et le 020 manquant côté traces en dit un de
plus. Ce n'est pas la numérotation qui cloche, c'est ce qu'elle raconte.

**Trouvé, et mesuré.** Ce ne sont pas sept cent vingt-six dépôts *manqués* :
c'est **une seule tranche réessayée sept cent vingt-six fois**, à la cadence
d'une requête qui n'aboutit pas.

L'enchaînement, et il n'a rien d'accidentel :

1. le dépôt échoue, la tranche revient en attente par `restore` ;
2. son contenu pèse à nouveau plus que le seuil de découpage — trente
   kilo-octets — donc `shouldSlice` redit « oui » **au tour de boucle suivant** ;
3. `takeSlice` consomme un rang, le dépôt échoue, retour au point 1.

Rien ne tenait la cadence. Le critère de durée ne pouvait pas : `takeSlice`
venait de le remettre à zéro. Le critère de taille non plus : le retour de la
tranche le rétablissait. Et le dépôt des tranches n'avait **aucun recul après
échec**, là où la file des dépôts — `core/upload/queue.ts` — en avait un depuis
toujours.

**La mesure :** une simulation des quarante-quatre minutes d'arrêt, avec 3,6 s
par requête qui échoue, consomme **734 rangs** contre 726 observés. L'écart de
1 % vient du choix de la durée de requête ; inversement, les 726 rangs réels
donnent cette durée : 2 640 s / 726 ≈ **3,6 s**.

**Corrigé.** La politique de recul de la file est sortie dans
`core/upload/backoff.ts` et sert aux deux : trente secondes après le premier
échec, le double ensuite, au plus un quart d'heure. La même coupure coûte
**sept** tentatives. Le flush d'arrêt, lui, passe outre — c'est le dernier
moment où l'on est encore là pour envoyer, et il ne se déclenche qu'une fois par
arrêt.

**Le rang reste consommé à chaque tentative, et c'est voulu** : le raisonnement
du 13 septembre tient, deux fichiers de même nom seraient un dépôt qui en écrase
un autre. Avec sept tentatives au lieu de sept cent, le saut devient lisible.

**Ce qui n'est pas expliqué, et ne l'était pas non plus avant :** pourquoi le
réseau manquait pendant ces quarante-quatre minutes. Ce n'est pas un défaut de
l'application — une voiture garée hors couverture suffit —, et rien n'a été
perdu : la tranche est partie au retour du réseau, c'est le fichier `741`. Le
journal du trajet n'a pas été relu ici, il n'est pas présent sur ce poste ; la
cause a été établie sur le code et vérifiée par la mesure.

**Un défaut voisin, non corrigé et signalé :** le journal n'a pas de témoin sur
l'écran de conduite. Son erreur de dépôt s'affiche dans *Configuration*, la
capture a le sien dans *Télémétrie*. Un journal qui ne part plus ne se voit donc
qu'en allant le chercher. Hors périmètre de ce point.

## 02 — Un interrupteur GPS sur l'écran de télémétrie

Statut : 🧑 attend David — livré le 11 septembre 2026, reste l'essai en roulant

Depuis le lot [COMMANDES](../COMMANDES/spec.md), il n'existe plus aucun bouton
de source dans l'application en production : le sélecteur **D** démarre la
localisation, et c'est tout. Si l'hypothèse du geste se révèle fausse, le
conducteur n'a **plus aucun recours** — c'est exactement la situation du
11 septembre, où il a fallu lancer une autre version de l'application.

David, le 11 septembre 2026 : « on peut mettre ça dans l'écran télémétrie ?
Genre GPS on/off ».

**Ce qu'on fait :** un bouton qui redemande une position, sur l'écran de
télémétrie — l'écran de diagnostic, où le motif d'un rejet et le compte des
relances sont déjà affichés. Il ne s'agit pas de choisir une source : il n'y en a
qu'une en voiture.

**Une relance, pas un interrupteur.** David demandait « genre GPS on/off » ; la
moitié « off » a été écartée, et il faut le dire. Éteindre la localisation seule
laisserait l'application tourner sans vitesse — un état qui ne sert à rien et
qu'aucun écran ne saurait expliquer. « P » éteint déjà tout, proprement.

**Et ce n'est pas le seul moyen de relancer** : « P » puis « D » ferme et rouvre
le suivi, depuis un geste. Mais « P » arrête le son et scinde l'enregistrement en
deux sessions. Ce bouton fait la seule chose qui manquait : redemander une
position **en roulant**, sans rien interrompre d'autre.

**Livré.** Le bouton « Relancer la localisation » ouvre la section « Qualité du
signal », là où l'on vient déjà voir pourquoi la vitesse ne bouge pas. Il arrête
le suivi, remet à zéro les compteurs — chien de garde, relances, cause de rejet
— et le redemande.

Vérifié à l'écran : présent quand la source est le GPS, absent sinon, et son
appel ne lève rien. **Pas vérifié** : qu'il débloque une localisation qui ne
part pas. En développement, le navigateur refuse la position faute de contexte
sécurisé ; cela se juge dans la voiture, et c'est justement l'essai qui
départagera l'hypothèse du geste.
