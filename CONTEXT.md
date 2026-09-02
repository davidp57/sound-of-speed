# Speed — glossaire

Le vocabulaire propre au projet : les termes qui ont un sens précis ici, et ceux
qu'on confond facilement. Ce n'est ni une spécification, ni un bloc-notes
d'implémentation — le fonctionnement est dans [`README.md`](README.md), le
process dans [`CLAUDE.md`](CLAUDE.md).

Chaque entrée donne le terme français employé partout, l'identifiant anglais
correspondant dans le code, et les mots à éviter.

## Le signal de vitesse

**Source de vitesse** (_speed source_, `SpeedSource`) :
D'où vient le chiffre : **simulateur** (clavier, pour travailler sur un poste
fixe), **GPS** (`GeolocationSource`), ou **rejeu** (`ReplaySource`) d'une trace
enregistrée. Les trois exposent la même interface et sont interchangeables :
rien en aval ne sait laquelle est active.
_Éviter_ : provider, capteur.

**Conditionnement** (_conditioning_, `SpeedConditioner`) :
La transformation d'une mesure GPS à 1 Hz en un signal continu utilisable pour
piloter une hauteur de son. Trois traitements composés : pente sur fenêtre
glissante, extrapolation entre deux mesures, ressort amorti critique à pas fixe.
_Éviter_ : filtrage, lissage (le lissage n'est que le troisième des trois).

**Trace** (_trace_, `Trace`) :
Un trajet capturé, mesure par mesure, qu'on rejoue pour mettre au point sans
reprendre la voiture. S'enregistre et se relit depuis l'écran Télémétrie.
_Éviter_ : log, enregistrement (réservé aux échantillons audio).

## Le moteur

**Régime** (_engine speed_, `rpm`) :
La vitesse de rotation du moteur simulé, en tours par minute. C'est elle qui
fixe la **hauteur** du son. Calculée depuis la vitesse, le rapport engagé, le
pont et le rayon de roue — sauf à l'arrêt ou pendant un passage, où le moteur
est découplé des roues.
_Éviter_ : rpm dans les textes français, tours (ambigu avec le nombre de tours).

**Charge** (_load_) :
L'effort demandé au moteur, de 0 à 1. Elle arbitre le fondu entre les couches
« en charge » et « pied levé ». Dans une voiture électrique il n'y a pas de
pédale d'accélérateur à lire : la charge est **déduite de l'accélération**
mesurée au GPS. Au simulateur, la position de l'accélérateur est connue et fait
foi, seule.
_Éviter_ : throttle, gaz, puissance.

**Ralenti** (_idle_, `idleRpm`) :
Le régime au point mort, moteur non entraîné par les roues.

**Rupteur** (_redline_, `redlineRpm`) :
Le plafond absolu du régime, et le nom du **rôle de couche** correspondant
(`limiter`). Le crépitement qu'on entend là-haut vient du hachage de l'allumage
(`limiterHoldMs`), pas du plafonnement.
_Attention_ : ne pas le confondre avec le **limiteur de sortie**
(`limiterThresholdDb`), qui est le dernier étage de la chaîne audio et n'a rien
de mécanique. Deux choses différentes qui portent presque le même nom en
anglais.
_Éviter_ : zone rouge, limiteur tout court.

**Seuil de coupure** (_soft limit_, `softLimitRpm`) :
Le régime où l'allumage commence à être coupé, en dessous du rupteur.

## La transmission

**Rapport** (_gear_) :
Le rapport engagé, compté à partir de 1. Le nombre de rapports est celui de la
liste de démultiplications.
_Éviter_ : vitesse (ambigu avec la vitesse du véhicule), gear.

**Démultiplication** (_gear ratio_, `gearRatios`) :
Le rapport de démultiplication d'un rapport de boîte, du plus court au plus
long. Une seule valeur décrit une prise directe, sans boîte.

**Pont** (_final drive_, `finalDrive`) :
Le rapport final, après la boîte. On ne le règle pas directement : on donne la
vitesse au rupteur dans le dernier rapport, et le pont s'en déduit — c'est le
chiffre parlant.

**Passage** (_upshift_, `upshiftRpm`) :
Le changement de rapport vers le suivant, et le régime auquel il se produit. Il
y a un régime de passage **par rapport** (1 → 2, 2 → 3, …), donné à charge
moyenne : un seuil unique ne peut pas convenir, parce qu'il faut à la fois
empêcher les rapports courts de monter au rupteur et éviter que les longs
passent trop bas.
_Éviter_ : shift, changement de vitesse.

**Croisière** (_cruise_) :
La phase où la vitesse est tenue, l'accélération restant dans une bande étroite
autour de zéro pendant quelques secondes. La boîte y monte les rapports d'elle-même, jusqu'au **plancher de croisière**
(`cruiseMinRpm`) — le régime sous lequel elle refuse de descendre, pour ne pas
brouter. C'est la seule raison de
monter qui ne regarde pas le régime.
_Éviter_ : régulateur (qui désigne le curseur du simulateur), palier.

**Rétrogradage** (_downshift_) :
Le changement vers un rapport plus court. Deux cas distincts : le rétrogradage
ordinaire, sous un seuil de régime en décélération, et le **rétrogradage forcé**
(_kickdown_), déclenché par une demande franche, qui descend plusieurs rapports
d'un coup pour retrouver du couple.
_Éviter_ : kickdown en français.

Trois choses distinctes se cachent donc sous « descendre un rapport » : le
rétrogradage **au régime**, quand le moteur tombe trop bas ; le rétrogradage
**au freinage**, pour aider à ralentir (`brakeDownshiftAccelMs2`) ; et le
rétrogradage **forcé**, sur une demande franche du conducteur.

## Le son

**Échantillon** (_sample_) :
Un fichier audio d'enregistrement réel de moteur, à régime fixe ou en montée. Il
reste **hors de l'image Docker** : les échantillons vivent dans un volume du
NAS, et changer de banque sonore consiste à remplacer des fichiers.
_Éviter_ : sample, son (trop vague).

**Couche** (_layer_, `LayerPreset`) :
Un échantillon dans le mixage, avec son rôle, son ancrage, son gain et ses
bornes de lecture. Toutes les couches jouent en permanence, en boucle, dès
l'activation du son : seuls leurs gains et leurs vitesses de lecture bougent.
Démarrer et arrêter des sources au fil du régime produirait des clics.
_Éviter_ : layer, piste, canal.

**Rôle** (_role_, `LayerRole`) :
La famille dans laquelle une couche est fondue : « en charge » (`on`),
« pied levé » (`off`), « ralenti » (`idle`) ou « rupteur » (`limiter`).

**Ancrage** (_anchor_, `anchorRpm`) :
Le régime auquel l'échantillon a été enregistré. Il fixe la **justesse** : c'est
lui qui dit à quelle vitesse lire le fichier pour obtenir le régime demandé.
_Attention_ : ce n'est **pas** le point d'entrée de la couche dans le mixage —
voir bascule. Confondre les deux est l'erreur la plus courante sur cet écran.
_Éviter_ : régime de référence, pitch de base.

**Bascule** (_crossfade_, `crossfadeLowRpm` / `crossfadeHighRpm`) :
Les deux régimes entre lesquels la couche haute remplace la couche basse d'un
même rôle. Indépendante des ancrages : la bascule règle **quand** une couche
s'entend, l'ancrage règle **juste**.
_Éviter_ : crossfade, transition.

**Domaine jouable** (_playable range_, `minRate` / `maxRate`) :
La plage de régimes qu'une couche peut couvrir sans que l'étirement s'entende —
environ une octave de part et d'autre de son ancrage. Au-delà, sa hauteur se
fige, et une couche figée qu'on laisserait s'entendre donnerait l'impression
d'un second moteur tournant à régime constant. Le mixage l'efface donc à mesure
qu'elle s'écarte, et la réduit au silence au-delà d'une demi-octave.
C'est l'explication d'un gain nul là où le fondu devrait faire entrer une
couche : elle n'est pas jouable à ce régime.

**Relief** (_relief_, `loadReliefDb` / `rpmReliefDb` / `idleLevelDb`) :
Les trois écarts de niveau, en décibels, qui font entendre l'effort. Ils
s'appliquent **après** les fondus et à toutes les couches à la fois, parce que
les fondus sont à puissance constante : ils changent la couleur et jamais le
volume. Le point neutre est la croisière, de sorte qu'augmenter un relief ne
déplace pas le niveau moyen.
_Éviter_ : compression, dynamique (qui désignent la chaîne de sortie).

**Raccord** (_loop seam_) :
Le point où une boucle se referme sur elle-même. Mal placé, il claque à chaque
tour, et un simple fondu ne suffit pas : les deux portions raccordées sont
décorrélées, leurs harmoniques s'annulent en partie et creusent le niveau. Le
chargement cherche donc où boucler, puis **mesure** le saut d'énergie sur les
deux versions et garde la meilleure — la réparation ne peut jamais empirer ce
qu'elle corrige.
_Éviter_ : loop point, boucle (qui désigne la lecture, pas le point).

**Pétarade** (_backfire_) :
Les claquements à l'échappement au lever de pied. Synthétisés : la banque sonore
n'en contient pas.

**À-coup de passage** (_shift jolt_) :
Le creux de niveau pendant la coupure de couple, puis la reprise. Zéro donne une
boîte parfaitement lisse, ce qu'aucune n'est.

## La configuration

**Profil** (_profile_, `Profile`) :
L'unité complète de configuration : tout ce qui influence le son y est déclaré,
rien n'est codé en dur ailleurs. Sérialisable en JSON, donc enregistrable,
exportable, partageable par URL et rechargeable tel quel. Deux profils sont
livrés — **Route** (calibré sur les vitesses qu'on pratique vraiment) et
**Sport** (une plage qu'on n'atteint jamais sur route). La différence entre les
deux est un réglage, pas une nature.
_Éviter_ : preset en français (l'identifiant anglais, lui, reste `*Preset`),
configuration (qui désigne l'écran).

**Section** (_section_, `ProfileSection`) :
Un bloc de réglages d'un profil — moteur, transmission, signal, mixage,
caractère, couches. C'est l'unité de réinitialisation : on remet une section aux
valeurs d'usine sans toucher au reste.

**Caractère** (_feel_, `FeelPreset`) :
Les trois comportements qui tiennent du tempérament plutôt que de la mécanique :
rétrogradage forcé, pétarade, à-coup de passage. Chacun s'active séparément, et
on les remarque surtout par leur absence.
