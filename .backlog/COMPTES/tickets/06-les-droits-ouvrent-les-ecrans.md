# 06 — Les droits ouvrent les écrans, et un droit expiré les referme

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md).

## Ce qu'il faut obtenir

Ce qu'un compte ouvre décide de ce qu'il voit : **conduire** pour un invité,
**régler** pour qui bricole, **fabriquer** pour qui fait des moteurs. Trois
usages, pas des rôles fins.

La table des droits existe depuis le premier schéma et personne ne la lit. Ce
ticket la branche — et tout le monde a tout, gratuitement, comme aujourd'hui.

## Ce à quoi il faut faire attention

- **La séparation en trois applications est abandonnée.** C'est une affaire de
  droits, pas de construction : une seule application, dont les écrans
  apparaissent ou non. Les décisions de
  [MENAGE-UI](../../MENAGE-UI/spec.md) sur ce qui reste réglable au volant
  tiennent telles quelles.
- **Un droit sans échéance ne se périme pas** — c'est ce que porte tout le monde
  aujourd'hui. Un droit daté qui expire doit refermer ce qu'il ouvrait, sans
  attendre un redémarrage.
- **Le client ne décide pas de ses droits.** Cacher un écran est un confort
  d'interface ; ce qui protège est le refus du serveur. Les deux doivent exister,
  et le second est le seul qui compte.
- **Hors réseau, les droits sont ceux qu'on avait.** Ils se lisent dans une copie
  locale, qui expire. Elle est contournable par qui veut — le code est public —
  et c'est assumé : l'objectif est de ne pas perdre d'argent, pas d'en gagner.
- **Rien n'est encaissé.** Aucun fournisseur de paiement, aucune valeur par
  défaut restrictive. Le jour de l'ouverture, il restera à brancher l'un et à
  changer l'autre.
- **Le relecteur est un écran comme un autre**, et il relit déjà une archive
  sans compte. Ce droit-là ne doit pas se refermer par inadvertance.

## Critères d'acceptation

- [ ] Les écrans ouverts dépendent des droits du compte, sans reconstruire
      d'image
- [ ] Un droit expiré referme ce qu'il ouvrait, sans redémarrage
- [ ] Le serveur refuse ce que le droit n'ouvre pas, et pas seulement l'écran
- [ ] Hors réseau, les droits connus restent lisibles et expirent
- [ ] Tout le monde a tout par défaut, et rien n'est encaissé
- [ ] Relire une archive du disque reste possible sans compte
