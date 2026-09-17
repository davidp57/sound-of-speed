# DELISSER — un régime qui ne soit pas une fréquence pure

**Statut :** ✅ validé en roulant le 16 septembre 2026 — David : « le ralenti est bien, et sera encore mieux avec un meilleur battement ». Ce battement est le ticket [ESSAI-16/09](../ESSAI-16/tickets/09-tremblement-ampute-au-ralenti.md)
**Branche :** `feature/delisser-le-regime`
**Version visée :** 0.1.69

## Ce qui a déclenché

L'essai du 8 septembre 2026, et la traque qui a suivi. Le son de la synthèse
« sonne faux, synthétique, trop propre, une fréquence trop simple » dès qu'on
roule, alors qu'il tient au ralenti.

**Le cas se reproduit en trois secondes**, David le 8 septembre : profil EJ25, à
85 km/h maintenus — 1 820 tr/min en cinquième. « La fréquence est vraiment très
stable et trop pure, on dirait un oscilloscope. Sur un V8 ça bouge un peu plus. »
Le quatre cylindres a moitié moins de sources qui se superposent que le V8, d'où
l'écart entre les deux.

C'est David qui a nommé le besoin : « il faut un mécanisme pour délisser les
RPM ».

## La cause, établie

Le régime tenu par le moteur simulé est **exactement** le régime demandé — 780
pour 780, 2 952 pour 2 952, mesuré au banc. Le dynamomètre d'engine-sim tient la
vitesse par une **contrainte du solveur** (`m_dyno.m_hold`, `probe.cpp`), résolue
à chaque pas : l'ondulation du vilebrequin entre deux explosions est écrasée par
construction. Un régime rigoureusement constant donne un signal rigoureusement
périodique.

## Trois leviers essayés, trois échecs

- **La fréquence de simulation.** Portée de 10 à 20 kHz, à régime égal : le
  spectre ne s'enrichit pas, et le calcul tombe sous le temps réel avec des
  creux. Écarté par la mesure.
- **Le couple du dynamomètre.** Balayé de 10 000 à 20 livres-pied : jusqu'à 40
  le régime tenu vaut exactement le demandé, puis il s'établit plus bas — 2 728,
  2 576, 2 435 — et chaque fois aussi figé. Le dyno sature et trouve un nouvel
  équilibre ; il n'oscille jamais. Le réglage a été exposé puis retiré le jour
  même.
- **La gigue d'échantillonnage d'engine-sim.** David : « ça ajoute juste un bruit
  blanc désagréable, une friture sur la ligne, mais ça ne change pas les RPM ».
  Le code lui donne raison : `JitterFilter` est une ligne à retard dont la
  position de lecture est tirée au sort puis filtrée — elle floute le signal
  audio en sortie, le moteur tourne exactement pareil.

Reste acquis de cette traque : le régime **entendu**, celui qui porte le
tremblement, est désormais transmis au moteur simulé. C'est le seul délissage en
place, et il est trop faible — le tremblement décroît fortement avec le régime,
justement là où le défaut s'entend.

## Ce qui a été livré

**La sonde d'abord**, parce que rien ne mesurait ce dont on parlait. L'ondulation
du vilebrequin est relevée à chaque pas de simulation dans le WebAssembly, et
remontée à l'écran de synthèse. Elle a immédiatement tranché : **exactement zéro**
à tous les régimes tant que le dynamomètre tient, et 6 à 16 tr/min seulement —
0,13 à 0,25 % — quand on le desserre assez pour qu'il lâche le régime. Le
dynamomètre visqueux ne valait donc pas le travail : même libre, engine-sim
n'ondule presque pas.

**Puis le mécanisme**, et il a fallu s'y reprendre. Une ondulation régulière calée
sur la fréquence d'allumage a été écrite, mesurée, et jetée : elle ne change rien
au spectre — 46,3 % de l'énergie dans les cinquante plus grandes raies sans elle,
45,4 % avec quarante tours d'amplitude. La raison est arithmétique : moduler à la
fréquence d'allumage place les bandes latérales exactement sur les harmoniques
voisines, donc l'énergie reste sur la même grille.

Ce qui manquait n'était pas une ondulation mais de l'**irrégularité**. Un bruit
blanc filtré passe-bas module le régime, à chaque pas de simulation. Mesuré à
1 820 tr/min sur quatre cylindres :

