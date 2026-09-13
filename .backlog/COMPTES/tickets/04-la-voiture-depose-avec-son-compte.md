# 04 — La voiture dépose avec son compte, et le mot de passe partagé s'efface

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md),
[03 — Ce que porte `solo` change de mains](03-ce-que-porte-solo-change-de-mains.md).
Déposer sous un compte suppose le compte, et suppose que ce qu'il a déjà déposé
lui appartienne.

## Ce qu'il faut obtenir

Ce que la voiture envoie part sous son compte, et non plus sous un mot de passe
partagé saisi une fois à l'écran de configuration. Les deux champs d'identifiants
de dépôt disparaissent — c'était déjà écrit dans la refonte.

Le fichier `htpasswd` cesse d'être la porte des dépôts.

## Ce à quoi il faut faire attention

- **Douze fichiers passent par `DepositCredentials`** : la capture, le journal,
  l'export, la bibliothèque de profils, le rapatriement, le relecteur, l'état de
  l'application. Ce ticket change ce qui s'annonce, pas qui appelle.
- **Une page dépose hors de l'application.** `public/sonde/sonde.js` relit le
  compte dans le stockage du navigateur et compose son propre en-tête. Elle
  n'apparaît dans aucun écran, et personne ne la verra casser.
- **Le jeu `accord` s'annonce en « Basic »**, et l'intégration continue lui
  fabrique un compte jetable. Le contrat change ici : c'est le seul endroit du
  dépôt où le changement se verra tout de suite, et c'est tant mieux.
- **Le refus ne se rejoue pas.** 401 et 403 sont les deux seuls codes que la
  voiture ne réessaie pas. Une session expirée rendue par un code de panne
  ferait rejouer un dépôt toutes les minutes, indéfiniment.
- **Hors réseau, la file continue de remplir.** Un dépôt qui ne part pas parce
  qu'il n'y a pas de réseau n'est pas un dépôt refusé : la distinction existe
  déjà dans le code, elle ne doit pas se perdre.
- **`htpasswd` part s'il ne sert plus à rien — et ça se vérifie.** Six endroits
  le connaissent : `comptes.ts`, l'option du serveur, `npm run htpasswd`,
  `scripts/accord/htpasswd-essai.mjs`, la pile Docker et le README. Il faut
  passer les six en revue avant de le retirer, pas seulement le premier : un
  fichier de mots de passe à moitié retiré est une porte qu'on croit fermée.

## Critères d'acceptation

- [ ] La voiture dépose sous son compte, sans mot de passe saisi
- [ ] Les deux champs d'identifiants de dépôt ont disparu de l'écran de
      configuration
- [ ] Une session expirée rend un refus que le client ne rejoue pas
- [ ] Hors réseau, la file garde et repart au retour, comme avant
- [ ] La sonde autonome dépose encore, ou son cas est tranché et écrit
- [ ] Le jeu `accord` est à jour et passe, dans le conteneur comme hors de lui
- [ ] Les six endroits qui connaissent `htpasswd` sont passés en revue ; s'il ne
      sert plus, il part partout, documentation et pile Docker comprises
