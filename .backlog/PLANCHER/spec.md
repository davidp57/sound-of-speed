# PLANCHER — la boîte se décide sur un seul plancher de régime

**Statut :** 🧑 attend David — la règle est livrée en version allégée, il reste
l'écoute en roulant et le nettoyage du format de profil
**Branche :** `feature/plancher`
**Version visée :** à décider

## Le problème

La boîte passe ses rapports trop haut, en redescend toute seule, et rétrograde
sans qu'on le lui demande. Les trois défauts ont été entendus le même soir, le
10 septembre 2026, sur un trajet de 36 minutes en mode Route.

**Elle monte trop haut.** Régime maximum atteint dans chaque rapport, contre le
seuil que le mode Route lui donne :

| Rapport | Seuil Route | Seuil à pleine charge | Observé |
|---|---|---|---|
| 1ʳᵉ | 3 700 | 4 500 | 6 122 |
| 2ᵉ | 3 350 | 4 150 | 3 800 |
| 4ᵉ | 2 950 | 3 750 | 3 675 |
| 5ᵉ | 2 950 | 3 750 | 4 007 |

**Elle fait le va-et-vient.** Dix-neuf alternances d'un rapport à l'autre et
retour, relevées malgré un journal qui n'inscrit le rapport qu'une fois toutes
les dix secondes — c'est donc une borne basse. Douze d'entre elles se produisent
à charge moyenne, entre 40 et 72 km/h.

**Elle rétrograde pour rien.** Les sept autres alternances sont des rétrogradages
forcés, entre 116 et 148 km/h, dont un qui descend de deux rapports. Une relance
ordinaire suffit à les déclencher.

Trois causes distinctes, et une seule racine : **le bas de la plage de chaque
rapport est décrit par plusieurs nombres qui ne s'accordent pas**. Le plancher
de croisière vaut 1 500 tr/min sur ce profil quand le seuil de descente au
régime en vaut 1 820. Chaque rapport a donc une plage de vitesse où la montée en
croisière l'autorise et où la descente au régime le refuse :

| Rapport | La croisière l'autorise dès | La descente le refuse sous |
|---|---|---|
| 3ᵉ | 37,1 km/h | 45,0 km/h |
| 4ᵉ | 49,0 km/h | 59,4 km/h |
| 5ᵉ | 58,6 km/h | 71,2 km/h |
| 6ᵉ | 70,0 km/h | 85,0 km/h |

Les alternances 5ᵉ↔6ᵉ observées sont à 71,9 et 72,0 km/h, les 2ᵉ↔4ᵉ à 48,9, 50
et 52. C'est cohérent avec ces plages sans les prouver : il faudrait le rapport
en continu pour trancher.

## La solution

Un seul nombre gouverne les deux sens : **le régime plancher d'un rapport**,
c'est-à-dire le régime en dessous duquel ce rapport n'a pas sa place.

- **On monte** dès que le rapport suivant tournerait au-dessus de ce plancher.
- **On descend** quand le rapport engagé tombe en dessous d'un plancher un peu
  plus bas, ce qui donne l'hystérésis.

Le plancher se compose du ralenti du moteur et d'une marge, et c'est cette marge
— et elle seule — qui porte le tempérament : le mode l'ajuste, la charge la
déplace. Plus on demande, plus on laisse monter dans les tours, comme une vraie
boîte automatique.

Ce que cela apporte au-delà du réglage : le critère porte sur le régime du
rapport **visé**, donc il s'adapte de lui-même à l'étagement de la boîte. Un
saut court et un saut long ne reçoivent plus le même seuil. Et la contradiction
entre montée et descente devient impossible à écrire, puisqu'un seul nombre les
gouverne.

Idée de David, le 10 septembre 2026 : « on peut passer le rapport suivant dès
lors que les RPM dans ce rapport seraient supérieurs au ralenti plus une marge ;
en fonction de l'agressivité du mode, on ajuste la marge ; en fonction de la
charge, on ajuste la marge ».

## Récits d'usage

