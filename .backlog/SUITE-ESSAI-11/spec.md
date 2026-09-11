# SUITE-ESSAI-11 — ce que l'essai du 11 septembre a laissé de côté

**Statut :** ⬜ prêt
**Branche :** à ouvrir
**Version visée :** à décider

Deux points relevés en dépouillant la trace du 11 septembre 2026, sans rapport
entre eux, et qu'aucun lot ne couvre. Ni l'un ni l'autre n'a empêché quoi que ce
soit : ce sont des défauts vus en passant.

## 01 — La numérotation des tranches saute

Statut : ⬜ prêt

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

## 02 — Un interrupteur GPS sur l'écran de télémétrie

Statut : 🧑 attend David — livré le 11 septembre 2026, reste l'essai en roulant

Depuis le lot [COMMANDES](../COMMANDES/spec.md), il n'existe plus aucun bouton
de source dans l'application en production : le sélecteur **D** démarre la
localisation, et c'est tout. Si l'hypothèse du geste se révèle fausse, le
conducteur n'a **plus aucun recours** — c'est exactement la situation du
11 septembre, où il a fallu lancer une autre version de l'application.

David, le 11 septembre 2026 : « on peut mettre ça dans l'écran télémétrie ?
Genre GPS on/off ».

**Ce qu'on fait :** un interrupteur qui arrête et relance la géolocalisation,
sur l'écran de télémétrie — l'écran de diagnostic, où le motif d'un rejet et le
compte des relances sont déjà affichés. Il ne s'agit pas de choisir une source :
il n'y en a qu'une en voiture. Il s'agit de pouvoir la **relancer à la main**
quand elle ne part pas.

Il relance depuis un geste de l'utilisateur, comme le fait **D** : c'est
précisément ce qu'on cherche à pouvoir refaire.

**Livré.** Le bouton « Relancer la localisation » ouvre la section « Qualité du
signal », là où l'on vient déjà voir pourquoi la vitesse ne bouge pas. Il arrête
le suivi, remet à zéro les compteurs — chien de garde, relances, cause de rejet
— et le redemande.

Vérifié à l'écran : présent quand la source est le GPS, absent sinon, et son
appel ne lève rien. **Pas vérifié** : qu'il débloque une localisation qui ne
part pas. En développement, le navigateur refuse la position faute de contexte
sécurisé ; cela se juge dans la voiture, et c'est justement l'essai qui
départagera l'hypothèse du geste.
