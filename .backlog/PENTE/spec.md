# PENTE — le GPS de la Tesla livre trente fois par seconde

**Statut :** 🧑 attend David
**Branche :** `fix/pente`
**Version visée :** 0.2 — avant tout le reste

## Ce qui a déclenché

Une remarque de passage, le 3 septembre 2026, à propos d'un compteur de
télémétrie : « dès que la voiture bouge ça rafraîchit très vite — des dizaines
de millisecondes — alors que quand elle est à l'arrêt ou presque, c'est des
secondes ».

Le conditionneur est bâti sur l'hypothèse inverse, et elle est **écrite dans le
code** :

```ts
/** Nombre d'échantillons conservés pour le calcul de pente. */
const HISTORY_SIZE = 16
```

> « L'historique borne la fenêtre utilisable : seize mesures, soit seize
> secondes à la cadence d'un GPS. »

Seize secondes à un hertz. À trente millisecondes, seize mesures font
**0,48 seconde**. La fenêtre réglée à mille millisecondes n'est donc jamais
atteinte : le réglage ne commande rien — le même défaut que FIX-CORE avait
corrigé, revenu par l'autre bout.

## Trois défauts en cascade

### 1 — La fenêtre est bornée en nombre de mesures, pas en durée

Elle vaut donc 16 s à un hertz et 0,48 s à trente millisecondes. Le réglage
« fenêtre d'accélération » est inopérant dans la voiture.

### 2 — La bande morte est multiplicative, et elle écrase les pentes faibles

```ts
const attenuation = clamp((Math.abs(delta) - deadband) / Math.max(deadband, 0.001), 0, 1)
const slope = (delta * attenuation) / seconds
```

`delta` est **multiplié** par une rampe qui ne vaut un qu'au double du seuil.
Une pente qui produit tout juste `deadband` de delta n'est pas amputée du
seuil : elle est **annulée**.

Mesuré sur une rampe propre, sans bruit :

| Accélération réelle | Cadence | Fenêtre effective | Vue |
|---|---|---|---|
| 0,35 m/s² | 1000 ms | 1,00 s | **0,09 m/s²** |
| 0,35 m/s² | 30 ms | 0,48 s | **0,00 m/s²** |
| 0,55 m/s² | 1000 ms | 1,00 s | 0,54 m/s² |
| 0,55 m/s² | 30 ms | 0,48 s | **0,00 m/s²** |
| 1,0 m/s² | 30 ms | 0,48 s | 0,62 m/s² |
| 2,0 m/s² | 30 ms | 0,48 s | 2,00 m/s² |

**Une accélération douce, dans la Tesla, n'est pas atténuée : elle est
effacée.** Accélérer de 110 à 150 en vingt secondes est vu comme tenir 110.

C'est la cause du reproche du même jour — « les accélérations douces sont trop
silencieuses » — et elle est bien plus directe que le modèle de charge : la
charge fait exactement son travail sur une accélération qu'on lui donne à zéro.

### 3 — La pente est estimée sur deux points

Une différence entre la mesure courante et **une** mesure de référence. À un
hertz on n'a pas mieux ; à trente millisecondes on jette trente-deux mesures sur
trente-quatre, puis on utilise une bande morte pour compenser le bruit qu'on
aurait pu moyenner.

Mesuré avec un bruit de mesure de ±1 km/h :

| Accélération réelle | Cadence | Vue aujourd'hui |
|---|---|---|
| 0,35 m/s² | 30 ms | **1,58 m/s²** |
| 0,55 m/s² | 30 ms | **1,78 m/s²** |
| 1,0 m/s² | 30 ms | 2,23 m/s² |
| 2,0 m/s² | 30 ms | 3,23 m/s² |

Un biais d'environ +1,2 m/s², et un écart-type de 5,5 km/h/s — la pente
oscillait entre 0,66 et 11,64 km/h/s pour une rampe constante à 7,2. Comparé au
tableau précédent, la même accélération de 0,55 m/s² est vue **à zéro** sans
bruit et **à 1,78** avec : l'estimateur n'est pas imprécis, il est instable.

Et c'est cette pente qui commande tout l'aval : la charge, donc le volume et le
timbre ; la boîte, donc la croisière, le rétrogradage au freinage et le
kickdown.

## Le correctif

**Une régression linéaire sur une fenêtre bornée en temps, et plus de bande
morte.**

- La fenêtre garde toutes les mesures des `accelWindowMs` dernières
  millisecondes, quel qu'en soit le nombre. Le réglage redevient effectif.
- La pente est la pente des moindres carrés sur ces mesures. Avec trente-quatre
  points, le bruit se divise par la racine de trente-quatre au lieu d'être
  ignoré.
- La bande morte disparaît : elle n'existait que pour masquer le bruit d'un
  estimateur à deux points. Le lissage aval — le ressort, `springOmega` — reste
  le bon endroit pour arrondir ce qui reste.

### Mesuré, avec le même bruit de ±1 km/h

| Accélération réelle | Cadence | Aujourd'hui | Corrigé | Écart-type corrigé |
|---|---|---|---|---|
| 0,35 m/s² | 30 ms | 1,58 | **0,35** | 0,048 |
| 0,55 m/s² | 30 ms | 1,78 | **0,55** | 0,048 |
| 1,0 m/s² | 30 ms | 2,23 | **1,00** | 0,048 |
| 2,0 m/s² | 30 ms | 3,23 | **2,00** | 0,048 |
| 0,55 m/s² | 250 ms | 0,54 | 0,55 | 0,000 |
| 0,55 m/s² | 1000 ms | 0,00 | 0,49 | 0,552 |

