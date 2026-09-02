# 02 — Duplication, fichier, lien

**Statut :** ✅ fait

**Bloqué par :** 01 — Chaque profil porte ses valeurs d'origine

## Ce qu'il faut obtenir

Les trois façons de faire un profil à partir d'un autre se comportent
correctement vis-à-vis de l'origine.

- **Dupliquer** : la copie hérite de l'origine de son modèle, et à défaut relève
  ses valeurs du moment. Une duplication de Route revenait auparavant aux
  valeurs de Sport.
- **Exporter en fichier** : l'origine suit. La taille n'importe pas, et un
  fichier qui porte son état initial est plus utile qu'un fichier qui l'oublie.
- **Partager par lien** : l'origine ne suit pas. Elle doublerait la longueur du
  lien, déjà surveillée, et le destinataire n'a que faire de l'état initial d'un
  profil qui n'est pas le sien — de la même façon que le statut de favori ne
  voyage pas.

## Critères d'acceptation

- [x] Une duplication a toujours un état de retour
- [x] Une duplication d'un profil fabriqué hérite de l'origine du modèle
- [x] Une duplication d'un profil livré relève ses valeurs du moment
- [x] Un aller-retour par fichier conserve l'origine
- [x] Un aller-retour par lien ne la transporte pas
