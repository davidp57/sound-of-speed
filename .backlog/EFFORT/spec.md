# EFFORT — la charge doit connaître la vitesse

**Statut :** 🧑 attend David — livré, reste à écouter en roulant
**Branche :** `feature/effort`
**Version visée :** 0.3 — **après [PENTE](../PENTE/spec.md)**

## Remesuré le 4 septembre 2026, après PENTE et après ESSAI-04

C'est ce que demandait le ticket 01, et **la conclusion est que le lot continue,
inchangé**. Relevé au banc en mode « positions GPS », donc sans pédale, comme
dans la voiture :

| Situation | Charge | Régime | Rapport |
|---|---|---|---|
| Arrêt, au ralenti | 0,52 | 800 | 1 |
| 30 km/h tenu | 0,50 | 1798 | 2 |
| 50 km/h tenu | 0,50 | 1542 | 4 |
| 90 km/h tenu | 0,51 | 1935 | 6 |
| 110 km/h tenu | 0,50 | 2353 | 6 |
| 130 km/h tenu | 0,50 | 2770 | 6 |
| 110 km/h roue libre | 0,07 | — | — |

Un demi partout, de l'arrêt à 130 km/h. Le défaut décrit plus bas est donc
intact après la correction de la pente : ce n'était pas un artefact du bruit de
mesure, et les chiffres de la spec tiennent.

**Une fausse piste, écartée le soir même.** Une première mesure donnait une
charge nulle en croisière et 1,00 en reprise, ce qui aurait voulu dire que le
modèle était devenu binaire. C'était un artefact du banc : au simulateur en
vitesse exacte, la charge vient de la **pédale**, pas de l'accélération, et le
régulateur tenait sa vitesse pédale relâchée. Les modes qui imitent un GPS ne
transmettent plus la pédale depuis — sans quoi ils n'éprouvaient pas le calcul
qu'ils étaient censés éprouver.

## À lire d'abord

Ce lot a été écrit en croyant tenir la cause du reproche « les accélérations
douces sont trop silencieuses ». Ce n'était pas elle. La mesure faite ensuite a
montré qu'à la cadence du GPS de la Tesla — trente millisecondes — une
accélération de 0,55 m/s² est **vue à zéro** par le conditionneur : la charge
faisait donc exactement son travail sur un signal nul. C'est l'objet de
[PENTE](../PENTE/spec.md), et c'est là qu'est le gros du reproche.

Ce lot-ci garde sa valeur propre, mesurée et indépendante : **la croisière est
plate**. Tenir 50 km/h et tenir 130 donnent le même niveau et le même timbre,
alors que l'un ne demande rien et l'autre beaucoup. Mais il n'est plus urgent,
et ses chiffres sont à refaire après PENTE — les niveaux du tableau ci-dessous
supposent une accélération correctement mesurée, ce qui n'est pas le cas
aujourd'hui.

## Le problème

Relevé en roulant, le 3 septembre 2026 : « les accélérations douces, comme
quand on accélère de 110 à 150 doucement sur le dernier rapport, sont trop
silencieuses par rapport au bruit sans charge, ou — encore plus — au
vrombissement haut dans les tours ».

Mesuré, c'est exact. La cause première est ailleurs (voir ci-dessus), mais le
modèle de charge y contribue et le tableau qui suit vaut pour lui-même.

Niveau acoustique sur le profil Route — gain calculé multiplié par le niveau
efficace réel de chaque échantillon :

| Situation | Charge | Niveau |
|---|---|---|
| Ralenti à l'arrêt | 0,50 | −8,5 dB |
| 50 km/h tenu, 4e | 0,50 | −2,7 dB |
| 90 km/h tenu, 5e | 0,50 | −2,3 dB |
| 110 km/h tenu, 6e | 0,50 | −2,3 dB |
| 130 km/h tenu, 6e | 0,50 | −2,1 dB |
| 110 km/h roue libre | 0,33 | −3,7 dB |
| 110 km/h freinage | 0,00 | −6,3 dB |
| **110→150 doucement (0,55 m/s²)** | **0,64** | **−1,0 dB** |
| Reprise franche à 60, 3e | 1,00 | +1,8 dB |
| Haut des tours à pleine charge | 1,00 | +3,4 dB |

Une accélération douce à haute vitesse est **1,1 dB** au-dessus de la croisière
et **2,7 dB** au-dessus de la roue libre. Un décibel ne s'entend pas ; deux à
peine. Et le vrombissement du haut des tours la dépasse de 4,4 dB. Elle est donc
écrasée entre les deux, exactement comme il le décrit.

