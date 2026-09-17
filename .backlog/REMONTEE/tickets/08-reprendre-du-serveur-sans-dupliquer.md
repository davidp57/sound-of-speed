# 08 — Reprendre un profil du serveur sans en faire un doublon

**Statut :** ⬜ prêt — demandé par David le 17 septembre 2026, périmètre à trancher

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

## Les questions de conception, à trancher avant d'écrire une ligne

1. **Que fait « reprendre » quand le profil existe déjà ?** Remplacer, garder les
   deux sous des noms distincts, ou demander. Remplacer est le geste attendu
   quand on parle de synchronisation, mais il écrase un réglage fait ici.
2. **Qui gagne quand les deux côtés ont bougé ?** Le plus récent est la règle
   simple, et elle suppose une date de modification fiable des deux côtés — ce
   que MIGRER/04 signalait déjà comme la condition. Sinon, montrer les deux.
3. **Un geste, ou en continu ?** Un bouton « mettre à jour depuis le serveur » se
   comprend et ne surprend jamais. Une synchronisation continue ne se demande
   pas, mais elle peut changer un profil sous les doigts — ce que MIGRER/04
   refusait explicitement.
4. **Est-ce que ça vaut un écran ?** Voir l'écart avant de reprendre demande une
   comparaison à l'écran, donc une place que la voiture n'a pas. Peut-être
   réservé au poste de travail, comme l'atelier.

## Ce qui est certain

Le doublon du point précédent est un **défaut**, indépendamment de ces quatre
questions : il se corrige que la synchronisation reste au lancement ou non.
