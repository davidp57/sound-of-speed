# 03 — Le régime qu'on aurait en passant maintenant

**Statut :** ✅ fait — vérifié dans l'application qui tourne

## Ce qu'il faut obtenir

David : « afficher le RPM calculé du prochain rapport si on le passait
maintenant (deuxième aiguille sur le compteur RPM — petite, fine, autre
couleur) ».

Une seconde aiguille sur le compteur de régime, qui montre où retomberait le
moteur si le rapport suivant était engagé à l'instant. Elle se lit d'un coup
d'œil pendant qu'on conduit : c'est le sens même du cadran, et c'est pourquoi
une aiguille ne relève pas de la règle « aucune animation » — son mouvement
**est** la valeur.

- **Petite, fine, d'une autre couleur** que l'aiguille du régime.
- Elle disparaît quand il n'y a pas de rapport suivant — dernier rapport,
  point mort, arrêt.
- Le calcul existe déjà : c'est `rpmInGear(gear + 1)`, ce que la boîte emploie
  pour décider. Il ne s'agit pas d'en écrire un second, qui pourrait diverger.

## Critères d'acceptation

- [x] L'aiguille montre le régime du rapport suivant, pris du même calcul que
      la boîte.
- [x] Elle est plus courte et plus fine que l'aiguille principale, d'une autre
      couleur.
- [x] Elle n'apparaît pas sur le dernier rapport, ni à l'arrêt.
- [x] Contrôle qualité vert.

Critères établis le 12 septembre 2026, en relisant le code : l'aiguille du
rapport suivant mesure 46 contre 64 pour la principale, 1,8 contre 4,5 de
demi-largeur, et porte sa propre couleur ; son régime vient de la fonction que
la boîte emploie pour décider, et vaut `null` au point mort, à l'arrêt et sur le
dernier rapport.
