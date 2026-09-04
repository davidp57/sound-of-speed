# JOURNAL — savoir ce que la voiture a vécu, sans avoir à le demander

**Statut :** 🧑 attend David
**Branche :** `feature/journal`
**Version visée :** 0.2

## Ce qui a déclenché

Le diagnostic des trois défauts de l'essai du 4 septembre 2026 a pris une
journée, et l'essentiel de ce temps est passé à **deviner** ce que la voiture
avait vécu. Le navigateur de bord n'a pas de devtools : on ne consulte pas une
console assis dans une Tesla en roulant, et David — c'est son usage, pas une
paresse — essaie le produit et rapporte ce qu'il voit, sans fouiller.

Un exemple suffit à mesurer le coût. Le drapeau qui distingue une vitesse lue
d'une vitesse déduite existait depuis le premier jour du projet et n'était
affiché nulle part. C'est lui qui aurait désigné le défaut du repli par distance
en une seconde ; faute de lui, le défaut a vécu une semaine et immobilisé
l'application deux fois sur autoroute.

## Ce qu'on veut

Un journal des événements de la conduite, qui **remonte tout seul** au NAS. La
contrainte est explicite : aucun geste à faire pour envoyer les données. On
règle une fois, et ensuite ça se dépose.

## Ce qui est décidé

**Le dépôt est automatique et régulier, jamais en direct.** Pas de websocket, et
la raison est double. D'abord une voiture traverse des zones sans réseau : une
connexion permanente perdrait ses données précisément aux moments intéressants.
Ensuite le temps réel n'a de valeur que si quelqu'un regarde pendant que ça se
produit — or celui qui pourrait regarder est au volant. Un envoi périodique,
avec ce qui n'a pas pu partir gardé pour le prochain, couvre le besoin réel.

**Le tuyau existe déjà.** `docker/nginx.conf` ouvre `/traces/` en écriture par
le module DAV de nginx, avec `dav_methods PUT`, authentifié, et il est éprouvé
sur le NAS depuis le 3 septembre. Aucun service nouveau n'est donc à ajouter à
la pile — ce qui préserve le « pas de serveur » du projet.

**L'accord est explicite, et il a deux crans.** Rien ne part par défaut. Une
fenêtre de confirmation dit ce qui est envoyé, en clair, avant le premier envoi.
Les deux crans :

| Cran | Ce qui part |
|---|---|
| **Minimum** | Événements de diagnostic, vitesses, accélérations, régimes, états de la source et du son |
| **Étendu** | En plus : position précise, trace exploitable en GPX, et ce qui peut servir à améliorer le produit |

Le second cran est un choix distinct, jamais déduit du premier : une position
précise est une donnée de déplacement, et même déposée sur un NAS qui est chez
soi, cela se dit avant, pas après.

**Des événements, pas du texte libre.** Des faits horodatés qui se comptent et
se comparent d'un trajet à l'autre — changement de source, statut du GPS,
relances du chien de garde, origine de la vitesse, suspensions du contexte
audio, rejets par motif, erreurs, plus un résumé chiffré périodique. Des lignes
de texte gonflent vite et ne se recoupent pas.

## Des tranches horodatées, jamais réécrites

**Chaque dépôt est une tranche neuve**, contenant ce qui s'est accumulé depuis la
précédente. Une tranche déposée est **immuable** : on ne réécrit jamais ce qui
est déjà là, ce qui s'accorde avec un serveur qui n'ouvre que l'écriture.

Une première conception déposait **un fichier par session, réécrit à chaque
dépôt**. Elle a été écartée par David, et il avait raison. Le stockage aurait été
le même — un fichier réécrit ne s'accumule pas —, mais **ce qu'on renvoie**
grossit à chaque fois, puisque c'est le journal complet depuis le début :

| Trajet de trente minutes, à la cadence de deux minutes d'abord envisagée | Fichier unique réécrit | Tranches |
|---|---|---|
| Dernier envoi | 200 Ko | ~13 Ko |
| Total transféré | ~1,6 Mo | 200 Ko |

Huit fois trop, et cela empire avec la durée : sur deux heures, le dernier envoi
ferait 800 Ko et le total transféré vingt-quatre mégaoctets. Sur un réseau
intermittent, un envoi de 800 Ko qui doit réussir **en entier** échoue
précisément quand le journal est le plus intéressant.

Trois règles bordent le prix des tranches, qui est leur nombre.

**Le nommage regroupe par session** : un préfixe commun — date, heure,
identifiant tiré au démarrage — suivi de l'indice de tranche. Les fichiers d'un
même trajet se trient ensemble, se recollent dans l'ordre, et se suppriment d'un
geste par préfixe. Sans cela, le ménage à la main devient un tri.

**Une tranche part sur une taille ou sur un temps**, et non sur la seule horloge :
un trajet calme ne doit pas produire quinze fichiers de deux lignes.

**Ce qui n'a pas pu partir est joint à la tranche suivante.** Sans cette règle,
vingt minutes sans réseau produiraient dix tranches en attente, déposées en dix
fichiers dès le retour du réseau. Jointes, elles font une tranche plus grosse et
un seul fichier.

