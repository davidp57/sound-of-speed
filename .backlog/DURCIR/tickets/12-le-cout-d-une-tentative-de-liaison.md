# 12 — Ce que coûte une tentative sur le code de liaison

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le code de liaison tient sur huit caractères et vingt-quatre heures. Ce qui le
rend sûr n'est pas sa longueur mais l'impossibilité d'essayer vite — et cette
borne n'est vérifiée par rien : la bibliothèque la coupe hors production, donc
aucun test ne la voit. Le calcul écrit à côté du code n'a jamais été confronté à
ce que le serveur fait vraiment.

Après ce ticket, la borne est prouvée dans une configuration de production. Et le
nombre de codes **vivants** pour un même compte est borné : rien ne l'empêche
aujourd'hui, et chaque code vivant divise d'autant la protection que le calcul
annonce.

## Critères d'acceptation

- [ ] Un test en configuration de production montre qu'au-delà de la borne les
      tentatives sont refusées.
- [ ] Demander un code neuf ne laisse pas l'ancien ouvert au-delà de ce qui est
      décidé, et la règle est écrite.
- [ ] Le calcul écrit à côté du code correspond à ce qui est mesuré, ou il est
      corrigé.