1. En tant que conducteur en ville, je veux que la boîte prenne un rapport long
   dès qu'il tient, pour que le moteur ne hurle pas à 40 km/h.
2. En tant que conducteur qui démarre, je veux passer la deuxième dès qu'elle
   est tenable, pour ne pas rester en première jusqu'à 30 km/h.
3. En tant que conducteur qui accélère franchement, je veux que la boîte garde
   les rapports plus longtemps, pour entendre le moteur travailler.
4. En tant que conducteur en mode Route, je veux une conduite calme, pour que
   l'application se fasse oublier sur un trajet ordinaire.
5. En tant que conducteur en mode Sport, je veux que les rapports tiennent
   jusque haut dans la plage, pour que le mode s'entende immédiatement.
6. En tant que conducteur qui tient une vitesse stable, je veux que le rapport
   ne change plus, pour ne pas entendre un va-et-vient permanent.
7. En tant que conducteur qui roule à 72 km/h, je veux que la boîte choisisse
   un rapport et s'y tienne, pour que l'application ne trahisse pas sa nature.
8. En tant que conducteur qui lève le pied, je veux que la boîte ne monte pas un
   rapport de plus, pour que le son suive ce que fait la voiture.
9. En tant que conducteur qui ralentit, je veux que la boîte rétrograde assez
   tôt, pour entendre le frein moteur travailler.
10. En tant que conducteur qui ralentit doucement, je veux que ce rétrogradage
    ne déclenche pas un yoyo, pour que la descente se fasse rapport par rapport.
11. En tant que conducteur qui relance sur autoroute, je veux que la boîte reste
    sur son rapport, pour qu'une reprise ordinaire ne provoque pas de
    rétrogradage.
12. En tant que conducteur qui écrase l'accélérateur, je veux que la boîte aille
    chercher le couple, pour que la reprise s'entende.
13. En tant que conducteur en mode Route, je veux que ce rétrogradage forcé reste
    exceptionnel, pour qu'il garde son effet.
14. En tant que conducteur en mode Sport, je veux qu'il se déclenche plus
    volontiers, pour que le mode change vraiment la conduite.
15. En tant que conducteur, je veux que le moteur ne sonne jamais comme une
    fréquence pure, pour entendre une machine et non un oscillateur.
16. En tant que conducteur, je veux que l'irrégularité du moteur ne fasse pas
    changer les rapports au hasard, pour que la boîte reste prévisible.
17. En tant que conducteur, je veux que les cadrans restent lisibles d'un coup
    d'œil, pour ne pas quitter la route des yeux.
18. En tant que propriétaire d'un profil enregistré, je veux qu'il continue de
    fonctionner après la mise à jour, pour ne pas avoir à le refaire.
19. En tant que David réglant un profil, je veux un seul nombre par mode plutôt
    que six réglages, pour savoir ce que je déplace.
20. En tant que David essayant un moteur différent, je veux que la boîte s'y
    adapte, pour que changer de moteur change la conduite.
21. En tant que David en train de mettre au point, je veux pouvoir couper
    l'irrégularité du régime en roulant, pour juger de son effet.

## Décisions de conception

### Le plancher de montée

Le rapport suivant est engagé dès que le régime qu'il donnerait dépasse le
plancher de montée. Ce plancher vaut **le ralenti du moteur plus une marge**,
et la marge dépend du mode de conduite et de la charge : plus on demande, plus
elle grandit.

Sur le V8 du profil Route — ralenti 800, marge de départ 900, doublée à pleine
charge — les passages se placent ainsi :

| Passage | En croisière | Pied dedans |
|---|---|---|
| 1ʳᵉ → 2ᵉ | 2 957 tr/min (28,0 km/h) | idem, voir ci-dessous |
| 2ᵉ → 3ᵉ | 2 554 (42 km/h) | 3 904 (64 km/h) |
| 3ᵉ → 4ᵉ | 2 246 (56 km/h) | 3 434 (85 km/h) |
| 4ᵉ → 5ᵉ | 2 032 (66 km/h) | 3 109 (102 km/h) |
| 5ᵉ → 6ᵉ | 2 033 (79 km/h) | 3 110 (121 km/h) |

