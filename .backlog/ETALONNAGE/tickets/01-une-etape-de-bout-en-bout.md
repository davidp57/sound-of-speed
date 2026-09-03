# 01 — Une étape, de la consigne à la valeur proposée

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le chemin complet de l'étalonnage, sur **une seule** étape : l'accélération
franche depuis l'arrêt.

L'application annonce la consigne, enregistre pendant qu'on roule, juge si
l'étape a bien été faite, en tire l'accélération réellement obtenue, et affiche
cette valeur face à celle du profil.

C'est la tranche la plus utile à ouvrir d'abord, parce que le réglage qu'elle
informe est celui dont dépend toute la charge — donc le volume, le timbre et les
seuils de passage. Il vaut aujourd'hui 2 m/s² sur le profil Route, choisi par le
calcul, là où une voiture électrique en fait bien davantage.

**L'analyse se fait dans la voiture**, sur place : elle ne demande que du calcul,
et le résultat doit se voir tout de suite. Le lot n'attend donc pas
[DEPOSER](../../DEPOSER/spec.md).

**Le jugement de validité fait partie de ce ticket**, et non d'un suivant : une
« accélération franche » qui n'atteint que 1 m/s² n'en est pas une, et l'accepter
donnerait une charge fausse — c'est-à-dire exactement le défaut que le lot
prétend corriger. Le critère est affiché avant l'étape, et son échec est dit.

**Elle propose, elle n'applique pas.** C'est la règle déjà retenue pour l'analyse
d'échantillon, dont les candidats d'ancrage se départagent à l'oreille.

## Critères d'acceptation

- [ ] La consigne de l'étape est annoncée avant l'enregistrement
- [ ] L'étape s'enregistre séparément, et l'enregistrement se relit
- [ ] Une étape trop molle est refusée, et la raison est dite
- [ ] L'accélération mesurée est affichée face à celle du profil
- [ ] Rien n'est appliqué au profil sans un geste explicite
- [ ] La mesure est reproductible sur une trace rejouée
- [ ] 🧑 Vérifié en roulant : la valeur mesurée est plausible pour la voiture