### La cause

Faute de pédale, la charge se déduit de l'accélération :

```ts
raw = clamp(accelMs2 / fullLoadAccelMs2, -1, 1) * 0.5 + 0.5
```

Tenir une vitesse — accélération nulle — vaut donc **toujours 0,5**, que ce soit
à 30 km/h ou à 130. Or tenir 130 km/h demande beaucoup de couple, et tenir
30 km/h presque rien : la traînée aérodynamique croît comme le carré de la
vitesse. **La charge ignore la vitesse**, alors que c'est elle qui décide de la
moitié de l'effort réel.

Conséquence directe : les cinq lignes « tenu » du tableau donnent le même
chiffre, et la fenêtre qui reste pour représenter une accélération va de 0,5
à 1 — la moitié de l'échelle pour tout ce qui n'est pas du freinage.

## La solution

**Séparer les deux grandeurs qu'on avait confondues en une.**

La boîte et le son ne demandent pas la même chose :

- la **boîte** veut connaître l'**intention** du conducteur — demande-t-il de
  l'accélération ? Cela ne dépend pas de la vitesse, et c'est bien ce que la
  charge actuelle mesure. Elle ne bouge pas.
- le **son** veut connaître le **travail du moteur** — combien il pousse. Cela
  vaut l'accélération **plus** la traînée à vaincre.

D'où une seconde grandeur, l'**effort**, calculée dans le moteur à côté de la
charge :

```ts
// La traînée consomme la moitié de la charge disponible à la vitesse de
// référence, et croît comme le carré de la vitesse.
const c = 0.5 * fullLoadAccelMs2 / (dragRefKmh * dragRefKmh)
effort = clamp((accelMs2 + c * kmh * kmh) / fullLoadAccelMs2, 0, 1)
```

L'effort remplace la charge pour **deux usages, et deux seulement** : le fondu
entre les familles « en charge » et « pied levé », et le relief de charge. La
charge continue de piloter la boîte, les seuils de passage et le rétrogradage
appuyé.

C'est ce découpage qui rend le lot sans risque : aucun seuil de passage n'est
touché, donc rien à recaler dans les profils livrés — le travail de BOITE-VIVANTE
et de FIX-BOITE reste intact.

### Ce que ça donne, mesuré

Repère de traînée à 130 km/h sur le profil Route :

| Situation | Effort | Niveau | Écart |
|---|---|---|---|
| Ralenti à l'arrêt | 0,00 | −12,9 dB | −4,4 |
| 50 km/h tenu, 4e | 0,07 | −6,2 dB | −3,5 |
| 90 km/h tenu, 5e | 0,24 | −4,4 dB | −2,1 |
| 110 km/h tenu, 6e | 0,36 | −3,5 dB | −1,2 |
| 130 km/h tenu, 6e | 0,50 | −2,1 dB | = |
| 110 km/h roue libre | 0,01 | −6,3 dB | −2,6 |
| 110 km/h freinage | 0,00 | −6,3 dB | = |
| **110→150 doucement** | **0,78** | **+0,1 dB** | **+1,1** |
| 50→90 doucement, 4e | 0,42 | −3,1 dB | −1,8 |
| Reprise franche à 60 | 1,00 | +1,8 dB | = |

L'accélération douce à haute vitesse passe à **3,4 dB au-dessus de la croisière
à 110** et **6,4 dB au-dessus de la roue libre** — contre 1,3 et 2,7. Elle
s'entend.

Et une chose neuve apparaît, qui est juste : **la croisière monte avec la
vitesse**. Tenir 50 km/h est calme, tenir 130 est un effort. Aujourd'hui les
deux sonnent identiques.

### Trois effets à assumer

1. **Le ralenti perd 4,4 dB.** Il était calé sur une charge de 0,5 qui n'avait
   aucun sens à l'arrêt. `idleLevelDb` passe de −5 à −1 sur Route pour le
   ramener où il était.
2. **Les accélérations douces en ville deviennent plus discrètes** (−1,8 dB à
   70 km/h). C'est physiquement juste — accélérer mollement à 70 demande peu —
   et cela creuse le contraste entre la ville et la route. À vérifier en roulant
   que ce n'est pas trop.
