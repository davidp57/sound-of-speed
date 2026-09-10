# RAPATRIER — faire redescendre ce que la voiture a déposé

**Statut :** 🧑 attend David — le code est livré, la preuve demande son téléphone
et le NAS
**Branche :** `feature/export-donnees`
**Version visée :** 0.1.84

## Ce qui a déclenché

Un diagnostic bloqué faute de données. L'essai en voiture du 9 septembre 2026 a
laissé seize tranches de journal sur le NAS — 1 h 20 de conduite, avec la
vitesse, l'accélération, le régime et le rapport toutes les dix secondes. Ce
sont les seuls chiffres qui diraient dans quelles conditions la boîte a dérapé,
et deux diagnostics ont déjà été démentis faute de les avoir.

Ils sont inaccessibles depuis le poste de travail : le proxy du bureau répond
503 sur le NAS. Et le navigateur de la voiture ne télécharge rien, donc rien
ne redescend par là non plus.

Proposition de David, faite deux fois :

> si tu fais une version (image Docker) qui permet de récupérer toutes les
> données enregistrées en un paquet (.zip par exemple) je peux mettre à jour le
> NAS via mon téléphone et je te télécharge les données de la même manière

La première réponse de l'agent — « File Station sait déjà zipper un dossier » —
était à côté : elle réglait ce soir-là et laissait le geste hors de
l'application, alors que la remontée y vit déjà tout entière. Et l'objection
qu'elle portait, le coût d'un service de plus sur le NAS, tombe : rien n'est
nécessaire côté serveur.

## Ce qu'on obtient

Un bouton, dans la section Profils : il liste les quatre dossiers du serveur,
tire tous les fichiers et rend un paquet compressé unique, nommé à la seconde.

**Rien de neuf côté serveur.** Trois pièces existaient déjà : nginx sait rendre
le contenu d'un dossier en JSON — ce dont la bibliothèque de profils se sert
depuis le lot BANQUES —, la lecture des quatre dossiers est fermée par le compte
de dépôt, et l'application garde ce compte. Il ne manquait que l'assemblage.

## Décisions

- **Le paquet est écrit à la main, sans dépendance et sans compression.** Une
  centaine de lignes pures, dans le cœur, donc vérifiables sous Node. Le projet
  n'a qu'une dépendance de production hors Vue, et une application qui doit se
  charger hors réseau ne gagne pas à en porter une deuxième pour un bouton. Le
  prix est la taille : une tranche de journal fait vingt-huit kilo-octets et le
  paquet les garde toutes. La compression native du navigateur
  (`CompressionStream`) s'ajoutera au même endroit si le poids gêne.
- **Le format est vérifié à l'extérieur.** Un lecteur écrit dans le test
  prouverait seulement que l'agent est cohérent avec lui-même. Le paquet a donc
  été ouvert par le décompresseur de Windows : arborescence et accents intacts.
- **Il part incomplet plutôt que pas du tout.** Un dossier refusé ou un fichier
  illisible n'emporte pas le reste, et le message nomme ce qui manque. Un
  dossier absent, lui, n'est pas un échec : ils naissent au premier dépôt.
- **Les dossiers sont en série, les fichiers en parallèle.** Sur un téléphone en
  réseau mobile, lancer cinquante requêtes d'un coup ralentit au lieu
  d'accélérer.
- **Sans compte, aucune requête ne part**, et l'écran le dit — plutôt qu'un
  aller-retour pour un 401.

## Ce que ça préfigure

C'est l'export par compte que le lot REFONTE prévoit — « récupérer tout ce que
j'ai enregistré en un seul paquet ». Écrit une fois, il sert avant les comptes
et après.

## Ce qui reste

L'essai de David : mettre l'image `develop` à jour sur le NAS depuis son
téléphone, ouvrir l'application, appuyer sur le bouton. C'est ce qui décidera si
le paquet est trop gros pour être compressé, et cela rapatriera l'essai du
9 septembre.

## Hors périmètre

- **Les données locales de l'appareil.** Le paquet ramasse ce que le serveur
  porte. Les traces qui n'ont pas encore été déposées s'exportent déjà une par
  une.
- **La compression.** Voir plus haut : elle s'ajoute si la mesure le demande.
- **Un service côté NAS.** Aucun n'est nécessaire.
