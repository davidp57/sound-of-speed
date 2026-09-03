# DEPOSER — sortir un profil ou une trace d'une voiture qui refuse les fichiers

**Statut :** ⬜ prêt
**Branche :** `feature/deposer`
**Version visée :** 0.3

## Le problème

Relevé en roulant : « on devrait trouver un moyen pour exporter les profils et
surtout les traces GPS — dans la Tesla on ne peut pas sauver de fichier sur le
navigateur, c'est bloqué ».

Tout l'export du projet passe par le téléchargement d'un fichier. Sur le
navigateur de la voiture, cette voie est fermée : **rien ne sort**. Or c'est
précisément là que les données naissent — les traces GPS s'enregistrent en
roulant, et elles ne servent qu'ailleurs, sur un poste, pour rejouer un trajet
et régler sans reprendre la voiture.

Une trace est aussi la matière première du lot
[ETALONNAGE](../ETALONNAGE/spec.md), qui n'a aucun sens si les traces restent
prisonnières.

Pour les **profils**, la situation est moins grave : le partage par lien et par
code existe, et il ne télécharge rien. Pour les **traces**, il n'y a rien — et
un lien ne convient pas, une trace pesant des dizaines de kilo-octets là où une
adresse confortable en tient moins de deux.

## La solution

**Déposer au lieu de télécharger.** L'application est servie par notre propre
nginx, depuis un dossier du NAS. Le dossier `profiles/` est déjà lu par la
bibliothèque de profils ; il suffit de pouvoir **écrire** à côté.

nginx sait recevoir un `PUT` — c'est le module WebDAV, et il n'ajoute aucun
service à maintenir, ce qui est la contrainte du projet depuis le début. Un
dossier `traces/` autorisé en écriture, et l'application y dépose ; le fichier
est ensuite lisible depuis n'importe quel appareil, ou par File Station.

**À confirmer avant d'écrire une ligne** : que le module DAV soit compilé dans
l'image `nginx:alpine` dont nous héritons. La vérification tient en une commande
sur le NAS :

```
docker run --rm nginx:alpine nginx -V 2>&1 | tr ' ' '\n' | grep dav
```

Docker n'est pas installé sur le poste de développement, donc ce point **n'a pas
été vérifié**. S'il manquait, deux replis : une image de base différente, ou un
dépôt par le presse-papiers pour les petites choses.

## Histoires

1. En tant que conducteur, je veux qu'une trace enregistrée en roulant se
   retrouve sur mon poste sans manipuler de fichier dans la voiture.
2. En tant qu'utilisateur, je veux déposer un profil trouvé en roulant pour le
   récupérer sur un autre appareil — la bibliothèque partagée le lit déjà.
3. En tant qu'administrateur du NAS, je ne veux pas d'un service de plus :
   nginx sert des fichiers, il peut en recevoir.

## Décisions à prendre

- **L'écriture est-elle protégée ?** Le site est déjà derrière l'authentification
  de nginx quand elle est activée, et derrière le proxy inversé de DSM. Un
  dossier ouvert en écriture sans authentification sur une adresse publique est
  une invitation. À trancher **avant** d'écrire, pas après.
- **Que se passe-t-il hors réseau ?** Une trace enregistrée sans réseau ne peut
  pas être déposée. Il faut donc soit la garder et la déposer au retour, soit le
  dire clairement. Elle est déjà conservée dans le stockage local d'une session à
  l'autre, ce qui donne la matière au premier choix.
- **Le quota.** Les traces longues pèsent lourd, et le stockage local a déjà
  échoué à en garder une — l'échec est signalé, c'est un acquis. Le dépôt sur le
  NAS lève la contrainte, à condition de ne pas y accumuler sans fin.

## Hors périmètre

- Un service de synchronisation, un compte, une base. Le projet s'en passe
  depuis le début et il n'y a pas de raison de commencer.
- L'export des profils par fichier, qui reste pour les postes où il fonctionne.
