# 04 — Le son sort, et suit le régime

**Statut :** 🧑 attend David — le son sort et suit le régime ; le timbre est à
juger à l'oreille, et un défaut du modèle est relevé plus bas.

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

## Comment c'est fait

**Trois fils, et le calcul n'est pas dans le fil audio.** Faire tourner le
WebAssembly dans l'`AudioWorklet` serait plus direct — c'est ce que demande
l'énoncé —, mais ce n'est pas possible ici : un module Emscripten ne s'instancie
pas dans un `AudioWorkletGlobalScope` (ni `fetch`, ni chargement asynchrone), et
l'option `AUDIO_WORKLET` d'Emscripten passe par des fils WebAssembly, donc par
`SharedArrayBuffer`, donc par les en-têtes COOP/COEP que la spécification du lot
a explicitement écartés — le NAS ne les sert pas.

Le partage retenu :

- le **fil principal** transmet, à chaque tour de la boucle de Speed, le régime
  du cadran et l'effort (`src/state.ts`) ;
- le **calculateur** (`src/core/synth/renderer-source.ts`) fait tourner
  engine-sim dans un `Worker` et remplit une réserve, bloc par bloc ;
- le **lecteur** (`src/core/synth/player-source.ts`), dans le fil audio, vide
  cette réserve et compte ce qui manque.

Ce que le détour rapporte : **une pointe de calcul mange la réserve au lieu de
faire un trou**. Le fil audio ne fait jamais qu'une recopie. Le calculateur et
le lecteur se parlent par un `MessageChannel` direct, sans repasser par le fil
principal, où un rendu de Vue s'intercalerait.

**Le régime est imposé au dynamomètre**, comme le ticket le tranchait
(`m_dyno.m_hold`), avec une limitation de pente à 12 000 tr/min par seconde : la
contrainte est rigide et un saut de rapport la secouerait.

**La cadence audio est celle du navigateur.** engine-sim câble 44 100 Hz dans
`Simulator::initializeSynthesizer` ; on ne le patche pas, on détruit le
synthétiseur juste après sa construction et on le réinitialise à la fréquence du
contexte. Rien à rééchantillonner ensuite.

**La résonance d'échappement est déportée** sur un `ConvolverNode` par défaut :
engine-sim la calcule en produit direct, dix mille multiplications par
échantillon, et Web Audio la fait en transformée de Fourier partitionnée.

**L'écran de réglage** est l'onglet *Synthèse*, réservé au développement comme le
simulateur (`import.meta.env.DEV`).

## Ce qui est mesuré

Ryzen 7 7800X3D, Chrome, contexte audio à 48 kHz, l'application entière
tournant à côté, machine par ailleurs au repos. Coefficient temps réel = secondes
de son produites par seconde de processeur, relevé par fenêtres de 250 ms.

| Réglage | Temps réel | Creux |
|---|---|---|
| V8 croisé, 10 kHz, convolution déportée | ×1,95 à ×2,06 | 0 |
| V8 croisé, 10 kHz, convolution interne à 10 000 | ×0,95 | 0 |
| V8 croisé, 20 kHz, convolution déportée | ×1,02 à ×1,08 | 0 |
| 4 cylindres, 10 kHz, convolution déportée | ×3,60 à ×3,85 | 0 |
| 4 cylindres, 20 kHz, convolution déportée | ×1,96 à ×2,04 | 0 |

Trois choses s'en lisent. Déporter la convolution **double** le débit — c'est le
seul réglage qui fasse passer le V8 nettement au-dessus du temps réel, et il
confirme la mesure native. Doubler la fréquence de simulation **divise le débit
par deux**, exactement : le coût est celui des pas de physique. Et le quatre
cylindres coûte **la moitié** du huit, ce qui reprend la proportionnalité au
nombre de cylindres déjà relevée en natif.

Rapporté au seuil du lot — ×3 dans la voiture, un poste que celui-ci n'est pas —
un seul de ces réglages passe ici : le quatre cylindres à 10 kHz.

