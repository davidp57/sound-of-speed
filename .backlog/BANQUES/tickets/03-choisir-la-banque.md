# 03 — Choisir la banque d'un profil

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Découvrir les banques présentes

## Ce qu'il faut obtenir

La banque d'un profil se choisit dans une liste, et l'écran dit si les fichiers
que le profil déclare y sont bien.

Aujourd'hui c'est une saisie de texte libre : on tape un nom de dossier en
aveugle, et une faute de frappe se découvre à l'activation du son, sous la forme
d'un silence.

Quand une banque est choisie et qu'un fichier déclaré manque, l'écran le dit
tout de suite, nommément. C'est aussi ce qui permet de comprendre qu'une banque
nouvelle n'a pas les mêmes noms de fichiers que l'ancienne — le cas le plus
courant.

## Critères d'acceptation

- [ ] La banque se choisit dans la liste des banques présentes
- [ ] La saisie libre reste possible : une banque peut exister sans que le
      serveur sache lister
- [ ] Les fichiers déclarés par le profil et absents de la banque sont nommés
- [ ] Changer de banque ne touche à aucun autre réglage du profil
- [ ] La réinitialisation de la section des couches remet la banque d'usine
