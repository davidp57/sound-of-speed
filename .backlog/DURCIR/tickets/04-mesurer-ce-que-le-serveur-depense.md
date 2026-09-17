**Statut :** 🧑 attend David — le relevé est réparé et vérifié contre un
serveur qui tourne ; reste à recoller la pile sur le NAS et à lire une ligne

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Les rôles existent pour borner ce que le serveur dépense, et personne ne sait ce
qu'il dépense. Tant que ces chiffres manquent, tout seuil posé ensuite est une
invention — et un mauvais seuil refuse ou efface des données sans que rien ne
rougisse.

Quatre chiffres, relevés sur le serveur qui tourne :

- ce que pèsent les banques d'échantillons ;
- ce que leur service transfère sur une période donnée ;
- ce que la base pèse par compte, et par dossier ;
- ce que l'analyse d'une trace prend au processeur, sachant qu'elle se déclenche
  à l'arrivée de chaque dépôt.

Le relevé **est** le livrable. Aucun seuil n'est posé ici : c'est le ticket 05
qui s'en sert.

## Critères d'acceptation

- [ ] Les quatre chiffres sont relevés sur le serveur de production, datés, et
      écrits dans le lot.
- [x] La mesure se refait : ce qui l'a produite est reproductible, pas un relevé
      à la main perdu dans une conversation.
- [ ] Le poste dominant est nommé, avec son écart aux autres.

## Comment les chiffres arrivent

Deux des quatre se relèvent en une commande — le poids des banques et celui de la
base. **Les deux autres ne se mesurent pas sans instrumenter le serveur** : rien
ne comptait les octets d'échantillons servis, rien ne chronométrait l'analyse
d'une trace.

Le serveur les compte donc lui-même, et inscrit **une seule ligne par jour** dans
le journal du conteneur, à côté de celle du ménage de rétention. Elle porte les
quatre chiffres : ce qui a été servi et en combien de demandes, le poids des
banques sur le disque, celui de la base avec les trois comptes les plus lourds,
et le temps moyen d'analyse d'une trace.

**C'est une différence, jamais un cumul.** Un compteur depuis le démarrage divisé
par une durée montre une moyenne là où il faut une tendance — un serveur allumé
depuis trois mois ne dirait plus rien de sa semaine. Le relevé remet donc ses
compteurs à zéro, et chaque ligne parle de la période qu'elle couvre.

**La première ligne arrive après vingt-quatre heures** — ou au premier
redéploiement : le relevé part aussi à l'arrêt du conteneur, sinon une pile qu'on
remplace plus souvent que ça n'en montrerait jamais une, et le silence se lirait
comme « rien à signaler ».

Reste à tirer l'image sur le NAS, laisser rouler quelques jours, et relire une
ligne. C'est ce que le premier critère attend.

## Ce qui a été réparé, le 17 septembre 2026

Le relevé fonctionnait ; **il ne se lisait jamais**. Trois causes qui se
composent, et une seule n'aurait pas suffi :

1. Il partait dans `console.log`, donc dans le journal du conteneur — qui
   disparaît avec lui.
2. Il battait toutes les vingt-quatre heures, et la pile est redéployée
   plusieurs fois par jour : l'échéance n'était jamais atteinte.
3. Le relevé d'adieu, censé rattraper le point 2, écrivait dans le journal du
   conteneur qu'on était précisément en train de remplacer.

**Le relevé s'écrit en base** (`expense_reports`, migration 0012), **bat à
l'heure** plutôt qu'au jour, et **se lit dans la régie** — une section en bas de
page, une ligne par période. La cadence se règle par `SPEED_RELEVE_MINUTES`,
parce qu'elle dépend de la fréquence des redéploiements, que le code ne connaît
pas. La ligne reste écrite au journal : elle est commode devant un conteneur qui
tourne, elle ne porte simplement plus la mémoire.

**Le relevé d'arrêt ne suffit pas, et il a fallu le mesurer pour le savoir.**
L'essai local n'écrivait rien : sous Windows, Node n'appelle pas le gestionnaire
de `SIGTERM`. En production le signal est réel, mais un conteneur tué sans
ménagement n'en envoie pas davantage — c'est le relevé périodique qui tient la
mémoire, pas celui d'adieu.

### La vérification

Contre un serveur qui tourne, cadence forcée à trois secondes : **cinq relevés
écrits en base**, chacun couvrant 3,02 s — la période demandée, au centième —,
avec les poids mesurés sur le disque : 5,0 Mio de banques en 4 dossiers, 208 Kio
de base. Six tests tiennent la persistance, dont celui qui **ferme et rouvre la
base** : c'est exactement le geste d'un conteneur qu'on remplace. Un septième
tient la route de la régie — 200 pour qui administre, 404 pour qui ne le fait pas.

### Ce qui reste, et qui appartient à David

Tirer l'image sur le NAS, laisser rouler quelques jours, ouvrir la régie. Les
quatre chiffres de production s'écriront ici à ce moment-là, et le ticket 05 s'en
servira pour poser une borne qui ne soit pas inventée.
