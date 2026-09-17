# 08 — Le volume maximal est plaqué contre le limiteur

**Statut :** ✅ fait le 17 septembre 2026 — mesuré, arbitré par David (« prends
la b »), livré et remesuré

David : « le volume max n'est pas suffisant ; quand j'écoute un podcast mixé un
peu fort, j'entends à peine le moteur. On peut augmenter le pic du curseur de
50 % ? »

## Pourquoi allonger la course ne suffira pas

Le volume général porte sur l'**entrée** de la chaîne de sortie, donc **avant le
limiteur** (`output-chain.ts`, le commentaire du champ `input` le dit). Ce
limiteur est réglé dur : seuil à **−1,5 dBFS** dans le profil de David, rapport
**12:1**, puis un gain de rattrapage de 1,8 après lui.

Au-dessus du seuil, pousser l'entrée de +3,5 dB — les 50 % demandés — ne rend
que **+0,3 dB** en sortie. Il ne manque donc pas de course au curseur : il est
plaqué contre le limiteur. Monter son maximum donnerait au conducteur un
mouvement qui ne s'entend pas, ce qui est pire que pas de mouvement du tout.

## Ce qu'il faut mesurer d'abord

Ce qui donnerait vraiment plus fort est le gain **après** le limiteur —
`MAKEUP_GAIN`, aujourd'hui 1,8. Le monter au jugé n'est pas une option : à ce
niveau on entre dans l'écrêtage de la sortie, et le remède serait un son sale
plutôt qu'un son fort.

La chaîne est constructible dans un contexte hors ligne — c'est même la raison
d'être du module, qui a été sorti d'`engine.ts` pour cela. Donc, sans rouler :

1. Faire tourner la chaîne sur la banque de David, à volume 1, et relever le
   niveau de sortie réel — crête et niveau moyen.
2. Dire combien de décibels sont récupérables avant écrêtage.
3. Voir si le seuil du limiteur, qui est un réglage de profil, a plus à donner
   que le gain de rattrapage, qui est une constante partagée.

Alors seulement proposer, chiffres en main.

## Ce qu'il ne faut pas faire

Monter le maximum du curseur sans rien d'autre. C'est la demande littérale, et
elle ne produirait pas l'effet attendu.

## Critères d'acceptation

- [x] Le niveau de sortie à volume maximal est mesuré, crête et moyenne.
- [x] La marge disponible avant écrêtage est chiffrée — **elle est négative**.
- [x] La proposition faite à David dit ce qu'on gagne en décibels, et ce qu'on
      risque de perdre en propreté.
- [ ] Écouté en roulant, par-dessus un podcast mixé fort — c'est le cas d'usage
      qui a déclenché le ticket.

## Ce que la mesure donne

Relevé sur `/banc/sortie.html` — le banc de la chaîne de sortie, qui existait
déjà et rend hors ligne, sans qu'aucun son ne sorte. Accélération franche à
2 600 tr/min, profil Route, cinq couches :

| Volume | Niveau | Crête | Rogné | Distorsion |
|---|---|---|---|---|
| 0,25 | −16,0 dB | −6,0 dBFS | 0 % | — |
| 0,5 | −10,0 | −0,1 | 0 % | — |
| **0,7 (livré)** | **−7,2** | **+2,7** | **1,1 %** | **−31 dB** |
| **1,0 (maximum)** | **−4,6** | **+5,0** | **9,3 %** | **−18 dB** |

**Il n'y a pas de marge : elle est négative de cinq décibels.** À volume
maximal, un échantillon sur onze est rogné par le convertisseur, et la
distorsion atteint −18 dB, soit environ douze pour cent. L'écrêtage commence
**vers 0,55 à 0,6**, c'est-à-dire en dessous du volume livré.

