# 05 — Le banc rend la commande de fabrication, prête à coller

**Statut :** ⬜ prêt

**Bloqué par :** 03 — L'atelier : un onglet qui rassemble le son et la
fabrication de profils

## Ce qu'il faut obtenir

On règle un timbre à l'oreille au banc de synthèse, on est content, et on veut
en faire une banque. Aujourd'hui il faut retrouver les bons paramètres et les
retaper dans un terminal.

Le banc rend la commande exacte, avec les réglages qu'on vient d'entendre, dans
son état complet — prête à coller, sans rien à compléter ni à commenter. Un
geste la copie.

**Ce n'est pas le serveur qui fabrique**, et c'est une décision, pas une
limitation subie : la chaîne lance un binaire natif compilé sur le poste, le NAS
est en Linux ARM64, et une compilation croisée rouvrirait le chantier que le lot
IMAGE-ARM64 a fermé. La friction réelle n'est pas de taper une commande, c'est de
retrouver les paramètres.

C'est réversible : le jour où taper gêne encore, le bouton existe et il n'y aura
qu'à changer ce qu'il déclenche.

## Critères d'acceptation

- [ ] Depuis le banc, un geste donne la commande de fabrication avec les
      réglages courants
- [ ] La commande se colle telle quelle dans un terminal et produit la banque
      attendue
- [ ] Les réglages qu'elle porte sont ceux qu'on vient d'entendre, sans écart
- [ ] L'écran dit où la banque sera écrite, et que la commande tourne sur le
      poste
