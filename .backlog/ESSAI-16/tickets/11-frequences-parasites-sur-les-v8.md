# 11 — Des fréquences parasites sur les deux V8, à moyen régime

**Statut :** 🧑 attend David — mesuré et **une banque adoucie livrée à écouter** ; ce qui reste est un arbitrage, pas une mesure

David, après avoir essayé trois banques lors de la sortie du 16 septembre 2026 :
« j'ai testé le V8 (GM), le V8-long (GM collecteur long) et le L4. Ils sonnent
bien, je trouve. Les deux V8 ont des fréquences parasites, surtout à moyen
régime — à corriger tranquillement à l'avenir. »

## Ce que l'observation dit déjà

Elle est précise sur deux points, et c'est ce qui la rend exploitable :

- **Les deux V8 et pas le L4.** Les trois banques sont **produites par
  engine-sim**, livrées par le commit `e63d4ab` le 14 septembre 2026. Ce ne sont
  donc pas des prises d'enregistrement, et le défaut ne peut pas venir d'un
  micro : il vient du moteur simulé, du rendu, ou du découpage en couches.
  `gm-ls` et `gm-ls-long-header` sont **le même bloc**, au collecteur près ;
  `subaru-ej25` est un quatre cylindres à plat. La cause est donc à chercher dans
  ce que ce V8 simulé a de particulier — sa définition dans la bibliothèque de
  moteurs, ou ce que le banc en tire.
- **À moyen régime.** C'est la zone de fondu entre couches. Sur le profil Route,
  le fondu va de 2 600 à 5 200 tr/min : au milieu, deux couches du même
  enregistrement jouent ensemble.

## Les pistes, dans l'ordre de ce qu'elles coûtent à vérifier

1. **Une raie du moteur simulé lui-même.** C'est la piste neuve, et la première
   à regarder : un V8 simulé porte des ordres d'allumage et des longueurs de
   conduits qui peuvent produire une résonance étroite. Le banc rend le spectre,
   et la bibliothèque de moteurs se relit — attention au motif partagé entre deux
   constructeurs de la même famille, qui a déjà fait modifier le mauvais moteur.
2. **Deux couches qui se renforcent en peigne.** Le projet connaît ce risque :
   chaque boucle démarre à une position tirée au sort pour l'éviter. Reste à
   vérifier que c'est bien le cas ici, et que le désaccord entre couches
   (`layerDetuneCents`) n'y produit pas un battement audible.
3. **Une raie propre à la boucle elle-même.** Une boucle courte crée une
   périodicité qui s'entend comme une fréquence. Le relevé de banque
   (`npm run banque`) donne les longueurs.
4. **Le raccord des boucles**, dont le saut d'énergie est mesuré au chargement.
   Un saut résiduel se répète à la période de la boucle.

## Comment l'instruire

Les deux banques sont sur le serveur et se téléchargent depuis le poste, et
surtout **elles se refabriquent** : le banc est dans le dépôt, la définition du
moteur aussi. On peut donc comparer ce que le moteur simulé produit, ce que le
banc en rend, et ce que la voiture joue — et savoir à quelle étape la raie
apparaît. La mesure se fait au bureau, sans rouler.

**Mais le verdict reste à l'oreille.** Sur un défaut sonore, ce que David entend
mène plus vite qu'un spectre : lui rendre le son découpé en bandes, ou un profil
importable, plutôt qu'un graphique.


## Ce qui est mesuré, le 17 septembre 2026

Mesure faite sur les **fichiers de la banque** eux-mêmes, décodés et analysés
dans le navigateur qui les joue — donc sur ce que la voiture lit, avant tout
rejeu. Spectre moyenné par blocs de 16 384 points, fenêtre de Hann, résolution
2,7 Hz.

**La grandeur retenue.** Un moteur à quatre temps dont tous les cylindres sonnent
pareil ne produit que les **ordres multiples du nombre de cylindres** ; tout le
reste vient d'un déséquilibre entre eux. On compare donc, prise par prise, le
niveau du plus fort des autres ordres à celui du plus fort ordre d'allumage. Zéro
décibel veut dire « aussi fort que le moteur lui-même ».

