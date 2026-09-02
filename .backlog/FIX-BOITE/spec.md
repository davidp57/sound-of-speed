# FIX-BOITE — ralentir n'est pas croiser

**Statut :** 🧑 attend David
**Branche :** `fix/croisiere-en-deceleration`
**Version visée :** 0.2

## Le problème

Deux reproches relevés en roulant, sur le lot [BOITE-VIVANTE](../BOITE-VIVANTE/spec.md) :

> à vitesse stabilisée, quand on ralentit doucement, la boîte a tendance à
> osciller entre la vitesse supérieure et celle juste en dessous (par exemple
> entre 5 et 4)

> le rétrogradage est trop tardif — on reste en rapport max pendant beaucoup
> trop longtemps, puis on passe toutes les vitesses dans les derniers
> 50-60 km/h

Les deux venaient du même défaut, et la mesure en a trouvé un troisième.

### Un ralentissement doux passait pour une croisière

La bande d'accélération considérée comme « vitesse tenue » était **symétrique** :
±0,3 m/s², soit ±1,08 km/h par seconde. Un ralentissement doux — lever le pied
sur du plat — tombe dedans. Il suspendait donc la descente au régime, qui n'est
suspendue que pour éviter le yoyo en croisière.

Mesuré sur le profil Sport, descente depuis 110 km/h à 0,8 km/h par seconde :

```
6->5@110  5->6@107  6->1@1
```

Il **montait** au dernier rapport puis y restait **jusqu'à l'arrêt**. D'où les
deux reproches d'un coup : le rapport maximal gardé bien trop longtemps, et la
cascade entassée au premier freinage franc.

### La montée au régime défaisait la descente au freinage

Mesuré à 3 km/h par seconde :

```
4->3@107  3->2@98  2->3@98  3->2@95  2->3@95  3->2@92  2->3@92  ...
```

Un aller-retour **tous les trois km/h**. La descente au freinage engage un
rapport dont le régime dépasse son propre seuil de montée — mon plafond était le
rupteur à 0,85, soit 7225 tr/min, quand le seuil de montée de la deuxième est à
5600 — et la montée ordinaire le défaisait aussitôt. Une vraie boîte ne monte
pas pendant qu'on freine.

### Un plafond trop permissif

Mesuré après le premier correctif : une descente en deuxième à 98 km/h plaçait
le moteur à **7232 tr/min**, au ras du rupteur, et il y restait jusqu'à l'arrêt.

## La solution

Trois corrections, et une leçon qui revient pour la troisième fois dans ce
fichier.

- **La bande devient asymétrique.** Tenir une vitesse, c'est ne pas la perdre :
  +0,3 m/s² du côté de l'accélération, mais seulement −0,1 du côté du
  ralentissement. Un dixième laisse passer le tremblement de la mesure, pas un
  ralentissement.
- **On ne monte pas pendant qu'on freine.** L'inhibition règle le va-et-vient à
  sa racine, et c'est ce que fait une boîte réelle.
- **Le plafond d'une descente au freinage est le seuil de montée du rapport
  visé**, que le profil règle déjà rapport par rapport. Le rupteur ne sert plus
  que de garde-fou absolu.

Et **la leçon** : un compteur, un usage. L'espacement des descentes au freinage
remettait à zéro le compteur de freinage, lequel sert aussi à inhiber la
montée — ce qui rouvrait la montée pendant une seconde, juste assez pour défaire
la descente. C'est la troisième fois dans ce module qu'un compteur portant deux
sens produit une oscillation : la première avec la stabilité de la vitesse, la
deuxième avec la maturité de cette stabilité, la troisième ici.

## Histoires

1. En tant que conducteur, je veux que la boîte descende régulièrement quand je
   ralentis doucement, et non qu'elle garde le dernier rapport jusqu'au bout.
2. En tant que conducteur, je ne veux plus entendre d'aller-retour entre deux
   rapports voisins quand je freine.
3. En tant que conducteur, je ne veux pas que le rétrogradage au freinage mette
   le moteur au ras du rupteur.
4. En tant que conducteur sur un GPS réel, je veux que la montée en croisière se
   déclenche quand même : l'accélération vient d'une dérivée, elle tremble.

## Décisions d'implémentation

- **Une tolérance de sortie de bande**, quatre dixièmes de seconde. Mesuré, un
  tremblement de 0,25 m/s² sur l'accélération suffisait à empêcher toute montée
  en croisière : une seule image hors bande remettait le compte à zéro. Elle ne
  rouvre pas le défaut qu'elle côtoie — un ralentissement, lui, sort de la bande
  et **y reste**.
- **Un délai après toute descente** avant qu'une montée en croisière soit
  permise, quatre secondes. Ceinture et bretelles contre le va-et-vient.
- Rien de tout cela n'est exposé à l'écran : ce sont des points d'inflexion, pas
  des réglages de caractère. Les trois curseurs du lot précédent restent les
  trois seuls.

## Décisions de test

Le banc de la boîte expose désormais l'**instant** de chaque passage : sans
cela, on ne peut pas isoler la phase de descente de celle de montée en vitesse,
et les assertions attrapent des passages qui ne sont pas le sujet. Les quatre
premiers tests écrits ici en ont fait la démonstration en échouant.

Le scénario qui compte est celui du reproche : montée, **croisière stabilisée**,
puis ralentissement. Les défauts ne se voyaient que là — d'où l'importance de
faire précéder la descente d'une vraie croisière dans le banc.

Deux tests jumeaux tiennent la distinction qui fait tout : un tremblement de
0,25 m/s² doit laisser la croisière monter, une oscillation de 1,5 m/s² ne doit
pas. Même forme, six fois l'amplitude.

## Ce que le lot a donné

Mesuré sur le profil Sport, depuis une croisière stabilisée à 110 km/h :

| Ralentissement | Avant | Après |
|---|---|---|
| 0,22 m/s² (doux) | `5→6@107` puis 6ᵉ jusqu'à l'arrêt | `6→5@104 5→4@87 4→3@73 3→2@55` |
| 0,83 m/s² (freinage) | yoyo tous les 3 km/h | `6→5@107 5→4@104 4→3@101 3→2@72` |
| Régime le plus haut visé | 7232 tr/min | 5298 tr/min |

Les descentes au freinage arrivent **plus tôt en vitesse** que celles au lever de
pied — 5→4 à 104 km/h contre 87 — ce qui est le métier du rétrogradage. Et la
cascade est identique avec un tremblement de ±0,25 et de ±0,5 m/s².

274 tests.