La courbe descend d'elle-même, sans qu'on l'écrive : c'est la philosophie que le
mode Route affichait dans cinq nombres sans jamais la dire.

**Les marges de départ ne sont pas arrêtées.** 900 en Route et 2 200 en Sport
sont des points de départ calculés pour retomber sur les seuils actuels du
premier passage ; ils se règlent à l'oreille et ce lot ne prétend pas les
trancher.

### Le premier passage échappe à la règle

Décision de David : « on passe la deuxième dès qu'on peut, sans attendre, quelle
que soit la charge et le mode ». Le plancher du passage 1ʳᵉ → 2ᵉ vaut donc
**810 tr/min en absolu** — ni marge de mode, ni effet de la charge, ni tirage au
sort. Sur le profil Route, la première cède à 13,3 km/h et 1 409 tr/min.

Conséquence connue et acceptée : en Sport pied au plancher, la première cède au
même endroit. Si cela sonne mou à l'écoute, c'est ce nombre-là qui bouge, et lui
seul.

Cette règle ne contredit pas le correctif du 10 septembre au matin, qui avait
retiré le passage imposé à la vitesse de lancement : le défaut d'alors était que
la deuxième tombait **sous le ralenti** — 486 tr/min à 8 km/h. Le plancher est
précisément ce qui l'interdit.

### Le plancher de descente, et l'hystérésis

On rétrograde quand le régime du rapport engagé tombe sous un plancher de
descente, plus bas que le plancher de montée. La marge de descente dépend du
mode et de la **décélération** : plus on ralentit fort, plus elle remonte, donc
plus on rétrograde tôt — c'est ce qui donne l'impression du frein moteur.

L'hystérésis se démontre au lieu de se régler : après une montée, le rapport
engagé tourne au-dessus du plancher de montée, donc au-dessus du plancher de
descente, donc il ne peut pas être rendu aussitôt. La réciproque tient de la
même façon. C'est un invariant à tester, pas un compromis à trouver.

### Ce qui disparaît

- **La montée en croisière** — `cruiseMinRpm`, `cruiseUpshiftAfterS` : le
  plancher de montée fait déjà entrer le rapport long quand il tient.
- **Le déclencheur séparé de rétrogradage au freinage** —
  `brakeDownshiftAccelMs2` : le plancher de descente, modulé par la
  décélération, couvre le même besoin. Un mécanisme au lieu de deux, donc pas de
  contradiction possible entre eux.
- **Les seuils de montée en tours et leurs correctifs** — `upshiftRpm`,
  `upshiftLoadSpreadRpm`, `minUpshiftRpm`, `downshiftAtRedlineRatio`.

Six réglages quittent le profil, remplacés par deux marges par mode. Le format
de profil monte donc de version, avec conversion des profils déjà enregistrés —
sans double lecture : on convertit, on ne maintient pas deux formes.

### Ce qui reste

- **Le tirage au sort du seuil** (`upshiftJitterRpm`, ±120 tr/min tirés à chaque
  intention de passage) : deux passages identiques ne doivent pas sonner
  identiques. **Sauf pour le premier passage**, qui est déterministe.
- **La courbe par mode** garde son rôle, mais elle ne porte plus cinq fractions :
  une marge de montée et une marge de descente par mode.

### Le rétrogradage forcé

Il reste, et il doit redevenir exceptionnel. Deux corrections.

**Le seuil de charge dépend du mode**, et non plus du profil : **0,95 en Route**
— pied au plancher — et **0,85 en Sport**. Ces valeurs sont sur l'échelle réelle
de la charge, qui n'est pas une position de pédale : faute de pédale, la charge
est déduite de l'accélération et **centrée sur 0,5**.

| Charge | Accélération, profil Route | Part du trajet du 10 septembre |
|---|---|---|
| 0,0 | −2 m/s², freinage appuyé | 5 relevés sur 218 |
| 0,5 | 0 m/s², croisière | la médiane exacte |
| 0,70 | +0,8 m/s², relance ordinaire | 23 relevés, 11 % |
| 0,95 | +1,8 m/s² | 6 relevés, 3 % |