**Attendre la reconstruction avant de relever.** Trois mesures fausses ont été
prises et jetées avant que la règle soit tenue : le chiffre affiché est celui de
la fenêtre en cours, et un relevé fait deux secondes après un changement de
cylindres mesure encore le moteur d'avant. Huit secondes suffisent.

**Le régime suit exactement.** Balayage du ralenti au rupteur (800 → 6 500
tr/min, aller-retour en 60 s) : l'écart entre le régime demandé et le régime que
le moteur simulé tient est **nul à l'unité près**, sur toute la plage.

**Aucun creux.** Ni à régime tenu, ni pendant un balayage complet, ni pendant un
changement de réglage à chaud. La réserve reste à sa cible, 250 ms, à trois
millisecondes près. Le compte de creux ne démarre qu'au premier bloc reçu : la
construction du moteur, 0,6 à 1,3 s, n'est pas un creux de lecture.

**Le volume par défaut est 0,25, et c'est mesuré.** Le niveleur d'engine-sim vise
une crête de 30 000 sur 32 767 mais son suiveur de crête décroît en vingt
millisecondes — l'intervalle entre deux allumages d'un V8 à 800 tr/min. Le gain
remonte donc entre deux bouffées et la suivante déborde : la crête reste collée à
1,000 jusqu'à un volume de 0,35, et tombe à 0,890 à 0,25. Le facteur de crête
vaut 28.

## Ce qui n'est pas vérifié, et un défaut relevé

- **Le timbre.** Personne ne l'a écouté. C'est le ticket qui le dit : la machine
  ne peut pas juger ce point.

- **L'effort ne fait pas ce qu'il devrait, et c'est mesuré.** À régime tenu,
  niveleur d'engine-sim actif — le réglage par défaut —, passer l'effort de 0 à
  1 change le niveau efficace de 0,055 à 0,062, et la brillance ne bouge pas
  au-delà de la dispersion. Niveleur coupé, la dynamique brute du modèle
  apparaît, et elle est **inversée** : papillon fermé, 0,231 de niveau
  efficace ; papillon grand ouvert, 0,006. Un facteur 38 dans le mauvais sens.
  La brillance, elle, monte bien avec l'ouverture — 0,63 à 0,73 —, donc le
  timbre change ; c'est le niveau qui part à l'envers.

  Le niveau croît normalement avec le régime dans les deux cas (0,006 à 800
  tr/min contre 0,268 à 6 300, papillon ouvert), donc le modèle tourne. Reste
  que sur ce V8 codé en dur, ouvrir le papillon à bas régime rendait
  l'échappement plus discret au lieu de plus fort.

  **C'était la troisième piste : le moteur ne brûlait pas.** Le banc vivant
  coupait le démarreur — « le dynamomètre tient l'arbre, le démarreur ne sert
  donc à rien » — et engageait le dynamomètre sur un moteur à l'arrêt. Le banc
  hors ligne du ticket 05 avait pourtant mesuré l'inverse et corrigé le sien :
  ainsi lancé, le moteur tourne sans jamais s'allumer, la chambre la plus chaude
  plafonne à 530 K et le couple reste négatif. Le son était donc celui du
  **pompage d'air**, et le pompage est plus bruyant papillon fermé qu'ouvert.
  D'où l'inversion, exactement.

  Le démarreur lance maintenant le moteur, dynamomètre coupé, avant que
  celui-ci ne prenne le relais — la même séquence que le banc hors ligne. La
  construction passe de 0,5 à 2,2 secondes, prix du rodage.

  **Remesuré après correction**, à 800 tr/min tenus, niveleur coupé, gain fixe à
  0,05 pour ne pas saturer :

  | Effort | Niveau crête | Niveau efficace | Brillance |
  |---|---|---|---|
  | 0,1 | 0,343 | 0,027 | 0,658 |
  | 0,4 | 0,563 | 0,035 | 0,636 |
  | 0,7 | 0,555 | 0,041 | 0,611 |
  | 1,0 | 0,634 | 0,034 | 0,630 |

  Le sens est rétabli : la crête croît avec l'effort au lieu de s'effondrer.
  **Mais le critère n'est pas tenu pour autant** — l'ampleur reste faible, un
  facteur 1,8 en crête, et la brillance ne monte pas : elle baisse légèrement.
  Or ce qu'on cherche est un spectre qui se remplit quand on ouvre les gaz. Le
  réglage reste à faire, et il se juge à l'oreille.

  Deux pistes toujours ouvertes pour cela : la définition du moteur
  (`native/probe.cpp`, jamais comparée à l'oreille au EJ25 dont elle reprend les
  cotes) et la position de plateau au ralenti (0,9985, là où les moteurs livrés
  avec engine-sim sont autour de 0,975).

  À noter aussi, vu à la mesure : au gain par défaut le signal **sature**, crête
  à 1,000 dès un effort de 0,25. La dynamique disparaît dans l'écrêtage avant
  même d'être entendue.

