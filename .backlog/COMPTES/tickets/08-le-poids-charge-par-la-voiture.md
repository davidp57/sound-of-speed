# 08 — Le poids chargé par la voiture, mesuré avant et après

**Statut :** ⬜ prêt

**Bloqué par :** [06 — Les droits ouvrent les écrans](06-les-droits-ouvrent-les-ecrans.md),
qui décide de ce qui s'affiche et donc de ce qui peut ne pas se charger.

## Ce qu'il faut obtenir

Une seule application qui porte les trois usages fait télécharger à la voiture du
code qu'elle n'utilisera pas. Le chargement à la demande ramène ce coût près de
zéro — **au prix d'un découpage, et il doit être mesuré, pas supposé.**

Le chiffre avant, le chiffre après, et ce qu'on en conclut.

## Ce à quoi il faut faire attention

- **La mesure est le livrable.** Un découpage qui fait gagner trois kilo-octets
  ne vaut pas la complexité qu'il ajoute ; on ne le saura qu'en regardant. Le
  premier relevé se prend au ticket 01, avant que la bibliothèque soit là.
- **Ce qui compte est ce que la voiture tire au démarrage**, pas le poids total
  du paquet. Un écran de banc qui ne se charge jamais ne coûte rien, même gros.
- **L'application doit se charger hors réseau**, donc le service worker doit
  savoir ce qu'il met en cache. Un morceau chargé à la demande qu'il n'a pas
  gardé est un écran qui manque dans un tunnel.
- **Le relecteur a déjà son propre paquet**, tiré seulement quand on ouvre son
  adresse. C'est le motif à suivre, et le point de comparaison le plus proche.
- **Ne pas découper pour découper.** Si la mesure dit que le gain est
  négligeable, l'écrire et s'arrêter là est une conclusion valable — et c'est
  celle qu'il faudra assumer.

## Le relevé de départ, pris au ticket 14

Trois constructions, le paquet `index` de l'application :

| Construction | Brut | Compressé |
|---|---|---|
| `develop`, sans le banc | 341,33 ko | 111,06 ko |
| `BENCH=1`, avec le banc | 341,46 ko | 111,09 ko |
| Après le ticket 14, une seule image | 343,63 ko | 111,88 ko |

**Le fait qui compte est la deuxième ligne.** Mettre le banc dans l'image coûtait
130 octets — parce que `App.vue` importait déjà `SynthView` et `BenchView` de
façon statique, quel que soit le drapeau : ils étaient **déjà** dans le paquet
que la voiture tirait. Le drapeau ne cachait que des onglets.

Donc le « avant » n'est pas 341 contre 343 : c'est un paquet qui contient déjà
tout ce qu'on croyait exclu. Ce que le découpage peut rendre est l'ensemble de
ces écrans, pas les deux kilo-octets du croisement des deux axes.

## Critères d'acceptation

- [ ] Le poids tiré au démarrage par la voiture est mesuré avant le découpage
- [ ] Il est mesuré après, dans les mêmes conditions
- [ ] L'écart est écrit, et la conclusion — découper ou non — est argumentée
- [ ] Hors réseau, tous les écrans qu'un compte ouvre restent accessibles
- [ ] Aucun écran ne se charge pour un compte qui n'y a pas droit
