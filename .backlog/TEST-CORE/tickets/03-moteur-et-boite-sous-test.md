# 03 — Le moteur et la boîte sous test

**Statut :** ✅ fait

**Bloqué par :** 01 — Vitest et ESLint en place

## Ce qu'il faut obtenir

Les cas particuliers du moteur et de la boîte sont couverts — ceux qu'une
correction ultérieure casse sans bruit parce qu'ils ne s'entendent que dans une
situation précise.

Côté moteur : le découplage. À l'arrêt et pendant un passage, le régime ne suit
plus les roues — il retombe au ralenti, ou monte librement si on donne des gaz.
C'est ce qui permet un coup d'accélérateur à l'arrêt, et c'est la première
chose que casse un changement d'inertie.

Côté boîte : le régime de passage rapport par rapport, son décalage selon la
charge, et le seuil qui commande le rétrogradage en décélération. Un profil
routier complet sert de base : on lui fait parcourir une montée en vitesse et
une décélération, et on vérifie qu'aucun rapport ne monte au rupteur ni ne reste
engagé bien après qu'il n'a plus de sens.

## Critères d'acceptation

- [x] À l'arrêt, le régime retombe au ralenti quelle que soit la vitesse des
      roues, et monte si l'accélérateur est enfoncé
- [x] Pendant un passage, le couple est coupé : le régime chute vers le ralenti
      au lieu de suivre les roues
- [x] Le régime ne dépasse jamais le rupteur, quelle que soit l'entrée
- [x] La montée à vide et le frein moteur suivent la direction de leur réglage
- [x] La charge déduite de l'accélération est bornée par les valeurs de réglage,
      et la position de l'accélérateur, quand elle est connue, fait foi seule
- [x] Sur une montée en vitesse à charge moyenne avec le profil Route, chaque
      passage se produit au régime déclaré pour ce rapport, à la dispersion
      aléatoire près
- [x] Pied au plancher, les passages reculent ; pied levé, ils avancent
- [x] Le rétrogradage en décélération est couvert, et son vrai levier établi :
      c'est « Descente sous », pas le régime plancher que le README désignait.
      Le README a été corrigé, et un test tient la correction
- [x] Le rétrogradage forcé descend au plus le nombre de rapports déclaré et
      vise le régime déclaré
- [x] La dispersion aléatoire est vérifiée par son étendue sur un grand nombre
      de passages, pas par une valeur tirée