- **La voiture.** Rien n'a été relevé dans la Tesla. Le seuil du lot est ×3
  temps réel là-bas ; ce poste-ci donne ×2 pour le V8 et ×3,8 pour le quatre
  cylindres.

- ~~**La boucle de l'application n'a pas pu être exercée ici.**~~ Elle l'a été
  depuis, profil « généré en direct » sélectionné, source *Simulateur*,
  régulateur poussé de 0 à 130 km/h. La chaîne se déroule entièrement : 85 km/h
  au troisième rapport, 4 157 tr/min au cadran, **4 157 tr/min entendus, écart
  nul**, ×1,79 temps réel, zéro creux, réserve à 253 ms. Le trajet vitesse →
  rapport → régime → son synthétisé fonctionne de bout en bout.

## Le parasite entendu par David, et sa cause

David, après la première écoute : « le son est pas mal, mais y'a une fréquence
assez aiguë en trop ». Puis, résonance à fond : « on n'entend pas du tout le
moteur, juste le souffle, comme des interférences sur une radio FM ». Et sur un
quatre cylindres : « y'a toujours ce son en trop partout dans la courbe ».

### Ce que la mesure a montré

Spectre du ralenti, en tiers d'octave, silencieux coupé. Deux anomalies, dont
aucune n'apparaît dans une prise faite sur une vraie voiture :

1. un **plateau plat** de 250 Hz à 2 kHz, là où un moteur décroît ;
2. une **remontée de 11 dB** entre 2 et 8 kHz. Un spectre de moteur ne remonte
   jamais dans l'aigu.

### La cause : les deux bruits qu'engine-sim ajoute à dessein

Ils étaient à leurs valeurs d'origine depuis le début du portage, et personne ne
les avait regardées. Elles ne sont pas un réglage, ce sont des valeurs de
démonstration — l'application d'origine d'engine-sim les expose à l'écran.

| Paramètre | Valeur d'origine | Coupure | Ce qu'il produisait |
|---|---|---|---|
| `airNoise` | 1,0 | 2 kHz | le plateau |
| `inputSampleNoise` | 0,5 | 10 kHz | la remontée |

Le premier ne s'ajoute pas au signal, il le **multiplie** :

```cpp
r_mixed = airNoise * bruit + (1 - airNoise);
v_in    = f_p * dF_F_mix + f * r_mixed * (1 - dF_F_mix);
```

À un, le moteur est donc entièrement modulé par un bruit blanc filtré à 2 kHz.
À zéro, `r_mixed` vaut un et le signal passe intact. C'est exactement le
« souffle » entendu.

### Ce que le réglage a donné

Ramenés à 0,15 et 0,05 — pas à zéro : un moteur a du souffle, et le retirer tout
à fait sonne synthétique. Ralenti, quatre cylindres, silencieux coupé :

| | Avant | Après |
|---|---|---|
| 50 Hz, le corps | −56,4 | **−53,5** |
| 250 Hz | −76,2 | **−70,5** |
| 4 kHz | −83,7 | **−100,8** |
| 8 kHz | −78,5 | **−96,1** |
| Remontée 2 → 8 kHz | **+10,8 dB** | **−1,3 dB** |

