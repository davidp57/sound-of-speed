# 10 — Les en-têtes que le serveur ne sert pas

**Statut :** ✅ fait

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

## Critères d'acceptation

- [x] Les en-têtes sont servis, et le jeu de requêtes d'accord les vérifie.
- [x] L'application joue, le moteur simulé démarre, et l'horloge audio tient page
      masquée.
- [x] Le relecteur fonctionne sous la même politique.
- [x] Les attributs du témoin sont relevés sur le serveur déployé, et écrits.

## Ce qui est servi

Sur **toutes** les réponses, et non sur les seules pages : une politique de
contenu, `X-Content-Type-Options: nosniff`, et
`Referrer-Policy: strict-origin-when-cross-origin` — un profil partagé voyage
dans l'adresse, et elle n'a rien à faire dans le journal d'un tiers.

La politique refuse l'encadrement de la page (`frame-ancestors 'none'`), les
objets, et tout ce qui ne vient pas de chez nous.

## Les deux desserrages, et ce qu'ils coûtent

Chacun a une raison nommée dans le code, et les deux sont vérifiés par le jeu
d'accord — les perdre couperait le son en silence.

| Desserrage | Sans lui |
|---|---|
| `'wasm-unsafe-eval'` | le moteur simulé ne s'instancie pas du tout |
| `blob:` dans `script-src` | l'horloge audio et le joueur de synthèse ne se chargent pas |

Le second est le plus cher : il rouvre l'exécution d'un script fabriqué à la
volée. Le retirer demanderait de livrer ces deux modules en fichiers, ce qui
touche une pièce délicate. À reprendre le jour où l'on y touchera pour autre
chose.

S'ajoutent `'unsafe-inline'` sur les styles — les liaisons de style de Vue posent
des attributs `style`, et le risque est sans commune mesure avec celui d'un
script — et `https:` sur les images, le portrait d'un compte tenu ailleurs venant
de chez le fournisseur.

## Ce qui a été mesuré, et comment

**Dans un navigateur, sur un contexte audio suspendu** — donc sans un son :

| Ce qui a été essayé | Résultat |
|---|---|
| Un module de worklet fabriqué à la volée, chargé depuis une adresse `blob:` | chargé |
| Un module WebAssembly instancié | instancié |
| Un échantillon par le chemin normal | 200 |
| Refus de la politique relevés sur les deux pages | aucun |
| Le relecteur sous la même politique | chargé, feuilles de style comprises |

Et 60 cas d'accord au vert contre un serveur qui tourne, dont le cas neuf qui
vérifie les en-têtes et les deux desserrages nommément.

## Le témoin de connexion : mesuré, et ça déplace le ticket 11

Relevé sur deux serveurs montés côte à côte :

| Adresse publique | Témoin servi |
|---|---|
| `https://…` | `__Secure-better-auth.session_token`, `Secure`, `HttpOnly`, `SameSite=Lax` |
| absente | `better-auth.session_token`, `HttpOnly`, `SameSite=Lax` — **pas de `Secure`** |

C'est la meilleure raison de renseigner `SPEED_URL`, et elle est plus forte que
celle du ticket 11 : sans elle, le conteneur ne voit qu'un port local en clair,
et le témoin pourrait repartir sur une requête non chiffrée. Écrit dans le
README, à côté de la variable.
