# Sound of Speed — glossaire

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

**Origine du son** (_sound source_, `soundSource`) :
D'où vient le son d'un profil, parmi trois : **enregistré** (`recorded`, la
banque d'échantillons jouée en changeant sa vitesse de lecture),
**généré en direct** (`live`, le moteur simulé pendant la conduite) et
**généré à l'avance** (`prerendered`, une banque produite par cette simulation
au bureau, une prise par plage de régime, que la voiture rejoue). Le choix est
par profil, parce qu'il dépend du moteur imité. Seul l'enregistré est gréé
aujourd'hui.
_Attention_ : sans « du son », **origine** désigne autre chose — les valeurs de
création d'un profil, `ProfileOrigin`. Toujours dire l'expression entière.
_Éviter_ : mode, source (qui désigne une source de vitesse), synthèse (qui ne
couvre que deux des trois).

**Définition de moteur** (_engine definition_, `engineDefinition`) :
La description du moteur simulé, portée par le profil pour les deux origines
générées. Un profil généré à l'avance la garde à côté de sa banque : sans elle,
la banque serait une boîte noire qu'on ne saurait plus refaire après un
changement de réglage. Sa forme n'est pas encore fixée.
_Éviter_ : moteur (qui désigne le moteur simulé du régime), modèle.

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

**Moteur** (_engine_, `EngineEntity`) :
Ce qui fait qu'on reconnaît un moteur : ses réglages — ralenti, rupteur,
inertie, frein moteur —, sa banque de sons, ses couches et son mixage. C'est une
entité qui a un nom, qu'on enregistre et qu'on envoie **seule** ; un profil la
désigne au lieu d'en recopier les valeurs, ce qui permet de la corriger une fois
pour tous les profils qui la jouent. Elle ne porte ni les rapports, ni le pont,
ni le tempérament : ce sont la **boîte** et le **mode de conduite**.
_Ne pas confondre_ avec `EnginePreset`, qui n'est que la section des réglages ;
avec `EngineDefinition`, les vingt-huit cotes du moteur simulé ; ni avec la
classe `Engine`, qui calcule le régime.

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
_Attention_ : à ne pas confondre avec l'**origine du son**, qui dit d'où vient le
son. L'origine du son n'entre d'ailleurs pas dans `ProfileOrigin` : réinitialiser
un profil ne le fait pas changer de nature.
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
comportements, ni avec la **réactivité**, qui est celle du signal, ni avec le
**mode de conduite**, qui se choisit au volant et ne vit pas dans le profil.
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

