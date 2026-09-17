# PASSAGE — un passage de rapport doit s'entendre comme un passage

**Statut :** ✅ validé en roulant le 16 septembre 2026 — David : « on n'entend pas vraiment tous les temps mais c'est pas grave, le résultat est bon »
**Branche :** `feature/passage-de-rapport`
**Version visée :** 0.3

## D'où vient ce lot

David a signalé le 8 septembre 2026, après avoir regardé la vidéo de
démonstration de [VehicleNoiseSynthesizer](https://github.com/ATG-Simulator/VehicleNoiseSynthesizer) :
« on entend bien le passage des vitesses et il est carrément mieux fait que chez
nous ».

L'étude comparative de trois projets ce jour-là a écarté deux d'entre eux —
[exhaustnotes](https://github.com/sathyaram/exhaustnotes), un catalogue d'écoute
sans licence, et [engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator),
dont le paramètre de papillon est câblé jusqu'au cœur puis jamais lu. Le
troisième, VNS, fait la même chose que nous — bouclage d'échantillons repitchés,
fondu à puissance constante entre voisins — mais quatre choses de plus au moment
d'un passage. C'est de là que vient ce lot.

## Ce que la mesure a montré

Relevé sur le profil Route, passage de première en seconde à 45 km/h,
accélération constante de 2,2 m/s², un point tous les seize millisecondes.

| | avant | après |
|---|---|---|
| Régime à la fin du passage | 4 289 tr/min, pour 2 803 aux roues | 2 781, pour 2 779 |
| Où tombe la chute de régime | 24 % pendant, 76 % dans les 170 ms d'après | entièrement dans les 133 ms |
| Part d'énergie des couches en charge | 0,926 avant, 0,926 pendant | 0,926 avant, 0,223 au creux |
| Niveau au creux | −3,8 dB | −4,2 dB |

Deux défauts distincts, tous deux mesurés :

1. **L'effort ne bougeait pas d'un millième pendant un passage.** Il se déduit de
   l'accélération, et la voiture ne coupe rien : elle est électrique et continue
   d'avancer pendant que la boîte imaginaire change de rapport. Le fondu vers les
   couches pied levé ne basculait donc jamais, et un passage n'était qu'une
   baisse de niveau sur un timbre identique.

2. **La chute de régime arrivait après le passage.** Le moteur était déclaré
   libre toute la durée de la coupure, donc descendait au frein moteur ; il ne
   rejoignait les roues qu'ensuite, d'un coup, quand le creux de niveau était
   déjà remonté. À l'oreille : un son qui glisse, pas une rupture.

## Ce qui a été fait

- **Coupure de couple** (`feel.shiftJolt.cutDepth`) — l'effort vu par le
  **mixage** tombe le temps du passage, en sinus, comme le creux de niveau. Posé
  dans `core/audio/mix.ts` et nulle part ailleurs : c'est une règle de mixage, et
  l'invariant du dépôt veut qu'elles y soient toutes. L'effort vrai n'est pas
  touché — le régime, la boîte et la télémétrie continuent de le voir entier.
- **Engagement de l'embrayage** (`core/engine/engine.ts`) — la progression du
  passage est transmise au moteur, qui ramène le régime vers celui du nouveau
  rapport à mesure que l'embrayage se referme. Sans progression, le comportement
  d'avant est conservé exactement.
- **Claquement de reprise** (`feel.shiftJolt.crackle`) — une seule détonation au
  front descendant du passage, avec la pétarade déjà synthétisée pour le lever de
  pied.

- **Plongée du régime** (`feel.shiftJolt.dipRpm`) — le moteur tombe sous le
  rapport visé pendant la coupure, et le réengagement l'y ramène. Négatif, il
  donne un coup de gaz au lieu d'un creux.

Les trois valeurs livrées — 0,8, 300 tr/min et 0,5 — sont des estimations, et se
coupent à zéro. L'engagement de l'embrayage n'a pas d'interrupteur : ce n'est pas
un effet mais la correction d'un défaut de synchronisation.

## Deuxième écoute, 8 septembre 2026

David : « on entend un tout petit claquement, c'est tout. Pour le couple, j'ai
pas l'impression que ça ait changé quoi que ce soit. » Et, en réécoutant la
vidéo de VNS : « au passage, on entend le moteur diminuer, remonter et ensuite
repartir de là où il était quand il a diminué — si j'étais pilote je dirais que
c'est un double embrayage. »

Deux mesures ont suivi, et elles ont réorienté le lot.

**VNS ne produit pas ce mouvement.** Son `OnGearShift()` ne déclenche que le clip
d'échappement ; `shiftPitchOsc`, la seule chose qui pourrait faire bouger la
hauteur, vaut zéro par défaut et rien dans VNS ne l'anime ; `autoBlip` ne touche
pas au régime, il force le mélange quand il **détecte** un saut. Ce que David
entend vient donc du modèle de transmission du jeu, pas de l'outil audio : c'est
un comportement de régime à produire dans `engine.ts`, et il n'y a plus rien à
chercher dans VNS.

**La banque n'est pas en cause.** Spectre des quatre couches de `procar`, par
bandes d'octave, normalisé au maximum de chacune : l'écart quadratique entre
en charge et pied levé vaut 6,0 dB en bas et 4,4 dB en haut — jusqu'à 13,4 dB
sur la bande de 63 Hz. Les deux familles sonnent vraiment différemment, la
bascule devait donc s'entendre.

**Ce qui l'annulait : le creux de niveau.** L'instant où le timbre bascule est
celui où le son est le plus faible. Le creux est passé de 0,55 à 0,15, soit de
−4,2 à −1,9 dB.

## Ce qui n'est pas fait

- **La remorsure à la reprise** (l'`autoBlip` de VNS : forcer brièvement le
  mélange vers « en charge » quand le couple revient). Écarté tant que la
  coupure n'a pas été jugée à l'oreille — elle suffit peut-être.
- **Le rétrogradage** n'a pas été mesuré séparément. La mécanique est la même et
  devrait valoir dans les deux sens, mais ce n'est pas vérifié.

## Ce qui reste à vérifier

**Rien de tout cela n'a été écouté.** Les mesures établissent que le timbre
bascule, que le régime atterrit juste et que le niveau creuse. Pas que cela sonne
mieux. C'est à David de trancher, en roulant ou au simulateur.

## Troisième écoute, 8 septembre 2026

David : « non c'est toujours pas ça. Mieux mais vraiment pas au niveau attendu.
Je suis déçu. » Et la liste de ce qui manquait : un claquement mécanique fort,
un coup de gaz franc, du caractère mécanique. Avec la séquence complète : « accél,
montée de régime ; passage au neutre, descente rapide ; coup de gaz, montée
rapide très courte ; passage du rapport, clac ; lâché de l'embrayage, reprise du
couple, descente rapide au rpm des roues puis réaccél. »

**La cause de fond était la durée.** Un passage durait 120 ms. Aucune séquence en
cinq temps ne tient dans un dixième de seconde : les phases se chevauchaient, et
tout ce qu'on ajoutait restait inaudible. `shiftTimeMs` est passé à 390 ms sur
Route et 300 sur Sport.

Ce qui a été ajouté ensuite : la trajectoire en cinq temps dans `engine.ts`, le
coup de gaz (`blipRpm`), et un **clac mécanique** distinct de la pétarade
(`clack`), synthétisé dans `audio/engine.ts` avec une attaque de une milliseconde
et deux composantes, claire et mate.

Relevé sur Route, première en seconde : 4 692 → 2 337 (fond) → 3 364 (sommet) →
clac → 2 910 pour 2 907 aux roues → réaccélération. Durée totale 390 ms.

**Non écouté.** Et les profils déjà enregistrés gardent leurs anciennes valeurs,
temps de passage compris.

## Quatrième écoute, 8 septembre 2026

David : « c'est trop court ; dans la vidéo ça dure au moins 500 ms, voire plus.
Et dans ton code, j'ai beau mettre au max je n'entends aucun claquement de
boîte. Ça devrait être flagrant, c'est un bruit sec dans un bruit de moteur
gras. »

Deux causes, toutes deux mesurées.

**La durée.** 390 ms restait court, et le curseur était plafonné à 500 ms — il
ne pouvait donc pas aller au-delà même en le voulant. Passé à 600 ms sur Route,
480 sur Sport, plafond du curseur à 1 500.

**Le niveau du clac.** Reproduction des filtres de Web Audio en Node, comparaison
aux crêtes du moteur au niveau où il arrive sur le bus :

| Réglage | Crête du clac, face au moteur |
|---|---|
| 0,60 (livré) | −15,6 dB |
| 1,50 (maximum) | −8,0 dB |

Le clac n'était donc pas mal déclenché : il était noyé, et le maximum du curseur
ne rattrapait pas. Trois causes cumulées — passe-bande étroit qui jette
l'essentiel de l'énergie, gain appliqué après cette perte, queue de 30 ms qui
étale au lieu de crêter. Trois composantes le remplacent (corps, métal, masse) :
**+4,2 dB** au-dessus des crêtes du moteur au réglage livré.

Un compteur « Clacs de boîte » est ajouté en télémétrie pour distinguer, sans
avoir à ouvrir la console, un défaut de déclenchement d'un défaut de niveau.

**Non écouté.**

## Cinquième écoute, 8 septembre 2026

David : « toujours pas de claquement, mais le compteur monte — c'est un souci de
son. En réglant à 600 ms j'ai le temps de tout entendre, sauf le claquement. »

Le compteur posé au tour précédent a fait son travail : il a écarté le
déclenchement en un mot, là où trois échanges n'y avaient pas suffi.

**La cause est le saturateur.** Sa courbe est indexée sur [-1, 1] et Web Audio
prend la valeur du bord au-delà. Le moteur crête à 1,74 sur le bus : il sature
donc en permanence, et tout ce qui entre au-dessus de lui en sort au même
niveau. Mesuré sur la courbe du profil Route (`drive` 0,12) :

| Entrée sur le bus | Sortie du saturateur | Écart au moteur |
|---|---|---|
| moteur, crête 1,74 | 1,0000 | 0,00 dB |
| clac à 0,6 (4,2 dB au-dessus) | 1,0000 | 0,00 dB |
| clac à 1,5, le maximum | 1,0000 | 0,00 dB |
| clac dix fois trop fort | 1,0000 | 0,00 dB |

Aucun réglage ne pouvait le rendre audible. Cela explique aussi pourquoi la
pétarade s'entendait « toute petite » depuis le début.

Les deux événements brefs sont injectés après le saturateur, sur le limiteur.
Ajout d'un bouton « Écouter le clac » dans la configuration, puisqu'un événement
d'un centième de seconde ne se règle pas en attendant un passage de rapport.

**Non écouté.**

## Sixième écoute, 8 septembre 2026

David : « j'entends le clac en cliquant sur le bouton, mais pas en passant les
vitesses ». Le bouton se presse à l'arrêt, moteur au ralenti ; le passage a lieu
moteur fort. Deux causes se sont ajoutées à celle du saturateur.

**Le limiteur.** Il n'écrête pas un transitoire, il applique au signal entier la
réduction que le moteur lui impose. Les événements sont donc injectés sur le
gain de rattrapage, après lui.

**Et une mesure fausse de ma part.** J'avais conclu que le clac passait 4,2 dB
au-dessus du moteur en comparant des **crêtes**. Une crête n'est pas un niveau :
repris par bandes d'octave, l'écart réel était de 24 à 40 dB en dessous.

| | 500 Hz | 1 k | 2 k | 4 k | 8 k | crête |
|---|---|---|---|---|---|---|
| avant | −42,7 | −37,7 | −28,6 | −23,4 | −15,2 | 2,1 |
| après | −8,4 | +2,0 | +10,5 | +14,3 | +22,9 | 7,8 |

La cause était l'enveloppe : une rampe exponentielle vers un millième descend en
quelques millisecondes, si bien que toute l'énergie tient dans la crête.
Remplacée par une extinction à constante de temps, gains triplés.

**Non écouté.** La crête du clac monte à 7,8 avant la chaîne ; le moniteur de
sortie dira s'il écrête.

## Septième écoute, 8 septembre 2026

David : « je l'entends (trop fort même) ; à 0,05 c'est encore un peu trop fort.
Je pense que c'est le son qui est surtout trop sec, aigu et court ; dans la
vidéo c'est un son un peu plus long et surtout plus sourd. »

La correction de niveau avait surcompensé, et surtout placé l'énergie au mauvais
endroit. Mesuré au réglage 0,05 — celui qu'il jugeait déjà trop fort — l'ancien
clac culminait à −4 dB du moteur à 8 kHz et +13 dB à 16 kHz : tout son niveau
était dans l'aigu, d'où le « sec ».

Nouvelles composantes, en écart au moteur au réglage livré (0,5) :

| | 125 Hz | 250 | 500 | 1 k | 2 k | 8 k |
|---|---|---|---|---|---|---|
| aigu (jeté) | +5,6 | +2,1 | −11,4 | −5,1 | +4,7 | +17,8 |
| sourd (livré) | −5,7 | −10,7 | −15,3 | −17,5 | −16,4 | −16,2 |

Le maximum passe de l'aigu au grave, et les extinctions de 24-90 ms à 50-120 ms.
La crête tombe de 7,9 à 0,31 : plus de risque d'écrêtage.

**Non écouté.**

## Huitième écoute, 8 septembre 2026

David : « beaucoup mieux ; clac boîte à 0,5 c'est très bien. Par contre au
rétrogradage il est trop fort, et je ne trouve pas où le configurer. »

Il n'y avait rien à trouver : le clac était tiré à la même intensité dans les
deux sens. Ce qui change n'est pas le son mais ce qu'il y a autour — on
rétrograde pied levé ou en freinant, donc avec un moteur plus doux, et le même
clac y ressort davantage.

Ajout de `feel.shiftJolt.clackDownshift`, part du clac gardée quand la boîte
descend, livrée à 0,55. Un réglage plutôt qu'une pondération automatique sur
l'effort : le bon dosage dépend de la banque.

**Non écouté.**

## Neuvième écoute, 8 septembre 2026

David : « à 0,5 les deux sonnent bien. Un seul souci : quand je laisse ralentir,
parfois le simu passe une vitesse supérieure au lieu de laisser ralentir et de
finalement rétrograder ; et comme le son du moteur est faible en décélération, on
entend le claquement fort. »

Le clac n'était que le révélateur : le défaut est dans la boîte, et il
préexistait au lot. Reproduit au banc — croisière à 90 km/h pendant douze
secondes, puis perte de 0,5 km/h par seconde : un passage du quatrième au
cinquième une seconde après le lever de pied.

La bande de croisière juge sur la dérive mesurée sur trois secondes : robuste au
bruit, mais lente. La stabilité étant déjà acquise, la dérive met plus d'une
seconde à voir le ralentissement. L'accélération instantanée le sait tout de
suite mais elle est bruitée : elle est cumulée dans un compteur qui monte en
ralentissant et redescend deux fois plus vite sinon.

Deux tests ajoutés : pas de montée après un lever de pied, et montée conservée
quand la vitesse est vraiment tenue.

## Dixième écoute, 8 septembre 2026

David : « je crois que le rapport passe automatiquement au moment du coup de gaz,
même si j'ai commencé à ralentir juste avant. »

Deux effets se cumulaient, et le second est propre à ce lot. Le blocage des
montées demandait 0,6 s de ralentissement avéré ; réduit à 0,35 s. Mais surtout,
un passage dure maintenant 600 ms : décidé légitimement une fraction de seconde
avant le lever de pied, il s'engage quand même, et son coup de gaz tombe alors
que la voiture ralentit déjà.

Le coup de gaz suit donc l'effort **en montée** — pied levé, il ne reste que la
chute. **Au rétrogradage il reste entier** : c'est là qu'il est le geste du
conducteur, et l'on rétrograde précisément pied levé ; le lier à l'effort l'aurait
supprimé exactement quand il doit s'entendre.

**Non écouté.**

## Onzième écoute, 8 septembre 2026

David : « c'est pareil ; si j'arrête d'accél juste avant que la boîte ne monte un
rapport, elle le monte quand même. »

Le correctif précédent ne portait que sur la montée **en croisière**. Celle **au
régime** est une autre règle : le franchissement du seuil lance un compte à
rebours de quelques dixièmes de seconde, et plus rien ne l'annulait. Lever le
pied ne franchit pas le seuil de freinage, donc l'inhibition existante ne
s'appliquait pas.

Reproduit au banc : montée jusqu'à 1 % au-dessus du seuil du premier rapport,
puis perte de 0,6 km/h par seconde — le passage se produit quand même. Un premier
scénario, où le seuil n'était pas tout à fait atteint, ne reproduisait rien : il
faut que le compte à rebours soit lancé.

La condition de ralentissement s'applique désormais aux deux règles. Le compteur
retombe à zéro dans la branche `else`, donc l'intention est abandonnée et non
suspendue.

## Douzième écoute, 8 septembre 2026

David, avec le scénario exact : « accél jusqu'à 4800 rpm en 4e ; arrêt de
l'accel ; le simu passe la 5 et la 6 ».

Les deux gardes posées ne suffisaient pas, et la cause était ailleurs.
`upshiftThreshold` décale le seuil de `upshiftLoadSpreadRpm` — 1600 tr/min sur
Route — selon la charge. Pied au plancher, le seuil est 800 tours au-dessus de
sa base ; la charge s'effondre en une demi-seconde au lever de pied, donc le
seuil aussi, bien plus vite que le régime ne descend.

La marge de dépassement (`UPSHIFT_OVERSHOOT_RPM`, 400 tr/min), qui court-circuite
la temporisation, se trouvait alors franchie non parce que le moteur montait mais
parce que la barre était tombée. Passage instantané, avant que le cumul de
ralentissement n'ait atteint son seuil. Puis rebelote au rapport suivant : « la 5
et la 6 ».

Deux corrections :

- le dépassement immédiat exige `accelMs2 >= 0` — il existe pour empêcher le
  régime de filer sous accélération, ce qui n'a pas de sens en décélérant ;
- au-delà d'un demi m/s² de décélération, le blocage est immédiat sans attendre
  le cumul de 0,35 s : à ce niveau le bruit de mesure n'explique plus rien.

Test ajouté qui rejoue le scénario : 4e à 4800 tr/min, charge de 1 à 0 en une
demi-seconde, vitesse en baisse de 5 km/h par seconde.

## Treizième écoute, 8 septembre 2026

David : « ça monte encore un rapport quand je relâche l'accel. »

Deux tentatives de reproduction au banc ont échoué — accélération chutant
brutalement, puis chutant sur une demi-seconde — sans que le passage se produise.
Plutôt que de continuer à deviner le timing exact, la cause racine a été traitée
directement.

Elle était identifiée depuis le tour précédent : `upshiftThreshold` suit la
charge à l'identique, donc chute de 1600 tr/min en une demi-seconde au lever de
pied, bien plus vite que le régime. Toutes les gardes posées jusque-là agissaient
**en aval** et dépendaient du moment où `accelMs2` devient franchement négatif —
or il est lissé par le conditionneur, quand la charge ne l'est presque pas.

Le seuil appliqué ne peut plus descendre que de 400 tr/min par seconde. Il monte
toujours instantanément : garder un rapport en remettant les gaz doit être
immédiat. Remis à zéro à chaque changement de rapport.

Deux tests protègent le comportement : la descente bornée, et la remontée
immédiate.

## Quatorzième écoute, 8 septembre 2026 — la cause, trouvée par David

David : « je crois que c'est un problème qui n'est pas dû à nos bricolages sur le
passage des rapports. On s'en rend juste compte maintenant parce qu'il est
flagrant. En fait les rapports montent plus tôt quand on accélère moins, et plus
tard après un kickdown. Je pense que ça a un lien. »

Il avait raison sur les deux points. `upshiftLoadSpreadRpm` — 1600 tr/min sur
Route — décale le seuil de ±800 selon la charge : ses deux observations en sont
les deux faces, et le réglage est antérieur au lot.

Le défaut de fond : ce décalage attend l'**intention** du conducteur, quand la
charge, faute de pédale, donne le **résultat**. En côte à pleine charge
l'accélération est faible, donc la boîte monte tôt — l'inverse du besoin.

Correction retenue (option 2 sur quatre proposées) : le seuil suit une
**demande**, qui monte instantanément avec la charge et n'en redescend qu'en
trois secondes. Elle remplace le garde-fou posé au tour précédent, qui freinait
la descente du seuil sans dire pourquoi.

Relevé sur Route, quatrième à 4000 tr/min puis lever de pied avec charge tombant
en une demi-seconde : le seuil descend de 3851 à 2358 en trois secondes au lieu
de s'effondrer, et **aucun passage ne se produit**.

**Non écouté.**

## Clôture, 8 septembre 2026

David, après la quatorzième écoute : « comme ça c'est pas mal en tout cas avant
de tester sur route ». PR #87 mergée dans `develop` — quinze commits, contrôle
qualité vert.

Ce qui reste, et qui ne se voit qu'en roulant : le rendu de la séquence sur un
vrai trajet, avec la vraie source GPS et sa cadence, et le comportement de la
boîte en côte — c'est le cas où la charge déduite de l'accélération diverge le
plus de l'intention, et il n'a pas pu être éprouvé au simulateur.

Points laissés ouverts, sans urgence :

1. Les trois secondes de retombée de la demande sont une estimation.
2. Deux des gardes posées avant la correction de fond — pas de dépassement
   immédiat en décélérant, blocage au ralentissement avéré — sont peut-être
   redondantes depuis. Elles n'ont pas été remesurées.
3. Le claquement d'échappement au rétrogradage n'a pas de dosage séparé, alors
   que le clac de boîte en a un et pour la même raison.

## Suite, 8 septembre 2026 — les moteurs en synthèse

Essai sur le NAS : « ça ne marche pas pour les moteurs en synthèse, juste ceux
qui sont enregistrés — je parle de tout le toutim, du claquement au passage en
particulier ».

Trois pièces sur quatre étaient logées du mauvais côté : le clac et la pétarade
dans le moteur à échantillons, dont la garde exige une banque chargée, et la
coupure de couple dans le mixage des couches, jamais appelé quand le synthé
tourne. Seul le mouvement de régime passait. Les deux graphes ont de surcroît
leur propre contexte audio.

Les bruits deviennent des pièces autonomes (`core/audio/events.ts`), jouées sur
le graphe actif ; sur celui du synthé, après le silencieux et la résonance. La
coupure s'applique à l'effort transmis au moteur simulé. PR #93, mergée.

Écouté par David : « impec ça marche ». Le niveau du clac face au moteur simulé
n'a pas été mesuré — seulement face à la banque `procar`.
