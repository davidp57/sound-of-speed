# 04 — Le panneau traces disparaît

**Statut :** ✅ fait

**Bloqué par :** 01 — la capture démarre toute seule et remonte par tranches ;
03 — un témoin dit si la session sera exploitable

## Ce qu'il faut obtenir

L'écran de télémétrie ne porte plus de panneau de traces. Capturer, nommer,
lister, supprimer, exporter, importer, rejouer, déposer : tous ces gestes
disparaissent, remplacés par la ligne d'état du ticket 03.

C'est la contrepartie du ticket 01. Deux mécanismes qui décrivent le même fait
finissent par diverger, et ce dépôt l'a déjà payé deux fois.

**L'étalonnage embarqué garde sa capture bornée.** Il démarre et arrête un
enregistrement à chaque étape de mesure, et son analyse en dépend : délimiter
une étape n'est pas capturer une session, et une étape mal bornée donne une
mesure fausse. Ce mécanisme reste, avec ce qu'il faut de la couche de stockage
pour qu'il continue de fonctionner.

**Ce ticket retire le seul rejeu sonore existant.** Tant que le relecteur ne
joue pas le son, aucun trajet ne peut être rejoué au bureau. C'est un prix
accepté, pas un oubli : le rejeu revient au ticket 08.

## Critères d'acceptation

- [x] L'écran de télémétrie ne propose plus aucun geste sur les traces.
- [x] L'étalonnage embarqué enregistre, analyse et applique comme avant.
- [x] Le code mort part avec le panneau — rien ne subsiste qui ne serve plus
      qu'à l'étalonnage sans le dire.
- [x] Le README ne décrit plus des gestes qui n'existent plus.
- [x] Le contrôle qualité est vert, tests compris.

Critères relus le 12 septembre 2026. Le README a été corrigé le jour même : il décrivait encore l'export et la réimportation des traces, et leur enregistrement depuis l'écran Télémétrie, trois gestes qui n'existent plus. Un critère reste ouvert : **du code mort subsiste** — des règles de style sans élément qui les porte, une fonction de lecture de traces que seul son test appelle, et un commentaire qui décrit encore le geste retiré.

Le code mort a été retiré le 12 septembre 2026 : les règles de style que plus aucun élément ne portait, la lecture de traces en fichier que seul son propre test appelait, et deux commentaires qui décrivaient encore le geste supprimé. L'écriture de traces en fichier, elle, reste : le dépôt s'en sert.
