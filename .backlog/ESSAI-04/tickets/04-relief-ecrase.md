# 04 — l'effort s'entend en sortie, pas seulement dans le mixage

**Statut :** 🧑 attend David — la mesure est faite, elle écarte la cause supposée
et en désigne une autre ; la correction se décide

**Bloqué par :** 01 — la charge doit être stable avant qu'on mesure le niveau ;
et l'essai de l'ancrage du ticket 05, qui déplace le spectre entrant dans la
chaîne

## Ce qu'il faut obtenir

Le relief de charge et de régime livré le 3 septembre s'entend réellement. Le
mixage produit aujourd'hui 3,9 dB d'écart entre croisière et accélération
franche ; l'estimation analytique dit qu'il en reste 0,3 dB après la chaîne de
sortie, le limiteur travaillant à un seuil de −1,5 dB avec un rapport de 12
pour 1, très au-dessus duquel les deux niveaux se situent.

**La mesure d'abord.** Un banc reconstruit la chaîne de sortie à l'identique
dans un contexte audio hors ligne — qui calcule un tampon et ne fait sortir
aucun son — et relève le niveau conservé pour une série de gains d'entrée et de
volumes généraux, saturateur en service puis court-circuité, afin de savoir
lequel des deux écrase. Aucun réglage ne bouge avant ce chiffre.

La piste tenue pour la correction, si la mesure confirme : ramener le niveau
nominal sous le seuil du limiteur, pour qu'il ne travaille que sur les crêtes au
lieu de compresser en permanence. Le gain de rattrapage fixe placé après lui
remonte le tout sans rendre la dynamique.

## Critères d'acceptation

- [x] Le banc de mesure existe, ne fait sortir aucun son, et son protocole est
      écrit — signal employé, valeurs relevées et leur provenance.
- [ ] L'écart conservé en sortie est chiffré avant et après correction.
- [x] La part du saturateur et celle du limiteur sont mesurées séparément.
- [ ] Après correction, l'écart entre croisière et accélération franche
      s'entend, et le niveau de sortie ne sature pas.
- [ ] Le README dit ce que la chaîne de sortie fait au niveau.

## Le banc

`banc/sortie.html`, servi par le serveur de développement seul — il n'entre dans
aucune entrée du build, la production ne l'embarque pas. Il rend dans un
`OfflineAudioContext` : les tampons sont calculés, aucun son ne sort.

**Le signal.** Les cinq couches du profil Route, décodées telles qu'elles sont
livrées, jouées en boucle avec les gains et les vitesses de lecture que
`computeMix` donne — la même fonction que celle qui pilote le moteur audio. Le
banc ne rejoue pas une idée du mixage, il rejoue le mixage.

**La chaîne.** `core/audio/output-chain.ts`, sortie de `engine.ts` pour cette
mesure et utilisée par les deux : il n'y a pas de seconde copie qui pourrait
dériver de celle qui sonne. Les court-circuits laissent les nœuds en place et les
contournent, de sorte que le nombre d'étages ne change pas d'une ligne à l'autre.

**Les états.** Même régime, seul l'effort change — 0,35 pour la croisière, 1,00
pour l'accélération franche — de façon à isoler le relief de charge. Deux régimes,
1800 et 2600 tr/min, pour lire aussi le relief de régime.

**Les valeurs relevées.** Niveau efficace sur 1,5 s après une demi-seconde
d'établissement, niveau crête, part des échantillons au-delà de la pleine
échelle, et niveau efficace **après écrêtage à ±1** : le rendu hors ligne est en
virgule flottante et laisse passer ce qui dépasse un, là où le convertisseur de
l'appareil le rogne. Sans cette seconde mesure, le banc relèverait un relief que
la voiture n'entend pas.

**Deux écarts assumés avec ce qui joue** : les boucles ne sont pas recollées, et
les positions de départ sont réparties régulièrement au lieu d'être tirées au
sort — sinon deux passes ne donneraient pas le même chiffre. Ni l'un ni l'autre
ne déplace un niveau moyen.

## Ce que la mesure dit — 6 septembre 2026

**Le relief traverse la chaîne.** Écart entre croisière et accélération franche
à 1800 tr/min, au volume livré de 0,70 :

| Configuration | Écart conservé |
|---|---|
| ni saturateur ni limiteur | 6,58 dB |
| sans limiteur | 6,51 dB |
| sans saturateur | 6,57 dB |
| chaîne complète | **6,49 dB** |

La chaîne coûte **0,09 dB** de relief. L'estimation analytique portée en tête de
ce ticket — 3,9 dB en entrée, 0,3 dB conservés — se trompait d'un facteur vingt.
Elle supposait un limiteur qui écrase en permanence ; il n'écrase pas.

