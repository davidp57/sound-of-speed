# 01 — Le moteur devient une entité qu'on nomme

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

On choisit un moteur dans une liste, et il **emporte tout avec lui** : ses
cotes, son rupteur, sa banque de sons, son caractère sonore. Ces valeurs
cessent d'être éparpillées dans un profil pour devenir une entité qui a un nom,
et que le profil ne fait que désigner.

Deux conséquences visibles tout de suite. On peut **partager un moteur seul**,
sans le profil qui l'utilisait — aujourd'hui il faut envoyer tout un profil pour
faire essayer un V8. Et deux profils peuvent **désigner le même moteur**, si
bien que le corriger une fois le corrige partout, au lieu d'avoir à le retoucher
dans chacun.

C'est le premier des cinq groupes, et il vient en premier parce que le rupteur
lui appartient : dériver les seuils de la boîte avant de déplacer le rupteur
obligerait à refaire ce travail.

Le mécanisme d'entité nommée et partageable naît ici. Les trois tickets
suivants le réutilisent plutôt que d'en inventer chacun un.

## Critères d'acceptation

- [ ] Un moteur est une entité qui porte un nom, ses cotes, son rupteur, sa
      banque de sons et son caractère sonore ; un profil le désigne au lieu de
      recopier ses valeurs.
- [ ] Choisir un moteur dans la liste applique d'un coup tout ce qu'il porte —
      c'est déjà le cas de la bibliothèque de neuf moteurs, et cela doit le
      rester sans qu'aucune valeur ne soit recopiée dans le profil.
- [ ] Un moteur s'exporte, se partage et se réimporte **seul**.
- [ ] Deux profils peuvent désigner le même moteur ; le modifier vaut pour les
      deux.
- [ ] Les profils déjà enregistrés sont repris sans perte : la version de format
      monte, et personne ne retrouve un profil vide ni un moteur muet.
- [ ] La « Référence des réglages » du README dit où vivent désormais les
      réglages du moteur, et `CONTEXT.md` porte le terme s'il se précise.
- [ ] Contrôle qualité vert.
