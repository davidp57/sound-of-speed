# 05 — Le relecteur déroule une session

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite — il se contente des
journaux déjà déposés

## Ce qu'il faut obtenir

Au bureau, David ouvre une adresse, choisit la session qu'il vient
d'enregistrer, appuie sur lecture et voit son trajet se dérouler : vitesse,
régime, rapport, charge, à l'instant où il les a vécus. Il peut mettre en
pause, avancer, revenir.

L'écran vit sur une **route à part**, dont le code n'est téléchargé que si on
l'ouvre : l'application de conduite ne doit pas grossir d'un octet pour un outil
qui ne sert qu'au bureau.

Les sessions se **listent depuis le serveur**, de la plus récente à la plus
ancienne, en s'annonçant avec le compte de dépôt déjà configuré. Les fichiers
d'une même session se regroupent tout seuls ; leur ordre vient de leur nom.

Une **timeline** porte la lecture, la pause et le déplacement libre, et elle est
**marquée des événements** : arrêts, redémarrages du GPS, salves de positions
rejetées, coupures du son, changements de profil. Ce sont les moments qu'on
cherche en debriefing.

Ce que le relecteur montre, ce sont **les valeurs telles qu'elles ont été
enregistrées**. Un journal ne porte la vitesse qu'une fois par seconde, et le
régime, le rapport et la charge qu'une fois toutes les dix secondes : ce qui est
interpolé entre deux points se voit comme tel, plutôt que d'être présenté comme
mesuré.

## Critères d'acceptation

- [x] Le code du relecteur n'est pas téléchargé tant qu'on n'ouvre pas son
      adresse.
- [x] La liste montre les sessions du serveur, la plus récente en tête, avec
      leur date et leur durée.
- [x] Les tranches d'une même session sont recollées dans le bon ordre.
- [x] Lecture, pause et déplacement fonctionnent, et l'affichage suit.
- [x] Les événements du journal sont marqués sur la timeline et se distinguent
      les uns des autres.
- [x] Les sessions des 8, 9 et 10 septembre 2026 se relisent, alors qu'elles
      sont en clair et sans en-tête.
- [x] Une valeur interpolée est visiblement distinguée d'une valeur mesurée.

Critères établis le 12 septembre 2026, sur les tests du recollage des tranches, de l'ordre des rangs et de l'interpolation annoncée. Un reste ouvert : **la liste des sessions n'affiche pas leur durée**, qui n'est connue qu'après chargement.

La durée a été ajoutée le 12 septembre 2026. Elle s'annonce comme une borne basse — « plus de 15 min » —, lue sur le seul nombre de tranches : la capture découpe toutes les cinq minutes, et une durée exacte demanderait de charger la session qu'on est en train de choisir. Quatre tests couvrent le calcul, dont le cas d'une session sans capture, qui n'affiche pas de durée inventée. L'affichage lui-même n'a pas pu être vu : il demande une session sur le serveur.
