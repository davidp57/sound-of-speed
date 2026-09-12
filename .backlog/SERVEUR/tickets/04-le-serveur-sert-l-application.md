# 04 — Le serveur sert l'application, et le test d'accord le dit

**Statut :** ✅ fait le 12 septembre 2026

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

- [x] L'application se charge et joue depuis le nouveau serveur
- [x] La part publique du test d'accord passe, y compris les deux types MIME
- [x] Un chemin de données absent rend un vrai 404, jamais la page d'application
- [x] Les requêtes par plage d'octets sont honorées
- [x] Le service worker s'installe et met en cache comme avant — vérifié en
      coupant le réseau après une première visite

## Ce que la mesure a corrigé en chemin

**Les plages d'octets ne marchaient pas**, et rien ne le disait : le serveur
répondait 200 avec le fichier entier à qui demandait cent octets. Les en-têtes de
la requête n'étaient jamais transmis jusqu'au service du fichier. Mesuré avant
d'être écrit — la documentation du cadre ne dit rien des plages, et je m'étais
promis de ne pas le supposer. Après correction : 206, cent octets, et 416 sur une
plage hors bornes.

**La racine ne servait pas la page** à qui n'annonce pas ce qu'il accepte. Le
repli ne répond qu'aux navigations, et un outil en ligne de commande ou une sonde
de santé n'en est pas une au sens de l'en-tête. La racine, elle, est une
navigation par définition.

**Deux de mes tests étaient faux, pas le code.** L'un attendait qu'une remontée
de chemin soit refusée, alors qu'elle est **neutralisée** — ce qui est plus sûr :
rien ne sort jamais du dossier servi. L'autre codait en dur une taille de fichier
qui comptait un caractère accentué pour un octet. Les deux ont été réécrits pour
vérifier la propriété qui compte, pas celle que j'avais imaginée.

## Ce que ce ticket répare sans y avoir été invité

**La banque de démonstration est redevenue découvrable.** Le serveur de fichiers
ne savait pas réunir deux sources : le volume des échantillons se montait
par-dessus le dossier et masquait tout ce que l'image y plaçait. La démonstration
avait dû être rangée ailleurs et ramenée par un alias, au prix de son absence
dans le listage des banques — défaut trouvé par le contrat au ticket 01 et
inscrit dans la spec d'[OUVRIR](../../OUVRIR/spec.md). Un serveur qui regarde
dans les deux sources le règle pour de bon, listage compris, et sans correctif
côté client qui n'aurait valu que pour l'ancien serveur.