C'est ce tableau qui fixe les valeurs : un seuil à 0,70 se franchirait onze fois
sur cent, ce qui n'a rien d'exceptionnel.

**Le nombre de rapports abandonnés** se déduit du régime recherché, lequel
dépend de la vitesse — donc des rapports disponibles —, de la charge et du mode.
Il n'est pas plafonné par un réglage de profil.

Corollaire à ne pas oublier : « on ne rétrograde jamais en croisière » ne peut
pas s'écrire « à charge nulle ou presque », puisque la charge nulle est le
freinage. La croisière est la bande **autour de 0,5**.

### L'irrégularité du régime

Un moteur réel n'est pas régulier, et cette irrégularité doit vivre dans le
moteur — on calcule le régime depuis la vitesse et le rapport, on lui ajoute le
tremblement, et c'est le régime tremblé qui produit le son. Décision de David :
c'est une propriété de la machine, pas une décoration du son ; elle doit donc
survivre au changement d'origine du son.

Il existe aujourd'hui **deux** mécanismes pour cela, et il n'en restera qu'un :

- dans le moteur, une somme de trois sinusoïdes de rapports irrationnels, réglée
  par `flutterRpm` et `flutterHz` — quasi-périodique ;
- dans la synthèse, un bruit blanc filtré passe-bas, réglé en amplitude et en
  vitesse de dérive — vraiment irrégulier, et voué à disparaître avec la
  synthèse.

C'est le **second signal** qu'on garde, avec les réglages du premier. Le lot
DELISSER a mesuré que l'ondulation régulière ne change rien au spectre et que
seule l'irrégularité compte : 46,3 % de l'énergie dans les cinquante plus
grandes raies sans elle, 35,1 % à quarante tours d'amplitude.

**La boîte continue de voir le régime net.** Le tremblement ne va que dans le
régime entendu. Sans cela, il ferait franchir les seuils de passage au hasard,
alors que le tirage au sort existe déjà pour cela, à un seul endroit et
explicitement.

**L'aiguille du compte-tours : à trancher en roulant**, par une bascule.
L'amplitude actuelle donne un mouvement de 0,18° à 0,60° selon le régime et la
charge, soit de l'ordre du pixel au bout de l'aiguille : il n'y a probablement
rien à voir, mais le rafraîchissement de l'écran peut transformer une
oscillation d'un pixel en scintillement. Cela se mesure en regardant, pas en en
discutant.

## Décisions de test

**Un seul point d'attache, le plus haut possible** : on fournit des positions
fabriquées à l'entrée de la chaîne, et on relève les passages de rapport à la
sortie. `GpsBench` sait déjà produire la cadence de la voiture et traverse la
vraie source de géolocalisation ; il n'a jamais été branché sur la boîte. Il le
sera : positions → source → conditionneur → moteur → boîte, et on compte les
passages. C'est la seule façon de juger la boîte sur un signal **bruité**, ce
qui est précisément la condition dans laquelle elle a échoué.

Le banc existant de `gearbox.test.ts` — qui fournit directement à la boîte le
régime qu'aurait le moteur dans chaque rapport — reste pour les cas
déterministes : il est plus rapide et plus précis pour vérifier un seuil.

Ce qui fait un bon test ici : il porte sur ce qu'on **entend** — à quel régime
un passage se produit, combien de passages sur un trajet, dans quel rapport on
se trouve à telle vitesse — et jamais sur la façon dont la boîte s'y prend.

Ce qu'il faut couvrir :

- **L'hystérésis, comme invariant** : sur une plage de vitesses balayée
  finement, aucun rapport engagé ne peut être rendu au tour suivant. C'est la
  démonstration que la contradiction du plancher de croisière ne peut plus se
  produire.
- **Les vitesses tenues** : à vitesse stable, sur toute la plage praticable,
  zéro passage après stabilisation. Les 72 km/h qui ont produit le va-et-vient
  sont un cas nommé.