Le parasite chute de 17 dB, le grave gagne 3 à 6 dB. Sur le V8, le rapport entre
le corps et le plateau passe de **5,7 à 10,6 dB** et la bosse disparaît aussi.

Le **silencieux** devient inutile : il avait été ajouté pour masquer ce parasite,
et David avait dû le descendre à 1 kHz, ce qui « coupe trop d'autres sons et rend
le moteur sourd ». Il est coupé par défaut. Mesuré après correction : 47 dB
d'écart entre 50 Hz et 4 kHz sur le quatre cylindres, là où une prise réelle en
montre 39. Filtrer davantage n'enlèverait plus que du moteur.

### Il manquait la captation réelle

Les bruits corrigés, David a réécouté : « ça sonne encore faux ». La cause tenait
à une différence avec engine-sim que nous n'avions jamais regardée.

**Son application charge un fichier WAV enregistré sur un vrai échappement.**

```cpp
ysWindowsAudioWaveFile waveFile;
waveFile.OpenFile(response->getFilename().c_str());
m_simulator->synthesizer().initializeImpulseResponse(...);
```

Nous fabriquions la nôtre — d'abord un bruit blanc, puis un tube. Une captation
porte ce qu'aucun modèle ne reproduit : la géométrie du tube, le silencieux, la
caisse, le lieu de la prise.

Ces fichiers étaient dans le dépôt cloné depuis le début, sous licence MIT.
Quatre sont repris dans `public/impulse/`, dont celui du V8 Chevrolet 454 livré
avec engine-sim, retenu par défaut. Relevé sur le ralenti du V8, sortie
complète : l'écart entre le grave et la bande de 8 kHz vaut **40,1 dB**, quand
une prise faite sur une vraie voiture en montre 39,1 ; le spectre décroît de
33 dB entre 2 et 8 kHz au lieu de remonter.

Notre gain de convolution valait par ailleurs 0,01 là où engine-sim applique
0,001 — dix fois trop.

### Une cinquième hypothèse écartée : l'espacement des allumages

Le grondement d'un V8 croisé vient de l'inégalité des intervalles entre
explosions. Le soupçon était que notre définition les rende réguliers.

**Le témoin l'a tué.** Mesurés de la même façon — détection des sommets
d'enveloppe, dispersion des intervalles — le véhicule réel donne 86,5 % et
53,2 % de dispersion, le nôtre 37,6 % et 52,1 %. La méthode mesure surtout son
propre bruit de détection : elle ne discrimine rien, et l'on ne peut rien en
conclure. Sans ce témoin, une fausse cause était annoncée.

### Quatre constantes figées, quatre défauts

La captation réelle en place, David a réécouté : « c'est pas mal ; sauf pour le
ralenti, comme d'habitude ». Trois autres points avec, et chacun tenait à une
valeur écrite en dur.

**Le rupteur, figé à 6 800 tr/min.** « Le son change étrangement quand on arrive
haut dans les tours (mode sport, vers 6 900) — comme si la fréquence liée à la
charge, sourde, était tout d'un coup coupée. » Le profil Sport monte à 8 500 ;
passé 6 800, engine-sim coupait l'allumage et il ne restait que le pompage d'air.
À cent tours près de ce qu'il a entendu. Le rupteur suit désormais le profil,
avec cinq pour cent de marge, et changer de profil rebâtit le moteur — il est
lu à la construction du module d'allumage. Vérifié : le régime monte à 7 985
tr/min, écart nul, crête 0,314 en haut contre 0,334 en bas.

**Le décalage entre le geste et le son.** « C'est flagrant sur le changement de
rapport : les tours affichés retombent avant le son. » Deux causes qui
s'ajoutaient — la réserve du lecteur à 250 ms, ramenée à 120 sans qu'aucun creux
apparaisse, et le limiteur de pente du régime à 12 000 tr/min par seconde. Un
passage de rapport fait chuter le régime de deux mille cinq cents tours d'un
coup : plus de deux dixièmes de seconde à cette pente, soixante millisecondes à
40 000.