| amplitude | 50 raies | centroïde |
|---|---|---|
| 0 | 46,3 % | 1 793 Hz |
| 10 | 42,8 % | 1 672 Hz |
| 20 | 39,1 % | 1 585 Hz |
| 40 | 35,1 % | 1 385 Hz |

Deux réglages dans l'écran de synthèse, applicables sans couper le son :
l'amplitude en tours par minute et la vitesse de dérive en hertz. Livrés à
quinze et quinze, une estimation à juger à l'oreille. Zéro rend le comportement
d'avant.

L'amplitude est en tours et non en pourcentage : l'énergie d'une explosion et
l'inertie du volant ne dépendent pas du régime, si bien qu'une amplitude
constante donne d'elle-même une part qui décroît quand le moteur monte.

## Les deux voies, telles qu'elles avaient été posées

**a) Moduler la consigne, plus fort et plus vite.** Le tremblement existe déjà
(`core/engine/engine.ts`, trois sinusoïdes dont deux à rapport irrationnel) ;
il lui faudrait sa propre amplitude pour la synthèse et une atténuation en régime
moins brutale. Tout en JavaScript, réglable à chaud, essayable le soir même.

**Sa limite est dure et se calcule** : la consigne n'est posée qu'une fois par
bloc rendu. À 1 024 échantillons et 48 kHz, un bloc dure 21 ms — on ne peut donc
pas moduler au-delà d'environ 45 Hz, et il en faudrait 61 pour suivre les
explosions d'un quatre cylindres à 1 820 tr/min, 121 pour un V8. Descendre le
bloc à 256 monterait le plafond vers 90 Hz, contre du temps de calcul. Cette voie
ne reproduit donc pas l'explosion individuelle : elle casse la périodicité, ce
qui peut suffire.

**b) Un dynamomètre visqueux, côté C++.** Remplacer la contrainte de vitesse par
un couple de rappel proportionnel à l'écart : le vilebrequin oscillerait entre
les explosions tout en tenant la consigne en moyenne. C'est la réponse
physiquement juste, et la seule qui produise la vraie ondulation. Elle demande de
toucher `native/probe.cpp`, de vérifier ce que le solveur d'engine-sim permet, et
de republier le WebAssembly.

## Ce que l'oreille a réglé

David, le 8 septembre 2026, après essai : « délissage à 60 rpm, 1,5 Hz : c'est
mieux ». Ce sont donc les valeurs livrées — dix fois plus lent et quatre fois
plus large que l'estimation de la veille. Le chiffre ne pouvait pas les trouver.

Son verdict sur ce qui reste est net, et déplace le sujet : « la fréquence reste
trop pure, c'est plus une question de **son** que de moteur (pour l'EJ25) ».
Ce n'est donc plus le régime qu'il faut travailler, mais le rendu — et l'EJ25
est justement l'un des moteurs qui n'en a pas de réglé : il porte le rendu par
défaut, c'est-à-dire l'échappement d'un V8 Chevrolet 454 à cent pour cent de son
réverbéré. Piste ouverte, non instruite.

## Le son pied levé, mesuré le 8 septembre 2026

David a relié ce qu'il entend à un chiffre de l'écran : « la fréquence que je
n'aime pas arrive plus ou moins quand la brillance monte au-dessus de 0,45-0,50,
au ralenti et en décélération ». Le rapprochement est juste, et la mesure le
suit — la brillance est la racine du rapport entre l'énergie au-dessus d'un
kilohertz et l'énergie totale, relevée sur le son sec, avant l'échappement.

| régime | effort | brillance |
|---|---|---|
| 780 | 0 | **0,504** |
| 780 | 0,1 | 0,470 |
| 2 000 | 0 | 0,425 |
| 2 000 | 0,3 | 0,470 |
| 3 000 | 0 | 0,444 |
| 3 000 | 0,5 | 0,388 |

**Ce n'est pas une raie parasite qui s'ajoute, c'est le grave qui s'en va.**
Part de l'énergie par bande, V8 à 780 tr/min :

| | 125 | 250 | 500 | 1 000 | 1 400 | 2 000 |
|---|---|---|---|---|---|---|
| pied levé | 12,5 | 18,7 | 13,2 | **21,6** | **22,6** | 9,3 |
| un peu de gaz | 1,9 | 24,9 | 21,6 | 24,0 | 18,5 | 7,0 |

