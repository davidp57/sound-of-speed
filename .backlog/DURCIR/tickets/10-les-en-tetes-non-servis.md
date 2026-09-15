# 10 — Les en-têtes que le serveur ne sert pas

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le serveur qui a remplacé l'ancien ne sert aucun en-tête de sécurité. Après ce
ticket, il sert une politique de contenu, dit que les types annoncés ne se
devinent pas, borne ce qui part dans l'adresse de provenance, et refuse d'être
encadré dans une autre page.

Le point délicat est que l'application charge un module compilé pour son moteur
simulé et fait tourner une horloge audio à part : une politique posée à l'aveugle
coupe le son sans rien dire. Le jeu de requêtes d'accord est le juge, et
l'application doit faire du son après.

Les attributs du témoin de connexion se relèvent dans le même mouvement, **tels
qu'ils arrivent derrière le proxy inversé** — pas tels qu'on croit les avoir
configurés.

## Critères d'acceptation

- [ ] Les en-têtes sont servis, et le jeu de requêtes d'accord les vérifie.
- [ ] L'application joue, le moteur simulé démarre, et l'horloge audio tient page
      masquée.
- [ ] Le relecteur fonctionne sous la même politique.
- [ ] Les attributs du témoin sont relevés sur le serveur déployé, et écrits.
