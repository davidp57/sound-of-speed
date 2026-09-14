# 05 — L'aide de référence, allégée

**Statut :** ⬜ prêt

**Bloqué par :** [02](02-des-bulles-sur-l-interface.md) et
[04](04-la-visite-designe-la-barre.md) : on ne retire de l'aide que ce que la
visite montre réellement.

## Ce qu'il faut obtenir

L'aide derrière le `?` cesse d'être le texte du premier lancement. Elle devient
ce qu'on ouvre quand on se pose une question, et rien d'autre.

## Ce qu'on construit

**Ce qui part** — ce que la visite montre désormais : « Pour commencer », « Les
commandes de conduite », et le paragraphe du son coupé et rendu.

**Ce qui reste**, dans cet ordre, parce que c'est l'ordre des questions qu'on se
pose : la vitesse reste à zéro, le son est trop faible, en roulant, partir sans
réseau, créer sa propre voiture, régler le son, l'écran Télémétrie, code source et
licence.

**Ce qui s'ajoute** : un lien « revoir la visite », qui efface
`speed.visiteVue.v1` et la relance. Une visite qu'on ne peut pas revoir se regarde
une fois, mal, en voulant démarrer.

**Le compte** garde une section dans l'aide — plus courte que celle de l'accueil,
qui dit où il vit et ce que l'enregistrer apporte, avec le bouton vers l'écran
Compte. L'aide s'ouvre longtemps après le premier lancement, quand il y a enfin
quelque chose à perdre.

**L'offre de source AGPL-3.0 ne bouge pas de cet écran.**

## Comment on vérifie

- Le `?` ouvre un texte plus court qu'aujourd'hui, sans redite de ce que la visite
  a montré.
- « Revoir la visite » la relance, et la termine proprement.
- Le lien du code source et la version sont toujours là.
- Le README décrit la même chose que l'écran.
