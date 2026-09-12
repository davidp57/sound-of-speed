# 02 — Les moteurs et les boîtes ont leur place sur le serveur

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Un moteur réglé au volant remonte tout seul, comme un profil le fait déjà, et se
relit depuis le bureau. Une boîte aussi.

Aujourd'hui leurs tables existent en base et rien ne les remplit : elles n'ont
aucun chemin pour y aller. C'est le seul morceau du serveur qui manque avant de
pouvoir vider le stockage du navigateur sans rien perdre.

## Ce à quoi il faut faire attention

- **La forme du listage est déjà fixée** par ce que le reste de l'application
  lit. En inventer une seconde pour ces deux-là donnerait deux façons de lire une
  liste, et le cœur en a déjà quatre qui lisent la première.
- **Le dépôt passe par la file qui survit à une coupure.** Un moteur réglé dans
  un tunnel part au retour du réseau, sans que personne ait à y penser.
- **Rien ne part à la frappe.** Un curseur qu'on déplace produit des dizaines de
  valeurs intermédiaires ; le moteur part quand la main s'arrête, comme le profil.
- **Un profil désigne son moteur et sa boîte par leur identifiant, et une
  désignation qui ne mène à rien vaut une absence.** C'est ce qui fait marcher le
  partage d'un profil venu d'ailleurs. Ce ticket ne touche pas à cette règle.
- **Le refus de charge ne se rejoue pas.** Comme pour les autres dépôts : une
  charge refusée par un code de panne ferait réessayer la voiture indéfiniment.

## Critères d'acceptation

- [x] Régler un moteur dans la voiture le fait apparaître sur le serveur, sans
      geste supplémentaire
- [x] Idem pour une boîte
- [x] Le listage a la même forme que celui des profils
- [x] Un dépôt fait hors réseau part au retour du réseau
- [x] Déposer deux fois le même nom remplace, sans créer de doublon
- [x] Le test d'accord couvre les deux nouveaux emplacements

## Ce qui a été corrigé en chemin

**La date de modification d'un profil ne bougeait jamais.** La colonne existait,
l'écriture ne la refaisait pas : un profil redéposé gardait la date de son
premier dépôt. Le ticket 04 arbitre « le plus récent gagne » — il aurait arbitré
sur une valeur figée, et le profil réglé dans la voiture serait passé pour
ancien. Corrigé pour les profils comme pour les deux registres neufs.

**La règle de nommage vivait à un seul endroit désormais.** Les moteurs devaient
la partager avec les profils ; la recopier, c'était la faire diverger un jour.

## La mesure

Trente-cinq cas sur trente-cinq contre le serveur neuf, les huit cas neufs
compris. Le serveur de fichiers ne se voit pas demander la part `entites` : ce
registre est né avec la base, et la question n'a pas de sens pour lui.
