# 05 — la banque jouée à sa hauteur

**Statut :** ✅ fait — l'essai écarte la piste, voir [SYNTHESE](../../SYNTHESE/spec.md)

**Bloqué par :** aucun, mais il faut un essai à l'oreille que seul David peut
faire

## Ce qu'il faut obtenir

Le son cesse d'être sourd en conduite ordinaire.

Chaque échantillon porte le régime auquel il a été enregistré, son ancrage :
3128 tr/min pour la prise bas régime, 8150 pour la haute. Pour faire entendre un
autre régime, l'application accélère ou ralentit la bande. Or le profil Route
fait vivre le moteur entre 800 et 2800 tr/min. Mesuré : la vitesse de lecture
reste entre 0,26 et 0,81 sur toute la conduite ordinaire, et la couche haut
régime ne sort jamais. On entend donc en permanence un enregistrement ralenti
d'une demi-octave à deux octaves.

Quatre sorties ont été pesées. Abaisser le point de bascule est **écarté** : la
couche haute, ancrée à 8150, serait jouée au quart de sa vitesse et le mixage
l'effacerait comme fausse.

Restent trois pistes, à essayer dans cet ordre.

D'abord vérifier l'ancrage déclaré de la prise bas régime. L'analyse
d'échantillon avertit elle-même qu'elle confond une fréquence avec sa moitié,
son tiers ou ses trois demis, et qu'elle se trompe sur les prises haut régime.
Si cette prise avait en réalité été enregistrée vers 1564 tr/min, tout le son
serait joué une octave trop bas depuis le début — ce qui décrirait exactement ce
qu'on entend. Cela se teste en changeant un seul nombre, son actif, sans rien
recompiler.

Ensuite, raccourcir le pont : de 3,7 à 4,9, la croisière à 90 km/h passe de 1927
à 2550 tr/min et la lecture de 0,62 à 0,82. Le coût est assumé — le moteur
tourne plus haut partout, ce que le profil Route voulait précisément éviter.

Enfin, une prise de ralenti et une prise bas régime réelles. C'est la seule
piste qui rende le son juste dans la plage roulée, et elle demande de la
matière, pas du code. Le README le dit déjà.

## Critères d'acceptation

- [ ] L'essai de l'ancrage est fait et son résultat écrit, quel qu'il soit.
- [ ] La piste retenue est celle que l'essai désigne, pas celle qui était
      supposée.
- [ ] Si le calibrage du profil bouge, les chiffres du README qui le décrivent
      bougent avec.

## Résultat de l'essai, le 4 septembre 2026

David a essayé l'ancrage à 1564 tr/min, son actif :

> ce n'était pas mieux qu'avant ; c'était différent, mais faux quand même. On
> avait un son très aigu (genre moto de course) à faible régime et le gros son
> lourd qui revenait à partir de 5000 tours.

**L'essai écarte l'hypothèse de l'octave.** Si l'ancrage déclaré avait valu le
double du vrai, 1564 aurait rendu le son juste ; il l'a aiguisé, ce qui est le
comportement attendu d'un ancrage abaissé sur un modèle qui rééchantillonne.
L'ancrage de 3128 tr/min est donc conservé.

Ce que l'essai a établi en creux est plus important : le défaut n'est pas dans
le nombre, il est dans le modèle. Le rééchantillonnage déplace le spectre entier,
résonances comprises, alors qu'un moteur change de régime sans changer de corps.
Les deux autres pistes du ticket — raccourcir le pont, enregistrer une prise de
ralenti — ne corrigeraient que l'ampleur du déplacement, pas sa nature.

D'où le lot [SYNTHESE](../../SYNTHESE/spec.md), ouvert le soir même.