Exact à toutes les cadences, et d'autant plus stable que le GPS parle plus.

**Ce qui empire, et il faut le dire** : à un hertz, l'écart-type passe de zéro
à 0,55 m/s². C'est inévitable — deux points ne permettent aucune moyenne — et
c'est le bruit qui existait déjà, que la bande morte cachait en effaçant le
signal avec lui. Un signal juste et bruité vaut mieux qu'un signal nul, et le
ressort est là pour l'arrondir. À vérifier tout de même au simulateur, qui
tourne à un hertz.

## Une question à trancher en roulant

À l'arrêt, les mesures s'espacent « de plusieurs secondes ». Le chien de garde
du suivi déclare le GPS perdu au-delà de **vingt secondes** de silence et
relance le suivi. Si, feu rouge ou stationnement, le silence atteint vingt
secondes, on relance pour rien.

Le compteur « Relances du suivi » du bloc « Arrière-plan » de l'écran de
télémétrie le dit : **non nul après un arrêt prolongé, il faut soit relever le
seuil, soit ne pas surveiller à l'arrêt** — un véhicule immobile n'a rien à
signaler. La seconde solution est la bonne si le cas se confirme.

## Ce qu'il faut faire

1. Borner l'historique en temps : garder les mesures des `accelWindowMs`
   dernières millisecondes, plus une marge, et supprimer `HISTORY_SIZE`.
2. Remplacer `estimateSlope` par une régression des moindres carrés.
3. Retirer `accelDeadbandKmh` du schéma de profil, des deux profils livrés, de
   l'écran de configuration, du guide de création et de la référence des
   réglages du README — et prévoir la reprise des profils enregistrés
   (`PROFILE_FORMAT_VERSION`).
4. Corriger le commentaire qui affirme « seize secondes à la cadence d'un GPS ».
5. Afficher la cadence de la source dans la télémétrie : `recentGapsMs` existe
   déjà, il n'est pas montré. C'est ce chiffre qui a permis de trouver.

## Quatre écarts à ce plan, décidés en cours de route

1. **`PROFILE_FORMAT_VERSION` n'a pas été monté.** Le point 3 le prévoyait par
   prudence. Vérifié : rien ne contrôle la version à la lecture d'un fichier de
   profil, et `reconcile` complète par tolérance. Un champ qui disparaît est
   simplement ignoré ; monter la version n'aurait rien protégé. Le champ mort est
   retiré du stockage par une reprise dédiée, `migrateSpeed`.

2. **La suppression de la zone morte a été mise à l'épreuve avant d'être
   retenue.** Elle protégeait réellement du tremblement du GPS à l'arrêt, et
   l'ajustement ne suffit pas à l'annuler : mesuré à ±3 km/h de tremblement, il
   laisse passer 0,6 m/s². Deux variantes qui la gardaient sous une forme
   correcte ont donc été mesurées — soustractive en km/h/s, et pondérée par la
   qualité de l'ajustement. Les deux amputent les reprises douces : de 25 % pour
   la première, de 69 % pour la seconde, qui écrase d'autant plus qu'une pente
   est faible. Écartées. La protection est passée à un seuil sur les mesures
   elles-mêmes : on ne cherche pas de pente quand rien ne bouge. Sans réglage, et
   sans amputer quoi que ce soit.

3. **Le défaut valait aussi au poste de travail.** Le simulateur émet une mesure
   par image, soit près de cent cinquante par seconde — relevé à l'écran de
   télémétrie une fois la cadence affichée. Tous les réglages faits au simulateur
   portaient donc sur une fenêtre de cent millisecondes, jamais sur celle qui
   était affichée. Le point 3 de la spec parlait d'un simulateur « à un hertz » :
   c'était faux.

4. **La cadence affichée est une médiane, pas une moyenne.** Relevé au poste de
   travail sur une page mise en veille par le navigateur : six intervalles de 13,
   6, 66 398, 4, 19 et 1005 ms. La moyenne annonçait 11 241 ms, la médiane
   dit 16. Une seule interruption suffit à rendre une moyenne illisible, et c'est
   un chiffre à lire en roulant.

## Ce qui a été vérifié, et comment

Le cas « cadence plus lente que la fenêtre » a été observé en vrai, par accident
utile : le navigateur de développement bride la page à un hertz quand elle n'a
pas le focus. La télémétrie affichait alors une durée d'image de 1006 ms, des
intervalles de 1005 ms, **deux** mesures dans la fenêtre — le plancher que garde
l'élagage — et une pente toujours estimée à 8,0 km/h/s. C'est le garde-fou
« garder au moins deux mesures » qui joue là : sans lui, l'historique tomberait à
une seule entrée et la pente resterait figée.

L'autre bout est couvert par les tests : 143 mesures dans la fenêtre à sept
millisecondes de cadence.

## Critères d'acceptation

- [x] Une accélération de 0,35 m/s² est vue à 0,35 m/s² à ±0,1, à toute cadence
      entre 30 ms et 1 s
- [x] La fenêtre réglée commande réellement la durée observée
- [x] À bruit égal, la pente estimée est d'autant plus stable que la cadence est
      rapide
- [x] Le réglage de bande morte a disparu et les profils enregistrés se
      reprennent sans le perdre
- [x] La cadence de la source est lisible à l'écran de télémétrie
- [ ] 🧑 Vérifié en roulant : une reprise douce fait monter la charge
- [ ] 🧑 Vérifié en roulant : « Relances du suivi » reste à zéro après un arrêt
      prolongé