3. **Le timbre suit aussi**, puisque le fondu on/off suit l'effort. En roue
   libre à 110 km/h on entendait encore 51 % de la famille « en charge » ; on
   tombera à 27 %. Le pied levé s'entendra vraiment comme un pied levé — c'est
   un gain, mais c'est un changement de caractère, pas seulement de niveau.

## Un réglage, et un seul

`mix.dragRefKmh` : la vitesse à laquelle tenir l'allure consomme la moitié de la
charge disponible. Bas, tout devient chargé tôt ; haut, la traînée compte peu et
l'on retombe presque sur le comportement actuel.

Défauts proposés : **130 km/h** sur Route, **150** sur Sport — un profil sportif
a de la réserve, sa traînée doit peser moins tôt.

Mesuré à 110 et à 150 pour comparaison : à 110, l'accélération douce monte
à +1,7 dB et la croisière à 130 devient franchement chargée (0,70) ; à 150, le
gain se réduit de moitié. 130 est le compromis.

Ce n'est **pas** un réglage de physique : `fullLoadAccelMs2` vaut déjà 2 m/s² là
où une Tesla en fait cinq. C'est un curseur de contraste, à régler à l'oreille.

## Ne pas régler aux curseurs en attendant

Une première version de cette spec proposait `fullLoadAccelMs2` à 1 et
`loadReliefDb` à 6 pour gagner 2,2 dB sur les reprises douces sans attendre le
lot. **C'est à ne pas faire**, et la raison est instructive.

Ces deux réglages agissent sur la charge calculée **à partir** de
l'accélération. Or, dans la voiture, l'accélération d'une reprise douce est vue
tantôt à zéro, tantôt à trois fois sa valeur, selon le bruit de mesure — c'est
la conclusion de [PENTE](../PENTE/spec.md). Multiplier par deux un signal faux
et instable n'y change rien d'utile : cela amplifie l'instabilité.

Autrement dit, il n'y a pas de réglage à trouver avant que la mesure d'entrée
soit juste. C'est une bonne illustration de la règle du dépôt : mesurer avant
d'affirmer, et remonter à la cause plutôt que compenser en aval.

Effet de bord à connaître pour plus tard : `fullLoadAccelMs2` sert **aussi** à
la boîte, via les seuils de passage et le déclenchement du kickdown. C'est
précisément ce que ce lot supprime en séparant les deux grandeurs.

## Ce qu'il faut faire

1. `mix.dragRefKmh` dans le schéma de profil, les deux profils livrés, le guide
   de création et la référence des réglages du README.
2. `EngineState.effort` calculé dans `core/engine/engine.ts`, lissé comme la
   charge, exposé à la télémétrie à côté d'elle.
3. `core/audio/mix.ts` : le fondu de charge et le relief de charge lisent
   l'effort. Le reste ne change pas.
4. `core/drivetrain/gearbox.ts` : **rien**. C'est le point du lot.
5. Recaler `idleLevelDb` sur les deux profils.
6. Tests : l'effort croît avec la vitesse à accélération nulle, vaut zéro à
   l'arrêt, sature à pleine charge, et la boîte passe ses rapports aux mêmes
   vitesses qu'avant — ce dernier test est le garde-fou du lot.

## Critères d'acceptation

- [ ] À accélération nulle, l'effort croît avec la vitesse
- [ ] À l'arrêt, l'effort est nul et le ralenti reste au niveau d'avant
- [ ] Une accélération douce à 130 km/h s'entend au moins 3 dB au-dessus de la
      croisière à la même vitesse
- [ ] Le pied levé reste au moins 5 dB sous une accélération douce
- [ ] Les passages de rapports se produisent aux mêmes vitesses qu'avant le lot
- [ ] Le guide de création donne un repère de traînée cohérent avec le
      caractère choisi
- [ ] 🧑 Vérifié en roulant : une reprise douce à haute vitesse s'entend

## Livré le 4 septembre 2026

`mix.dragRefKmh` existe — 130 km/h sur Route, 150 sur Sport. `EngineState.effort`
est calculé à côté de la charge, lissé de la même façon, et affiché en télémétrie
sous elle. Le fondu entre familles et le relief de charge le lisent ; la boîte
continue de lire la charge, et **rien de ses seuils n'a bougé** — les 535 tests
passent, dont ceux de la boîte, qui étaient le garde-fou du lot.

Mesuré au banc, en mode « positions GPS », profil Route :

