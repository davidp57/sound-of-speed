# 06 — Les rôles ouvrent les écrans, et un droit expiré les referme

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md).

**Réécrit le 13 septembre 2026**, après un recadrage de David : ce qu'un écran
demande tient sur **deux axes** et non un seul. Le rôle, qui est ici. L'appareil,
qui est le [ticket 14](14-l-appareil-porte-les-fonctions.md).

## Ce qu'il faut obtenir

Un compte porte des rôles, et un rôle ouvre des écrans :

| Rôle | Ce qu'il ouvre |
|---|---|
| `conduite` | conduire, la télémétrie, les réglages, l'étalonnage, le banc |
| `atelier` | fabriquer des moteurs et des boîtes |
| `synthese` | régler un timbre |

Ils se cumulent : un compte en porte zéro à trois, une ligne par rôle dans
`rights`. Aujourd'hui tout le monde les a tous, gratuitement, comme avant ce
ticket.

La table des droits existe depuis le premier schéma et personne ne la lit. Ce
ticket la branche.

## Ce à quoi il faut faire attention

- **Le rôle se défend, l'appareil non.** C'est ce qui sépare ce ticket du 14 :
  un navigateur peut mentir sur ce qu'il est, donc l'axe appareil reste un
  confort d'affichage que le serveur ignore. Le rôle, lui, vit dans la base et
  le serveur refuse ce qu'il n'ouvre pas. **Le refus du serveur est le seul qui
  compte** ; cacher un écran n'est qu'un confort.
- **L'écran du compte est hors rôles.** C'est le seul endroit où l'on se relie,
  où l'on se connecte et où l'on reprend son compte : le fermer serait une
  impasse dont on ne sortirait pas.
- **Ce qui est offert est une valeur, pas une règle.** Les rôles offerts à tout
  compte se donnent par l'environnement, et valent les trois par défaut. Le jour
  de l'ouverture, il restera à changer cette valeur et à brancher un
  encaissement.
- **Un droit sans échéance ne se périme pas** — c'est ce que porte tout le monde
  aujourd'hui. Un droit daté qui expire doit refermer ce qu'il ouvrait, sans
  attendre un redémarrage.
- **Hors réseau, les rôles sont ceux qu'on avait.** Ils se lisent dans une copie
  locale, qui expire ; passé ce délai on retombe sur ce qui est offert à tous.
  Sans aucune copie — premier lancement dans un tunnel — on n'interdit rien :
  c'est le serveur qui refusera. Cette copie est contournable par qui veut, le
  code est public, et c'est assumé : l'objectif est de ne pas perdre d'argent,
  pas d'en gagner.
- **Rien n'est encaissé.** Aucun fournisseur de paiement, aucune valeur par
  défaut restrictive.
- **`__BENCH__` ne bouge pas ici.** Le drapeau de construction qui cache le banc
  et la synthèse sort au ticket 14, remplacé par l'axe appareil. Le retirer ici
  ferait apparaître le banc dans la voiture.
- **Le relecteur est un écran comme un autre**, et il relit déjà une archive
  sans compte. Ce droit-là ne doit pas se refermer par inadvertance.
- **Nommer.** `user` est écarté au profit de `conduite` : la bibliothèque
  d'identité appelle déjà `user` ce que ce dépôt appelle un compte, et
  `CONTEXT.md` passe une section à démêler cette collision.

## Critères d'acceptation

- [ ] Les écrans ouverts dépendent des rôles du compte, sans reconstruire d'image
- [ ] Un droit expiré referme ce qu'il ouvrait, sans redémarrage
- [ ] Le serveur refuse ce que le rôle n'ouvre pas, et pas seulement l'écran
- [ ] Hors réseau, les rôles connus restent lisibles et expirent
- [ ] Tout le monde a tout par défaut, et rien n'est encaissé
- [ ] L'écran du compte reste ouvert quels que soient les rôles
- [ ] Relire une archive du disque reste possible sans compte
