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

**Étalonnage** (_calibration_) :
Mesurer la vraie voiture pour régler les virtuelles. Un protocole en **étapes**
(`CalibrationStep`), chacune avec sa consigne et son **critère** de validité :
l'étape s'enregistre comme une trace, la trace se mesure, et le chiffre obtenu
s'affiche face à celui du profil. Il **propose, il n'applique pas** — la recopie
se fait réglage par réglage, sur un geste. Il informe des seuils **en vitesse**,
jamais en régime : la voiture mesurée n'a pas de rapports.
_Attention_ : ne pas le confondre avec l'**analyse d'échantillon**, qui mesure un
fichier audio. Les deux rendent des propositions, mais l'une mesure la voiture et
l'autre le son.
_Éviter_ : calibration en français, réglage automatique.

**Étape** (_step_, `CalibrationStepId`) :
Une manœuvre du protocole d'étalonnage — accélération franche, décélération pied
levé, freinage, conduite en ville, sur route, sur autoroute. Chacune vaut
séparément : un freinage franc ne se commande pas au milieu du trafic, et ce qui
n'a pas été fait est dit **non mesuré**, jamais estimé.

**Palier** (_plateau_, `Plateau`) :
Dans une trace, une portion où la vitesse est **tenue** — l'accélération reste
dans une bande étroite assez longtemps. C'est de là que sortent les vitesses
qu'on pratique vraiment. L'arrêt n'en est pas un : un feu rouge est une
accélération nulle qui dure.
_Attention_ : proche de la **croisière**, mais ce n'est pas la même chose — la
croisière est ce que la boîte décide en roulant, le palier est ce qu'on relève
après coup sur une trace.

## Le moteur

**Régime** (_engine speed_, `rpm`) :
La vitesse de rotation du moteur simulé, en tours par minute. C'est elle qui
fixe la **hauteur** du son. Calculée depuis la vitesse, le rapport engagé, le
pont et le rayon de roue — sauf à l'arrêt ou pendant un passage, où le moteur
est découplé des roues.
_Éviter_ : rpm dans les textes français, tours (ambigu avec le nombre de tours).

**Régime entendu** (_audible engine speed_, `audibleRpm`) :
Le régime plus le **tremblement**. C'est lui, et lui seul, qui fixe les vitesses
de lecture des couches. Le moteur en sort donc deux : le régime, sur lequel
travaillent la boîte, ses seuils et la télémétrie, et celui-ci, qui ne sert qu'au
son. Les séparer est ce qui empêche le tremblement de faire osciller les seuils
de passage.
_Éviter_ : régime réel, régime sonore.

**Tremblement** (_flutter_, `flutterRpm` / `flutterHz`) :
L'irrégularité de quelques dizaines de tours qu'on ajoute au régime pour qu'il
cesse d'être parfaitement lisse. Décroît quand le régime monte et quand la charge
monte : un moteur se stabilise en poussant, il tremble au ralenti et à vide.
Déterministe — une somme de sinusoïdes, pas un tirage au sort — donc une même
situation donne toujours le même son.
_Attention_ : ne pas le confondre avec la **dispersion** des passages
(`upshiftJitterRpm`), qui est tirée au sort à chaque changement de rapport et
concerne la boîte.
_Éviter_ : bruit, jitter, vibrato.

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
La phase où la vitesse est **tenue** — c'est-à-dire ni gagnée ni perdue :
l'accélération reste dans une bande **asymétrique** autour de zéro pendant
quelques secondes, bien plus serrée du côté du ralentissement. Un lever de pied
sur du plat n'est pas une croisière. La boîte y monte les rapports d'elle-même, jusqu'au **plancher de croisière**
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

**Désaccord** (_detune_, `layerDetuneCents`) :
L'écart de justesse, en centièmes de demi-ton, entre les couches d'une même
famille. Au rapport exact elles sont parfaitement justes l'une par rapport à
l'autre, ce qu'un moteur n'est jamais : c'est le battement lent qui manque.
L'écart est réparti de part et d'autre, donc la hauteur moyenne de la famille ne
bouge pas, et il s'applique après la décision de **domaine jouable** — il ne
déplace donc aucun gain.
_Éviter_ : détune, désaccordage, chorus.

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