Papillon fermé, il n'y a presque pas de combustion : il reste le pompage d'air,
qui n'a pas de corps. Les deux bandes de 1 et 1,4 kHz portent alors 44 % de
l'énergie.

**Le papillon au repos déplace cela, un peu.** Porté de 0,06 à 0,35 au ralenti :
la bande de 1,4 kHz passe de 22,6 à 18,9 %, celle de 250 Hz de 18,7 à 24,8 %.
Mais en décélération à 2 000 tr/min il agit **à l'envers** : le 125 Hz tombe de
60,6 à 35,7 % quand on l'ouvre à 0,20, parce qu'ouvrir les gaz pied levé n'est
plus une décélération.

Trois leviers ont été proposés, et David les a essayés le jour même. Aucun ne
tient, et l'un d'eux **contredit la mesure** :

- **le papillon au repos** : « à 0,35 j'ai la fréquence parasite qui augmente
  considérablement, et ça écrête ». Le banc dit l'inverse — la bande de 1,4 kHz
  y descend de 54,0 à 51,3 dB en niveau absolu, et l'écrêtage reste sous un
  dixième de pour cent. C'est le banc qui a tort : il tourne sur la définition
  d'usine, pas sur le GM LS à collecteur long que David écoute, et il mesure le
  son **sec**, avant la résonance d'échappement et le silencieux. La chaîne de
  sortie n'a jamais été mesurée ;
- **le silencieux** : « effectivement, "dedans" assourdit le son donc on entend
  moins la fréquence parasite ». Il masque, il ne corrige pas ;
- **le bruit d'air** : « aucune différence ; il est branché quelque part, ce
  curseur ? ». Il l'est — `renderAudio` relit `airNoise` à chaque échantillon —
  mais son effet est mince par construction : à 0,15 le facteur `airNoise * r +
  (1 - airNoise)` oscille entre 0,70 et 1,00, et le niveleur rattrape ce qui
  reste. Mesuré au ralenti, de 0 à 1 sur toute la course du curseur : 1,2 dB
  d'écart sur la bande du kilohertz. « Aucune différence » est une observation
  juste.

**Ce que cet épisode a montré, et qui vaut pour la suite : le banc ne mesure pas
ce que David écoute.** Il rend le son sec, sur le moteur d'usine, sans la
convolution ni le silencieux qui suivent dans le graphe. Toute mesure de timbre
qui prétend expliquer une écoute doit d'abord passer par la chaîne complète.

## Le « frt frt frt » : la sortie écrête, et rien ne le dit

David, le 8 septembre 2026 : « les fréquences qui me dérangent sont comme des
parasites, des frt frt frt à plus haute fréquence que le moteur, et avec ces
réglages on les entend très bien au ralenti ».

Le banc passé par la chaîne complète donne, Chevrolet 454 au ralenti :

- écrêtage sur le son sec : **0,03 %** ;
- crête **en sortie de chaîne : 1,194**, et 0,02 % des échantillons au-delà du
  plafond.

La résonance d'échappement ajoute seize décibels à la bande de 500 Hz : le
signal, déjà collé au plafond en sortie du lecteur, le dépasse de près de vingt
pour cent une fois la chaîne traversée. Le contexte audio le borne, et un
écrêtage bref est riche en aigu — « à plus haute fréquence que le moteur ».

**Rien ne le mesure.** Le niveau crête et le compteur d'écrêtage de l'écran sont
relevés dans le lecteur (`player-source.ts`), donc **avant** le silencieux et la
convolution. L'écran annonce 1,000 quand la sortie est à 1,194 : il montre le
plafond du son sec, pas celui qu'on entend.

Cela explique aussi le rapprochement que David avait fait avec la brillance : un
écrêtage engendre des harmoniques hautes, donc la part d'énergie au-dessus d'un
kilohertz monte avec lui. La brillance ne causait rien, elle signalait.

