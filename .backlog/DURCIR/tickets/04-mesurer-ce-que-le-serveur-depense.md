# 04 — Mesurer ce que le serveur dépense

**Statut :** ⬜ prêt

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
- [ ] La mesure se refait : ce qui l'a produite est reproductible, pas un relevé
      à la main perdu dans une conversation.
- [ ] Le poste dominant est nommé, avec son écart aux autres.
