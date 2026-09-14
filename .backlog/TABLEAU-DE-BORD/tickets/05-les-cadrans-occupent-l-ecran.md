# 05 — Les cadrans occupent l'écran

**Statut :** ✅ fait — 14 septembre 2026

**Bloqué par :** aucun — reprend [02](02-vitesse-et-rapport.md), livré, sur un
défaut d'usage relevé en roulant.

## Ce qui a déclenché

David, le 14 septembre 2026 : « TABLEAU-DE-BORD : presque bon : les cadrans sont
trop petits, il faut gagner de la place en réduisant la largeur du bloc
central ». Puis, sur la question de savoir s'il roulait en plein écran :
« non, jamais ».

## Ce que la mesure a montré

Un écran de 1024 × 768, visage à cadrans, hors plein écran :

| | Avant |
|---|---|
| Rangée | 920 px utiles, dans un écran borné à 960 |
| Bloc central (sélecteur + rapport) | 263 px, soit 28 % |
| Cadran, diamètre du disque | 296 px |
| Hauteur inutilisée sous le tableau de bord | 343 px |

**Un disque ne profite pas de la hauteur libre** : il ne grandit qu'en largeur.
Tout ce qui occupe le milieu de la rangée se paie donc en taille de cadran, et la
hauteur laissée vide ne compense rien. C'est ce qui a écarté deux fausses pistes
— redessiner le cadran pour qu'il « remplisse » sa hauteur (il balaie déjà 240°,
son repère contient exactement ce qu'il dessine) et compter sur le plein écran,
où David ne va jamais.

## Ce qu'il fallait obtenir

- Le rapport **en haut, entre les deux cadrans** — c'est David qui l'a placé là,
  contre la proposition de le mettre au centre du compte-tours.
- Les commandes de conduite en bande sous les cadrans, faute de colonne centrale
  pour les tenir.
- L'écran de conduite occupant toute la place, plein écran ou non.

## Ce qui a demandé deux reprises

**Le rapport dans une rangée à lui coûtait cent pixels aux disques** — pris
exactement là où on venait de les leur rendre. Il est donc posé par-dessus, dans
le creux que laissent les deux disques en haut : le repère du cadran est plus
large que son disque, et ce coin-là est vide.

**Une rangée élastique sans plancher se comprime sans limite.** Mesuré sur
790 × 590 : le disque tombait à 106 px, illisible, et sans qu'on puisse faire
défiler pour le retrouver ; sur un téléphone de 375 × 812, à 60 px. Les rangées
ont maintenant un plancher — 11 rem en paysage, 12 par cadran en portrait — et
sous ce plancher l'écran déborde et défile, ce qui est le moindre mal.

## Ce que ça donne, mesuré

Diamètre du disque, visage à cadrans, hors plein écran, sans alerte ni bandeau :

| Fenêtre | Avant | Après |
|---|---|---|
| 375 × 812 (portrait) | — | 230 px, la page défile |
| 790 × 590 | — | 211 px, la page défile de 44 px |
| 1024 × 768 | 296 px | **434 px** |
| 1200 × 800 | 296 px | **474 px** |
| 1400 × 900 | 296 px | **594 px** |

Avant, le diamètre ne bougeait plus au-delà de 1024 : l'écran était borné à
60 rem.

## Critères d'acceptation

- [x] Le rapport se lit en haut, entre les deux cadrans
- [x] Les commandes de conduite sont atteignables, en bande sous les cadrans
- [x] L'écran de conduite occupe toute la place sans passer en plein écran
- [x] Le cadran ne descend jamais sous une taille lisible : sous le plancher,
      c'est la page qui défile
- [x] Le visage en chiffres est inchangé — relevé sur 780 × 580, trois cellules,
      aucun débordement latéral
- [x] Le plein écran marche toujours, et ne diffère plus que par la barre du haut
- [ ] 🧑 Vérifié dans la voiture : les cadrans se lisent d'un coup d'œil, et les
      commandes se touchent sans viser
