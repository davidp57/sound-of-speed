# 08 — Le poids chargé par la voiture, mesuré avant et après

**Statut :** ✅ fait — 13 septembre 2026

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

## Ce que la mesure a trouvé

Mesuré dans un navigateur, l'appareil déclaré « voiture », en relevant ce que le
réseau transfère réellement — et non les tailles annoncées par la construction.

| État | Ce que la voiture tire au démarrage |
|---|---|
| Avant | 459,4 ko |
| Après le découpage des trois écrans | 422,6 ko — **−8 %** |
| Après la compression | **141,5 ko** — **−69 %** au total |

**Le découpage rapporte 37 ko. La compression en rapporte 281.**

### La vraie trouvaille : le serveur ne compressait plus

nginx compressait — `docker/nginx.conf` le dit encore, `gzip on` et
`application/javascript` dans ses types. Le serveur TypeScript qui l'a remplacé
au lot 48 ne le faisait plus, et personne ne l'avait vu : la voiture tirait
**310 ko de JavaScript là où gzip en fait 99**.

C'est une régression d'un lot précédent, trouvée ici parce que ce ticket
regardait le bon chiffre — celui que le réseau transfère, pas celui que la
construction annonce. Un `encodedBodySize` égal au `decodedBodySize` est ce qui
l'a dénoncée.

Corrigée : les types textuels se compressent au-delà d'un kilo-octet, jamais les
échantillons — du FLAC déjà compressé ne gagne rien —, et jamais une plage
d'octets, le client demandant les octets d'un fichier et non d'un flux. Six
tests tiennent ces bords.

### Le découpage : petit, et gardé quand même

Trois écrans qu'une voiture n'ouvre jamais — étalonnage, banc, synthèse —
chargés à la demande. Trois lignes de code, 37 ko. Le marché est bon : la
complexité ajoutée tient dans un `defineAsyncComponent`, et le gain se mesure.

Les autres écrans restent chargés d'emblée, et c'est délibéré : ils s'ouvrent au
volant, donc les différer déplacerait leur téléchargement au premier appui,
c'est-à-dire là où il n'y a pas de réseau.

**Hors réseau :** le service worker garde les morceaux comme le reste de
`/assets/`, dès la première ouverture en ligne. Un écran jamais ouvert n'est pas
en cache — mais c'est un écran que cet appareil n'ouvre pas, et qui ne manque
donc à personne. Sur un téléphone ou un poste, il y a du réseau.

## Critères d'acceptation

- [x] Le poids tiré au démarrage par la voiture est mesuré avant le découpage
- [x] Il est mesuré après, dans les mêmes conditions
- [x] L'écart est écrit, et la conclusion — découper ou non — est argumentée
- [x] Hors réseau, tous les écrans qu'un compte ouvre restent accessibles
- [x] Aucun écran ne se charge pour un compte qui n'y a pas droit
