# RELIEF — faire entendre l'effort

**Statut :** 🧑 attend David
**Branche :** `feature/volume`
**Version visée :** 0.2

## Le problème

Relevé à l'usage : le volume est mal calibré entre le ralenti, la montée en
régime douce, la montée rapide et le maintien. Mesuré, le reproche est exact et
la cause est structurelle.

Niveau **acoustique** — gain calculé multiplié par le niveau réel de chaque
échantillon, relevé au décibel près avec ffmpeg — sur le profil Route :

| Situation | Niveau |
|---|---|
| Ralenti | −0,5 dB |
| Croisière | référence |
| Montée douce | −0,7 dB |
| Montée rapide | −1,3 dB |
| Pied levé franc | +1,0 dB |
| Montée rapide, haut régime | +4,0 dB |

**Tout ce qui se passe sous 3000 tr/min tient dans 1,3 dB.** Ralenti, croisière,
reprise douce, reprise franche : le même niveau. Seul le timbre change.

La raison est dans la conception des fondus : ils sont **à puissance
constante**, `sin² + cos² = 1`. C'est ce qui évite un creux au milieu d'une
bascule — une qualité — mais cela veut dire qu'ils changent la couleur et jamais
le volume. Personne n'a jamais ajouté de relief par-dessus.

Pire, l'écart est **à l'envers de 2,3 dB** : lever le pied franchement (+1,0)
est plus fort qu'écraser (−1,3). Mesuré à la source : `off-low` est 9,6 dB plus
faible que `on-low` à l'enregistrement, mais reçoit **+12,4 dB** de
compensation — gain de couche ×1,3 et `offLoadGain` ×3,2. On surcompense de
2,8 dB. Et `off-high`, dont le déficit n'est que de 6,5 dB, reçoit la même
compensation : 5,9 dB de trop.

Enfin, les +4 dB en haut des tours, appréciés, ne sont pas une intention
réglable : ils viennent de ce que `on-high` est enregistré 4,8 dB plus fort que
`on-low`. Un accident heureux de la banque sonore.

## La solution

Trois reliefs, appliqués **après** les fondus et à toutes les couches à la fois :
ils déplacent le niveau d'ensemble sans toucher à l'équilibre entre les couches,
donc sans rouvrir le creux que les fondus évitent.

- **relief de charge** : autant en moins pied levé, autant en plus pied au
  plancher, rien en croisière ;
- **relief du régime** : un gain gagné du ralenti au rupteur, qui s'ajoute aux
  4 dB de la banque ;
- **niveau au ralenti** : un écart à part, le ralenti n'ayant pas de couche
  dédiée dans la banque livrée.

Et la compensation des prises plus douces passe **par couche**, là où le déficit
se mesure, au lieu d'un facteur commun qui surcompense l'une et pas l'autre.
`offLoadGain` devient un curseur de goût, neutre par défaut.

Tout est réglable, curseur et saisie : l'objet est que l'équilibre se cherche
dans la voiture, pas qu'on le devine ici.

## Histoires

1. En tant que conducteur, je veux entendre que j'accélère, et pas seulement un
   changement de couleur du son.
2. En tant que conducteur, je veux que le ralenti soit discret : il ne se passe
   rien, ça ne doit pas s'entendre comme une pleine charge.
3. En tant que conducteur, je veux que le rugissement en haut des tours soit un
   réglage et non un hasard d'enregistrement, pour pouvoir le pousser.
4. En tant que David au volant, je veux régler les trois depuis la voiture,
   sans avoir à comprendre le mixage.

## Décisions d'implémentation

- **Le relief suit la charge brute**, et non celle que le contraste a resserrée.
  Le contraste règle l'équilibre entre les deux familles, le relief règle le
  niveau d'ensemble : les coupler ferait qu'un contraste nul désactiverait le
  relief en silence, et les deux curseurs deviendraient impossibles à régler
  l'un après l'autre. Le défaut a été écrit, puis attrapé par un test.
- **La croisière est le point neutre.** Le relief se déploie autour de la charge
  à mi-course, si bien que monter le réglage ne change pas le niveau moyen — on
  ne se retrouve pas à tout rebaisser au volume général après chaque essai.
- **Zéro rend le son d'avant, exactement**, et un test le vérifie.
- **Trois réglages, pas six.** Les points d'inflexion restent des constantes ;
  seuls les trois écarts en décibels sont exposés.

## Décisions de test

Le relief se teste sur un profil réduit à **une seule couche** : le fondu ne
bouge plus, et l'écart mesuré est celui du relief seul. Les écarts sont vérifiés
**en décibels**, puisque c'est l'unité du réglage.

Deux tests existants du mixage neutralisent désormais le relief : ils portent sur
la conservation d'énergie des fondus, qui se juge à relief égal. Le relief, dont
la raison d'être est précisément de faire varier le niveau, est vérifié à part.

Ce qui ne se teste pas : que l'équilibre soit *agréable*. Les valeurs livrées
sont un point de départ chiffré, pas un goût.

## Hors périmètre

- Une couche de ralenti dans la banque livrée. Le réglage de niveau traite le
  symptôme ; la vraie réponse serait un échantillon de ralenti, que la banque
  n'a pas.
- La compression au sommet : à +10 dB de relief, le haut des tours entre dans le
  limiteur de sortie. C'est son rôle, et le volume général permet de lui laisser
  de la place.

## Ce que le lot a donné

Niveau acoustique après le lot, mêmes situations, mêmes échantillons :

| Situation | Route avant | Route après | Sport après |
|---|---|---|---|
| Ralenti | −0,5 dB | **−6,0** | −6,5 |
| Pied levé franc | +1,0 | **−3,7** | −4,9 |
| Croisière | 0 | 0 | 0 |
| Montée douce | −0,7 | **+2,4** | +2,6 |
| Montée rapide | −1,3 | **+4,4** | +5,2 |
| Montée rapide, haut régime | +4,0 | **+10,5** | +12,1 |

L'étendue passe de 5,3 à 16,5 dB sur Route, et l'ordre suit l'effort : ralenti,
pied levé, croisière, montée douce, montée rapide, haut régime. 258 tests.