- **Le premier passage** : la deuxième est engagée au plancher absolu, quels que
  soient le mode et la charge, et jamais sous le ralenti.
- **Les deux modes sur le même trajet** s'entendent comme deux conduites, et
  Route passe systématiquement plus bas que Sport.
- **Les quatre moteurs de la bibliothèque** gardent des passages proportionnés à
  leur rupteur — l'acquis du ticket REFONTE/02 ne doit pas se perdre.
- **Le rétrogradage forcé** ne se déclenche pas sur une relance ordinaire, et se
  déclenche pied au plancher.
- **La conversion des profils enregistrés** : un profil à l'ancien format donne
  une boîte au comportement voisin, et le format monté ne se relit pas à
  l'ancienne.
- **L'irrégularité du régime** : le régime entendu n'est jamais une valeur
  répétée à l'identique, le régime que voit la boîte l'est.

Prior art : `gearbox.test.ts` pour le banc de boîte et sa façon de relever les
régimes de passage, `gps-bench.test.ts` pour la fabrication de positions,
`conditioner.test.ts` pour l'épreuve d'un signal à la cadence réelle du GPS.

## Hors périmètre

- **L'unification de la notion de mouvement**, qui est le lot
  [MOUVEMENT](../MOUVEMENT/spec.md) et doit passer avant : ce lot-ci s'appuie
  sur « accélère / tient / ralentit », il ne le redéfinit pas.
- **Le journal des passages de rapport**, qui rendra la prochaine écoute
  exploitable mais ne fait pas partie de la boîte.
- **L'accéléromètre du téléphone** comme source d'accélération mesurée : c'est
  une inconnue à relever en roulant, notée dans REFONTE.
- **Le son du passage lui-même**, jugé correct par David.
- **Le retrait de `BENCH=1` de l'image d'intégration**, indépendant.

## Ce qui est livré, et ce qui ne l'est pas

Livré le 10 septembre 2026 au soir, en version **allégée** — le format de profil
n'a pas bougé, pour que la règle soit essayable dès le lendemain :

- le plancher de montée, réglé par le mode et la demande ;
- le premier passage à 810 tr/min en absolu, sans mode, sans charge, sans tirage
  au sort ;
- le plancher de descente, qui remonte avec la décélération et reste sous celui
  de montée ;
- le rétrogradage forcé au seuil du mode ;
- la montée en croisière et la descente au freinage supprimées.

Pas encore fait :

- **le nettoyage du format de profil.** Les six réglages sont toujours là et ne
  commandent plus rien ; le README le dit ligne par ligne. La montée de version
  et la conversion restent à faire.
- **l'irrégularité du régime**, à fusionner en un seul mécanisme dans le moteur.
- **les marges elles-mêmes**, qui sont des points de départ.

## Notes

**Un excès sans cause établie.** La première tenue à 6 122 tr/min dépasse de
1 600 tours le seuil le plus permissif qu'elle pouvait avoir. Deux candidats : le
régime inscrit serait celui du moteur pendant un passage, l'embrayage restant
ouvert 600 ms sur ce profil, ou la montée serait inhibée par le compteur de
ralentissement sur une accélération bruitée. Le journal ne permet pas de
trancher. La nouvelle règle peut faire disparaître le symptôme sans que la cause
soit connue : il faudra le vérifier plutôt que le supposer.

**Un piège déjà exploré, à ne pas rouvrir.** Moduler le régime à la fréquence
d'allumage a été écrit, mesuré et jeté : les bandes latérales tombent sur les
harmoniques voisines, donc l'énergie reste sur la même grille — 46,3 % contre
45,4 %. C'est contre-intuitif et quelqu'un le reproposera.

**Ce qui reste à régler à l'oreille**, et que ce lot n'invente pas : les deux
marges de chaque mode, la façon dont la charge les déplace, et le régime
plancher du premier passage. Le lot livre la règle et les points d'attache pour
la juger ; les nombres viennent en roulant.