**Le limiteur ne limite pas.** Réduction relevée sur le nœud, signal stationnaire :
0,0 dB au volume livré, **−0,2 dB** au maximum à volume 1,0, alors que la sortie
y rogne 8 % de ses échantillons. Le niveau efficace, lui, ne dépasse jamais
−7,2 dB : ce sont des crêtes brèves qui touchent le seuil, pas le corps du son.

Il n'est pas neutre pour autant. À volume 0,05, soit quarante décibels sous son
seuil, où un limiteur ne doit rien faire du tout, il rend **0,4 dB de plus** que
lorsqu'il est court-circuité — mesuré, saturateur écarté et rattrapage neutre.
Le nœud applique donc un gain qui n'a pas été demandé. C'est un comportement de
l'implémentation, non un réglage du projet, et il explique que la chaîne complète
sorte plus fort que la même chaîne sans limiteur.

**Ce qui écrase, c'est l'écrêtage en sortie.** Il vient du gain de rattrapage de
1,8 — +5,1 dB — placé **après** le limiteur, là où plus rien ne rattrape ce qui
dépasse :

| Volume général | Part rognée en accélération franche | Écart entendu |
|---|---|---|
| 0,25 | néant | 6,59 dB |
| 0,50 | néant | 6,57 dB |
| **0,70 (livré)** | **0,96 %** | 6,49 dB |
| 1,00 | 8,28 % | **6,01 dB** |
| 0,70, rattrapage neutre | néant | 6,54 dB |

Le relief ne se perd donc pas dans la chaîne : il se perd dans ce que la chaîne
laisse rogner, et seulement quand le volume monte.

## Ce qui reste à décider

Le limiteur est placé avant le seul gain qui fait dépasser la pleine échelle : il
ne peut pas empêcher l'écrêtage qu'il est censé empêcher. Le remettre en dernier
lui rendrait son travail. C'est une décision qui touche le son, et David en a déjà
tranché une voisine — pour le moteur synthétisé, l'écrêtage au volume 0,70 est
assumé, « essayé deux fois sans qu'aucune différence s'entende »
(`core/preset/defaults.ts`). Elle lui revient donc.

## Ce que l'écrêtage fait entendre — 6 septembre 2026

Compter les échantillons rognés dit qu'il y a de l'écrêtage ; ça ne dit pas si on
l'entend. Le banc relève donc aussi l'énergie du signal d'erreur — la partie
coupée — rapportée au son lui-même. Sous −60 dB elle est inaudible, vers −40 elle
se devine sur un son tenu, au-delà de −30 elle s'entend franchement.

En accélération franche, à 1800 tr/min :

| Chaîne | Distorsion | Relief conservé | Niveau |
|---|---|---|---|
| livrée, volume 0,70 | **−31 dB** | 6,49 dB | −7,6 dB |
| livrée, volume 1,00 | **−18 dB** | 6,01 dB | −5,0 dB |
| limiteur en dernier, volume 0,70 | −49 dB | 6,07 dB | −8,0 dB |
| limiteur en dernier, volume 1,00 | −38 dB | 4,49 dB | −6,5 dB |
| **rattrapage 1,25 + limiteur en dernier** | **néant** | **6,54 dB** | −10,7 dB |
| idem, volume 1,00 | −51 dB | 6,12 dB | −8,1 dB |

**Remettre le limiteur en dernier ne suffit pas** : il rend alors son travail —
1,4 dB d'atténuation au volume livré, 3,7 dB à volume 1,0 — et cette atténuation
mange le relief qu'on cherchait à sauver. On échangerait de la distorsion contre
la chose même que ce ticket veut faire entendre.

**Ce qui marche est de ne pas produire l'écrêtage plutôt que de le rattraper.**
Le gain de rattrapage ramené de 1,8 à 1,25 place la crête à −0,7 dB en
accélération franche : plus rien ne dépasse, le relief passe entier à 6,54 dB, et
le limiteur remis en dernier ne sert plus que de filet quand l'utilisateur monte
le volume — où il garde encore 6,12 dB au lieu de 4,49.

Le prix est **3,1 dB de niveau en moins**, à reprendre sur le volume de
l'autoradio. C'est le seul point qui ne se tranche pas au banc : il dépend de ce
que la sortie du téléphone donne dans cette voiture-là.

**À écouter avant de décider.** Le banc produit un extrait de huit secondes —
quatre telle que la chaîne sort aujourd'hui, quatre corrigée, **mises au même
niveau efficace**, chacune rognée avant la mise à niveau comme le ferait le
convertisseur. Sans cette égalisation, la plus forte des deux paraîtrait toujours
la meilleure.
