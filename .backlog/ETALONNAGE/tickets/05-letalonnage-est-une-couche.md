# 05 — L'étalonnage est une couche, pas une recopie

**Statut :** 🧑 attend David

**Bloqué par :** 04 — Le récapitulatif : mesuré face à réglé

## Ce qu'il faut obtenir

Les mesures de la voiture s'appliquent d'elles-mêmes à **tous** les profils, sans
jamais écraser ce qui a été réglé.

Trois couches qui se composent :

1. le **profil** — ce qu'on règle, ce qu'on voit à l'écran de configuration ;
2. l'**étalonnage**, facultatif, mesuré une fois sur la vraie voiture ;
3. leur composition, qui donne les valeurs que le moteur emploie.

## Pourquoi la recopie ne suffisait pas

Le récapitulatif du ticket 04 propose, et l'on recopie dans le profil courant, un
réglage à la fois. Trois manques :

- **on refait le geste à chaque profil.** Une mesure de la voiture n'a pas de
  raison de ne profiter qu'au profil ouvert le jour où on l'a prise, ni de se
  refaire onze fois à chaque création ;
- **elle écrase.** Ce qu'on a réglé à l'oreille disparaît sous la mesure, et il
  faut passer par la réinitialisation pour le retrouver ;
- **elle voyage.** Un profil recopié puis partagé emporte les capacités de la
  voiture de celui qui l'a réglé, alors qu'il ne devrait emporter qu'un son.

La forme en couches règle les trois d'un coup, et suit le motif que le dépôt a
déjà retenu deux fois : le volume général a quitté le profil parce qu'il décrit
l'appareil et non le moteur, et le tempérament ne s'y stocke pas parce qu'il se
déduit. Ce qui appartient à la voiture n'appartient pas au son.

## Ce que ça donne

- L'écran de configuration édite le profil, et **annonce** les réglages que la
  mesure remplace : « ce que vous réglez ici reste inchangé, c'est la valeur
  mesurée que le moteur emploie ».
- Il n'y a plus de bouton d'adaptation, ni de question « appliquer ou pas ».
- Sans étalonnage, le profil est employé tel quel — la même référence, pas même
  une copie, la composition traversant la boucle soixante fois par seconde.
- L'analyse des traces est mémorisée à part de son application : elle est
  coûteuse et ne dépend que des enregistrements, quand la composition se refait
  à chaque réglage touché.

## Un défaut trouvé en éprouvant la composition

Avec la seule étape de reprise enregistrée — une accélération pure, sans un
freinage — la plus forte décélération relevée valait presque zéro, et la borne
basse proposée **−0,5 m/s²**. Écrite dans un profil, elle aurait écrêté *tout*
freinage réel : la charge et la boîte auraient vu un ralentissement minuscule là
où l'on plante les freins.

Une borne trop large ne protège de rien ; une borne trop serrée ampute le signal,
ce qui est bien pire. Elle ne se propose donc plus que si une étape susceptible
de ralentir a été mesurée — lever de pied, freinage, ou conduite ordinaire.

Le test qui existait figeait le défaut plutôt qu'il ne le détectait : il
affirmait que « la borne basse tombe à zéro ». Il dit maintenant qu'elle n'est
pas proposée.

## Critères d'acceptation

- [x] Un étalonnage corrige tous les profils, livrés compris, sans geste
- [x] Le profil réglé n'est jamais modifié par l'étalonnage
- [x] Composer deux fois donne le même résultat : une couche ne se consomme pas
- [x] **Sans étalonnage, l'application se comporte exactement comme avant** —
      vérifié sur un stockage vierge, les quatre écrans se remplissent et la
      boucle tourne
- [x] Les réglages que la mesure remplace sont annoncés à l'écran de
      configuration
- [x] Une borne de décélération n'est pas proposée sans étape qui ralentisse
- [ ] 🧑 Vérifié en roulant : un étalonnage de la Tesla change ce qu'on entend
      sur les deux profils livrés
