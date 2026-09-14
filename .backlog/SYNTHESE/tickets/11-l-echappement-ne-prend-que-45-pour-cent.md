# 11 — L'échappement ne prend que 45 % de la sortie du banc

**Statut :** ✅ fait — le mélange est jugé à l'oreille, les trois banques sont refaites

**Bloqué par :** aucun

## Ce qui a déclenché

David, le 14 septembre 2026, en ouvrant le chantier du quatre cylindres :

> occupons-nous du L4

Sa plainte, dans la liste des symptômes proposés : **« il sonne synthétique,
électronique »** — le même mot qu'en septembre pour le tube fabriqué.

## Deux hypothèses, dont une fausse

**La captation.** J'ai annoncé `smooth_39` comme coupable probable : c'est la
plus sourde des quatre, −25,4 dB entre 4 et 8 kHz. Faux. Les quatre captations
donnent le même creux sur le L4, et `smooth_39` est même celle qui laisse le plus
de 1–4 kHz.

| Captation | 1 – 4 kHz de la banque produite |
|---|---|
| `smooth_39` | −26,3 dB |
| `minimal_muffling_01` | −28,1 dB |
| `sharp_01` | −29,3 dB |
| `mild_exhaust` | −42,9 dB |

**La quantité, pas la qualité.** Le banc s'appuyait sur la convolution interne
d'engine-sim, qui est **entière**. Le mode direct n'en mélange que 45 % et garde
55 % de son sec — réglage de David du 6 septembre, étendu à la bibliothèque le 8,
avec cette raison écrite dans `rendering.ts` : « à cent pour cent, tout le son
passait par la réponse d'échappement — celle d'un V8 Chevrolet, y compris sous un
quatre cylindres ».

Vérifié en faisant tourner le banc avec une impulsion unité, donc sans aucun
filtrage. À 2 245 tr/min, part d'énergie :

| | 60–250 Hz | 250 Hz–1 kHz | 1–4 kHz | 4–8 kHz |
|---|---|---|---|---|
| sec | −1,0 | −7,1 | **−21,7** | −66,0 |
| convolué entièrement | −4,3 | −2,0 | **−26,3** | −78,6 |
| **prise réelle** | −1,2 | −6,5 | **−18,6** | −34,9 |

Le sec colle presque à la vraie prise jusqu'à 4 kHz.

**C'est la troisième correction de cette famille** : après la gigue
d'échantillonnage et la réponse fabriquée, une valeur trouvée à l'oreille côté
direct qui n'atteint pas le banc, parce que les deux chaînes ne partagent que le
modèle et pas le rendu.

## Le verdict

Trois extraits envoyés à David — livré, mélange 45 %, sec — puis la banque
complète en 45 % à essayer au simulateur. Son retour :

> difficile de juger « en charge » sur un seul régime, ça fait trop propre, trop
> synthétiseur. pour le ralenti par contre, c'est pas mal, j'aime bien le rendu
> 45 %

Puis, après l'essai au volant du simulateur : **« c'est pas mal, on garde ça »**.

Sa remarque sur le protocole était juste, et vaut pour les prochains essais : une
note tenue trois secondes en boucle **est** un synthétiseur, quelle que soit la
chaîne. Un essai de timbre se juge dans l'application, où le régime bouge et où
les couches se désaccordent et se rafraîchissent — pas sur un extrait.

## La fenêtre de bouclage, trouvée en chemin

Le son sec a des transitoires plus raides que le convolué, et le raccord s'est
mis à s'entendre : le saut au bouclage du V8 est passé de 11,4 % à **26,4 %**.
Livrer ça aurait été échanger un défaut contre un autre.

Une prise fait un nombre entier de cycles moteur, donc ses deux bouts sont en
phase par construction — mais un cycle ne vaut pas l'autre. On essaie désormais
toutes les fenêtres de cycles entiers, à tous les décalages, et l'on garde la
**plus longue** dont le raccord tient sous 8 %.

Le critère a d'abord été une longueur minimale, mesurée sur le seul quatre
cylindres, et il ne se généralisait pas : à neuf dixièmes de la prise, le L4
restait à 7,05 % quand le V8 remontait à 18,9 %. Ce qui fait le raccord, c'est
**où** l'on coupe, pas combien.

| Banque | Avant | Après |
|---|---|---|
| `gm-ls` | 11,4 % | **6,7 %** |
| `gm-ls-long-header` | 13,6 % | **5,7 %** |
| `subaru-ej25` | 39,7 % | **7,7 %** |

Les trois passent sous la banque enregistrée (10,8 %), et les prises gardent leur
longueur : 2,72 à 3,08 secondes pour trois visées.

## Critères d'acceptation

- [x] Le banc rend le son sec, la captation se pose ensuite avec le mélange du
      direct, et `exhaustMix` le déclare dans la définition de banque
- [x] Le banc corrigé reproduit l'essai validé à 0,5 dB près sur cinq bandes
- [x] Le saut au bouclage des trois banques passe sous celui de la banque
      enregistrée
- [x] Les trois banques sont régénérées, transcodées, et leurs profils d'usine
      recopiés

## Ce qui n'est pas vérifié

- **L'aigu au-dessus de 4 kHz reste 30 à 45 dB sous une vraie prise**, sec comme
  convolué. C'est une limite du modèle, pas du rendu. Si le « synthétique »
  revient, c'est là qu'il faudra chercher — et ce sera un autre chantier.
- **Les trois banques refaites n'ont pas été réécoutées** : David a validé le
  mélange sur le quatre cylindres, avant la correction du bouclage.
- **Le relief du quatre cylindres reste deux fois plus creux que celui du V8** —
  45,7 dB bruts contre 26,3. Repéré, non traité.
