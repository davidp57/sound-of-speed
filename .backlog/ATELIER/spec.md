# ATELIER — l'atelier fabrique les moteurs, la voiture les reçoit

**Statut :** ⬜ prêt
**Branche :** `feature/atelier-livre` pour le premier volet
**Version visée :** 0.5

## Ce qui a déclenché

David, le 12 septembre 2026, en reprenant le backlog :

> on a un « moteur » défini par des tas de paramètres. Pour le moment ils vivent
> tous dans un profil éditable en voiture, et c'est beaucoup trop complexe pour
> un utilisateur lambda. Je souhaite qu'on construise ces profils dans un
> atelier et que cet atelier produise donc les profils qui seront embarqués dans
> la voiture.

Ce n'est pas une demande d'interface. C'est un partage des rôles : un endroit où
l'on fabrique, un autre où l'on roule, et un chemin entre les deux.

## Le modèle

Trois temps, et ils ne se recouvrent pas.

1. **L'atelier** définit un moteur — sa définition, ses couches, son mixage, son
   échappement — et une boîte — ses rapports, son pont, sa façon de passer. Il en
   produit quelque chose qui se livre.
2. **La voiture reçoit** ce produit et ne l'édite pas. Elle choisit parmi ce
   qu'on lui a livré.
3. **Au volant**, deux choses seulement bougent : deux effets sonores, et les
   corrections que l'étalonnage applique tout seul par-dessus.

## Ce qui est déjà debout

Plus que le backlog ne le laissait voir. Le moteur et la boîte sont des entités
qu'on nomme et qu'on partage seules ; le profil actif est **assemblé** depuis
elles ; les profils enregistrés ont été scindés en un moteur et une boîte au
démarrage ; l'étalonnage est une **couche** qui corrige tous les profils sans
jamais modifier ce qu'on a réglé — six critères sur sept, il ne lui manque que
l'écoute en roulant.

La mécanique du modèle existe donc. Ce qui manque est le chemin.

## Les deux trous

**Rien ne produit de moteur livrable.** Un moteur naît aujourd'hui de la scission
d'un profil, et vit dans le stockage local du navigateur où il est né. La
bibliothèque livrée, elle, est du code : 493 lignes de TypeScript, sept
définitions écrites à la main dans le dépôt. Un moteur réglé au bureau ne peut
pas arriver dans la voiture autrement qu'en passant par un commit, la CI et un
redéploiement.

**L'atelier et la voiture sont la même application.** La voiture embarque les
4 597 lignes d'écrans qui ne lui servent pas : la configuration, le banc de
synthèse, le simulateur, le panneau d'étalonnage manuel.

## Décisions

Prises le 12 septembre 2026.

### Ce qui reste réglable au volant : deux effets, pas quatre

Le classeur du 10 septembre gardait quatre réglages de caractère en voiture —
rétrogradage forcé, rapports descendus au plus, pétarade, clac de boîte. Il en
reste **deux** : la **pétarade** et le **clac**.

La raison est une frontière, pas un compte. Le rétrogradage forcé et les rapports
descendus au plus changent la façon de conduire : ils appartiennent au
tempérament, que le sélecteur livré le 11 septembre bascule déjà d'un appui. La
pétarade et le clac sont du décor sonore, qu'on veut pouvoir couper sans changer
de caractère — en ville, ou avec un passager.

### Le chemin : le serveur sert les moteurs, la voiture les garde

L'atelier dépose un moteur sur le serveur ; la voiture le récupère au lancement
et le garde pour rouler hors réseau.

C'est le canal qui sert déjà les banques d'échantillons, qui vivent dans un
volume du NAS hors de l'image. Le moteur voyage avec sa banque, par le même
chemin. Et c'est ce que [REFONTE](../REFONTE/spec.md) a déjà tranché pour les
profils : le serveur fait foi, le stockage local n'est qu'un cache.

Ce que ça coûte, et qui est assumé : déposer demande que le serveur soit
joignable, et la voiture doit avoir vu le réseau une fois avant de partir.

### L'ordre : le chemin d'abord

Régler un moteur au bureau et l'entendre le soir même, sans commit ni
redéploiement. C'est la boucle qui manque, et c'est le premier volet.

C'est aussi le seul ordre sûr. Retirer d'abord les écrans de réglage de la
voiture la laisserait figée sur ce qui est commité, sans moyen de recevoir quoi
que ce soit. Le prix de cet ordre est que l'écran de configuration reste
encombré en voiture le temps du premier volet.

### L'état de retour suit les valeurs

Un profil vidé ne peut plus porter son état de retour, qui est fait des sept
sections qui déménagent. Il suit donc les entités : chaque moteur et chaque
boîte porte le sien, et le geste devient « réinitialiser ce moteur ».

C'est la seule forme qui ne laisse pas une photo périmée derrière elle : corriger
l'ancrage d'une couche dans le moteur se verrait partout sauf dans l'origine, et
« réinitialiser » rendrait alors des valeurs d'avant la correction. C'est aussi
un geste d'atelier, qui n'a pas à partir en voiture.

## Les trois volets

1. **Le chemin** — l'atelier dépose, la voiture reçoit et garde. Premier, et
   c'est celui qui rend la boucle de réglage utilisable.
2. **La séparation** — la construction embarquée n'emporte plus les écrans de
   l'atelier. C'est le volet « trois constructions » de
   [REFONTE](../REFONTE/spec.md), qui n'avait jamais été découpé, et
   [MENAGE-UI](../MENAGE-UI/spec.md) en est le lot d'exécution côté interface.
3. **La contraction** — finir le vidage du profil, avec l'état de retour qui
   déménage. C'est le ticket 04 de REFONTE, suspendu le 12 septembre : le vider
   n'avait de sens qu'une fois su ce que l'atelier livre.

## Hors périmètre

- **Distribuer l'atelier.** « On décidera plus tard si c'est juste pour moi ou si
  on le distribue. » Le lot le sépare, il ne le publie pas.
- **Les comptes.** Le volet compte de REFONTE tient son calendrier. Ce lot se
  fait à compte unique, comme le reste du dépôt aujourd'hui.
- **Le vieux panneau d'étalonnage manuel.** Il n'a plus lieu d'être en voiture
  depuis que l'étalonnage se fait tout seul, mais son retrait appartient au volet
  de la séparation, pas à celui du chemin.
- **Le son lui-même.** Le timbre, la synthèse et le rejeu restent où ils sont :
  [SYNTHESE](../SYNTHESE/spec.md) garde engine-sim comme outil d'atelier pour
  fabriquer des banques.
