# 01 — Better Auth entre dans le serveur, sans rien casser

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

La bibliothèque est montée sur le serveur, branchée sur la base qui existe, et
elle rend une session. Rien d'autre ne change : la voiture dépose comme avant, le
relecteur lit comme avant, et le jeu de requêtes passe sans qu'on y touche.

C'est la balle traçante de l'identité : une session qui existe et qu'on peut
lire, avant que quoi que ce soit en dépende.

## Ce à quoi il faut faire attention

- **Elle apporte ses propres tables.** `user`, `session`, `account`,
  `verification` — et la base porte déjà `accounts`, avec des clés étrangères
  depuis les profils, les moteurs, les boîtes, les dépôts et le profil mesuré.
  Deux tables de comptes qui coexistent, c'est deux vérités : il faut décider
  laquelle fait foi, et l'écrire. La réponse se prend à l'essai, pas d'avance.
- **Les migrations sont versionnées ici.** Ce que la bibliothèque veut créer doit
  entrer par le même chemin que le reste — `drizzle-kit generate`, un fichier SQL
  numéroté, joué au démarrage. Une bibliothèque qui crée ses tables toute seule
  au premier appel contournerait la seule porte qu'on a.
- **C'est une dépendance de production**, sur une application qui doit se charger
  hors réseau. Ce qu'elle ajoute au paquet du client se **mesure** dans ce
  ticket, même si le découpage viendra plus tard : un chiffre relevé maintenant
  est le seul point de comparaison qu'on aura.
- **Hono a été choisi pour elle** : il parle en `Request` et `Response`
  standard. Si le montage demande autre chose, c'est un signal, pas un détail à
  contourner.
- **Le jeu `accord` ne doit pas bouger.** Il décrit le contrat que la voiture
  attend ; s'il faut le changer à ce ticket, c'est que quelque chose a cassé.

## Critères d'acceptation

- [ ] Le serveur démarre avec la bibliothèque montée, et la base se migre par le
      chemin habituel
- [ ] Une session se crée et se relit, vérifiée par un test
- [ ] La table des comptes qui fait foi est décidée, et la décision est écrite
      dans la spec
- [ ] Le jeu `accord` passe sans modification, dans le conteneur comme hors de lui
- [ ] Le poids ajouté au paquet du client est mesuré et noté