**Sélecteur** (_drive selector_, `DriveSelector`) :
Les commandes de conduite, entre les deux cadrans. Il a la forme d'un sélecteur
de boîte mais c'est d'abord **l'interrupteur de l'application** : `D` met en
route, `P` met au repos. Les deux commandes de boîte — automatique et manuelle —
y sont montrées côte à côte, chacune sous son étiquette, celle qui n'a pas la
main étant estompée.
_Éviter_ : levier, PRNDS (il n'y a ni marche arrière ni point mort), bouton
marche/arrêt (il en fait plus).

**En route** / **au repos** (_running_ / _idle_, `isRunning`) :
Les deux états de l'application. **En route**, la localisation, le son, la
boucle et l'enregistrement du trajet tournent. **Au repos**, tout cela s'arrête
et la tranche en attente est déposée ; seul l'affichage reste allumé, parce que
c'est par lui qu'on redémarre. L'application **s'ouvre au repos** : le démarrage
demande un appui, qui est aussi le geste dont le navigateur a besoin pour ouvrir
la position et le son.
_Éviter_ : allumé / éteint (l'écran reste allumé), en marche / arrêté (l'ancien
libellé du bouton disparu), veille (qui suggère une reprise automatique).

**Mode de conduite** (_drive mode_, `DriveMode`) :
Route ou sport. Il déplace les marges de passage de la boîte et la façon dont le
moteur sonne sous charge. Il se prend sur la touche de marche, qui affiche alors
`S`, et revient à « route » au repos pour que cette touche montre toujours `D`
au parking. C'est un choix de **l'appareil**, pas du profil.
_Ne pas confondre_ avec le **tempérament** ci-dessus, qui est une lecture des
réglages d'un profil, ni avec la **commande de boîte**, qui est automatique ou
manuelle.
_Éviter_ : tempérament (déjà pris), agressivité, mode tout court.

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

## La remontée au serveur

**Remontée** (_upload_) :
Ce que l'application dépose d'elle-même sur le serveur : le journal, les traces,
les relevés de mesure et les profils. Elle ne part que sur un **accord**, et rien
n'est envoyé par défaut.
_Éviter_ : synchronisation (rien ne redescend), sauvegarde (rien n'est restauré),
envoi.

**Accord** (_consent_, `UploadConsent`) :
Ce que l'utilisateur a autorisé à partir, en trois positions — rien, le minimum,
et la conduite. Le troisième cran ajoute la position et les traces, et il ne se
déduit jamais du second. Une préférence de l'appareil : il ne voyage ni par lien,
ni par fichier, ni avec un profil.
_Éviter_ : consentement (le mot du droit, pas celui de l'écran), option.

**Dépôt** (_deposit_, `putFile`) :
L'écriture d'un fichier sur le serveur, toujours sous le **compte de l'appareil**
— le témoin de connexion voyage tout seul, il n'y a rien à composer. Un dossier
par nature : `journal/`, `traces/`, `mesures/`, `profiles/`.
_Attention_ : le dépôt **manuel** d'une trace, depuis l'écran de télémétrie, ne
dépend pas de l'accord — ce qu'on fait soi-même n'a pas à être autorisé d'avance.

**File** (_queue_, `UploadQueue`) :
Ce qui attend de partir. Une voiture traverse des zones sans réseau : ce qui n'a
pas pu partir y reste et repart au retour. Elle est bornée, et le plus ancien
cède la place — une file sans fin rendrait l'échec d'écriture du stockage local
plus fréquent, pas moins.
_Éviter_ : tampon, cache.

**Relevé de mesure** (_measurement_) :
Un instantané chiffré de ce que l'application coûte ou produit, avec son
contexte — navigateur, matériel, date. Celui de la **sonde** tranche le portage
d'engine-sim ; celui du journal dit ce que le son a coûté en roulant. Un chiffre
sans son contexte ne se relit pas trois semaines plus tard.
_Éviter_ : mesure (qui désigne une mesure de vitesse), statistique.

## La rétention

**Trajet** (_trip_, `SessionEntry`, `SessionEnBase`) :
Une session vue depuis le serveur : ses tranches de trace et de journal réunies
par le nom qu'elles portent. C'est l'**unité** de tout ce qu'on fait d'un
enregistrement — on télécharge, on épingle et on efface un trajet, jamais une
tranche : effacer tranche par tranche rendrait des sessions à trous.
_Attention_ : un dépôt au nom libre, d'avant la convention de nommage, fait un
trajet à lui seul — sans quoi rien ne pourrait jamais l'enlever.

**Date d'enregistrement** (_recorded at_, `recordedAt`) :
Quand le trajet a eu lieu, lue dans le nom des tranches. À distinguer de la
**date de dépôt**, qui est celle de l'arrivée sur le serveur et qui ment dès que
l'envoi est différé. C'est la date d'enregistrement qui décide de l'effacement.

**Analysé** (_analyzed_, `analyzedProcedure`) :
Se dit d'un dépôt que le profileur a **regardé**, quoi qu'il en ait tiré. Une
session trop courte dont rien ne sort est analysée, et donc effaçable ; une
session jamais soumise au profileur ne l'est pas, et rien ne l'effacera. La
marque porte le numéro du procédé : elle ne vaut plus rien dès qu'il change.
_Éviter_ : mesuré, traité (qui laissent croire qu'il en est sorti quelque chose).

**Épingle** (_pin_, `exemption: 'epingle'`) :
Le choix de garder un trajet malgré la règle. Elle est **bornée**, et la borne
s'annonce.
_Attention_ : à ne pas confondre avec le profil **épinglé** sur l'écran de
conduite, qui est un favori et ne parle pas de rétention.

**Archive** (_archive_, `exemption: 'archive'`) :
L'exemption posée par une reprise sur ce qui vient d'un ancien serveur. Un fait,
non un choix : ces trajets ont été déménagés, et les effacer un mois plus tard
reviendrait à les avoir déplacés pour les perdre. Elle n'est pas bornée.
_Éviter_ : épingle automatique — les deux natures existent justement pour ne pas
se confondre.

**Verdict** (_verdict_, `verdictDeRetention`) :
Ce que la règle emporterait, rendu **sans rien effacer** : les trajets qui
partiraient, et pour chacun de ceux qui restent, la raison qui le retient. Le
seul moyen de juger un délai, puisqu'un seuil trop court efface des données sans
que rien ne rougisse.

## L'identité

Le vocabulaire de la bibliothèque qui tient les comptes recoupe celui du projet
sur deux mots, et ils ne désignent pas la même chose. Les tables de la base
portent donc un préfixe `auth_`, et les correspondances sont réglées une fois
pour toutes dans `src/server/identite.ts`.

**Compte** (_account_, `accounts`) :
La personne. Il se crée tout seul au premier lancement et reste **anonyme** tant
que ça suffit ; l'adresse se rattache le jour où elle sert. C'est lui que
désignent les `account_id` de toutes les autres tables, et lui que la
bibliothèque d'identité appelle un *user*.

**Héritage** (_heritage_, `faireHeriter`) :
Le passage au premier compte réel de tout ce que portait le compte d'avant
l'identité. Une seule fois, et rien à mémoriser pour s'en assurer : le compte
d'avant s'efface, donc il ne reste rien à transmettre au suivant.
_Éviter_ : migration (qui désigne ici le déplacement des données du navigateur
vers la base, lot MIGRER), reprise (qui désigne le versement des anciens
dossiers du NAS).

**Compte anonyme** (_anonymous account_, `accounts.is_anonymous`) :
Un compte que l'appareil a reçu sans que personne saisisse rien, au premier
contact avec le serveur. **C'est la colonne qui fait foi**, et non l'adresse : la
bibliothèque d'identité en fabrique une, sous le domaine réservé `.invalid` qui ne
désigne aucune boîte, parce qu'elle refuse un compte sans courriel. Un compte
anonyme n'a rien à récupérer — pas de mot de passe, donc rien à reprendre si
l'appareil perd ce qu'il gardait. Le **code de liaison** n'y change rien : il
relie un second appareil au même compte anonyme, et les perdre tous les deux le
perdrait. C'est le **rattachement** d'une adresse qui met fin à cet état.
_Éviter_ : compte temporaire, compte invité (les deux laissent croire qu'il
expire, or il dure tant qu'on ne l'efface pas).

**Code de liaison** (_link code_, `poserUnCodeDeLiaison`) :
Ce qu'un appareil donne pour qu'un autre ouvre le **même compte**. Huit
caractères, dans un alphabet où rien ne se confond, à recopier — ou à scanner,
le lien portant la même valeur dans son fragment. Il ne sert **qu'une fois** et
expire en dix minutes.
_Attention_ : il ne touche pas au mot de passe du compte, et un compte relié à
deux appareils reste anonyme.
_Éviter_ : appairage, jumelage (qui laissent croire à un lien entre deux
appareils, alors qu'il n'y a qu'un compte et des appareils qui l'ouvrent),
invitation (rien n'est envoyé à personne).

**Rattachement** (_link an address_, `rattacherUneAdresse`) :
Donner une adresse et un mot de passe au compte qu'un appareil porte déjà. Le
compte **garde son identifiant**, donc tout ce qu'il porte reste en place ; ce
qui change est son adresse, et le fait qu'il cesse d'être anonyme.
_Attention_ : à ne pas confondre avec une **inscription**, qui créerait un
compte neuf et laisserait les réglages sur l'ancien. C'est exactement ce qu'on
ne veut pas, et c'est pourquoi ce geste a sa propre route.
_Éviter_ : créer un compte, s'inscrire (il en existe déjà un).

**Identité** (_auth identity_, `auth_identities`) :
Une façon de prouver qu'on est le titulaire d'un compte : un mot de passe rangé
ici, ou un compte tenu chez un tiers. Un compte peut en porter plusieurs.
_Attention_ : c'est ce que la bibliothèque d'identité appelle un *account*, et
c'est exactement pour éviter cette collision que la table ne porte pas ce nom.

**Session d'identité** (_auth session_, `auth_sessions`) :
Ce qui dit qui tient le volant, et jusqu'à quand.
_Attention_ : à ne pas confondre avec une **session de conduite**, qui est un
trajet — voir la section « La rétention ». Les deux mots n'ont aucun rapport, et
seul le préfixe les distingue dans la base.

**Droit** (_right_, `rights`) :
Ce qu'un compte ouvre, et jusqu'à quand. Un droit sans échéance ne se périme pas,
et c'est ce que tout le monde porte aujourd'hui : rien n'est encaissé.

## Profil effectif

Ce que le moteur, la boîte, le conditionnement et le mixage emploient réellement :
le **profil** réglé, corrigé par l'**étalonnage** quand il existe.

Deux couches, et la distinction porte tout le reste : un profil décrit un *son*
— le caractère d'un moteur, sa boîte, son mixage —, l'étalonnage décrit une
*voiture* — sa reprise, son freinage, son ralentissement pied levé, les vitesses
qu'on y pratique. Une mesure de la voiture n'appartient donc pas à un profil :
elle vaut pour tous ceux qu'on écoute dans cette voiture.

L'écran de configuration édite le profil ; c'est le profil effectif qu'on entend.
Sans étalonnage, les deux sont le même objet.
