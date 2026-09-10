# RELECTURE — revoir un trajet au bureau, au lieu de le raconter de mémoire

**Statut :** 🔄 en cours
**Branches :** `feature/capture-continue` puis `feature/relecteur` — deux lots
d'exécution, deux PR
**Version visée :** 0.2

## Le problème

Le 10 septembre 2026, David a roulé trente-six minutes pour essayer la journée
de travail. Au retour, il ne reste que huit tranches de journal : un relevé
toutes les dix secondes, une position par seconde, et aucune trace. Le
debriefing se fait donc de mémoire, et il bute sur la même phrase à chaque
fois — « à un moment, il s'est passé quelque chose ».

Trois manques se sont révélés ce soir-là.

**Rien n'a été capturé, et rien ne l'a dit.** La remontée automatique des traces
existe pourtant : `core/upload/consent.ts` classe la trace au dernier cran de
l'accord, et cet accord était donné, puisque le journal portait les positions.
Le transport était en place ; c'est le déclenchement qui manquait. La capture
démarre par un bouton, dans un panneau de l'écran de télémétrie, et il faut y
penser avant de partir.

**Le journal ne suffit pas à revivre un trajet.** Il enregistre la vitesse déjà
conditionnée, une fois par seconde ; le régime, le rapport et la charge une fois
toutes les dix secondes. Entre deux relevés, un passage de rapport ne laisse
aucune trace. Et il ne dit ni quel moteur jouait, ni quels réglages : le genre
d'événement `profile` est déclaré dans le code depuis le début et n'est émis
nulle part.

**Il n'y a aucun moyen de regarder un trajet.** Les fichiers se lisent à la main,
ligne par ligne, sur un poste de travail. Personne ne trouve « le moment où
c'était bizarre » dans deux mille sept cent vingt-huit lignes de JSON.

## La solution

Deux volets, décidés avec David le 10 septembre 2026.

### Une seule capture, automatique

La capture de trace cesse d'être un geste. Elle **démarre au démarrage du GPS**,
dès lors que l'accord de remontée est au dernier cran — celui qui annonce déjà
« le détail de la position et les traces ». Un seul réglage la gouverne, celui
que l'utilisateur a déjà compris.

Elle porte de quoi rejouer **et** de quoi vérifier :

- les échantillons bruts de la source, à sa cadence, tels qu'elle les émet ;
- ce que la chaîne en a fait au même instant — régime, rapport, charge ;
- un en-tête complet : profil, moteur, boîte, voiture, version de l'application.

La sortie enregistrée n'est pas un luxe. Elle permet de comparer ce qui a été
joué ce jour-là à ce que le code rejoue aujourd'hui : un écart signale une
régression que rien d'autre ne détecterait.

Elle part **par tranches**, par la file de remontée déjà écrite pour le journal,
et n'est pas gardée dans le téléphone : une session de trente-six minutes à dix
hertz fait vingt-deux mille échantillons, que le stockage local du navigateur ne
peut pas absorber trajet après trajet. La file garde déjà ce qui n'a pas pu
partir et le renvoie au retour du réseau.

**Ce qui part est compressé dans le navigateur**, avant l'envoi, par le
compresseur natif — sans bibliothèque. Le journal et la capture sont du JSON très
répétitif : on gagne de l'ordre de 85 %. Le gain porte autant sur la 4G en
roulant que sur la place du serveur.

Un **témoin** apparaît sur l'écran de conduite. Vert quand la capture tourne et
que les tranches partent ; orange quand c'est rattrapable — dépôt en attente de
réseau, GPS qui rejette beaucoup ; rouge quand c'est perdu — mot de passe refusé,
GPS mort, écriture impossible. La frontière entre orange et rouge est la
récupérabilité. Absent si l'envoi est coupé : un rouge permanent pour un choix
délibéré est une alarme qu'on apprend à ignorer.

Le **panneau traces de l'écran de télémétrie disparaît** — capturer, nommer,
lister, supprimer, exporter, importer, rejouer, déposer. Une ligne d'état le
remplace. L'étalonnage embarqué, lui, **garde sa capture bornée** : délimiter une
étape de mesure n'est pas capturer une session, et une étape mal bornée donne une
mesure fausse.

### Un relecteur

Un écran qui déroule une session enregistrée, comme un lecteur vidéo. Il vit sur
une **route à part, chargée seulement quand on l'ouvre** : l'application doit se
charger hors réseau sur un téléphone, et le relecteur ne sert qu'au bureau.

Il liste les sessions **depuis le serveur**, de la plus récente à la plus
ancienne, en s'annonçant avec le compte de dépôt déjà configuré. Une **timeline**
avec lecture, pause et déplacement libre, **marquée des événements** du journal :
arrêts, redémarrages du GPS, salves de positions rejetées, coupures du son,
changements de profil. Ce sont les moments qu'on cherche.

Une **carte** montre où l'on était, le véhicule suivant la timeline. Elle demande
Leaflet et les tuiles OpenStreetMap — la première dépendance d'interface du
projet, chargée sur ce seul écran.

Un **repère copiable** : à tout instant, un bouton met dans le presse-papier une
ligne lisible — session, moment, vitesse, régime, rapport — suivie de l'état
complet. C'est le geste qui sert le but réel du lot : David colle le repère,
Claude va droit au moment dont il parle.

## Ce qui est décidé, et qui ne va pas de soi

- **Le journal garde ses positions**, alors que la capture les portera dix fois
  plus finement. C'est une ceinture assumée : si la capture échoue ou n'est pas
  activée, il reste une carte grossière. Une fois compressé, le doublon coûte
  peu.
- **Le bouton « Tout récupérer » livre les fichiers compressés tels quels.** Le
  paquet est dix fois plus léger ; l'Explorateur Windows n'ouvre pas un `.gz`
  d'un double-clic, il faut 7-Zip. David lit de toute façon les fichiers
  directement sur le serveur.
- **Le rejeu sonore disparaît avant que le relecteur sache le remplacer.** Le
  panneau traces tombe dans le premier volet, et le rejeu d'une capture arrive
  dans le second. Entre les deux, il n'y a aucun moyen de rejouer un trajet au
  bureau — ce que le CHANGELOG appelle « l'outil de mise au point le plus utile
  du projet ». C'est le prix accepté pour n'avoir qu'un seul mécanisme dès le
  premier soir ; le ticket qui rend le rejeu est le premier du second volet.
- **L'en-tête est répété dans chaque tranche.** Quatre kilo-octets sur trois cents
  : une tranche isolée doit se lire seule.
- **Un arrêt du GPS ne coupe pas la capture.** Une session reste une session,
  identifiée comme celle du journal, avec des trous s'il y en a.
- **Le relecteur lit indifféremment `.jsonl` et `.jsonl.gz`**, donc les essais des
  8, 9 et 10 septembre restent lisibles.

## Ce qui n'est pas dans ce lot

- **Le son au relecteur pour les journaux anciens.** Un journal ne porte pas de
  quoi rejouer fidèlement : sa vitesse est déjà lissée, son régime n'existe qu'une
  fois toutes les dix secondes. Le relecteur affiche les valeurs enregistrées
  telles quelles, et ce qui est interpolé se voit comme tel.
- **La comparaison de deux sessions** côte à côte.
- **L'annotation d'une session** qui survivrait au navigateur.
