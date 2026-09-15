# 04 — Mesurer ce que le serveur dépense

**Statut :** 🧑 attend David — le serveur relève les quatre chiffres tout seul,
une fois par jour ; il reste à tirer l’image et à lire une ligne du journal

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
