# 11 — Des fréquences parasites sur les deux V8, à moyen régime

**Statut :** 🧑 attend David — mesuré le 17 septembre 2026 ; ce qui reste est un arbitrage, pas une mesure

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

**Hypothèse sur la cause, non vérifiée dans le code du banc** : un V8 à
vilebrequin croisé n'envoie pas d'impulsions régulières *banc par banc* — c'est
la symétrie des deux bancs réunis qui régularise l'échappement. Si le modèle rend
les deux sorties séparément, chacune porte un motif irrégulier, et les ordres
impairs apparaissent. À confirmer en lisant le modèle, pas en raisonnant.

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
