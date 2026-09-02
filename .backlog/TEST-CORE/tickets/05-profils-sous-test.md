# 05 — Les profils sous test

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Vitest et ESLint en place

## Ce qu'il faut obtenir

Un profil enregistré ne se perd pas. C'est le seul endroit du projet où une
régression coûte des données à l'utilisateur, et pas seulement un son faux.

Trois chemins à couvrir : le stockage local, l'export/import de fichier, et le
partage par URL. Chacun doit faire un aller-retour sans perte, et la relecture
doit accepter un fichier écrit par une version de format antérieure.

Un profil incomplet ou abîmé — champ manquant, valeur hors bornes, JSON
tronqué — ne doit pas casser le démarrage de l'application : il est refusé ou
complété par les valeurs d'usine, jamais accepté à moitié.

## Critères d'acceptation

- [ ] Un profil écrit puis relu depuis le stockage local est identique à
      l'original
- [ ] Un aller-retour export puis import rend un profil identique
- [ ] Un profil transporté par URL et relu rend un profil identique
- [ ] Un fichier de profil au format antérieur est relu, et les réglages qu'il
      contient sont conservés
- [ ] Un fichier dont un champ manque est complété par la valeur d'usine
      correspondante, et le reste du profil est conservé
- [ ] Un fichier illisible est refusé sans faire échouer le chargement de
      l'application
- [ ] La réinitialisation d'une section remet cette section aux valeurs d'usine
      et ne touche à aucune autre
- [ ] Les deux profils livrés se chargent et sont conformes au schéma