**Le papillon de ralenti, presque fermé.** Il valait 0,9985 là où engine-sim
retient 0,975. Le débit d'air passe en cosinus de l'angle : `cos(0,9985·π/2)`
vaut 0,0024 contre 0,0393, soit **dix-sept fois moins d'air**. Le moteur était
asphyxié au ralenti, il ne brûlait presque pas, et l'on entendait le pompage. À
papillon égal, la sonde monte maintenant à 4 565 tr/min au lieu de 2 337.

**Ce dernier point n'est pas mesuré à l'oreille, et il ne peut pas l'être ici** :
le niveleur d'engine-sim vise une crête constante, si bien que le niveau au
ralenti n'a pas bougé (crête 0,108 contre 0,107–0,151 avant). Ce que la mesure
établit, c'est que le moteur respire ; ce qu'il en sort reste à juger.

**Une piste écartée, et elle était tentante.** `dynoMinSpeed` vaut 1 000 et
`dynoMaxSpeed` 6 500 — exactement les deux bornes où tombaient les deux
symptômes, un ralenti à 780 en dessous et un décrochage à 6 900 au-dessus. Trop
beau : ces bornes ne servent qu'à limiter le curseur de l'application d'origine
(`engine_sim_application.cpp`), ni le solveur ni notre code ne les lisent.

### Dehors ou dedans, trouvé par l'usage

« Le réglage silencieux permet de sélectionner un son extérieur (coupé) ou
assourdi, donc intérieur. C'est un truc sympa, qu'on pourrait mettre en
paramètre intérieur / extérieur. »

Le passe-bas de sortie faisait cela sans qu'on l'ait cherché : c'est en réglant
à l'oreille que David l'a vu. Il devient un choix qui se comprend — dehors à
côté de la voiture, ou dedans vitres fermées —, le réglage libre restant
accessible. Mille hertz pour l'habitacle : la valeur qu'il avait trouvée.

### Le V8 reste en retrait du quatre cylindres

Même après correction, et c'est mesuré : rapport corps/plateau de 10,6 dB pour le
V8 contre environ 27 pour le quatre cylindres. David l'avait entendu avant qu'on
le mesure — « sur un 4 cylindres j'entends le ralenti (c'est chouette
d'ailleurs) ».

**Correction : le V8 n'a pas été écrit au jugé.** Je l'ai affirmé quatre fois
sans ouvrir le fichier, et David a demandé sur quoi je me basais. Le
commentaire en tête de `buildCrossplaneV8` dit le contraire :

> Un V8 americain a vilebrequin croise, releve sur le GM LS livre avec
> engine-sim (assets/engines/atg-video-2/07_gm_ls.mr). Rien n'y est invente :
> angle de V, point mort haut, angles de manetons, ordre d'allumage et
> repartition des cylindres entre les bancs sont recopies du fichier.

Les cotes aussi sont réelles : 4,065 × 3,622 pouces est un LS3 de 6,2 litres.

**Mais l'échappement, lui, ne figurait pas dans cette liste** — et c'est lui qui
fait le son. Ses valeurs venaient du quatre cylindres, dont la ligne est celle
d'un EJ25 Subaru :

| Paramètre | GM LS | Notre V8, avant |
|---|---|---|
| Longueur du tube primaire | 29 pouces | 10 |
| Débit primaire | k_carb(500) | k_carb(300) |
| Volume audio | 4,0 | 1,0 |

Le V8 portait donc l'échappement d'une Subaru. C'est la première explication
**mesurée** de son retrait sur le quatre cylindres, dont l'échappement était
juste. Corrigé le 5 septembre 2026.

Reste à vérifier ce que d'autres paramètres non énumérés valent par rapport au
LS : cames, admission, volumes de chambre et de conduits. La méthode est
établie — comparer ligne à ligne au `.mr`, et ne rien laisser au jugement.