**Origine** (_origin_, `ProfileOrigin`) :
Ce qu'un profil était à sa création, tout sauf son identité — identifiant, nom
et statut de favori n'en font pas partie. C'est à elle que la réinitialisation le
ramène, et elle survit à l'opération pour qu'on puisse la refaire. Facultative :
les deux profils livrés se retrouvent à leur identifiant.
_Éviter_ : valeurs d'usine (qui désigne les profils livrés), défaut.

**Section** (_section_, `ProfileSection`) :
Un bloc de réglages d'un profil — moteur, transmission, signal, mixage,
caractère, couches. C'est l'unité de réinitialisation : on remet une section aux
valeurs d'usine sans toucher au reste.

**Tempérament** (_sportiness_) :
Le caractère du moteur et de la boîte, sur une échelle du calme au sportif :
ce qui décide si la voiture **pousse fort**. Il n'est pas enregistré dans un
profil, il s'en **déduit** — huit de ses réglages suivent des lois qui
s'inversent, et la médiane des lectures donne sa position. C'est ce qui permet
au curseur du mode simplifié de refléter un profil réglé à la main.
_Ne pas confondre_ avec le **caractère** ci-dessous, qui est un bloc de trois
comportements, ni avec la **réactivité**, qui est celle du signal.
_Éviter_ : sportivité, agressivité.

**Réactivité** (_responsiveness_) :
Le caractère du **signal de vitesse**, du pépère au nerveux : ce qui décide si
la voiture **répond vite**. Nerveux suit au plus près et laisse passer le bruit
du GPS, pépère est lisse et en retard. Se déduit du profil comme le
tempérament, et s'en distingue : une voiture calme peut être vive, une sportive
pâteuse.
_Éviter_ : nervosité, latence.

**Mode avancé** (_advanced mode_) :
La bascule de l'écran de configuration. En simplifié, la vue est courte et
quelques curseurs globaux commandent le reste ; en avancé, la cinquantaine de
réglages détaillés s'ajoute dessous. Préférence de l'**appareil**, comme le
volume général : ne fait pas partie du profil et ne voyage pas.
_Éviter_ : mode expert, mode débutant.

**Caractère** (_feel_, `FeelPreset`) :
Les trois comportements qui tiennent du tempérament plutôt que de la mécanique :
rétrogradage forcé, pétarade, à-coup de passage. Chacun s'active séparément, et
on les remarque surtout par leur absence.

## L'écran de conduite

**Visage** (_face_, `DriveFace`) :
L'un des deux affichages de l'écran de conduite : **cadrans** (`dials`), pour
conduire, ou **chiffres** (`numbers`), pour régler. Le même écran, les mêmes
commandes, la même télémétrie — seule la façon de montrer la vitesse, le rapport
et le régime change. C'est une préférence de l'appareil, comme le volume
général : elle n'appartient pas au profil.
_Éviter_ : mode (qui désigne la boîte, automatique ou manuelle), thème, vue.

**Cadran** (_dial_, `DialGauge`) :
Un afficheur à aiguille, gradué. Le compteur de vitesse et le compte-tours en
sont deux instances du même composant. L'aiguille n'a **aucune inertie propre** :
elle suit le régime, déjà lissé par le conditionnement et par le volant moteur.
Son mouvement est la valeur, ce n'est pas une animation.
_Éviter_ : jauge (qui évoque un niveau), gauge, compteur tout court (ambigu avec
le compteur de vitesse).

**Paysage** (_scenery_) :
Le décor qui défile derrière les cadrans, à la vitesse du véhicule. **Rien ne s'y
lit** : c'est le seul élément de l'application qui bouge pour l'agrément, et
l'unique exception à la règle « aucune animation », levée sciemment le
3 septembre 2026. Il se coupe, et coupé il n'existe pas dans la page.
_Éviter_ : fond, décor animé, arrière-plan (qui désigne l'état de la page quand
le navigateur la masque).
