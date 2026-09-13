# 03 — Le relecteur rouvre une archive depuis le disque

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Télécharger une session en une archive](02-telecharger-une-session.md),
qui décide du format à rouvrir.

## Ce qu'il faut obtenir

Le relecteur ouvre une archive prise sur le disque, sans passer par le serveur,
et le trajet se relit comme s'il en venait : la carte, les cadrans, les faits
marquants, la barre de temps.

C'est ce qui ferme la boucle de l'archive. Tant que le relecteur ne sait relire
que le serveur, télécharger ne sert à rien et effacer revient à perdre.

## Ce à quoi il faut faire attention

- **Aucun compte n'est requis.** Relire un fichier du disque ne demande pas
  l'identité de dépôt. Un relecteur ouvert sans compte doit pouvoir servir à ça,
  alors qu'il ne peut rien lister.
- **Le chemin de lecture est le même**, une fois les tranches en main. La façon
  d'assembler une session ne se réécrit pas pour cette source : ce serait deux
  procédés pour la même chose, et ils divergeraient.
- **Une archive amputée se relit quand même.** Un trajet à moitié lu répond
  souvent à la question ; c'est déjà ce que fait le chargement depuis le serveur,
  et ce qui manque est nommé.
- **Ce qui n'est pas une archive de session le dit.** Un zip quelconque, une
  archive vide, un fichier qui n'en est pas un : un message clair, pas une page
  muette.
- **La démonstration du lot se fait ici** : télécharger, effacer, rouvrir. C'est
  le seul endroit où les trois gestes se vérifient ensemble.

## Critères d'acceptation

- [ ] Une archive prise sur le disque s'ouvre et se relit entièrement
- [ ] Le relecteur sans compte de dépôt sait rouvrir une archive
- [ ] Une archive à qui il manque des tranches se relit, et ce qui manque est
      nommé
- [ ] Un fichier qui n'est pas une archive de session rend un message clair
- [ ] Le parcours complet est vérifié : une session téléchargée, puis effacée du
      serveur, se relit à l'identique depuis le disque