**Et les références sont là.** Le dépôt cloné contient les définitions livrées
avec engine-sim, dans `native/.work/engine-sim/assets/engines/` :

| Fichier | Ce que c'est |
|---|---|
| `chevrolet/chev_truck_454.mr` | un big block Chevrolet 454 — le V8 américain visé |
| `atg-video-2/07_gm_ls.mr` | un GM LS |
| `atg-video-2/08_ferrari_f136_v8.mr` | un V8 à plat, pour comparer |

Elles sont écrites en `.mr`, dont la spécification a écarté l'interpréteur — mais
rien n'empêche de les **lire** et d'en traduire les valeurs. C'est exactement ce
que ce ticket réclamait : partir d'une définition existante plutôt que de régler
au jugé. Le chantier est balisé.

### Quatre hypothèses écartées, pour n'y pas revenir

Chacune paraissait plausible, chacune a été tuée par une mesure.

- **Le rééchantillonnage de la simulation.** La bosse 5-10 kHz aurait dû se
  déplacer en passant la simulation de 10 à 20 kHz. Elle n'a pas bougé :
  −91,4 dB puis −90,9.
- **La quantification en entiers 16 bits.** `readAudioOutput` rend des `int16`,
  et un plancher de quantification est plat comme le plateau observé. Mais
  monter le volume interne d'un facteur seize n'a amélioré le rapport que de
  1,4 dB, quand la quantification aurait donné 24.
- **Le dynamomètre.** Il tient le régime par une contrainte du solveur à 10 000
  livres-pied, résolue à chaque pas ; le soupçon était qu'il injecte du bruit
  dans la rotation. Desserré à 300, l'écart n'a pas bougé : 5,7 dB puis 6,1.
  L'export `synth_set_dyno` reste, pour pouvoir refaire l'essai ; son curseur a
  quitté l'écran, un réglage sans effet mesuré n'y a pas sa place.
- **Le filtrage comme remède.** Cherché la meilleure coupure et le meilleur ordre
  contre une prise réelle : le résidu ne descend jamais sous 4,5 dB, contre 8,3
  sans filtre. Un filtre ne pouvait pas réparer un signal dont le défaut est à la
  source — et mon réglage à 1 kHz, lui, dégradait (7,5 dB).

Une correction intermédiaire, elle, était fondée et reste : la **résonance
d'échappement était un bruit blanc**, reprise d'engine-sim. Convoluer des
explosions par du bruit rend du bruit. Mesuré sur un ralenti de V8, par le
facteur de crête : son sec 6,0, bruit blanc 3,4, tube 5,7. Elle simule désormais
un tube — une suite d'échos espacés du temps d'aller-retour.

## Critères d'acceptation

- [x] Le son sort sans creux ni craquement à régime tenu, puis en accélération —
      zéro creux mesuré, balayage complet compris
- [x] Le régime entendu est celui du cadran, à quelques dizaines de tours près —
      écart nul à l'unité près
- [ ] L'effort agit sur le timbre, et pas seulement sur le niveau — le niveau ne
      part plus à l'envers, mais il bouge peu et la brillance ne suit pas ; voir
      ci-dessus
- [x] La charge processeur pendant la lecture est relevée, à côté du reste de
      l'application qui tourne
- [x] Le son se coupe proprement quand on change de source ou d'origine
- [ ] 🧑 Jugé à l'oreille par David, et le verdict écrit

## Comment l'essayer

1. `npm run dev`, puis l'onglet **Synthèse**.
2. **Activer la synthèse** — le navigateur exige ce clic, sans lui le contexte
   audio reste suspendu et rien ne sort.
3. Pour écouter sans conduire : cocher **Balayage du régime**.
4. Pour conduire : revenir sur **Conduite**, source *Simulateur*, manette ou
   flèches du clavier. Le son suit le régime du cadran.
5. Le bouton **Arrêté / En marche** de la barre coupe la synthèse avec le reste.
