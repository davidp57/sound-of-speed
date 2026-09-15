# 06 — La régie lit les données d'un compte sous accord

**Statut :** ⬜ prêt

**Bloqué par :** 05 — le conducteur autorise l'assistance ; 03 — la trace

## Ce qu'il faut obtenir

L'accord est ouvert : depuis la fiche, je vois ce que le compte porte pour de
bon — ses profils, ses moteurs, ses boîtes, ses trajets, son journal. De quoi
comprendre un défaut sans lui demander de m'envoyer son archive.

L'échéance passe : l'écran se vide et le serveur refuse. C'est le comportement
juste, l'accord a cessé.

**Des routes de régie dédiées, en lecture seule.** Elles prennent l'identifiant
du compte visé et vérifient deux choses : que je suis administrateur, et que
l'accord n'est pas échu.

**La régie n'emprunte jamais l'identité de quelqu'un.** Une session empruntée
serait une session complète, donc en écriture : la régie pourrait modifier ou
effacer en se faisant passer pour le conducteur, et la trace attribuerait ces
gestes au conducteur. La séparation doit être structurelle, pas une discipline.

**L'archive du compte n'est pas la porte non plus.** Elle n'exige aujourd'hui
aucun rôle, délibérément, parce que ce sont ses données à lui ; l'ouvrir à
l'administrateur en ferait la porte dérobée qui contourne l'accord.

Chaque consultation s'inscrit dans la trace.

## Critères d'acceptation

- [ ] Accord ouvert : la régie lit les profils, les moteurs, les boîtes, les
      trajets et le journal du compte visé.
- [ ] Accord fermé, ou date passée, ou aucune date : le serveur refuse, et
      l'écran ne montre plus rien.
- [ ] Aucune route de régie n'écrit dans les données d'un compte — vérifié route
      par route.
- [ ] La régie ne peut pas obtenir de session au nom d'un autre compte.
- [ ] La route de l'archive n'est pas ouverte à l'administrateur.
- [ ] Chaque consultation écrit une ligne de trace nommant le compte visé et
      l'instant.
- [ ] Un administrateur sans accord ouvert ne distingue pas un compte qui
      n'existe pas d'un compte qui n'a pas accordé.
- [ ] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [ ] Contrôle qualité vert.
