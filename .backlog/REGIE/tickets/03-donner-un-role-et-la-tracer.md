# 03 — Donner et reprendre un rôle, et la trace qui l'inscrit

**Statut :** ⬜ prêt

**Bloqué par :** 02 — la fiche d'un compte

## Ce qu'il faut obtenir

Depuis la fiche, je donne un rôle à un compte. L'écran correspondant s'ouvre
chez lui, sans qu'on redéploie quoi que ce soit. Je le reprends, il se referme.

Et le geste laisse une ligne : quand, quel administrateur, quel compte, quoi.
Cette ligne se lit dans la régie.

C'est ce ticket qui crée la table de trace, parce qu'une table de trace sans
geste à tracer ne se démontre pas. Tous les gestes des tickets suivants y
inscriront leur ligne de la même façon.

**Deux contraintes de schéma, et elles ne sont pas décoratives.**

La trace porte l'identifiant du compte **en clair, sans clé étrangère** : toutes
les tables liées au compte s'effacent en cascade avec lui, et une trace
rattachée disparaîtrait exactement au moment où on voudrait la relire.

La trace se garde sans limite : quelques dizaines de lignes par an, et son
intérêt est de répondre à une question posée tard.

## Critères d'acceptation

- [ ] Un rôle donné depuis la fiche ouvre immédiatement l'écran correspondant
      pour ce compte, contrôle serveur compris.
- [ ] Un rôle repris le referme.
- [ ] Le rôle de synthèse s'attribue comme les autres, sans qu'on lui donne un
      pouvoir de route qu'il n'a pas.
- [ ] Chaque attribution et chaque reprise écrit une ligne de trace : instant,
      administrateur, compte visé, nature du geste.
- [ ] La trace se lit dans la régie, la plus récente en haut.
- [ ] La table de trace ne porte pas de clé étrangère vers le compte — vérifié
      en effaçant un compte et en relisant la trace.
- [ ] Rien n'efface les lignes de trace, ni le passage de rétention ni autre
      chose.
- [ ] Un compte non administrateur reçoit 404 sur les routes d'attribution et de
      trace.
- [ ] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [ ] Contrôle qualité vert.
