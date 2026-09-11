# 09 — Servir le profil mesuré : la chaîne était coupée en trois

**Statut :** ⬜ prêt

**Bloqué par :** rien. C'est le défaut qui a empêché le ticket 07 de se voir.

## Ce qui s'est passé

Sortie du 11 septembre 2026 au soir, application en 0.1.107 — le bandeau était
donc embarqué. David a attendu la proposition, elle n'est jamais venue.

Trois ruptures, toutes dans ce qui a été livré :

1. **`docker/nginx.conf` n'a pas d'emplacement `/profils/`.** L'application
   demande `/profils/profil-voiture.json` ; les emplacements servis sont
   `/profiles/`, `/traces/`, `/journal/`, `/mesures/`. La requête tombe donc
   dans le `location /` avec son `try_files … /index.html` : nginx répond
   **200 avec la page d'accueil**, `response.ok` est vrai, `response.json()`
   échoue sur du HTML, et `fetchMeasuredCar` rend `null`. Sans un mot.
2. **Le conteneur `speed` ne monte pas `/volume1/docker/speed/profils`.** Même
   avec l'emplacement, il n'y aurait rien derrière.
3. **Le dossier n'existe pas sur le NAS** — il y a `profiles`, à une lettre
   près. Le compose le dit lui-même des autres volumes : sous DSM, Docker ne
   crée pas un point de montage absent, il refuse de démarrer le conteneur. Le
   profileur n'a donc pas pu démarrer.

Pourquoi le ticket 07 ne l'a pas vu : il a été éprouvé dans le navigateur avec
le fichier posé à la main. Le chemin servi n'a jamais été traversé.

## Ce qu'il faut obtenir

- Un `location /profils/` dans `docker/nginx.conf`, en lecture seule — rien n'y
  est déposé depuis la voiture, c'est le profileur qui écrit.
- Le volume `/volume1/docker/speed/profils` monté dans le conteneur `speed`,
  en lecture seule de son côté.
- Le dossier à créer, dit dans le README avec les autres, et la consigne de
  **recoller la pile dans Portainer** : un repull ne crée pas un service absent.
- **Ne plus échouer en silence.** Une rupture de cette chaîne rend `null` et
  n'affiche rien ; c'est ce qui a fait attendre David sans signe. L'écran de
  télémétrie dit ce qui s'est passé au dernier essai.

## Critères d'acceptation

- [ ] `GET /profils/profil-voiture.json` rend le fichier, pas `index.html`.
- [ ] Une réponse qui n'est pas du JSON ne passe pas pour une absence de profil.
- [ ] L'écran de télémétrie dit l'état du dernier essai : jamais tenté, pas de
      réponse, réponse illisible, ou la date du profil trouvé.
- [ ] Le README liste `profils` parmi les dossiers à créer, et dit de recoller
      la pile.
- [ ] Contrôle qualité vert.
