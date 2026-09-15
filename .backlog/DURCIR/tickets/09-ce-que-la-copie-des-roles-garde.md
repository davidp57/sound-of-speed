# 09 — Ce que la copie des rôles garde vraiment

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'écran retient les rôles du compte pour les savoir hors réseau. Cette copie ne
protège rien, et c'est écrit partout : le serveur relit les droits à chaque
requête. Sauf pour **un** rôle, qui ne commande aucune route — parce que ce qu'il
ouvre tourne entièrement dans le navigateur et ne coûte rien au serveur. Pour
celui-là, la copie est le seul verrou, et il suffit de l'effacer pour l'ouvrir :
une copie absente n'interdit rien, par construction.

**C'est arbitré : ce rôle est un verrou d'affichage, et c'est assumé.** Il ne
garde aucune ressource, il n'y a rien à refuser côté serveur, et prétendre le
garder serait du théâtre. Ce qu'il faut, c'est que ce soit **écrit** — pour que
personne ne le découvre le jour où des rôles se vendront.

Deux défauts se corrigent dans le même mouvement. La copie n'est rattachée à
aucun compte : elle est bien effacée aux trois endroits où le compte change, mais
c'est une discipline, pas une garantie, dans un domaine qui ajoute des chemins.
Et l'échéance d'un droit se juge sur l'horloge de l'appareil, qu'on recule.

## Critères d'acceptation

- [ ] Un test dit, rôle par rôle, lequel a un gardien côté serveur et lequel n'en
      a pas, et rougit si un rôle en perd un.
- [ ] Le verdict sur le rôle d'affichage est écrit là où on le cherchera : le
      glossaire du projet et la documentation de référence.
- [ ] La copie porte le compte auquel elle appartient, et une copie qui ne
      correspond pas est ignorée sans qu'il faille penser à l'effacer.
- [ ] Ce que vaut une échéance jugée sur l'horloge locale est tranché et écrit.