**Le seuil du limiteur n'a rien à donner**, et c'est mesuré : à volume 0,7,
retirer complètement le limiteur ne change la crête que de 0,4 dB (+2,5 contre
+2,1). Il est placé **avant** le gain de rattrapage de 1,8 — soit +5,1 dB — donc
il ne peut pas empêcher le dépassement que ce gain fabrique. Son propre
commentaire le dit depuis qu'il a été écrit ; c'est maintenant chiffré.

## Ce qu'on peut offrir, et ce qu'on ne peut pas

**La demande littérale est à refuser, et voici pourquoi en un chiffre** : entre
0,7 et 1,0, le curseur rend 2,6 dB, dont une partie n'est que du rognage. Monter
son maximum de cinquante pour cent rendrait moins que cela, et salirait
davantage. Ce que David entend de « plus fort » tout en haut de la course est
déjà, pour une part, de la distorsion.

Trois voies, mesurées à volume 1,0, accélération franche à 2 600 tr/min :

| Voie | Niveau | Rogné | Distorsion |
|---|---|---|---|
| **a.** ne rien changer | −4,6 dB | 9,3 % | −18 dB |
| **b.** limiteur en dernier | −6,5 | 1,1 % | −37 dB |
| **c.** limiteur en dernier + rattrapage 1,25 | −7,7 | 0,19 % | −50 dB |

De **a** vers **c**, on perd 3,1 dB de niveau et on divise la distorsion par
trois cents. Le son devient propre, et plus faible — l'inverse de la demande.

**Le vrai levier est ailleurs, et il est double :**

1. **Le volume du système de la voiture.** L'application sort déjà au-delà de la
   pleine échelle ; ce qui manque face à un podcast mixé fort se règle en amont,
   pas ici.
2. **Le relief.** Le niveau moyen est 6,5 dB sous les crêtes en accélération —
   c'est le relief de charge, voulu. Le réduire monterait le niveau **perçu**
   sans toucher aux crêtes. C'est un réglage de mixage, et il se juge à
   l'oreille : ce n'est pas au limiteur de le faire.

## La question posée à David

La **b** est la seule qui ne coûte presque rien — 1,9 dB — et qui supprime
l'essentiel de la distorsion. Faut-il la prendre, ou garder le son tel qu'il est
en sachant maintenant ce qu'il contient ?

Et si c'est « plus fort » qu'il veut avant tout, la piste à instruire est le
relief, pas la chaîne.

## Ce qui a été livré, et ce que ça donne

David, le 17 septembre 2026 : « prends la b ». Le limiteur ferme maintenant la
marche : il passe **après** le gain de rattrapage, donc il voit enfin ce qui
sort. Remesuré au banc, accélération franche à 2 600 tr/min :

| | Niveau | Crête | Rogné | Distorsion |
|---|---|---|---|---|
| volume 0,7 — avant | −7,2 dB | +2,7 dBFS | 1,09 % | −31 dB |
| **volume 0,7 — après** | **−7,7** | **+0,6** | **0,25 %** | **−48 dB** |
| volume 1,0 — avant | −4,6 | +5,0 | 9,26 % | −18 dB |
| **volume 1,0 — après** | **−6,5** | **+1,2** | **1,12 %** | **−37 dB** |

Au volume livré, cela coûte un demi-décibel et divise la distorsion par
cinquante. À fond, cela coûte 1,9 dB et divise le rognage par huit.

**Il reste 1,12 % de rognage à fond**, et c'est attendu : le nœud de limitation
du navigateur n'est pas un mur — genou de 3 dB, attaque de 2 ms, rapport de 12.
Pour aller à zéro il faudrait le cran de plus, le rattrapage à 1,25 : mesuré à
−7,7 dB et 0,19 % de rognage à volume 1,0, soit 1,2 dB de moins encore. Il
n'est pas pris ; la ligne reste au banc pour qu'on puisse y revenir.

L'ordre d'avant est gardé au banc sous le nom « limiteur avant le rattrapage » :
c'est la ligne de comparaison, et l'extrait téléchargeable fait entendre les
deux à niveau égal.