| Situation | Charge (boîte) | Effort (son) | Relief de charge |
|---|---|---|---|
| Arrêt, au ralenti | 0,50 | 0,00 | −4,0 dB |
| 30 km/h tenu | 0,52 | 0,07 | −3,4 dB |
| 50 km/h tenu | 0,54 | 0,15 | −2,8 dB |
| 90 km/h tenu | 0,51 | 0,26 | −1,9 dB |
| 110 km/h tenu | 0,53 | 0,42 | −0,6 dB |
| 130 km/h tenu | 0,53 | 0,57 | +0,6 dB |
| 110 km/h roue libre | 0,19 | 0,00 | −4,0 dB |
| 130 km/h, reprise douce | — | 0,85 | +2,8 dB |
| Pleine charge | 1,00 | 1,00 | +4,0 dB |

Avant le lot, **toutes** les lignes « tenu » valaient 0 dB : la croisière était
plate d'un bout à l'autre. Elle s'étage maintenant sur 3,4 dB entre 50 et
130 km/h, et une reprise douce à 130 passe 2,2 dB au-dessus de la croisière à la
même vitesse.

`idleLevelDb` est recalé en conséquence : −5 → −1 sur Route, −5 → 0 sur Sport,
soit exactement le relief que l'effort nul retire désormais au ralenti.

### Ce qui n'a pas pu être chiffré, et pourquoi

Le tableau en **niveaux acoustiques absolus** de la spec n'a pas été refait. Il
demande le niveau efficace de chaque échantillon, et les échantillons vivent dans
un volume du NAS. Une tentative de le remplacer par la somme des gains de couches
a donné un résultat absurde — une reprise douce sortant *sous* la croisière — et
la raison vaut d'être retenue : **les couches « pied levé » portent un gain de 3
là où les couches « en charge » portent 1**, parce qu'elles ont été enregistrées
plus doucement. Comparer des gains sans les niveaux qu'ils multiplient ne veut
donc rien dire.

Le relief de charge, lui, est un facteur global : il se chiffre sans les
échantillons, et c'est ce que donne le tableau.

Conséquence pour le critère « une reprise douce à 130 s'entend 3 dB au-dessus de
la croisière » : le relief en apporte **2,2**, et le reste dépend du fondu de
timbre, qui ne se mesure pas d'ici. À juger à l'oreille ; si l'écart manque,
`loadReliefDb` est le curseur, et c'est un réglage, pas un correctif.

## Ce que l'écoute a montré ensuite : la résistance au roulement manque

Le 5 septembre 2026, en écoutant le son synthétisé, David :

> le ralenti est meilleur, quoiqu'il pourrait être plus « ralenti » — pour
> l'instant c'est la même chose que si je roule à 800 rpm, le son est le même.

C'est exact, et le modèle le dit. L'effort ne porte que deux termes :
l'accélération demandée et la **traînée aérodynamique**, laquelle croît comme le
carré de la vitesse. À basse vitesse ce second terme est négligeable :

| Situation | Effort |
|---|---|
| À l'arrêt, au point mort | 0 |
| À 15 km/h, allure tenue (environ 800 tr/min en première) | **0,007** |

Sept millièmes d'écart sur une échelle qui va jusqu'à un : rien ne peut
s'entendre. Or les deux situations n'ont rien de commun — au point mort le
moteur ne fournit que ses propres frottements, en première il traîne une tonne
huit.

**Ce qui manque est la résistance au roulement.** Elle est à peu près constante,
et elle domine en dessous de cinquante kilomètres à l'heure, là où la traînée ne
vaut rien. Ordre de grandeur : `Crr · m · g` ≈ 0,01 × 1800 × 9,81 ≈ 177 N, contre
3 600 N pour accélérer à la charge pleine du profil Route — soit environ **cinq
pour cent** de l'échelle, présents dès qu'un rapport est engagé et absents au
point mort.

### Deux façons de le prendre, non tranchées

1. **Ajouter le terme de roulement à l'effort**, et mettre l'effort à zéro franc
   au point mort. C'est physique, cela se teste, et le symptôme du ralenti n'est
   qu'un cas particulier du défaut : tenir 30 et tenir 130 souffrent du même
   oubli.
2. **Traiter le ralenti à part** : voiture à l'arrêt, papillon au ralenti pur et
   aucune charge. Plus ciblé, moins de risque de dérégler ce qui est réglé.

La première est recommandée, mais elle **change le son partout** : les profils
sont réglés sur le modèle actuel. C'est à David de trancher, et il ne l'a pas
encore fait.