| Banque | Architecture | Énergie inharmonique / allumage |
|---|---|---|
| `gm-ls` | V8 | −18,4 à **+0,8 dB** |
| `gm-ls-long-header` | V8, collecteur long | −2,3 à **+16,4 dB** |
| `bmw-i6-3l` | six en ligne | −31,8 à −53,8 dB |
| `subaru-ej25` | quatre à plat | −30,4 à −57,9 dB |

**La frontière n'est pas « les V8 », c'est « les moteurs en V ».** Les deux
banques à un seul banc de cylindres sont propres, les deux en V ne le sont pas,
et l'écart est de **30 à 70 dB**. Le collecteur long est le pire des deux, ce qui
est cohérent : il déplace la résonance qui sélectionne ce qui sort.

**Ce ne sont pas des résonances fixes mais de vrais ordres moteur.** La première
lecture faisait croire à une raie fixe, parce que le pic dominant retombe toujours
vers 410–465 Hz quel que soit le régime. Vérifié ordre par ordre, il n'en est
rien : 426 Hz à 1 892 tr/min est l'**ordre 27**, 415 Hz à 2 620 l'**ordre 19**,
444 Hz à 3 547 l'**ordre 15**, 441 Hz à 4 801 l'**ordre 11**. Tous entiers, tous
**impairs**, donc aucun n'est un multiple de huit. Ce qui est fixe, c'est la
réponse de l'échappement autour de 430 Hz : elle ne crée pas ces composantes, elle
**choisit** celle qui sort le plus fort. Les deux effets se composent.

**« Surtout à moyen régime » est confirmé.** Sur `gm-ls`, le rapport vaut −15,5 dB
au ralenti et −18,4 dB au rupteur, mais −4,1 à +0,8 dB entre 1 390 et 4 775 tr/min.
C'est exactement la plage où David les entend.

**La piste 2 du ticket — deux couches qui se renforcent — est écartée** : le
défaut est dans les fichiers, avant toute superposition. Les pistes 3 et 4 le sont
aussi pour la même raison.

## Ce qui reste, et ce n'est pas une mesure

**La cause n'est plus une hypothèse : le dépôt la disait déjà.** Le LISEZMOI de
la banque `gm-ls`, écrit le 14 septembre 2026, porte ceci : le vilebrequin croisé
« donne le grondement inégal d'un V8 américain : **chaque banc voit ses allumages
espacés de 90 puis 180 degrés** ». Des allumages inégalement espacés par rangée
produisent exactement les ordres impairs mesurés. Ce n'est donc pas un défaut du
modèle : c'est ce que le moteur fait, et ce pour quoi il a été choisi.

**Et une question de conception, qui revient à David** : un V8 américain à
vilebrequin croisé **sonne** ainsi, c'est même ce qui fait sa signature. Ce que la
mesure appelle « inharmonique » est peut-être le son du moteur. Trois voies :

1. **On ne touche à rien** — c'est le son d'un V8, et le corriger le rendrait
   lisse comme un moteur qui n'existe pas.
2. **On atténue** — un filtre sur la bande 400–470 Hz, ou un réglage de la
   réponse d'échappement, qui garde le caractère en baissant ce qui gêne.
3. **On refabrique la banque** avec un modèle qui réunit les deux bancs.

La question ne se tranche pas au spectre : **elle se tranche à l'oreille**, et la
deuxième voie se fait écouter en une banque refabriquée.

## Critères d'acceptation

- [x] La fréquence parasite est identifiée et chiffrée, pas décrite.
- [x] On sait pourquoi elle touche les deux V8 et pas le L4 — et ce n'est pas le
      nombre de cylindres mais l'architecture en V.
- [ ] Le correctif est jugé à l'oreille par David, dans l'application.

## La banque adoucie, livrée le 17 septembre 2026

