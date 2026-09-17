# 02 — Une bande de défilement à gauche, trouvable sans regarder

**Statut :** 🧑 **repris par [INTERFACE](../../INTERFACE/spec.md)**

**Bloqué par :** aucun, peut démarrer tout de suite — mais n'a de sens qu'après
avoir constaté ce que donne le 01 dans la voiture

## Ce qu'il faut obtenir

Une bande verticale le long du bord **gauche** de l'écran de configuration —
la place du conducteur, donc celle du pouce — où le glissement ne peut rien
dérégler, quel que soit le comportement tactile du navigateur. Elle est
suffisamment large pour se trouver sans regarder et suffisamment marquée pour
qu'on sache qu'elle est là.

Elle ne remplace pas le 01 : elle garantit le défilement même si le navigateur
de la voiture ignore le comportement tactile déclaré. C'est une sécurité, et
c'est aussi ce qui a été demandé.

Sur un téléphone en portrait, elle ne doit pas rétrécir les curseurs au point de
les rendre imprécis : sa largeur est un compromis à trancher en la voyant.

La marque visuelle reste dans le registre du dépôt : discrète, sans animation,
sans dégradé, sans flèche.

## Critères d'acceptation

- [x] Un glissement vertical dans la bande fait défiler la page
- [x] Aucun réglage ne peut être atteint depuis la bande
- [x] La bande est visible sans être voyante, et ne bouge pas
- [x] Les curseurs restent utilisables sur un téléphone en portrait
- [x] L'écran de télémétrie n'en reçoit pas : il n'a pas de curseurs, donc pas le
      problème
- [ ] 🧑 Vérifié dans la voiture : la bande se trouve au pouce, sans regarder
