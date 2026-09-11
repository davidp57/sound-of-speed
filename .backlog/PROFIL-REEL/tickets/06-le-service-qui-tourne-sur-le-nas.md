# 06 — Le service qui tourne sur le NAS

**Statut :** ⬜ prêt

**Bloqué par :** 04 — il n'y a rien à faire tourner tant que le calcul ne sait
pas se compléter.

## Ce qu'il faut obtenir

**Un second conteneur dans la pile, à côté de nginx.** Il voit les tranches
arriver, met l'agrégat à jour, et écrit le résultat là où l'application saura le
lire.

Il importe `src/core/` tel quel, et c'est tout l'intérêt : **un seul calcul**.
Un service écrit ailleurs donnerait deux procédés pour la même grandeur, et ils
divergeraient — la revue du 11 septembre a trouvé cinq défauts de ce genre en
une journée, tous nés d'un état dupliqué.

Le NAS ne construit rien et n'ouvre pas de terminal : l'image arrive prête,
publiée par la même chaîne d'intégration que celle de l'application, et
Portainer la tire.

## Critères d'acceptation

- [ ] Le conteneur se construit et se publie avec l'application, sans étape
      manuelle.
- [ ] Il détecte une tranche déposée et met l'agrégat à jour.
- [ ] Le résultat est lisible par l'application, avec le compte de trajets qui
      le fondent et la date du dernier calcul.
- [ ] Il survit à un redémarrage sans reperdre son agrégat.
- [ ] Une tranche illisible ou tronquée ne l'arrête pas : elle est écartée et
      nommée.
- [ ] La pile mise à jour est documentée dans le README, comme celle de
      l'application.
- [ ] Contrôle qualité vert.