`gm-ls-adouci`, cinquième profil livré, sous le nom **« V8 adouci »**. Produite
à partir de `gm-ls` par `node scripts/adoucir-banque.mjs` : mêmes prises, mêmes
boucles, mêmes réglages, seules les composantes visées changent. La comparaison
est donc honnête — tout ce qu'on entend de différent vient de là.

Un moyennage circulaire sur un cycle moteur, borné entre 120 et 1 200 Hz : au-delà
de cette bande, le souffle et le grain sortent intacts, sans quoi le son
deviendrait rigoureusement périodique et synthétique.

| Prise | Avant | Après | Gagné |
|---|---|---|---|
| `on-1390` | −4,1 dB | −30,3 dB | 26,2 dB |
| `on-1892` | **+0,8 dB** | −22,2 dB | 23,0 dB |
| `on-2576` | −10,5 dB | −25,6 dB | 15,1 dB |
| `on-3507` | −6,4 dB | −26,5 dB | 20,1 dB |
| `on-4775` | −1,3 dB | −20,4 dB | 19,1 dB |
| `on-6500` | −18,4 dB | −32,8 dB | 14,4 dB |

Le quatre cylindres, pour repère, est à −48 dB. La banque adoucie ne l'atteint pas
et n'a pas à l'atteindre : à −20 dB, ce qui reste est sous la note du moteur.

**Un défaut trouvé en relisant, et corrigé.** Le traitement ne retirait pas la
même énergie à chaque prise — de 0,2 à 4,1 dB —, alors que la banque porte les
gains mesurés sur l'originale. Le niveau aurait fait un creux vers 4 800 tr/min,
et l'on aurait entendu une différence de niveau là où l'on veut juger un timbre.
Chaque prise retrouve donc son niveau efficace d'origine : écart **nul sur les
onze prises mesurées**, et la réduction des parasites est inchangée. Aucun test
n'aurait vu ça.

**Vérifié dans l'application** : les dix-huit couches se chargent, aucune erreur,
le son sort. Les boucles ne sont pas abîmées — dix-sept couches recollées au
chargement contre **dix-huit sur dix-huit** pour la banque d'origine.

### La banque n'arrivait pas jusqu'à la voiture

Livrée le 17 septembre, elle a rendu l'application **muette** chez David : son
dossier n'était pas excepté dans `.dockerignore`, donc il entrait dans le dépôt
mais pas dans l'image, et le serveur rendait 404 sur chacune de ses prises. Le
profil était sélectionné, il n'y avait plus de son, et le bouton du haut-parleur
relançait un chargement voué à échouer.

Une banque livrée se déclare à **trois** endroits — `.gitignore`, `.dockerignore`,
et la vérification de la chaîne d'intégration — et rien ne rougissait quand l'un
manquait. C'était déjà arrivé le 14 septembre 2026. Trois tests partent maintenant
des profils livrés et vérifient que chaque déclaration suit.

**Ce que ça laisse ouvert, et qui n'est pas de ce lot** : un profil dont la banque
manque rend l'application muette en le disant mal. « on-1021.flac : 404 » ne dit
ni de quelle banque il s'agit, ni qu'il suffit de changer de profil. Un message
qui nommerait la banque absente vaudrait mieux.

### Comment l'écouter

Les deux profils sont côte à côte dans la liste, « V8 » et « V8 adouci ».
Basculer de l'un à l'autre recharge les couches, ce qui prend une seconde ; rien
d'autre ne change entre les deux. À écouter **à moyen régime**, entre 1 400 et
4 800 tr/min, là où l'écart mesuré est le plus grand.

### La question, une fois écoutée

Trois réponses possibles, et chacune close le ticket :

| Ce que David entend | Ce qu'on fait |
|---|---|
| l'adouci est meilleur | il remplace `gm-ls`, et l'original s'en va |
| l'original est meilleur | la banque adoucie et son script s'en vont, le ticket se ferme en « ce n'est pas un défaut » |
| l'adouci est trop lisse, mais l'original gêne | on dose — le dosage est un seul nombre dans `scripts/adoucir-banque.mjs` |