**Les deux, tranché par David le 8 septembre 2026, et livrés.** Un moniteur
placé tout au bout de la chaîne relève la crête et l'écrêtage réels — deux
lignes de plus à l'écran, *Crête en sortie* et *Écrête en sortie*. Et la sortie
garde deux décibels de marge sous le plafond : à 1,194 de crête mesurée, cela
ramène le cas à 0,95. Vérifié dans le navigateur, une fois branché : crête au
lecteur 0,916, crête en sortie 0,838, écrêtage nul, temps réel ×1,70 et aucun
creux — le moniteur ne coûte rien.

## Le « frt frt frt » : c'était la gigue d'échantillonnage

**Trouvé le 8 septembre 2026, après sept hypothèses fausses.** `inputSampleNoise`
n'est pas un tremblement de moteur : c'est une ligne à retard dont la position de
lecture est tirée au sort à chaque échantillon. Elle ne fait pas vibrer le
moteur, elle **crépite**.

Mesuré sur le GM LS au ralenti, ce que la valeur portée par le projet — 0,05,
jugée à l'oreille le 6 septembre sans être mesurée — ajoute à l'aigu :

| bande | 4 000 | 5 600 | 8 000 |
|---|---|---|---|
| gigue 0 | 30,8 | **20,2** | **6,5** |
| gigue 0,05 | 31,7 | **28,9** | **32,0** |

Vingt-cinq décibels à huit kilohertz. Verdict de David sur les deux sons
égalisés en niveau : « c'est bon, le claquement est supprimé ».

**Ce qui a permis de le trouver, et qui vaut pour la suite.** Six analyses
successives n'ont rien vu : détecteur de grain, spectre par bandes, cadence des
salves, autocorrélation, position des ruptures dans les blocs, pompage du
niveleur. Ce qui a marché est de **rendre le son en fichier** et de le découper
en quatre bandes pour que David dise dans laquelle il l'entend. Il a répondu
« l'aigu », et le code désignait alors un seul coupable pour cette bande.

Deux erreurs de méthode ont failli faire manquer la cible, toutes deux du même
genre : **normaliser efface ce qu'on cherche à montrer**. Les bandes envoyées
étaient remontées chacune à sa propre crête — ×9,7 avec la gigue, ×28,1 sans —
donc précisément la différence à faire entendre. « Ils sont identiques », a
répondu David, et il avait raison. Le son complet, égalisé en niveau global, a
tranché du premier coup.

## Ce que la capture a permis, et ce qui reste du cliquetis

Le bouton de capture, livré le soir même, a tranché ce que six analyses n'avaient
pas su trancher : le son que l'application produit est **très proche** de celui
du banc — 31 ruptures fortes contre 26, spectres superposables. Le cliquetis
n'est donc pas un artefact du navigateur, du lecteur ou de la carte son. Sans cet
outil, la traque continuait à l'aveugle.

Restaient, après la gigue : des bouffées d'aigu, 4,5 par seconde dans la capture
réelle et 4,0 au banc, +6,4 dB à 8 kHz pendant la bouffée alors que le grave ne
bouge pas. Écartés par la mesure, chacun testé dans les conditions du jour :
le délissage (4,0 sans, 4,9 avec), le correcteur de charge (l'effort était nul),
les trames du worklet, les blocs du WASM, le niveleur.

Elles viennent du moteur simulé. Faute de savoir les supprimer à la source, le
point d'écoute « Dehors » cesse de les laisser sortir : le silencieux y referme à
4 kHz au lieu de 22 000. Treize décibels de moins à 8 kHz, aucune bande utile
déplacée, ruptures de 126 à 86. David : « c'est mieux, même si c'est pas encore
parfait ».

**Ce qui n'est donc pas résolu** : la source de ces bouffées, dans engine-sim au
ralenti. Le remède actuel les masque.

## Ce qui reste

1. **le rendu de l'EJ25**, et de tous les moteurs qui portent encore le rendu par
   défaut — un quatre cylindres à plat joué à travers la réponse d'un gros V8 ;
2. si l'amplitude doit s'atténuer sous charge, comme le fait le tremblement des
   échantillons — un moteur en charge tremble moins qu'à vide ;
3. la voie a) telle qu'elle avait été posée — la modulation lente côté
   JavaScript — n'a pas eu à être élargie : le régime **entendu**, qui porte le
   tremblement, est transmis au moteur simulé depuis le 8 septembre, et le
   délissage travaille maintenant par-dessus, à une cadence que le JavaScript ne
   pouvait pas atteindre.