Le serveur borde le reste de lui-même : `docker/nginx.conf` n'ouvre que `PUT`, ni
`DELETE` ni `MKCOL`. **L'application ne peut donc pas faire le ménage**, et c'est
une propriété à garder — une application capable d'effacer ses propres journaux
serait un mauvais témoin. Le ménage se fait à la main, avec File Station.

Pour que ce soit tenable, l'écran dit ce qui a été déposé — noms et tailles —
afin qu'on sache quoi supprimer sans deviner.

**Un dossier à part**, et non `/traces/`. nginx sert ce dossier en index JSON, et
c'est cet index que l'application télécharge pour lister les traces du serveur :
y verser un journal par trajet alourdirait cette liste à chaque sortie.

## Deux cadences, à ne pas confondre

| | Cadence | Pourquoi |
|---|---|---|
| Écriture locale | quelques secondes | La voiture coupe le contact sans prévenir : ce qui n'est pas écrit est perdu |
| Dépôt d'une tranche | cinq minutes, ou une taille atteinte | Six fichiers pour un trajet d'une demi-heure. La perte reste bornée : le journal vit en local, et le démarrage suivant rattrape ce qui n'est pas parti |

Plus deux filets : une tentative quand la page passe en arrière-plan, et un
rattrapage au démarrage suivant pour ce qui n'a pas pu partir. Sans réseau, on
garde et on réessaie — c'est ce qu'une connexion permanente ne sait pas faire.

## Ce que cela pèse

Estimé pour un trajet de trente minutes, à confirmer par la mesure :

| Cran | Contenu | Taille |
|---|---|---|
| Minimum | événements plus un résumé toutes les dix secondes, soit deux à trois cents lignes | ~25 Ko |
| Étendu | plus une trace décimée à un point par seconde, mille huit cents points | ~200 Ko |

C'est le total d'un trajet, tranches confondues : le découpage ne change pas ce
qui est stocké, seulement ce qui est transféré. Deux trajets par jour font de
1,5 à 12 Mo par mois, en trois à quatre cents fichiers regroupés par préfixe de
session : rien pour un NAS, à condition que le nommage permette d'en supprimer
un trajet d'un geste.

**Le piège est de journaliser chaque mesure de vitesse.** À la cadence réelle du
GPS, trente millisecondes, cela ferait soixante mille lignes et cinq mégaoctets
**par trajet**. D'où la décimation à un point par seconde, qui est de toute façon
la résolution habituelle d'une trace exploitable.

Deux protections côté application, pour la même raison : le journal en attente
est **borné en mémoire**, et la taille d'une tranche est plafonnée — une tranche
qui atteint son plafond part sans attendre l'horloge. Une session de trois heures
ne doit ni produire un fichier que le serveur refuse — sa borne est à 64 Mo — ni
saturer le stockage local, dont le quota mord déjà sur les traces.

**Le journal ne refait pas les traces.** L'enregistrement de trace existe et
capture déjà la vitesse. La valeur du journal est dans ce que la trace ne
contient pas : les états, les décisions, les erreurs.

## Question ouverte

Une **console embarquée** (eruda, vConsole) chargée à la demande depuis un
paramètre d'adresse répondrait à un besoin voisin mais distinct : regarder sur
place, tout de suite, sans réseau. Elle complète le journal plutôt qu'elle ne le
remplace. C'est une dépendance de production, donc elle demande l'accord de
David avant d'être ajoutée — et David a dit ne pas connaître l'outil. À lui
présenter avant de décider.

## Hors périmètre

L'analyse des journaux déposés. On commence par les avoir.

## Ce qui est livré

Le cœur — l'anneau borné, le découpage en tranches, le nommage triable, la
remise en attente d'une tranche qui n'a pas pu partir —, le dépôt avec sa
distinction des échecs réessayables, la collecte qui se tait aux états
inchangés, le réglage à trois positions avec sa confirmation, le bloc
`location /journal/` du serveur et le montage dans les deux piles.

**Trente-six tests, éprouvés par mutation.** Six mutations du code ont été
essayées, dont trois sur la règle de confidentialité et le découpage : chacune
fait tomber un test au moins. Un test qui passe sur du code neuf ne prouve rien
tant qu'on n'a pas montré qu'il peut échouer.

Un défaut trouvé en essayant l'application, et qui ne se serait pas vu
autrement : le journal était branché sur l'horloge murale alors que toute la
chaîne avance au pas de la boucle. Le banc de mise au point, qui déroule des
heures en quelques secondes, ne produisait donc aucune tranche — le journal
n'était pas vérifiable là où tout le reste l'est.

## Ce qui reste

**Deux gestes sur le NAS**, et ils sont à David :

- créer le dossier `/volume1/docker/speed/journal/` avec File Station, avant de
  redéployer : Docker sous DSM refuse de démarrer sur un point de montage absent ;
- **redéployer l'image**, et non seulement l'application : le bloc `location` du
  serveur est dans l'image.

Puis un trajet, journal accepté, pour lire ce qu'il dit. Le format d'une ligne et
la valeur du plafond de tranche restent à confirmer sur des tranches réelles
plutôt que sur l'estimation de 25 Ko.

## Question toujours ouverte

La **console embarquée** (eruda, vConsole), qui répondrait au besoin voisin de
regarder sur place, sans réseau. C'est une dépendance de production, et David ne
connaît pas l'outil : à lui montrer en action avant de proposer de l'ajouter.
