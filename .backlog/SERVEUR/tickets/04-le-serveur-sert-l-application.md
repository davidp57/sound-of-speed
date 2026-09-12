# 04 — Le serveur sert l'application, et le test d'accord le dit

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le contrat est figé · 02 — Un manifeste, trois dossiers.

## Ce qu'il faut obtenir

Un serveur en TypeScript rend l'application, ses ressources, les échantillons et
les réponses d'échappement. On ouvre l'adresse, on conduit, on entend le moteur :
tout ce qui ne demande ni compte ni écriture marche déjà.

À ce stade, les dossiers de données sont encore servis par l'ancien chemin. Ce
ticket ne les touche pas.

## Ce qui décide de la réussite

**Le test d'accord**, sur sa part publique. Pas une relecture : une exécution.

Trois pièges y sont enfermés, et chacun casse quelque chose de silencieux :

- le **type des fichiers du moteur simulé**, sans lequel il ne se charge pas ;
- le **repli d'application à page unique**, qui ne doit pas répondre à la place
  d'un chemin de données absent ;
- les **requêtes par plage d'octets** sur les échantillons et sur le média
  silencieux, que le navigateur demande de lui-même.

## Ce qui reste à mesurer, et non à supposer

Servir les échantillons aussi bien que nginx — vingt-trois mégaoctets de FLAC,
sur un disque de NAS. C'est faisable proprement, ça ne se décrète pas. La mesure
appartient au dernier ticket, celui du déploiement ; ici, on note seulement que
la promesse n'est pas encore tenue.

## Critères d'acceptation

- [ ] L'application se charge et joue depuis le nouveau serveur
- [ ] La part publique du test d'accord passe, y compris les deux types MIME
- [ ] Un chemin de données absent rend un vrai 404, jamais la page d'application
- [ ] Les requêtes par plage d'octets sont honorées
- [ ] Le service worker s'installe et met en cache comme avant — vérifié en
      coupant le réseau après une première visite
