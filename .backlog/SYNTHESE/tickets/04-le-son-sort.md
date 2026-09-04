# 04 — Le son sort, et suit le régime

**Statut :** ⬜ prêt

**Bloqué par :** 02 — savoir jusqu'à combien de cylindres le direct tient

## Ce qu'il faut obtenir

**Entendre engine-sim**, en conduisant. Demandé par David : « surtout je voudrais
l'entendre — n'oublie pas de le brancher au simulateur ».

Jusqu'ici le binaire produit des chiffres. Il doit produire du son, et ce son
doit suivre le régime que la chaîne calcule à partir de la vitesse.

## Les deux morceaux

**Faire sortir le son.** Le cœur rend des échantillons à 44,1 kHz par
`readAudioOutput`. Il faut les faire jouer sans creux : un `AudioWorklet` qui
appelle le WebAssembly, avec la réserve qu'il faut pour absorber les à-coups.
C'est la partie où le budget processeur se voit vraiment — un banc qui tient
×1,6 en moyenne peut craquer sur une pointe.

**Suivre le régime.** engine-sim a sa propre dynamique : un accélérateur, une
inertie, une charge. La chaîne de Speed, elle, calcule déjà un régime à partir de
la vitesse et du rapport. Deux façons de les marier :

- imposer le régime par le **dynamomètre** d'engine-sim, qui existe pour cela
  (`m_dyno`) : le moteur tient le régime qu'on lui donne, et l'on garde la
  cohérence avec le compteur affiché ;
- piloter l'**accélérateur** depuis l'effort, et laisser le moteur trouver son
  régime : plus fidèle à un vrai moteur, mais le régime entendu ne sera plus
  celui du cadran.

Le premier est le bon choix pour commencer : le régime affiché et le régime
entendu doivent dire la même chose, sinon c'est le compteur qu'on croira faux.
L'**effort** livré par le lot EFFORT commande alors la charge du moteur simulé —
c'est précisément ce qu'il représente, et il change le timbre, pas seulement le
volume.

## Ce qui se juge, et par qui

À l'oreille de David, en conduisant à la manette, engine-sim tournant à côté
comme étalon. La machine ne peut pas juger ce ticket : elle fournit les réglages
et mesure ce qui se mesure.

## Critères d'acceptation

- [ ] Le son sort sans creux ni craquement à régime tenu, puis en accélération
- [ ] Le régime entendu est celui du cadran, à quelques dizaines de tours près
- [ ] L'effort agit sur le timbre, et pas seulement sur le niveau
- [ ] La charge processeur pendant la lecture est relevée, à côté du reste de
      l'application qui tourne
- [ ] Le son se coupe proprement quand on change de source ou d'origine
- [ ] 🧑 Jugé à l'oreille par David, et le verdict écrit
