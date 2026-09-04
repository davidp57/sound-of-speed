# 03 — Trois origines de son, au choix dans le profil

**Statut :** ⬜ prêt

**Bloqué par :** aucun — la conception ne dépend pas du verdict du ticket 02

## Ce qu'il faut obtenir

Un profil déclare **d'où vient son son**, parmi trois origines :

| Origine | Ce que c'est | Ce qu'elle coûte dans la voiture |
|---|---|---|
| **Enregistré** | la banque d'échantillons d'aujourd'hui, jouée en changeant la vitesse de lecture | rien de neuf, c'est l'existant |
| **Généré en direct** | engine-sim tourne dans la voiture et produit le son au fil de la conduite | tout le budget processeur, et c'est la question du ticket 02 |
| **Généré à l'avance** | engine-sim tourne **ici**, produit une banque, et la voiture la rejoue | rien de plus que l'enregistré |

Décidé par David le 4 septembre 2026. Le choix n'est pas un pis-aller : les trois
ont chacun leur domaine.

## Pourquoi trois, et pas deux

Le mode **généré à l'avance** n'est pas un repli du mode direct. Il corrige un
défaut que ni l'un ni l'autre des deux existants ne corrige : la banque livrée
est jouée entre 0,26 et 0,81 fois sa vitesse sur toute la conduite ordinaire, ce
qui descend les résonances de l'échappement en même temps que la fréquence
d'allumage — alors qu'un moteur change de régime sans changer de corps. En
générant, on produit une prise **par plage de régime**, donc une lecture proche
de un, où le timbre ne se déplace plus. Et l'on obtient enfin la prise de ralenti
et la prise bas régime qui manquaient depuis le début.

Le mode **direct**, lui, garde ce que la génération perd : le son suit la
conduite en continu, sans domaine ni bascule. Et il se peut qu'il ne tienne que
pour les petits moteurs — un bicylindre bien simulé en direct vaudrait mieux
qu'un V8 échantillonné. C'est la mesure du ticket 02 qui le dira, et le choix par
profil est justement ce qui permet de ne pas trancher globalement.

## La forme

Un champ dans le profil, à côté de la définition de moteur : `soundSource`, avec
trois valeurs. Le reste suit :

- **enregistré** : les couches actuelles, inchangées ;
- **direct** : la définition de moteur en JSON, et rien d'autre — pas de banque ;
- **à l'avance** : une définition de moteur **et** la banque qu'elle a produite,
  laquelle vit sur le NAS comme les autres.

Un profil généré à l'avance porte donc les deux : de quoi rejouer, et de quoi
régénérer si l'on change un réglage du moteur. C'est ce qui évite qu'une banque
générée devienne une boîte noire dont personne ne sait plus d'où elle vient.

## Critères d'acceptation

- [ ] `soundSource` existe dans le schéma de profil, avec ses trois valeurs, et
      les profils déjà enregistrés sont repris en « enregistré »
- [ ] L'écran de configuration montre l'origine et permet d'en changer
- [ ] Une origine indisponible se dit et ne casse rien : un profil « direct » sur
      un appareil qui ne tient pas le temps réel doit se plaindre, pas grésiller
- [ ] Le choix se fait **dans la voiture**, sans reconstruire l'application
- [ ] Un profil généré à l'avance garde la définition qui a produit sa banque
