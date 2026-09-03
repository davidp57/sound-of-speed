# 02 — Déposer une trace enregistrée en roulant

**Statut :** 🧑 attend David

**Bloqué par :** 01 — Le serveur accepte un dépôt, et lui seul

## Ce qu'il faut obtenir

Une trace enregistrée dans la voiture se dépose en un geste, et se retrouve
ensuite depuis n'importe quel appareil — sans manipuler de fichier dans la
voiture, ce que son navigateur interdit.

C'est le cœur du lot : les traces naissent en roulant et ne servent qu'ailleurs,
pour rejouer un trajet au poste de travail et régler sans reprendre la route.
Elles sont aussi la matière première de
[ETALONNAGE](../../ETALONNAGE/spec.md).

Le nom du fichier déposé doit permettre de retrouver la trace sans l'ouvrir :
date, durée et nom donné à l'enregistrement.

Un dépôt qui échoue le dit, et la trace reste dans le stockage local — elle n'est
jamais perdue au profit d'un dépôt raté.

## L'authentification, tranchée le 3 septembre 2026

Le dépôt exige de s'annoncer, et c'est là que la voiture complique tout. Le
navigateur ne fournit l'en-tête d'authentification qu'après qu'on l'a saisie une
fois pour cette adresse, et il n'affiche sa boîte de dialogue native que sur une
**navigation** — pas sur une requête lancée par l'application. Le premier dépôt
recevrait donc un refus sans que rien ne s'affiche.

Trois issues ont été posées : s'authentifier par une navigation avant chaque
session ; faire saisir le mot de passe à l'application ; ou **un jeton**.

**Retenu : le jeton.** Dans une voiture, tout ce qui demande une saisie ou
affiche une boîte est perdu d'avance — écran à bout de bras, au feu rouge. Et le
droit accordé est minuscule au regard d'un mot de passe de compte : écrire un
fichier dans un dossier de traces, rien d'autre.

Concrètement, **rien à changer sur le serveur** : le jeton est un identifiant
dédié, ajouté au fichier de mots de passe à côté du sien, et l'application
compose elle-même l'en-tête d'authentification. Aucune boîte, aucune saisie en
roulant.

Le jeton est une préférence de l'appareil, rangée comme le volume et le mode
avancé : il ne fait pas partie d'un profil et ne voyage pas avec un profil
partagé. Il se saisit une fois, à l'écran de configuration.

**Ce que cela vaut, et ne vaut pas** : le jeton vit en clair dans le navigateur
de la voiture. Quelqu'un qui a la main sur ce navigateur peut déposer des
fichiers dans le dossier des traces. Il ne peut ni les supprimer — la méthode
n'est pas ouverte — ni toucher au reste du NAS. C'est le compromis assumé ; le
mot de passe personnel, lui, ne quitte pas le poste de travail.

## Critères d'acceptation

- [x] Une trace se dépose depuis l'écran de télémétrie, en un geste
- [x] Le fichier déposé se relit par la fonction d'import existante, à
      l'identique
- [x] Le nom du fichier dit de quelle trace il s'agit
- [x] Le jeton se saisit une fois et se retient, hors du profil
- [x] Aucune boîte de dialogue d'authentification n'apparaît en roulant
- [x] Un dépôt qui échoue est signalé, et la trace reste enregistrée localement
- [x] Un jeton absent ou faux donne un message qui dit lequel des deux
- [x] Une trace déjà déposée ne se réécrit pas en silence
- [ ] 🧑 Vérifié depuis la voiture : la trace se retrouve sur le poste de travail

## Un faux positif trouvé à l'usage

La vérification « cette trace est-elle déjà déposée ? » interrogeait le fichier
lui-même. Essayé : le **premier** dépôt était refusé comme déjà fait.

La cause est qu'un serveur qui replie les chemins inconnus sur la page d'accueil
répond « oui » à tout — ce que fait le serveur de développement, et ce que fait
notre nginx partout **hors** du dossier des traces. La question se pose donc au
dossier, dont la liste est du JSON : si la réponse n'en est pas, on ne sait pas,
et l'on tente le dépôt plutôt que de refuser à tort.

## Ce qui ne se vérifie qu'en production

Le dépôt vise un chemin relatif, donc le serveur qui sert l'application. En
développement, c'est celui de Vite, qui n'a pas ce dossier : le message dit alors
« le serveur a répondu 404 », ce qui est exact. Le dépôt réel demande que
l'application soit servie par le NAS.

## Deux objections de David, et ce qu'elles ont changé

**« Si je le fais sur mon PC ça marchera pas dans ma Tesla. »** Juste, et cela
cassait l'usage : le jeton est une préférence de l'appareil, donc absent de la
voiture — où il sert. Il faudrait le retaper là-bas.

**« Et en plus ton jeton est impossible à retenir. »** Juste aussi. Un jeton
aléatoire de trente-deux caractères ne se saisit pas sur un écran tactile ;
c'était une mauvaise suggestion de ma part.

D'où deux corrections :

- le jeton **voyage par l'adresse**, avec un code à scanner, exactement comme un
  profil partagé — le fragment n'atteint jamais le serveur, et il est effacé
  aussitôt lu. L'écoute porte aussi sur le changement de fragment : coller
  l'adresse dans un onglet déjà ouvert ne recharge pas la page, et c'est
  pourtant le geste le plus probable dans la voiture ;
- la documentation recommande un jeton **prononçable** — quelques mots séparés
  par des tirets — plutôt qu'une suite aléatoire. Vingt caractères tapables
  valent mieux ici : ce qu'il protège est l'écriture d'un fichier de trace, pas
  un compte.

**Et une troisième remarque, « y'a pas de bouton save ? »** : l'écran de
configuration n'en a jamais eu, tout s'y applique à la frappe. Mais pour un
curseur cela se voit, et pour un jeton masqué rien ne se voyait. Le champ dit
maintenant qu'il est retenu, et sa longueur — de quoi reconnaître une saisie
tronquée sans montrer le secret.

## Critères ajoutés

- [x] Le jeton s'installe dans la voiture sans avoir à le retaper
- [x] L'adresse d'installation fonctionne aussi dans un onglet déjà ouvert
- [x] Le fragment est effacé après lecture, et un rechargement ne le réinstalle
      pas
- [x] Le champ du jeton dit qu'il est retenu

## Une troisième objection : « j'ai pas de caméra dans le browser de ma Tesla »

Juste, et cela invalidait la façon dont j'avais présenté la chose. Le code à
scanner ne sert qu'à un appareil **qui a une caméra** — un téléphone, une
tablette. Dans une voiture, l'adresse se **tape**.

Deux conséquences, et elles vont dans le même sens :

- le nom d'utilisateur `depot` est **implicite** dans l'adresse, qui se réduit à
  `#depot=<jeton>`. Six caractères de moins à saisir sur un écran tactile ;
- le jeton prononçable n'est plus une préférence de confort mais une nécessité.
  La documentation et l'interface le disent tous les deux, avec la raison.

Le code reste affiché, parce qu'il sert à installer le jeton sur un téléphone.
Mais l'interface dit désormais à quoi il sert et à quoi il ne sert pas.

- [x] L'adresse d'installation est aussi courte que possible, et se tape
- [x] L'interface dit que le code à scanner ne sert qu'aux appareils à caméra
