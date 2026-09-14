# 03 — De vrais onglets, avec une découpe

**Statut :** ⬜ prêt

## D'où vient ce ticket

En instruisant ACCUEILLIR, David demande en passant : « ça serait mieux d'avoir
des onglets que des boutons, ça serait plus clair non ? »

Le relevé donne raison à la remarque, mais pas à l'endroit où elle se pose. La
barre **est** déjà une barre d'onglets au sens du balisage — `<nav class="tabs">`,
`aria-pressed` sur l'entrée courante — et l'entrée active est bien visible : fond
couleur d'accent, texte sombre, gras (`src/style.css`). Le vrai défaut est que
ces entrées ont **exactement le même dessin que les boutons qui agissent** :
`Plein écran` et `?` sont à quelques pixels, dans la même boîte, avec la même
bordure et le même arrondi. Rien ne dit lequel navigue et lequel agit.

## Ce qu'il faut obtenir

Qu'on distingue d'un coup d'œil ce qui change d'écran de ce qui fait quelque
chose.

## Ce qu'on construit

Les entrées de navigation prennent une **forme d'onglet découpée** : l'onglet
actif se raccorde au contenu — bordure en haut et sur les côtés, coins arrondis
en haut seulement, et le trait du bas de la barre interrompu sous lui. Les
entrées inactives restent en retrait, sans fond plein.

Les commandes de droite — son, verrou d'écran, `?`, plein écran — gardent leur
boîte : ce sont des boutons, et c'est justement ce qu'on veut lire.

**La zone tactile ne rétrécit pas.** C'est un écran de voiture, touché en
roulant : le remplissage vertical compense ce que la boîte perd. Mesuré avant et
après, et écrit dans le commentaire.

## Comment on vérifie

- L'onglet actif se lit sans chercher, et se distingue de `Plein écran` sans
  l'avoir appris.
- Hauteur tactile des entrées : identique ou supérieure à aujourd'hui, mesurée.
- Le repli de la barre sur deux lignes sous 655 pixels tient toujours, et
  l'onglet actif reste raccordé au contenu sur les deux lignes.
- Le raccord de l'onglet actif au contenu ne laisse pas de trait résiduel — la
  feuille de style est sombre et unique, il n'y a qu'un rendu à regarder.

## Ce qui est hors de ce ticket

Ce que la barre contient. Les onglets ouverts dépendent du rôle et de l'appareil
(`TABS` dans `src/App.vue`), et ce lot ne touche pas à cette liste.
