# SUITE-ESSAI-11 — ce que l'essai du 11 septembre a laissé de côté

**Statut :** ✅ prouvé le 17 septembre 2026 sur les trajets du 16 — la relance de la localisation mord (122 déclenchements), et le recul entre deux dépôts tient : 81 tranches arrivées proprement, aucune trace de la boucle à 726 essais
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

**Le vrai sujet est donc ailleurs :** le saut de 015 à 741 dit que le dépôt a
été tenté sept cent vingt-six fois. Ce n'est pas la numérotation qui cloche,
c'est ce qu'elle raconte.

**Et ce n'était pas « pendant les quarante-quatre minutes d'arrêt ».** Cette
lecture, écrite ici le 13 septembre, est fausse : les tranches relues sur le NAS
le 15 septembre montrent que la 741 reprend **1,008 seconde** après la fin de la
015, à 76 km/h. Le saut s'est produit en roulant, sur une coupure de réseau de
deux minutes, et non à l'arrêt.

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

**La mesure, faite sur les fichiers eux-mêmes.** Les tranches 001 à 015 partent
toutes les 299,4 s, au découpage nominal. La 741 couvre **435,5 s** — 137,1 s de
plus —, puis les 742 à 745 reprennent leur cadence. La coupure tient donc dans
ces 137,1 secondes, et 726 rangs y ont été consommés : **une tentative toutes
les 189 millisecondes**.

**Rien n'a été perdu, et c'est prouvé.** Les vingt et une tranches de journal se
recouvrent bout à bout, de 0,1 s à 6 136,0 s, sans un trou. Côté capture, les
rangs 020 et 023 manquent aussi — deux échecs isolés, pas une boucle — et là non
plus il n'y a pas de trou : la 019 finit à 4 714,9 s et la 021 commence à
4 714,9 s.

**Corrigé.** La politique de recul de la file est sortie dans
`core/upload/backoff.ts`. Les tranches en prennent une plus courte que celle de
la file — cinq secondes doublées, cinq minutes au plus — parce qu'une coupure en
roulant se compte en secondes, pas en heures : sur les 137 s mesurées, cinq
tentatives, et la tranche repart 18 s après le retour du réseau, là où le recul
de la file l'aurait fait attendre 73 s. Le flush d'arrêt passe outre le recul
sans le remettre à zéro.

**Le rang reste consommé à chaque tentative, et c'est voulu** : le raisonnement
du 13 septembre tient, deux fichiers de même nom seraient un dépôt qui en écrase
un autre. Avec sept tentatives au lieu de sept cent, le saut devient lisible.

**Ce qui n'est pas expliqué :** pourquoi le réseau a manqué pendant ces deux
minutes. Ce n'est pas un défaut de l'application — deux minutes sans couverture
sur une route en sont la cause ordinaire —, et la tranche est partie au retour du
réseau : c'est le fichier `741`.

**Un second défaut, trouvé en mesurant, et corrigé sur demande de David le
15 septembre :** le dépôt n'avait **pas de délai d'expiration**, et un envoi en
cours interdisait tout autre dépôt tant qu'il n'avait pas rendu la main. C'est ce
qui explique l'asymétrie entre les deux : le journal, dont les tranches pèsent
deux à cinq kilo-octets, échouait en 189 ms et rebouclait ; la capture, dont les
tranches en pèsent près de cent, restait pendue sur une seule requête — un rang
consommé au lieu de sept cents, mais aussi quatre cent quarante-quatre secondes
sans qu'aucune tentative soit faite.

Un envoi est maintenant abandonné au bout de trente secondes
(`core/upload/inflight.ts`). L'échéance se lit sur l'horloge murale et non sur le
temps de session — le pas de la boucle est plafonné à un quart de seconde — et
elle est relue par la boucle plutôt que confiée à un minuteur, que le navigateur
briderait dès la page masquée. Le compromis est écrit dans le module : une
requête abandonnée peut avoir abouti, et la suivante déposerait le même contenu
sous un autre rang. Un doublon se lit ; sept minutes d'attente ne se voient pas.

**Un troisième défaut, corrigé en même temps :** le journal n'avait **aucun
témoin** sur l'écran de conduite. Le 11 septembre, il s'est répété sept cent
vingt-six fois sans que rien ne le dise. Il entre maintenant dans le témoin de
session, qui prend le pire des deux — un seul voyant, comme le prescrit
`core/capture/health.ts` — et qui nomme le journal quand la capture, elle, va
bien.

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
