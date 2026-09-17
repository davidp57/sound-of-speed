# 08 — Reprendre un profil du serveur sans en faire un doublon

**Statut :** 🧑 attend David — livré le 17 septembre 2026, vérifié contre un serveur simulé ; reste l'essai contre le NAS

David : « j'ai demandé un moyen de synchroniser facilement mes profils de l'app
avec ceux du serveur ; on l'a pas encore ? »

**La demande n'était écrite nulle part**, et c'est le manquement à corriger
d'abord : le dépôt demande qu'un point mentionné entre dans `.backlog/`
immédiatement. Ce ticket le fait.

## Ce qui existe déjà, et qui marche

- **Le sens montant, tout seul.** Un profil modifié remonte trois secondes après
  la dernière frappe, sous un nom stable qui remplace sa version précédente —
  [REMONTEE, ticket 03](03-un-profil-se-retrouve-ailleurs.md), prouvé le
  17 septembre 2026.
- **Le sens descendant, au lancement.** La base rend ce qu'elle a de plus récent
  au démarrage — [MIGRER, ticket 04](../../MIGRER/tickets/04-au-lancement-la-base-rend-le-plus-recent.md).
- **Un bouton « Profils du serveur »** dans l'écran de configuration, qui liste
  ce que le serveur porte et propose « Ajouter » ligne par ligne.

## Ce qui manque, et ce qui est faux

**« Ajouter » duplique au lieu de mettre à jour.** Mesuré dans l'application le
17 septembre 2026 : reprendre un profil qu'on a déjà laisse **deux entrées
portant le même identifiant**, le même nom, et rien à l'écran ne les distingue.
La sélection prend la première trouvée, donc pas forcément celle qu'on vient de
reprendre. On croit avoir synchronisé, on a fabriqué une ambiguïté.

**La descente ne se fait qu'au lancement.** Régler au bureau pendant que la
voiture tourne ne descend pas : il faut recharger l'application.

**Rien ne montre l'écart.** Qu'est-ce qui diffère entre ici et là-bas, lequel est
le plus récent, qu'est-ce que je perds en reprenant : aucune de ces trois
questions n'a de réponse à l'écran.

**Et le cas des deux côtés modifiés est ouvert depuis le 12 septembre.** MIGRER,
ticket 04, le pose noir sur blanc : « On rend, on ne synchronise pas en continu.
Deux appareils qui ont bougé le même jour restent un cas que ce lot n'ouvre
pas. » Personne ne l'a rouvert depuis.

## Ce que David a tranché, et ce qui a été fait

> « Un bouton unique "Reprendre les profils du serveur" qui efface tous les
> profils locaux et récupère ceux du serveur à la place ; c'est l'équivalent de
> faire "supprimer" sur tous les profils puis "profils d'usine". »

**Un remplacement, pas une fusion.** Le serveur fait foi, donc les quatre
questions de conception tombent : rien à arbitrer, rien à comparer, pas d'écran
de différences. C'est ce qui rend le geste lisible d'un coup d'œil.

Le bouton est dans l'atelier, à côté de « Profils d'usine ». Il demande **deux
appuis**, et le premier annonce combien de profils vont partir — un nombre fait
hésiter là où un avertissement général ne fait rien. Ce qui manque au serveur est
complété par les profils d'usine, comme le geste manuel qu'il remplace.

**Rien ne s'efface tant que le serveur n'a rien rendu.** Hors réseau, sans compte
ou sur un dossier vide, la bibliothèque rend une liste vide : ce n'est pas une
instruction d'effacer. C'est la seule garde qui compte ici, l'effacement étant
sans retour.

**Les moteurs et les boîtes restent.** Supprimer un profil ne les a jamais
emportés, et le rattachement retrouve celui qui correspond plutôt que d'en créer
un second : reprendre deux fois de suite ne fait pas grossir la liste.

## La vraie cause du doublon, trouvée en vérifiant

Le premier jet de ce ticket disait que le bouton « Ajouter » dupliquait. C'était
vrai mais c'était le symptôme : **la lecture de la bibliothèque donnait un
identifiant neuf à chaque profil lu**. Aucun rapprochement n'était donc possible,
et le geste de reprise lui-même n'a pas marché à son premier essai — les cinq
profils d'usine revenaient tous, alors que le serveur en portait un.

La bibliothèque garde maintenant l'identifiant du fichier, comme le rapatriement
du lancement le faisait déjà : ce dossier est celui de son propre compte, et ces
profils sont les siens qui redescendent. Le bouton de la liste dit « Reprendre »
plutôt qu'« Ajouter », parce que c'est ce qu'il fait.

**À noter pour la suite** : le rapatriement au lancement, lui, n'a jamais
dupliqué — il remplace par identifiant depuis le début. Seule la bibliothèque
avait le défaut.

## Mesuré

**Dans l'application, contre un serveur simulé** portant trois fichiers : une
version modifiée d'un profil déjà là, un profil inédit, et un doublon
d'identifiant.

| | Résultat |
|---|---|
| Profils repris du serveur | 2 |
| Doublon du dossier écarté | 1 — le premier listé gagne, faute de date |
| Profils d'usine réintroduits | 4 — **pas** celui que le serveur portait |
| Profils remplacés | 8 |
| Doublons d'identifiant après coup | **aucun** |

**Serveur vide** : 7 profils avant, 7 après, identiques, et l'écran dit pourquoi.

Dix tests tiennent l'ensemble — sept sur le calcul de reprise, trois sur la
stabilité des identifiants à la lecture.

## Ce qui reste

L'essai contre le vrai serveur : le NAS porte des profils, le serveur de
développement n'en a pas. La logique est tenue par les tests et la simulation ;
ce qui reste à voir est le chemin réel, compte compris.
