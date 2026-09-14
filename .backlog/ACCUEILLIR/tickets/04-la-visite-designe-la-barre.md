# 04 — La visite désigne la barre du haut

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Des bulles sur l'interface](02-des-bulles-sur-l-interface.md)
pour le mécanisme, et [03 — De vrais onglets](03-de-vrais-onglets.md) pour ne pas
décrire une barre qu'on sait devoir changer.

## Ce qu'il faut obtenir

La visite continue vers le haut de l'écran et dit à quoi sert chaque chose de la
barre — c'est là que vivent la navigation et les commandes d'appareil, et rien ne
les explique aujourd'hui hors du texte.

## Ce qu'on construit

Quatre bulles de plus, après celles de l'écran de conduite :

1. **Les onglets** : ce qu'on change ici, c'est l'écran. Ce que le compte ouvre
   décide de ce qu'on voit — donc la bulle dit « selon le compte et l'appareil,
   il y en a plus ou moins » plutôt que de nommer six écrans dont la voiture n'en
   montre que quatre.
2. **Le son** : il se coupe et se rend sans rien arrêter d'autre, et c'est le
   même bouton qui le récupère quand une autre application l'a pris.
3. **Le verrou d'écran** : sans lui, l'écran s'éteint au bout d'une minute et on
   perd la vitesse de vue. La bulle se saute quand le navigateur ne le supporte
   pas — le bouton n'est alors pas dans le document.
4. **Plein écran** et **`?`** : l'un donne toute la hauteur aux chiffres, l'autre
   rouvre l'aide, et on peut y revenir à tout moment. Dernière bulle, celle qui
   termine la visite.

## Comment on vérifie

- Sur un navigateur sans verrou d'écran : une bulle de moins, sans trou dans le
  décompte.
- Sur un compte qui n'ouvre que la conduite : la bulle des onglets reste juste.
- Barre repliée sur deux lignes : les bulles suivent leur cible.
- La dernière bulle termine la visite, et un rechargement ne la relance pas.
