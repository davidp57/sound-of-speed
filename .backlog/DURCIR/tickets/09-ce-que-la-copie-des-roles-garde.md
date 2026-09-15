# 09 — Ce que la copie des rôles garde vraiment

**Statut :** ✅ fait

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

- [x] Un test dit, rôle par rôle, lequel a un gardien côté serveur et lequel n'en
      a pas, et rougit si un rôle en perd un.
- [x] Le verdict sur le rôle d'affichage est écrit là où on le cherchera : le
      glossaire du projet et la documentation de référence.
- [x] La copie porte le compte auquel elle appartient, et une copie qui ne
      correspond pas est ignorée sans qu'il faille penser à l'effacer.
- [x] Ce que vaut une échéance jugée sur l'horloge locale est tranché et écrit.

## Ce qui a été fait

**La table des gardes.** Une table de `serveur.test.ts` énumère, rôle par rôle,
les routes que le serveur refuse en son absence : sept pour `conduite`, deux pour
`atelier`, **zéro** pour `synthese`. Un cas de plus vérifie l'autre bout — retirer
le rôle d'affichage ne ferme aucune route —, si bien que le jour où quelqu'un en
garderait une, le test rougit et oblige à corriger la table **et** le verdict
écrit.

**Le verdict, écrit deux fois.** Dans le glossaire, à l'entrée « Rôle », et dans
la référence des rôles du README, avec une colonne « Gardé par le serveur » qui
dit non pour le troisième. Les deux disent pourquoi : le dépôt est public, le
code de cet écran se lit, et prétendre le garder serait du théâtre.

**La copie porte son compte.** La réponse des droits dit désormais à qui ils
appartiennent, et la copie rangée le retient. Le contrôle est placé dans la
fonction pure que tout le monde emprunte pour connaître ses rôles, et non dans un
appel à oublier qu'une route ajoutée plus tard pourrait manquer. Une copie qui
parle d'un autre compte est traitée comme une absence de copie : elle n'interdit
rien, le serveur s'en chargeant. La clé de rangement passe en `v2` — une copie
d'avant ne sait pas de qui elle parle, donc elle ne se relit pas.

**L'horloge : tranché, on n'y touche pas.** Reculer l'horloge rouvre un droit
expiré et n'ouvre rien : la copie ne protège rien, et l'écran ainsi rouvert
n'obtiendra que des refus. Juger l'échéance sur une heure rendue par le serveur
coûterait précisément ce qu'on refuse de payer — il faudrait le réseau pour
savoir ce qu'on ouvre, dans une application dont la règle est de démarrer et de
faire du son sans lui. Écrit dans le code et dans le README.

## Ce qui a été vérifié

1 728 tests au vert, 58 cas d'accord contre un serveur qui tourne, lint et
construction compris.
