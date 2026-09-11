# Speed

Un son de moteur pour une voiture qui n'en fait pas.

L'application mesure la vitesse au GPS, en calcule un régime moteur et un rapport
de boîte, et joue le son correspondant à partir d'enregistrements réels. Tout se
règle sans couper le son, et les réglages se rangent dans des profils qu'on
sauvegarde, exporte et recharge.

- [Les écrans](#les-écrans)
- [Démarrer en développement](#démarrer-en-développement)
- [Installation sur un NAS Synology](#installation-sur-un-nas-synology)
- [Une seconde pile, pour essayer l'intégration](#une-seconde-pile-pour-essayer-lintégration)
- [En voiture](#en-voiture)
- [Hors réseau](#hors-réseau)
- [Référence des réglages](#référence-des-réglages)
- [Les échantillons](#les-échantillons)
- [Comment ça marche](#comment-ça-marche)
- [Banc de mise au point](#banc-de-mise-au-point)
- [État du projet](#état-du-projet)

---

## Les écrans

**Conduite** — la vitesse, le rapport, le régime, et les commandes de conduite
entre les deux cadrans. Rien d'autre : le choix de l'affichage et celui de la
source sont passés en **Configuration**, le son et le verrou d'écran en haut à
droite avec l'aide — ce sont des commandes d'appareil, pas de conduite. Le
volume reste sous les cadrans, c'est un réglage qu'on pose une fois. Les
commandes du simulateur, elles, sont sur l'écran **Banc**. Un bouton **Plein
écran** masque la barre du haut : l'affichage occupe toute la hauteur et les
commandes deviennent de grandes touches. On en sort par la **flèche de retour**,
à gauche de la rangée, à l'écart des autres et d'une autre couleur — l'écart est
ce qui empêche de la presser en visant sa voisine.

### Les commandes de conduite

Elles ont la forme d'un **sélecteur de boîte**, et c'en est un pour partie
seulement : c'est d'abord l'interrupteur de l'application.

| Touche | Ce qu'elle fait |
|---|---|
| **D** | démarre tout : localisation, son, enregistrement du trajet. Une fois en route, le même bouton bascule le tempérament et affiche **S** — un appui de plus revient à D. Au repos il affiche toujours **D**. |
| **P** | met tout au repos, et dépose ce que la capture gardait. L'affichage reste allumé : c'est par lui qu'on redémarre. Il fonctionne **aussi en roulant**. |
| **AUTO** / **MAN** | choisissent la boîte. Chaque étiquette porte au-dessus d'elle les commandes de son mode : la touche de marche pour l'automatique, `+` et `−` pour la manuelle. |

**L'application s'ouvre au repos**, et ce n'est pas une précaution d'usage. Elle
démarrait la géolocalisation au chargement de la page, sans qu'on ait rien
touché ; le 11 septembre 2026, elle n'a reçu que des positions annoncées à
9 999,99 m de précision — la valeur qu'un navigateur sert faute d'en avoir une
vraie — pendant tout un trajet, et trois relances n'y ont rien changé. Ce qui a
fonctionné fut un appui sur un bouton, dans une autre version de l'application.
Partir de « P » met ce geste au début de chaque trajet. Que ce soit bien le
geste qui débloque reste **à vérifier en roulant**.

Le tempérament survit à la boîte manuelle : la touche reste vive, car elle ne
décide plus des rapports mais décide encore du son. Il ne survit **pas** au
repos, où la touche affiche toujours « D » et le tempérament revient à « route »
— la garder en « S » ferait lire une lettre et repartir sur l'autre réglage. Les
touches qui ne commandent réellement rien, elles, sont estompées.

Cet écran a **deux visages**, choisis en **Configuration** › *Affichage de la
conduite* :

- **Cadrans** — un tableau de bord. Le compteur de vitesse et le compte-tours
  sont deux cadrans à aiguille, le rapport engagé est écrit en grand entre les
  deux. La zone rouge du compte-tours commence au seuil de coupure, donc le
  plafond se voit sans lire un chiffre. Chaque cadran garde son nombre en petit,
  au centre, pour le réglage et le diagnostic. Le compteur est gradué jusqu'à
  180 km/h — la vitesse à laquelle le dernier rapport touche le rupteur dépasse
  300 km/h sur les deux profils livrés, une échelle qui laisserait l'aiguille
  dans un coin. En plein écran, sur un écran large, les deux cadrans sont côte à
  côte ; en portrait, ils s'empilent, chacun sur toute la largeur.
- **Chiffres** — la vitesse, le rapport et le régime en nombres, avec la
  réglette de régime. C'est cette vue qui sert à régler : cent tours d'écart se
  lisent sur un nombre et ne se voient pas sur une aiguille.

Le choix du visage est une préférence de **l'appareil** : il survit au
rechargement et ne fait pas partie du profil.

Un décor défilait un temps derrière les cadrans. Il est **retiré**, et il ne
reviendra pas : il défilait de côté, comme un jeu de plateforme, là où l'écran
est vu de la place du conducteur. Le redessiner en perspective demandait de
remesurer ce qu'un rendu continu coûte à la régularité du son, pour un décor dont
rien ne se lit. Le son passe avant.

**Télémétrie** — tout ce qui alimente le son : vitesse brute et lissée, écart de
lissage, pente, accélération, qualité du signal GPS, régime, régime entendu,
charge, état de la transmission, régime que donnerait chaque rapport, gain et
vitesse de lecture de chaque couche sonore, niveau de sortie. C'est aussi là que
se lit l'état de la **capture du trajet** : ce qu'elle retient, ce qui est parti,
et ce qui l'empêche de partir.

Elle porte aussi de quoi **redemander une position en roulant**. Passer par `P`
puis `D` relance déjà la localisation, mais au prix du son coupé et d'une capture
scindée en deux sessions. Le bouton *Relancer la localisation* fait la même chose
sans rien interrompre : il ferme le suivi, remet à zéro les comptes de la source
— pour qu'on lise ce que la relance produit, et non deux suivis additionnés — et
le redemande depuis un appui. Il n'apparaît qu'en roulant : au repos, personne ne
lirait les positions, et ouvrir un suivi là rendrait sans effet le `D` qui suit.

La section *Qualité du signal* dit aussi **d'où vient la vitesse** — lue du
navigateur, ou déduite de la distance entre deux positions —, combien de
positions la source a reçues, combien de vitesses elle en a tirées, et combien
elle a rejetées. Ces comptes ne sont pas décoratifs : une source qui reçoit des
positions sans en tirer aucune vitesse donne le même écran qu'une source muette,
et c'est ce qui a rendu un défaut invisible pendant une semaine.

Elle affiche aussi la **précision** que le navigateur annonce avec chaque
position, la courante et les douze dernières. C'est ce relevé, et non une
supposition, qui doit servir à régler le seuil *Précision GPS acceptée* : le
seuil livré est large exprès, faute de connaître les valeurs de la voiture.

La section *Appareil* commence par le **numéro de version** servi à cette page.
Ce n'est pas décoratif : dans la voiture, il n'y a ni console ni outils de
développement, un service worker garde un cache, et rien ne permettait de savoir
si l'on essayait bien la version qu'on croyait. Un correctif jugé sur la version
précédente est un correctif jugé pour rien.

Elle répond ensuite à trois questions qu'aucun code ne devine : la
largeur et la hauteur dont la page dispose réellement — le zoom du navigateur
d'une voiture n'est pas réglable —, ce que répond l'API de maintien d'écran
allumé, et si l'autorisation de géolocalisation est retenue d'une session à
l'autre. Cette dernière est relevée au chargement de la page, avant tout suivi :
plus tard, elle vaudrait « accordée » dans tous les cas.

**Configuration** — deux modes. En **simplifié**, la vue est courte : la
création guidée, les profils, le fonctionnement hors réseau. En **avancé**, la
cinquantaine de réglages détaillés s'ajoute dessous, en curseur et en saisie,
appliqués immédiatement, groupés par section — moteur, transmission, signal,
caractère, mixage, couches. Aucun réglage ne disparaît en simplifié : ils
attendent. Le choix du mode est une préférence de l'appareil, comme le volume :
il se retient et ne voyage pas avec un profil partagé.

C'est aussi là qu'on gère les profils et qu'on analyse les échantillons. Une
bande de défilement longe le bord gauche : le glissement n'y dérègle rien, et
les curseurs eux-mêmes rendent le glissement vertical à la page.

**Étalonnage** — un protocole guidé en six étapes : rouler en ville, sur route,
sur autoroute, puis une accélération franche, une décélération pied levé et un
freinage franc. Chacune s'enregistre à part et **juge si elle a bien été
faite** : une « accélération franche » qui n'atteint pas le critère est refusée,
et la raison est dite, plutôt que de donner une charge fausse. Un récapitulatif
met ensuite le mesuré face au réglé.

Ce que l'étalonnage mesure devient une **couche** par-dessus les profils. Un
profil décrit un son — le caractère d'un moteur, sa boîte, son mixage ;
l'étalonnage décrit une voiture — sa reprise, son freinage, son ralentissement
pied levé, les vitesses qu'on y pratique. Le moteur emploie la composition des
deux. Trois conséquences :

- les mesures valent pour **tous** les profils à la fois, ceux livrés compris —
  une capacité de la voiture n'a pas de raison de ne profiter qu'au profil ouvert
  le jour où on l'a prise ;
- le profil qu'on a réglé n'est **jamais écrasé**. L'écran de configuration
  annonce les réglages que la mesure remplace, et l'on peut refaire ou retirer
  l'étalonnage sans avoir rien perdu ;
- un profil partagé emporte un son, pas les capacités d'une autre voiture —
  la même raison qui a fait sortir le volume général du profil.

**Sans étalonnage, rien ne change** : le profil est employé tel quel. Et
**l'étalonnage ne s'applique qu'entier** : tant qu'une des six étapes manque ou
a été refusée, rien n'est repris automatiquement, et l'écran de configuration
dit lesquelles manquent. Plusieurs des réglages qu'il informe sont des bornes
tirées de ce que la voiture a fait pendant l'étalonnage : au jeu complet elles
décrivent la voiture, à une étape près elles décrivent le bout de route qu'on a
pris ce jour-là. Mesuré en roulant : une seule étape de ville, enregistrée dans
un bouchon à moins de 30 km/h, portait la vitesse plausible maximale à 40 km/h —
au-delà, chaque mesure était rejetée comme aberrante et la vitesse se figeait.
Les propositions, elles, restent affichées étape par étape et se recopient à la
main.

**Banc** — conduire une vitesse à la main, sans rouler : les deux pédales, le
curseur d'allure maintenue, et les réglages de ce que la source fabrique
(cadence, bruit de mesure, précision annoncée). Il rappelle la vitesse, le
régime et le rapport, de façon à se suffire sans regarder les cadrans. Ces
commandes vivaient sous les cadrans de l'écran de conduite ; elles y prenaient
la place de ce qu'on lit en roulant.

**Synthèse** — il fait jouer engine-sim en direct au lieu de la banque
d'échantillons, et sert à trouver un timbre. Comme le Banc, il **n'existe pas en
production** : on ne règle pas un timbre en conduisant, et l'écran embarqué
reste sobre. Les deux sont dans l'image `:develop`, parce qu'un son se règle
garé, sur l'appareil qui le rendra.

Le régime affiché au cadran est **imposé** au dynamomètre du moteur simulé, et
l'effort ouvre son papillon. Le choix compte : laisser le moteur trouver son
régime serait plus fidèle, mais le régime entendu ne serait plus celui du
cadran, et c'est le cadran qu'on croirait faux.

Il se paie, et le prix est un son trop pur. Le dynamomètre tient la vitesse par
une contrainte du solveur : mesurée à chaque pas de simulation, l'ondulation du
vilebrequin est **exactement nulle**, à tous les régimes, alors qu'un moteur réel
accélère à chaque explosion et ralentit entre deux. Un régime rigoureusement
constant donne une fréquence pure — « on dirait un oscilloscope ». Le réglage
**Régime délissé** lui rend une irrégularité, par un bruit filtré dont on règle
l'amplitude en tours et la vitesse de dérive en hertz. À zéro, on retrouve le
régime parfaitement lisse.

Une ondulation régulière, calée sur les explosions, a été essayée d'abord : elle
ne change rien, ses bandes latérales retombant exactement sur les harmoniques
voisines. Ce qui manque à ce son n'est pas une ondulation, c'est de
l'irrégularité.

L'écran règle et **mesure** à la fois. Il donne le régime demandé et le régime
tenu, l'**ondulation du régime** — relevée à chaque pas de simulation, la seule
cadence où elle est visible —, le coefficient temps réel du calcul, la charge, le
nombre et la durée des creux, la réserve du lecteur, le niveau crête, **le niveau
et l'écrêtage en sortie** — mesurés tout au bout de la chaîne, là où le premier
niveau crête ne voit pas encore ce que la résonance fait déborder —, le niveau
efficace et la
**brillance** — la part de l'énergie au-dessus d'un kilohertz, qui dit si
l'effort change le timbre ou seulement le volume. Un **balayage de régime** va
du ralenti au rupteur et revient, à cadence fixe, pour écouter la montée sans
rouler. Une case *Mesurer en silence* coupe la sortie sans rien arrêter
derrière : tous ces chiffres se relèvent en amont du haut-parleur.

L'écran sépare deux choses qui se confondaient. **Le calcul et le poste** — la
fréquence de simulation, la longueur de la réponse impulsionnelle interne, la
taille de bloc, le niveleur d'engine-sim et sa crête visée, puis à chaud les deux bornes du
papillon, le volume, le silencieux, la résonance d'échappement, son accord, sa
longueur et la réserve visée — restent des préférences de l'appareil : ils
décrivent la machine qui calcule, et n'ont aucune raison de suivre un profil
d'une voiture à l'autre. **Le moteur**, lui, vit dans le profil.

### Le moteur se décrit dans le profil

Les deux moteurs simulés étaient écrits en dur dans le C++ : changer un volume
de chambre demandait de recompiler le WebAssembly, une minute, et personne
d'autre que la machine ne pouvait le faire. Or c'est à l'oreille que ces valeurs
se trouvent.

Vingt-sept nombres décrivent maintenant le moteur, dans une section du profil.
Ils voyagent avec lui — stockage, fichier exporté, lien de partage — et se
règlent dans l'onglet Synthèse, groupés par famille : géométrie, culasse, cames,
admission, échappement, rupteur, bruits.

À côté de chaque valeur réglée, la valeur de **référence** apparaît dès qu'elle
en diffère — celle du GM LS pour un huit cylindres, celle de l'EJ25 pour un
quatre. C'est ce qui a manqué au V8 : son échappement portait les cotes d'un
EJ25 sans que rien ne le signale, et il a fallu comparer ligne à ligne pour s'en
apercevoir. S'écarter d'une référence doit être un choix visible.

Tout, sauf les deux bruits, rebâtit le moteur simulé — une seconde de coupure.
Le **rupteur** figure dans la liste mais en gris : il se règle dans la section
moteur du profil, et deux réglages pour un seul chiffre finiraient par se
contredire. Restent en dur dans le C++ les courbes de débit des soupapes, qui
sont des relevés de banc et non des réglages, ainsi que l'ordre d'allumage et
les angles de manetons, qui *définissent* le moteur et suivent le nombre de
cylindres — d'où deux valeurs possibles pour lui, quatre ou huit.

La liste des paramètres, leurs unités et les valeurs des deux définitions de
référence sont dans [`native/CONTRAT-MOTEUR.md`](native/CONTRAT-MOTEUR.md).
C'est la source de vérité : le C++ lit ces nombres **par position**, et cet
ordre est le contrat.

### On charge un moteur, puis on affine

Vingt-huit curseurs ne se règlent pas un par un. « C'est vraiment difficile de
trouver des réglages qui sont bien, ils ont tous des effets les uns sur les
autres et y'en a beaucoup » : un moteur est un ensemble où les valeurs
s'accordent, pas vingt-huit nombres indépendants.

L'onglet Synthèse ouvre donc la section du moteur sur une **bibliothèque de
moteurs**, un bouton par moteur, avant les curseurs. Charger un moteur écrit
d'un coup sa définition **et** son rupteur dans le profil actif : les deux
décrivent le même moteur, et un GM LS sous le rupteur d'un quatre cylindres n'en
serait plus un.

Une ligne dit ce qui est chargé. Trois cas :

| Ce qu'on lit | Ce que ça veut dire |
|---|---|
| `Chargé : GM LS — V8 5,7 L` | les vingt-sept valeurs et le rupteur sont exactement ceux de ce moteur |
| `Chargé : GM LS — V8 5,7 L, modifié — 3 valeurs changées` | on est parti de ce moteur et on l'a retouché ; le bouton **Annuler les retouches** le recharge tel quel |
| `Réglages personnels` | plus de la moitié des valeurs diffèrent du moteur le plus proche : rien ne dit plus d'où l'on est parti, et l'écran préfère ne rien affirmer |

Le départ n'est pas mémorisé : il se **déduit** en comptant les valeurs qui
diffèrent de chaque moteur connu. Un profil reçu par lien se lit donc comme un
autre, et la ligne reste juste après un rechargement de la page.

Ce qui limite la liste n'est pas le nombre de définitions disponibles, mais les
architectures que le C++ sait construire : quatre cylindres en ligne, et V8 à
quatre-vingt-dix degrés à vilebrequin croisé.

Le **silencieux** est un passe-bas, placé avant la séparation du son sec et du
son réverbéré puisque c'est le même échappement qui les porte. Il répare un
manque : le modèle rend les impulsions crues et rien n'absorbait leur haut du
spectre. Relevé au ralenti, la bande 4-16 kHz était à 12 dB seulement sous la
bande 200-800 Hz, quand une prise faite dans une vraie voiture est à 22-37 dB en
dessous. Au-delà de 20 kHz le filtre est **coupé**.

Il est **coupé par défaut**, et c'est une histoire instructive. Il avait été
ajouté pour masquer un parasite aigu, réglé d'abord à 3 500 Hz sur la foi du
spectre moyen, puis descendu à 1 kHz à l'oreille — où il « coupe trop d'autres
sons et rend le moteur sourd ». La vraie cause était ailleurs : les deux bruits
d'engine-sim ci-dessous. Une fois ceux-ci réglés, le spectre décroît tout seul et
le filtre n'a plus rien à retirer.

Le **bruit d'air** et la **gigue d'échantillonnage** sont deux bruits
qu'engine-sim ajoute à dessein, et qui étaient restés aux valeurs de sa
structure — des valeurs de démonstration, pas un réglage. Le bruit d'air ne
s'ajoute pas au signal : il le **multiplie**, si bien qu'à un le moteur est
entièrement modulé par un bruit blanc filtré à 2 kHz. La gigue, filtrée à
10 kHz, produisait une remontée du spectre dans l'aigu — ce qu'aucun moteur ne
fait. Ramenés à 0,15 et 0,05, le parasite à 8 kHz recule de 17 dB et le corps du
moteur gagne 6 dB. Pas zéro : un moteur a du souffle, et le retirer tout à fait
sonne synthétique.

La **résonance** est une captation réelle : un enregistrement fait sur un vrai
échappement, choisi par le sélecteur **Échappement**. Elle porte ce qu'aucun
modèle ne reproduit — la géométrie du tube, le silencieux, la caisse, le lieu de
la prise. Quatre sont livrées, reprises de la bibliothèque d'engine-sim (voir
[`public/impulse/`](public/impulse/LISEZMOI.md)) ; celle du V8 Chevrolet 454 est
retenue par défaut.

Le **tube fabriqué** reste disponible en repli, et son **accord** en donne la
fréquence — 57 Hz vaut environ trois mètres. Il a servi de remède intermédiaire
et garde son intérêt : il ne demande aucun fichier.

Elle a longtemps été un bruit blanc, repris d'engine-sim, et c'était faux :
convoluer des explosions par du bruit rend du bruit. À haut régime la texture
tenait, mais en dessous on entendait un souffle à la place du moteur. Mesuré sur
un ralenti de V8, tout en réverbéré, par le facteur de crête — il dit si les
coups restent détachés :

| Réponse | Niveau efficace | Facteur de crête |
|---|---|---|
| aucune, son sec | 0,023 | 6,0 |
| bruit blanc | 0,023 | 3,4 |
| tube à 57 Hz | 0,062 | 5,7 |

La résonance et sa **longueur** ne changent que la couleur, pas le niveau : la
réponse est normalisée en énergie et le mélange se fait en racine. Sans cela,
monter la résonance baissait fortement le volume, et l'on ne pouvait juger ni
l'un ni l'autre.

Aucune animation nulle part : les valeurs changent, rien ne bouge pour le
plaisir. La règle n'a pas d'exception. Elle en a eu une, levée sciemment en
septembre 2026 pour un décor défilant ; le décor était raté, il a été retiré,
puis abandonné — l'exception est retirée avec lui. L'**aiguille** d'un cadran,
elle, n'a jamais relevé de cette règle : son mouvement est la valeur, elle n'a
aucune inertie propre, et un cadran se lit d'un coup d'œil là où un nombre se lit
en le lisant — c'est le même argument d'ergonomie qui fonde la règle.

---

## Démarrer en développement

```bash
npm install
```

```bash
npm run dev
```

Pour tester depuis un téléphone sur le même réseau :

```bash
npm run dev:mobile
```

Le serveur passe alors en HTTPS et écoute sur toutes les interfaces : ouvrir
`https://<adresse-du-poste>:5173`. Le certificat est auto-signé, le téléphone
demande donc de confirmer une fois.

> **Le chiffrement n'est pas décoratif.** La géolocalisation, le verrou d'écran,
> le service worker et l'AudioWorklet n'existent que dans un « contexte
> sécurisé ». `localhost` en est un même en clair — d'où le `npm run dev`
> ordinaire — mais **pas** une adresse de réseau local. En `http://192.168.x.x`,
> la page s'affiche normalement et le GPS refuse de démarrer, sans message.

Le simulateur et le rejeu ne sont proposés **qu'en développement et dans
l'image `:develop`** : ce sont des outils d'atelier, et dans la voiture qui sert
au quotidien on est toujours au GPS. Ils sont revenus dans la pile d'essai le
8 septembre 2026, parce que c'est là, garé, qu'un timbre se règle et qu'on
distingue un défaut de son d'un défaut de signal. Dans la construction de
production, la rangée de boutons disparaît entièrement — un seul bouton qu'on ne
peut pas désactiver n'est pas un choix — et seul le statut de la source reste
affiché.

Au clavier, source « Simulateur » :

| Touche | Effet |
|---|---|
| ↑ | Accélérateur |
| ↓ | Frein |
| ← → | Descendre / monter un rapport, en mode manuel |

Une **manette Xbox** branchée sur le poste conduit le simulateur, et c'est un
meilleur outil que le clavier pour juger un son : la charge s'entend sur des
transitions, et une touche tout ou rien ne produit que la plus brutale.

| Commande | Effet |
|---|---|
| Gâchette droite | Accélérateur, analogique |
| Gâchette gauche | Frein, analogique |
| A / B | Monter / descendre un rapport |
| X | Boîte automatique ou manuelle |
| Y | Tenir la vitesse courante, ou rendre la main |
| Stick gauche, haut et bas | Volume général |

La manette n'apparaît **qu'après un premier appui** sur un de ses boutons : le
navigateur ne la révèle pas avant, pour ne pas la donner comme empreinte à toute
page ouverte. Elle ne reprend la main sur les curseurs de l'écran qu'en étant
touchée, et la rend en revenant au repos.

L'écran affiche **ce que le navigateur annonce** — le nom de la manette et son
agencement — plutôt que de le juger. Aucun agencement n'est refusé : exiger le
standard écartait en silence des manettes qui s'annoncent autrement selon le
navigateur, le pilote et le mode de liaison, et l'écran affirmait alors qu'aucune
manette n'était branchée. Quand l'agencement n'est pas standard, l'écran prévient
que les boutons peuvent ne pas correspondre à ceux du tableau.

Le curseur **Allure maintenue** est un régulateur : le simulateur tient la
vitesse choisie, comme on le fait sur autoroute, jusqu'à ce qu'on accélère ou
qu'on freine. C'est la façon la plus simple d'écouter un régime stabilisé.

### Ce que le banc fabrique

Le simulateur a **trois modes**, de fidélité croissante. Ils ne changent pas sa
physique, mais ce qu'il **émet** — et c'est là que se joue la difficulté du
produit, car la voiture ne donne jamais sa vitesse exacte.

| Mode | Ce qui sort | Ce que ça éprouve en plus |
|---|---|---|
| **Vitesse exacte** | une vitesse parfaite à chaque image | rien : commode pour juger un réglage de son sans le bruit du signal |
| **Mesure GPS** | la même vitesse, à la cadence d'un récepteur et bruitée | le conditionnement sur un signal réel : extrapolation, ressort, charge qui frémit, plafond de plausibilité, chien de garde |
| **Positions GPS** | des positions complètes, lues par la **vraie** source GPS | la source elle-même : dérivation par distance, rejet des positions trop rapprochées, filtre de précision |

Les deux derniers défauts relevés en roulant — la source qui se tait, le plafond
de plausibilité qui rejetait tout — vivaient dans ce que seul le troisième mode
traverse. C'est la raison de l'avoir fait.

Quatre réglages accompagnent les deux derniers modes : la cadence en roulant
(30 ms, la valeur mesurée sur la voiture), la cadence à l'arrêt (le récepteur
s'espace quand rien ne bouge), le bruit de mesure, et la précision annoncée. Le
mode *Positions GPS* ajoute une case **« le récepteur annonce sa vitesse »** :
décochée, la source doit dériver la vitesse de deux positions — le chemin où elle
s'était tue. On ne sait pas encore ce que fait la Tesla, et les deux cas
s'écoutent ici sans attendre un trajet.

Mesuré au banc, en croisière tenue à 110 km/h :

| | Vitesse exacte | Mesure GPS | Positions GPS |
|---|---|---|---|
| Écart-type de l'accélération vue | 0 | 0,177 m/s² | 0,179 m/s² |
| Pointe d'accélération | 0 | 0,51 m/s² | 0,48 m/s² |

Un quart de la charge pleine du profil Route en pointe, sur une vitesse qui ne
bouge pas : voilà ce que le premier mode cache.

**Le simulateur n'existe dans aucune image publiée.** Dans une voiture il n'a
aucun sens, et il n'y serait qu'un moyen de se tromper sur ce qu'on entend. Ni
`:latest` ni `:develop` ne le proposent, et la source au démarrage est donc le
GPS partout.

L'image `:develop` l'a porté jusqu'au 10 septembre 2026, avec l'écran de réglage
de la synthèse. C'est elle qu'on essaie en roulant, et elle démarrait sur le
simulateur : sur l'essai de ce soir-là, trente-six secondes de simulateur avant
la première position. Le banc reste en développement, où l'on règle un son garé,
et `BENCH=1` permet de le mettre dans une image construite à la main.

Autres commandes :

```bash
npm run dev:mobile   # idem, en HTTPS, pour tester depuis un téléphone
npm run relecteur    # idem, avec les dossiers du NAS, pour /relecteur.html
npm run build        # produit dist/
npm run typecheck    # vérification TypeScript stricte
npm run lint         # style et fautes courantes
npm test             # les tests du cœur, une passe
npm run test:watch   # les tests en continu, pendant qu'on écrit
npm run coverage     # couverture de src/core/
npm run banque       # relève une banque entière : ancrages et gains
npm run transcode    # compresse les échantillons en FLAC
npm run deploy       # recopie le build vers le NAS
npm run icons        # régénère les icônes de l'application
npm run silence      # régénère le silence qui maintient la session audio
npm run htpasswd     # produit un fichier de mots de passe pour nginx
```

Les quatre premières sont le contrôle à passer avant de pousser — c'est
exactement ce que vérifie la chaîne d'intégration. Les tests portent sur
`src/core/`, qui n'importe jamais Vue : ils tournent sous Node, sans navigateur,
en une seconde.

---

## Installation sur un NAS Synology

Une chaîne d'intégration construit l'image et la publie sur le registre de
conteneurs GitHub. **Le NAS ne construit rien et ne reçoit aucun fichier** :
Portainer tire une image prête. Tout se fait dans les interfaces de DSM et de
Portainer ; il n'y a pas de terminal à ouvrir sur le NAS.

Trois étiquettes d'image, selon l'usage : `latest` est la production, publiée
depuis `main` ; `develop` est l'intégration, à tirer dans une seconde pile sur
un autre port pour essayer un lot en voiture avant d'en faire une version ; et
`vX.Y.Z` est une version figée, publiée par son tag.

L'hébergement reste chez soi, ce qui règle du même coup la question des
échantillons, puisque rien n'est publié.

### 1. Créer les dossiers et déposer les échantillons — File Station

Six dossiers, sous `/volume1/docker/speed/` :

| Dossier | Contenu | Accès |
|---|---|---|
| `audio/procar/` | les échantillons du moteur — un dossier par banque, et l'application les découvre toute seule | lecture |
| `profiles/` | les profils partagés entre appareils, et ceux qui remontent de la voiture. **Peut rester vide** | lecture-écriture |
| `traces/` | les trajets enregistrés en roulant. **Peut rester vide** | lecture-écriture |
| `journal/` | le journal de bord, déposé tout seul en roulant. **Peut rester vide** | lecture-écriture |
| `mesures/` | les relevés de mesure, dont ceux de la sonde. **Peut rester vide** | lecture-écriture |
| `profils/` | ce que le profileur mesure de la vraie voiture. **Peut rester vide** | lecture-écriture pour le profileur, lecture pour le site |

Les six doivent **exister avant** de déployer la pile : Docker sous DSM ne
crée pas un point de montage absent, il refuse de démarrer le conteneur avec un
`Bind mount failed`. Des dossiers `profiles/`, `traces/`, `journal/`,
`mesures/` et `profils/` vides suffisent — et à défaut, il faut commenter leur
ligne dans la pile, au prix de la bibliothèque de profils, du dépôt de traces,
du journal, des relevés et du profil mesuré.

**`profils/` et `profiles/` sont deux dossiers différents**, et ce n'est pas
une faute de frappe : le premier, en français, ne contient qu'un fichier écrit
par le profileur ; le second, en anglais, est la bibliothèque de profils
partagés. Ils ont des droits différents et ne se remplacent pas.

**`profils/` est né avec le profileur**, le 11 septembre 2026. Une pile
installée avant lui ne le monte pas et ne lance pas le second conteneur : il
faut **recoller la pile entière** dans Portainer, un simple « repull » ne crée
pas un service absent. Sans cela, l'application demande le profil mesuré,
reçoit la page d'accueil à sa place, et n'a jamais rien à proposer — ce qui
s'est produit le soir même. L'écran de télémétrie le dit maintenant, dans la
section « Profil mesuré ».

**`profiles/` était en lecture seule** jusqu'à la remontée automatique. Il passe
en écriture parce que c'est là qu'un profil réglé dans la voiture doit atterrir :
c'est ce dossier que la bibliothèque lit. Une pile déjà en service garde son
montage en lecture tant qu'elle n'est pas redéployée, et le dépôt d'un profil
échoue alors en disant que le serveur n'a pas le droit d'écrire.

Les quatre dossiers exigent **toujours** de s'authentifier — en lecture comme
en écriture —, même quand l'authentification générale reste désactivée. Il faut
donc le fichier de mots de passe, voir plus bas.

L'écriture l'a toujours exigé : un dossier ouvert en écriture sur une adresse
joignable de l'extérieur est une invitation. **La lecture ne l'exigeait pas**, et
c'était un trou : l'adresse est publique — la voiture n'est pas sur le réseau
local —, si bien que qui la connaissait pouvait lister les trajets et les
télécharger, positions comprises dès le cran étendu du journal. Fermé le
6 septembre 2026.

Conséquence à connaître : **la bibliothèque de profils est vide sur un appareil
où le compte de dépôt n'est pas saisi.** Le partage par lien, lui, ne passe pas
par le serveur et fonctionne toujours.

Aucun n'accepte la suppression : l'application ne peut pas effacer ce qu'elle a
déposé. C'est voulu pour le journal — un témoin qui peut effacer ses notes est un
mauvais témoin — et le ménage se fait avec File Station.

Les échantillons restent hors de l'image : ils ne sont ni dans le dépôt ni dans
le registre, et changer de banque sonore consistera à remplacer ces fichiers,
sans rien reconstruire.

### 2. Rendre l'image accessible au NAS

Un paquet publié depuis un dépôt privé est privé lui aussi. **Sa visibilité se
règle pourtant séparément de celle du dépôt** — les deux ne sont pas liées, et
c'est ce qui permet de simplifier cette étape sans ouvrir son code.

**Option recommandée : rendre le paquet public.** Portainer n'a alors plus rien à
authentifier et cette étape disparaît. L'image ne contient que l'application
compilée : ni échantillons, ni secrets — il n'y en a aucun, tout s'exécute dans
le navigateur.

Le réglage se trouve sur le **profil**, pas sur le dépôt — c'est ce qui le rend
introuvable quand on le cherche dans les paramètres du projet :

<https://github.com/users/davidp57/packages/container/speed/settings>

Puis, tout en bas, *Danger Zone* › **Change package visibility** › *Public*.
GitHub demande de retaper le nom du paquet pour confirmer.

Par la navigation : cliquer son avatar › *Your profile* › onglet **Packages** ›
`speed` › *Package settings* dans la colonne de droite. L'onglet Packages
n'apparaît que si l'on est connecté, un paquet privé n'étant pas listé autrement.

**Option conservatrice : garder le paquet privé.** Il faut alors déclarer le
registre dans Portainer › **Registries** › **Add registry** › **Custom
registry** :

| Champ | Valeur |
|---|---|
| Name | GitHub |
| Registry URL | `ghcr.io` |
| Authentication | activé |
| Username | `davidp57` |
| Password | un **jeton d'accès personnel** GitHub |

Le jeton se crée dans GitHub › Settings › Developer settings › Personal access
tokens › Tokens (classic), avec la seule portée **`read:packages`**. Le mot de
passe du compte ne fonctionne pas.

### 3. Créer la pile — Portainer

Portainer › **Stacks** › **Add stack** › **Web editor**, nommer la pile `speed`,
coller le contenu de `docker/docker-compose.yml`, puis **Deploy the stack**.

| À vérifier | Pourquoi |
|---|---|
| Le port `8088` | Il peut déjà servir sur le NAS. Le changer dans la pile si Portainer se plaint |
| Le chemin `/volume1/…` | Le nom du volume peut différer selon le modèle |

Le service répond alors sur `http://<ip-du-nas>:8088` — en clair, et seulement
depuis le réseau local. C'est normal à ce stade : le GPS ne marchera pas encore,
faute de chiffrement.

### 4. Publier en HTTPS — DSM

**Panneau de configuration** › **Portail des applications** › **Proxy inversé** ›
**Créer** :

| Champ | Valeur |
|---|---|
| Description | Speed |
| Protocole source | **HTTPS** |
| Nom d'hôte source | `speed.<votre-nom>.synology.me` |
| Port source | `443` |
| Protocole destination | **HTTP** |
| Nom d'hôte destination | `localhost` |
| Port destination | `8088` |

Le nom DDNS s'obtient dans **Accès externe** › **DDNS** s'il n'existe pas déjà.
Puis **Sécurité** › **Certificat** : obtenir un certificat Let's Encrypt pour ce
nom, et l'affecter à ce service dans **Paramètres**.

### 5. Faut-il ouvrir le NAS sur Internet ?

**Le plus souvent, non** — et c'est un changement récent. Depuis que
l'application fonctionne [hors réseau](#hors-réseau), il suffit de l'ouvrir une
fois chez soi, sur le wifi, en appuyant sur *Préparer hors réseau*. Elle tourne
ensuite sur son cache, en voiture, sans rien demander à personne. Le NAS n'a
alors besoin d'être joignable que pour installer une mise à jour, depuis la
maison.

Si l'on tient malgré tout à y accéder de l'extérieur, il faut rediriger le port
443 de la box vers le NAS — et **l'adresse devient publique**. Activer alors
l'authentification :

```bash
npm run htpasswd
```

Le mot de passe est demandé en saisie masquée, et le fichier `htpasswd` produit
se dépose dans `/volume1/docker/speed/` avec File Station. Il reste à
décommenter les deux lignes `auth_basic` de `docker/nginx.conf` et le volume
correspondant dans la pile.

### Déposer : le fichier de mots de passe

Tout ce qui remonte de la voiture exige ce fichier, **indépendamment de
l'authentification générale** : `traces/`, `journal/`, `mesures/` et
`profiles/` sont les seuls endroits du serveur qui acceptent d'écrire, et ils ne
l'acceptent que de quelqu'un qui s'annonce.

En quatre gestes, une fois pour toutes :

```bash
npm run htpasswd
```

1. La commande demande un **nom d'utilisateur**, puis un **mot de passe** — huit
   caractères au minimum, saisi en aveugle, à confirmer. Rien n'apparaît à
   l'écran pendant la frappe, et le mot de passe ne passe pas en argument : il
   resterait dans l'historique du terminal et dans la liste des processus.
   Relancer la commande **ajoute** une entrée au fichier, et remplace celle d'un
   nom déjà présent — il en faudra deux, la vôtre et celle du dépôt.
2. Elle écrit un fichier nommé `htpasswd` dans le dossier courant. Il tient sur
   une ligne : le nom d'utilisateur, puis l'empreinte du mot de passe. Le mot de
   passe lui-même n'y est pas — il n'est pas récupérable, et il faut refaire
   l'opération si on l'oublie.
3. Déposer ce fichier dans `/volume1/docker/speed/` avec File Station.
4. Dans la pile Portainer, **ajouter** les deux lignes suivantes sous
   `volumes:`, puis tirer l'image à jour et redéployer :

```yaml
      - /volume1/docker/speed/traces:/usr/share/nginx/html/traces
      - /volume1/docker/speed/journal:/usr/share/nginx/html/journal
      - /volume1/docker/speed/mesures:/usr/share/nginx/html/mesures
      - /volume1/docker/speed/htpasswd:/etc/nginx/htpasswd:ro
```

Et **retirer le `:ro`** de la ligne des profils, qui devient elle aussi un
dossier où l'on écrit :

```yaml
      - /volume1/docker/speed/profiles:/usr/share/nginx/html/profiles
```

> **Ajouter, et non décommenter.** Une pile Portainer contient le texte qu'on y
> a collé le jour de sa création, pas le fichier du dépôt : les lignes
> commentées de `docker/docker-compose.yml` n'y sont pas, et le volume des
> traces est de toute façon nouveau. Les commentaires du dépôt indiquent quoi
> monter ; c'est dans l'éditeur de pile que le montage se déclare.

### Le profileur, un second conteneur

Depuis le 11 septembre 2026, la pile contient **deux** services : `speed`, qui
sert le site, et `speed-profileur`, qui relit les traces déposées et en tire le
profil de la vraie voiture. Le second n'ouvre aucun port et ne sert rien ; il
écrit un fichier que le premier expose.

Les deux images viennent du **même commit** — c'est ce qui garantit qu'elles
calculent la même chose, et les redéployer séparément les ferait diverger.

**Ajouter un service demande de recoller la pile.** Tirer les images à jour ne
crée pas un conteneur qui n'était pas déclaré : il faut reprendre le texte de
[`docker/docker-compose.yml`](docker/docker-compose.yml) dans l'éditeur de pile
Portainer, et redéployer. Sans cela, l'application demande le profil mesuré et
ne trouve rien — l'écran de télémétrie l'affiche alors dans sa section
« Profil mesuré ».

### Redéployer ne suffit pas à changer de version

Mettre une pile à jour recrée le conteneur, mais **Docker réutilise l'image
qu'il a déjà en local** : une étiquette comme `develop` ou `latest` ne change pas
de nom quand son contenu change, et rien n'oblige Docker à aller voir. On croit
donc déployer la dernière version et l'on relance l'ancienne.

Deux façons de s'en assurer :

- dans Portainer, cocher **« Re-pull image and redeploy »** avant de mettre la
  pile à jour ;
- ou nommer l'image par son empreinte de commit. Le workflow publie, à côté de
  `develop` et `latest`, une étiquette immuable `sha-<commit court>` :

```yaml
    image: ghcr.io/davidp57/speed:sha-28cc0a1
```

Docker ne l'a jamais vue, donc il la tire forcément. C'est le moyen le plus sûr
de savoir ce qui tourne, et le seul de revenir à une version précise.

Pour vérifier ce qui tourne réellement, sans Portainer : la date de
`Last-Modified` sur la page d'accueil est celle de la construction de l'image.

```bash
curl -I https://ADRESSE/index.html
```

Le dossier `/volume1/docker/speed/traces/` doit **exister** avant de
redéployer, même vide : Docker sous DSM refuse de démarrer un conteneur dont un
point de montage est absent, avec un `Bind mount failed`.

**Il n'y a rien d'autre à décommenter pour le dépôt.** Les deux lignes
`auth_basic` de `docker/nginx.conf` protègent le site *entier* et ne servent que
si l'adresse est exposée hors du réseau local ; l'emplacement `traces/`, lui,
porte sa propre exigence, déjà active.

Sans ce fichier, le dépôt est refusé — la lecture des traces, des profils et de
l'application continue de fonctionner normalement.

### Un ou deux comptes ?

L'application s'annonce elle-même, avec **un nom et un mot de passe** du fichier
`htpasswd` — pas autre chose. Elle est obligée de le faire : le navigateur ne
fournit l'authentification qu'après l'avoir demandée, et il ne la demande que sur
une **navigation**, jamais sur une requête lancée par une page. Un dépôt
recevrait donc un refus sans que rien ne s'affiche.

Le compte que vous avez déjà **fonctionne**. Mais un second, dédié au dépôt, vaut
mieux, et pour deux raisons précises :

- il vit en clair dans le navigateur de la voiture. Le vôtre n'a pas à y être ;
- si vous activez un jour l'authentification générale du site, le vôtre ouvrirait
  **tout**, alors qu'un compte dédié ne sert qu'au dépôt — et se révoque seul, en
  retirant sa ligne du fichier.

| Nom | Sert à | Vit où |
|---|---|---|
| le vôtre | déposer à la main, avec `curl` ou en naviguant | sur le poste de travail |
| `depot` | à l'application, depuis la voiture | dans le navigateur de la voiture |

Donnez au second un mot de passe **que vous pouvez taper** : il faudra le saisir
une fois dans la voiture, sur un écran tactile. Quelques mots séparés par des
tirets valent mieux qu'une suite aléatoire.

`npm run htpasswd`, avec `depot` comme nom d'utilisateur. Le script **ajoute**
une entrée sans écraser les autres.

### Déposer depuis la voiture

Une fois le compte créé et le fichier déposé sur le NAS :

1. écran **Configuration**, champ **Compte de dépôt** : saisir le nom et le mot
   de passe. Il n'y a pas de bouton d'enregistrement — comme tous les réglages de
   cet écran, cela se retient à la frappe, et la mention à côté du champ le
   confirme. C'est rangé hors du profil : cela ne voyage donc pas avec un profil
   partagé, et il n'y aurait aucun sens à envoyer à quelqu'un un son accompagné
   du droit d'écrire sur son NAS ;
2. c'est tout. Le même compte sert à tout ce qui remonte tout seul — capture du
   trajet, journal, relevés de mesure, profils — dès que la remontée est
   acceptée, et à la page de mesure `/sonde/`, qui dépose son relevé du même
   bouton.

Il n'y a plus de bouton pour déposer un trajet : **la capture part d'elle-même**,
par tranches, pendant qu'on roule. Voir « La capture du trajet » plus bas.

Ce qui peut échouer se lit sur l'écran de télémétrie, et les cas se distinguent
parce qu'ils ne se corrigent pas au même endroit :

| Message | Ce qu'il faut faire |
|---|---|
| Aucun compte de dépôt | le régler à l'écran de configuration |
| Refusé | le nom ou le mot de passe ne correspond pas au fichier du serveur |
| Le serveur n'a pas le droit d'écrire | les permissions du dossier, côté DSM |
| Pas de réseau | rien : ce qui attend partira à son retour |

Une tranche n'est **jamais** perdue au profit d'un dépôt raté : elle revient en
attente et se joint à la suivante, ce qui fait qu'un tunnel ne coûte pas un
trajet.

> **En développement, le dépôt répond 404.** Il vise le serveur qui sert
> l'application, et celui de Vite n'a pas ce dossier. C'est en production que la
> chose se vérifie.

> Depuis le wifi de la maison, le nom DDNS résout vers l'adresse publique : sans
> **NAT loopback** activé sur la box, l'accès échoue alors qu'il fonctionne en
> 4G.

### 6. Vérifier

1. La page s'affiche, le cadenas est fermé.
2. Écran Conduite › **D** → autoriser la localisation → le statut passe à
   « actif » et l'icône de son s'allume.
3. Écran Télémétrie → « Intervalles récents » se remplit, autour de 1000 ms.

Si le GPS reste muet alors que la page s'affiche, c'est presque toujours le
contexte sécurisé : vérifier que l'adresse est bien en `https://`.

### Mettre à jour

```bash
git push
```

La chaîne d'intégration vérifie le code, construit l'image pour les deux
architectures et la publie. Ensuite, dans Portainer : ouvrir la pile `speed`,
cocher **Re-pull image and redeploy**, puis **Update the stack**. Les
échantillons ne sont pas touchés, étant montés depuis le NAS.

### Variante sans registre

`docker/docker-compose.volumes.yml` lance `nginx:alpine` tel quel et prend tout
par volumes, y compris le site. Utile pour essayer une modification sans attendre
la chaîne d'intégration, ou pour dépanner si le registre est inaccessible. Elle
suppose de recopier le build sur le NAS :

```bash
setx SPEED_DEPLOY_TARGET "Z:\docker\speed\dist"
```

```bash
npm run build && npm run deploy
```

---

## Une seconde pile, pour essayer l'intégration

L'étiquette `develop` est publiée à chaque lot fusionné, avant qu'il devienne
une version. La faire tourner **à côté** de la pile de production permet
d'essayer en voiture ce qui n'est pas encore sorti, sans toucher à
l'application qui sert au quotidien.

### 1. La pile — Portainer

**Stacks** › **Add stack** › **Web editor**, nommer la pile `speed-develop`,
coller le contenu de [`docker/docker-compose.develop.yml`](docker/docker-compose.develop.yml),
puis **Deploy the stack**.

Les dossiers `audio/` et `profiles/` doivent exister, comme pour la production —
c'est le même arrangement, et les mêmes dossiers.

Elle diffère de la production sur trois points, et les trois comptent : un autre
nom de conteneur, un autre port (`8089`), et une autre adresse dans le proxy
inversé. Les échantillons et les profils déposés sont partagés, en lecture
seule : rien à recopier.

### 2. L'adresse — DSM

**Panneau de configuration** › **Portail des applications** › **Proxy inversé** ›
**Créer** :

| Champ | Valeur |
|---|---|
| Description | Speed (intégration) |
| Protocole source | **HTTPS** |
| Nom d'hôte source | `speed-dev.<votre-nom>.synology.me` |
| Port source | `443` |
| Protocole destination | **HTTP** |
| Nom d'hôte destination | `localhost` |
| Port destination | `8089` |

Puis **Sécurité** › **Certificat** : le certificat Let's Encrypt doit couvrir ce
nom. Le plus simple est de le demander pour les deux noms à la fois, ou d'ajouter
le nouveau nom au certificat existant.

> **Le HTTPS n'est pas du confort ici.** Le GPS, le verrou d'écran et le service
> worker n'existent que dans un « contexte sécurisé ». En HTTP simple — par
> exemple `http://<ip-du-nas>:8089` — la page s'affiche normalement et la
> localisation est refusée **sans message**. Une pile d'essai sans son nom
> d'hôte ne sert donc à rien pour rouler.

### 3. Mettre à jour

Portainer ne remplace pas de lui-même une image devenue obsolète. Après une
poussée sur `develop` : la pile, **Editor**, puis **Update the stack** en cochant
**Re-pull image**. Une dizaine de secondes.

### Ce que les deux piles ne partagent pas

Les **profils enregistrés dans le navigateur**. Le stockage local appartient à
une adresse : les réglages trouvés sur l'une ne suivent pas sur l'autre. Deux
passerelles pour les transporter — le dossier `profiles/` partagé, qui apparaît
dans la bibliothèque des deux, ou le partage d'un profil par lien.

Il en va de même de l'**installation** : chaque adresse s'installe séparément sur
l'écran d'accueil, avec son propre cache hors réseau. C'est voulu — une pile
d'essai qui écraserait le cache de celle qui sert serait une mauvaise idée.

---

## En voiture

**Plein écran** — masque la barre d'onglets, porte l'affichage à toute la hauteur
et remplace les commandes par quatre grandes touches. Sur le visage à cadrans,
les deux cadrans prennent la hauteur disponible : côte à côte sur un écran large,
empilés en portrait.

**Session média** — l'application apparaît sur l'écran verrouillé et dans le
panneau de notifications, avec le nom du profil, sa configuration et une pochette
dessinée à la volée. Les commandes au volant et les boutons de casque coupent et
rétablissent le son.

**Verrou d'écran** — sans lui, l'écran s'éteint au bout de quelques dizaines de
secondes et l'on perd de vue la vitesse. Le système le relâche à chaque passage
en arrière-plan et ne le rend pas au retour : il est donc redemandé à chaque fois
que la page redevient visible. Quand il est refusé, la raison s'affiche à
l'écran — un verrou qui échoue en silence est indiscernable d'un verrou absent.

**Reprise après suspension** — le système suspend le contexte audio quand
l'application reste longtemps en arrière-plan, ou quand un appel prend la sortie
audio. Il ne le relance jamais seul.

---

## Sur un navigateur embarqué

Le navigateur d'une voiture n'est pas celui d'un téléphone, et deux écueils y ont
été rencontrés en roulant.

**L'horodatage des positions** n'y est pas dans la même base que l'heure
courante — vraisemblablement compté depuis le chargement de la page. Les écarts
entre mesures restent justes, donc le suivi de vitesse n'en souffre pas, mais
dater une mesure avec donne un nombre absurde. La réception est donc horodatée
sur notre propre horloge, et l'horodatage fourni ne sert plus qu'à des
différences.

**Le contexte audio peut être suspendu** sans prévenir et sans changement de
visibilité, ce qui coupait le son dès le passage en arrière-plan. Une
surveillance régulière relance donc le contexte et le média silencieux,
indépendamment de tout événement. Ce média est par ailleurs laissé à plein
volume : son contenu est déjà silencieux, et le baisser en plus le ferait passer
pour inactif auprès du système, qui libérerait la session — exactement ce qu'il
sert à empêcher.

---

## Hors réseau

Une voiture traverse des zones sans couverture, et une application chargée depuis
Internet n'y démarre pas. Un service worker met en cache l'application et les
échantillons : une fois cela fait, tout fonctionne sans connexion, et le serveur
n'a plus besoin d'être joignable pour rouler — seulement pour mettre à jour.

Dans l'écran **Configuration**, section *Hors réseau* :

- **Préparer hors réseau** met en cache tous les échantillons du profil sans
  attendre d'en avoir besoin, et affiche ce qui est déjà disponible. À faire
  avant de partir, plutôt que de découvrir sur la route qu'une couche manque.
- **Installer sur l'écran d'accueil** propose l'installation quand le navigateur
  l'autorise. L'application s'ouvre alors en plein écran, sans barre d'adresse.
- **Libérer les banques inutilisées** vide du cache les échantillons dont plus
  aucun profil ne se sert, et dit combien de place il a rendue. Les échantillons
  y restent indéfiniment par construction — leur cache ne dépend pas de la
  version du code, ce qui évite de retélécharger plusieurs mégaoctets à chaque
  mise à jour — si bien qu'essayer trois banques en laissait trois sur le
  téléphone. Ce qui est libéré se retéléchargera si un profil y revient.

Le compte affiché **suit le profil** : changer de banque, changer de profil ou
éteindre une couche met à jour ce qui est surveillé, donc ce que *Préparer hors
réseau* ira chercher.

Une bannière signale une version plus récente prête à être chargée, ou la perte
du réseau.

### Vérifié comment

Le scénario a été déroulé en conditions réelles sur le build de production :
première visite, préparation, **arrêt du serveur**, rechargement. L'application
démarre, les cinq couches se chargent et le son sort — serveur éteint.

Le listage des banques, lui, n'est pas servi depuis le cache : c'est une adresse
qui se termine par une barre, elle change dès qu'on dépose un dossier, et la
garder d'abord figerait la découverte. Le serveur la déclare `no-store`, ce que
la règle du cache ne regardait même pas — relevé en lisant le contenu réel du
cache après une mise en cache, où les listages s'étaient glissés à côté des
échantillons. Le réseau passe donc devant, la copie ne servant que hors réseau.

Ce test a révélé un défaut qui serait resté invisible autrement. Les serveurs
répondent volontiers `Vary: Origin` sur les fichiers statiques ; une réponse
enregistrée depuis une requête sans en-tête `Origin` ne correspond alors plus à
la même adresse demandée avec — ce qui est le cas du script de l'application, que
Vite déclare `crossorigin`. Résultat : un cache complet, et une page blanche.
Les recherches dans le cache se font donc avec `ignoreVary`.

---

## Référence des réglages

Tout est dans l'écran **Configuration**, appliqué immédiatement. Les sections qui
suivent — moteur, transmission, signal de vitesse, mixage, caractère, couches —
sont celles du **mode avancé** : la bascule en haut de l'écran les fait
apparaître. En mode simplifié, elles sont remplacées par quelques curseurs
globaux qui les commandent.

### Origine du son

Dans le panneau **Profils**, et visible dans les deux modes : chaque profil
déclare **d'où vient son son**. Le choix se fait dans la voiture, et il est
enregistré dans le profil — il suit donc l'export en fichier et le partage par
lien.

| Origine | Ce que c'est | Ce qu'elle coûte |
|---|---|---|
| **Enregistré** | La banque d'échantillons, jouée en changeant sa vitesse de lecture. C'est ce que fait l'application depuis le début | rien de neuf |
| **Généré en direct** | Le moteur est simulé pendant la conduite, sans le moindre échantillon | tout le budget processeur |
| **Généré à l'avance** | La simulation tourne au bureau, produit une banque — une prise par plage de régime — et la voiture la rejoue | comme l'enregistré |

Trois et non deux : le rendu à l'avance n'est pas un repli du direct. Il corrige
un défaut que ni l'un ni l'autre des deux autres ne corrige — la banque livrée
est jouée entre 0,26 et 0,81 fois sa vitesse sur toute la conduite ordinaire, ce
qui descend les résonances de l'échappement en même temps que la fréquence
d'allumage, alors qu'un moteur change de régime sans changer de corps. Une prise
par plage de régime se lit près de un, et le timbre ne se déplace plus. Le
direct, lui, garde ce que la génération perd : un son continu, sans domaine ni
bascule.

#### Le moteur simulé, en conduisant

Un profil *généré en direct* ouvre trois listes sous l'origine du son. Elles se
choisissent au volant ; tout le reste du réglage se fait au banc, sur un
ordinateur.

| Liste | Ce qu'elle change |
|---|---|
| **Moteur** | Le moteur simulé, avec son rupteur **et son réglage de son**. Seul le GM LS est réglé à ce jour ; les autres sonnent avec le réglage par défaut, ce qui s'entend |
| **Échappement** | Combien de résonance passe par-dessus le son direct. *Direct* ne garde que le son cru du moteur, où le grain s'entend le plus ; *enveloppé* ne laisse que le son réverbéré, qui étale les fronts |
| **On écoute** | Le silencieux : refermé bas, la voiture s'entend à travers la tôle et les vitres ; ouvert en grand, on l'entend de dehors |

**Le moteur se change aussi depuis l'écran de conduite**, sur un rang de boutons
sous celui des profils — un par moteur, avec son nom court. Il n'apparaît que si
le profil décrit un moteur simulé. C'est ce qui permet d'essayer plusieurs
moteurs en roulant sans passer par la configuration.

Chaque liste garde une entrée pour la valeur qui ne tombe sur aucun palier :
un réglage fin fait au banc ne se fait pas écraser en ouvrant l'écran. Pour le
moteur, cette entrée dit **de qui il descend** plutôt que « réglé à la main » —
« 454, retouché — 5 valeurs ».

**Le son suit le moteur, pas la voiture.** Échappement, volume, crête visée et
papillon sont enregistrés dans le profil, et chaque moteur de la bibliothèque
pose les siens en arrivant. Sans cela, essayer plusieurs moteurs les ferait tous
écouter à travers l'échappement du premier, et l'on ne saurait plus lequel des
deux on entend. La réserve reste en dehors : elle décrit la machine qui calcule,
et ce qui tient sans un creux sur un poste de bureau n'a pas la même marge sur un
téléphone.

**Les trois sont gréées.** C'est le même bouton « Activer le son » qui les
démarre : un profil *généré en direct* allume le moteur simulé là où les deux
autres chargent une banque.

**Changer d'origine pendant que le son joue prend effet aussitôt**, sans qu'on
ait à réactiver quoi que ce soit : entrer dans *généré en direct* démonte la
banque et allume le moteur simulé, en sortir fait l'inverse. Les deux ne jouent
jamais ensemble — la bascule se fait au changement, et non image par image, pour
qu'une boucle d'affichage arrêtée ne laisse pas les deux sons se superposer. Si
le son n'avait pas été activé, changer d'origine ne l'allume pas.

*Généré à l'avance* ne demande rien de plus qu'*enregistré* — c'est un dossier
d'échantillons comme un autre, produit par
[`scripts/generate-bank/`](scripts/generate-bank/README.md). *Généré en direct*,
lui, a besoin d'un `AudioWorklet` et du WebAssembly : un navigateur qui n'en a
pas le dit dans l'écran de configuration, et la banque continue de jouer plutôt
que de grésiller.

Un profil réglé avant l'arrivée de ce champ est repris en **enregistré**, ce
qu'il a toujours été.

### Définition du moteur simulé

Vingt-sept nombres décrivent le moteur qu'engine-sim construit — alésage,
course, volume de chambre, cames, tubes d'échappement, bruits. Ils sont dans le
profil, voyagent avec lui, et se règlent dans l'onglet **Synthèse**, réservé au
développement : on ne décrit pas un moteur en conduisant. On ne les tourne
d'ailleurs pas un par un : une **bibliothèque de moteurs** en tête de la section
charge un moteur entier — sa définition et son rupteur — et les curseurs servent
ensuite à retoucher. Le détail est plus
haut, dans la présentation de cet écran ; la liste complète, les unités et les
deux définitions de référence sont dans
[`native/CONTRAT-MOTEUR.md`](native/CONTRAT-MOTEUR.md).

Un profil enregistré avant que ce champ ait une forme reçoit la définition de
son profil d'usine — le V8 des deux profils livrés. Aucun profil ne se retrouve
sans moteur à décrire, et basculer son origine en *généré en direct* donne
toujours un son.

### Mode simplifié

Le guide de création sait déduire une cinquantaine de réglages de quatre
réponses. Ce savoir ne servait qu'une fois, à la création ; les curseurs globaux
le rendent disponible en continu. Ils **écrasent** les réglages qu'ils
commandent — un curseur global recalcule, il ne peut pas faire autrement — et un
bouton **Revenir aux réglages d'avant** rend le profil tel qu'il était avant le
premier mouvement.

Aucun des deux n'est enregistré dans le profil : leur position s'en **déduit**.
Le curseur reflète donc ce qu'on a réellement sous les doigts, y compris sur un
profil réglé à la main ou reçu par lien. Mesuré : Route se lit à 22 sur cent de
tempérament, Sport à 80 ; les deux se lisent au milieu de la réactivité, le
milieu du curseur étant par construction le réglage qui a servi jusqu'ici.

| Curseur | Ce qu'il commande |
|---|---|
| **Calme ↔ sportif** | Le caractère du moteur et de la boîte : inertie, montée à vide, temps de passage, écart selon la charge, régimes de passage, plancher et délai de croisière, seuil de rétrogradage au freinage, rétrogradage forcé, pétarade, à-coup de passage. Il ne touche ni au pont, ni aux démultiplications, ni au rupteur, ni au mixage. Mesuré sur Route, pied au plancher : la pointe de régime passe de 3929 tr/min au plus calme à 6043 au plus sportif, pour un rupteur à 6500 |
| **Pépère ↔ nerveux** | La réactivité du **signal**, et non le caractère : raideur du lissage, fenêtre d'accélération, lissage de la charge, temporisations de passage. La distinction est réelle — le premier curseur dit si la voiture pousse fort, celui-ci si elle répond vite. Une voiture calme peut être vive, une sportive pâteuse |
| **Nombre de rapports** | De trois à huit, en un appui. Le premier et le dernier rapport sont **conservés**, et le pont avec eux : le régime en dernier rapport à une vitesse donnée ne bouge pas — mesuré, 1276 tr/min à 110 km/h sur Route quel que soit le nombre de rapports — la septième y est un rapport d'autoroute. Seuls les rapports intermédiaires se redistribuent, géométriquement, avec les régimes de passage et les temporisations. Pour poser les démultiplications à la main, le champ reste là en mode avancé |

Les bornes du second sont **mesurées** sur une rampe de 0 à 90 km/h en quinze
secondes, bruitée à ±1 km/h comme l'est une mesure GPS, à la cadence la plus
défavorable — une mesure par seconde :

| Position | Marche d'une image à l'autre | Retard sur la vitesse vraie |
|---|---|---|
| Pépère (raideur 6) | 0,242 km/h | 556 ms |
| Milieu (raideur 14) | 0,433 km/h | 409 ms |
| Nerveux (raideur 22) | 0,675 km/h | 369 ms |

La vitesse reste continue même au plus nerveux : le ressort est amorti critique,
il ne produit pas de marche, et 0,675 km/h par image vaut une quinzaine de tours
par minute en dernier rapport. À la cadence du GPS d'une Tesla en mouvement —
une mesure toutes les trente-trois millisecondes — la marche tombe à 0,376 km/h
et le retard à 334 ms : plus le GPS parle, plus le suivi est à la fois doux et
juste.

La fenêtre d'accélération suit la même logique, et son prix se paie sur la
charge : à une cadence de 250 ms, une fenêtre de 400 ms laisse l'accélération
lue trembler à 1,51 m/s² d'écart-type, contre 0,85 à 1600 ms.

Deux interrupteurs restent à la main : le **rétrogradage forcé** et l'**à-coup de
passage** ne se coupent jamais tout seuls — couper ce que quelqu'un a activé
exprès n'est pas un caractère. La **pétarade**, elle, s'éteint au plus calme :
c'est la règle du guide de création, et une voiture tranquille ne claque pas à
l'échappement.

### Moteur

| Réglage | Ce qu'il fait |
|---|---|
| **Cylindres enregistrés** | Décrit le moteur des **échantillons**, pas celui qu'on veut entendre : il ne modifie pas le son, celui-ci venant d'enregistrements où le moteur est figé. Il sert à convertir la raie d'allumage en régime lors de l'analyse — une valeur fausse y proposerait des ancrages faux, dans le même rapport |
| **Ralenti** | Régime au point mort, moteur non entraîné |
| **Régime de décollage** | Ce que l'embrayage impose dès que la voiture avance. Le moteur y monte et l'y tient pendant qu'elle prend de la vitesse, jusqu'à ce que les roues le rejoignent. Sans lui, le régime restait au ralenti sous six kilomètres à l'heure et le son était celui de l'arrêt |
| **Seuil de coupure** | Régime auquel l'allumage commence à être coupé |
| **Rupteur** | Plafond absolu du régime |
| **Durée de coupure** | C'est le hachage qui produit le crépitement, pas le plafonnement |
| **Inertie** | Poids du volant moteur : temps de montée à vide |
| **Montée à vide** | Prise de tours hors prise, en tr/min par seconde |
| **Frein moteur** | Retombée pied levé |
| **Tremblement au ralenti** | Amplitude du tremblement de régime, en tr/min, prise au ralenti et pied levé. Elle décroît ensuite quand le régime monte et quand la charge monte — un moteur se stabilise en poussant. Mesuré sur Sport, réglé à 35 : 34 tr/min d'excursion au ralenti, ±18 à 3000 tr/min pied levé, ±7 pied au plancher. Zéro donne un régime parfaitement lisse, ce qu'aucun moteur thermique n'est. **Il ne va que dans le son** : la boîte, ses seuils et la télémétrie gardent le régime net |
| **Vitesse du tremblement** | Fréquence de la composante rapide. Une composante lente à un peu plus d'un dixième de cette valeur s'y ajoute — 0,70 Hz pour 6 Hz réglés : à une seule fréquence, le tremblement s'entend comme un vibrato |

### Transmission

| Réglage | Ce qu'il fait |
|---|---|
| **Démultiplications** | Du plus court au plus long, séparées par des virgules. Une seule valeur = prise directe. En **changer le nombre** redimensionne du même coup les régimes de passage et les temporisations, qui sont indexés par rapport : ils sont redistribués depuis le tempérament que porte le profil. À nombre égal, rien d'autre ne bouge |
| **Pont** | Rapport final |
| **Rupteur atteint à** | Vitesse au rupteur dans le dernier rapport. **Modifier cette valeur recalcule le pont** — c'est le chiffre parlant |
| **Rayon de roue** | En mètres. Entre dans le calcul du régime |
| **Temps de passage** | Durée de la coupure de couple |
| **Écart selon la charge** | **Sans effet depuis le 10 septembre 2026.** C'est la marge du mode qui se déplace avec la demande, et elle double à pleine charge |
| **Dispersion aléatoire** | Tirée au sort à chaque passage. Sans elle, la boîte passe toujours au même régime exact et s'entend comme une machine |
| **Ne jamais monter sous** | **Sans effet depuis le 10 septembre 2026.** Le plancher du rapport visé joue ce rôle, et il ne peut par construction pas proposer un rapport où le moteur peinerait |
| **Descente sous** | **Sans effet depuis le 10 septembre 2026.** Le rétrogradage se décide sur le plancher de descente, qui vient du mode et remonte avec la décélération |
| **Croisière au-dessus de** | **Sans effet depuis le 10 septembre 2026.** Il n'y a plus de montée en croisière séparée : le plancher fait entrer le rapport long de lui-même, et c'est lui qui décide de l'assiette |
| **Monter après** | **Sans effet depuis le 10 septembre 2026.** Voir ci-dessus : la montée en croisière n'existe plus |
| **Descendre en freinant à** | Décélération à partir de laquelle la boîte cesse de monter. Elle ne commande plus la descente : celle-ci suit le plancher, qui remonte de lui-même avec la décélération |
| **Temporisations de montée** | Une par rapport, en secondes. Les garder **inégales** : avec une valeur unique, la boîte sonne comme un métronome. Courtes de préférence — elles confirment une intention, elles ne retiennent pas le passage |

### Signal de vitesse

| Réglage | Ce qu'il fait |
|---|---|
| **Raideur du lissage** | Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard. Le réglage le plus sensible |
| **Fenêtre d'accélération** | Durée sur laquelle la pente est estimée, par ajustement sur **toutes** les mesures qu'elle contient. Elle décide aussi du temps qu'une pente met à s'oublier : à quatre secondes, le régime met encore quatre secondes à retomber après qu'on a cessé d'accélérer ; à une seconde, il suit aussitôt mais le signal est moins lisse. En deçà de l'intervalle entre deux mesures, la baisser ne gagne rien — et cet intervalle dépend de l'appareil : quelques dizaines de millisecondes dans une Tesla en mouvement, une seconde ailleurs |
| **Vitesse plausible max** | Au-delà, la mesure est écartée : on n'en tire rien du tout, et la vitesse conditionnée continue comme si elle n'était pas arrivée |
| **Précision GPS acceptée** | Incertitude annoncée au-delà de laquelle la position est écartée — ni mesure, ni référence pour la mesure suivante. Livré à 250 m, volontairement large : un point satellite s'annonce à quelques mètres ou quelques dizaines de mètres même mal placé, une position obtenue par le réseau à plusieurs centaines. Les valeurs de la voiture ne sont pas mesurées ; **les relever sur l'écran Télémétrie avant de resserrer.** Un seuil trop serré rejette des mesures saines et fait taire le GPS. Une position dont la précision n'est pas renseignée n'est jamais rejetée |
| **Accélération / décélération max retenues** | Bornes de l'accélération transmise à la charge |

### Mixage

Le **volume général** ne figure pas dans cette liste : ce n'est pas un caractère
de profil mais une **préférence de l'appareil**, rangée à côté du profil choisi.
Il dépend de l'autoradio, de la position du téléphone, du bruit de roulement, et
il n'a donc aucune raison de sauter quand on change de voix, ni de voyager vers
qui reçoit un profil partagé. Il se règle sur l'écran de conduite, seul endroit
où l'on touche un réglage en roulant, et il peut dépasser 1 — au prix d'un
écrêtage, décrit juste en dessous.

#### Ce que la chaîne de sortie fait au niveau

Le son passe par un coupe-bas, un saturateur, un limiteur, puis un gain de
rattrapage fixe de 1,8. Mesuré sur le profil Route, cinq couches, par le banc
`banc/sortie.html` :

- **Le relief survit à la chaîne.** L'écart entre croisière et accélération
  franche vaut 6,58 dB en entrée et 6,49 en sortie, au volume livré de 0,70.
  L'ensemble coûte 0,09 dB.
- **Le limiteur ne limite presque rien** : 0,2 dB d'atténuation au maximum. Le
  niveau efficace du son reste bien sous son seuil ; seules des crêtes brèves le
  touchent. Il n'empêche donc pas la saturation, contrairement à ce que son nom
  laisse croire.
- **C'est l'écrêtage qui écrase**, et il vient du rattrapage placé après le
  limiteur. Au volume livré, 1 % des échantillons sont rognés en accélération
  franche ; à volume 1,0, 8 %, et le relief entendu tombe alors à 6,0 dB.

Monter le volume général au-delà de 0,7 gagne donc du niveau et perd de la
dynamique. En dessous de 0,5, plus rien n'est rogné.

**Cet écrêtage ne s'entend pas**, et c'est pourquoi il n'est pas corrigé. Les
deux versions — telle qu'elle sort, et une chaîne réglée pour ne rien rogner —
ont été comparées au même niveau sur un extrait de huit secondes : « quasiment
aucune différence ». Le supprimer coûterait 3,1 dB de niveau pour un gain
inaudible. C'est le même constat qu'au banc du moteur synthétisé, où l'écrêtage
avait déjà été essayé deux fois sans qu'aucune différence s'entende.

| Réglage | Ce qu'il fait |
|---|---|
| **Relief de charge** | Autant en moins sans effort, autant en plus à pleine charge, rien à mi-effort. **C'est le réglage qui fait entendre l'effort** : sans lui, les fondus étant à puissance constante, ralenti, croisière et pleine charge tenaient dans 1,3 dB — le son changeait de couleur et jamais de volume. À 4, il y a 8 dB entre lever le pied et écraser |
| **Relief du régime** | Gain gagné entre le ralenti et le rupteur : le rugissement qui monte avec les tours. Il **s'ajoute** aux 4 dB que la banque livrée donne déjà, sa prise haut régime étant enregistrée plus fort que la basse |
| **Niveau au ralenti** | Le ralenti n'a pas de couche dédiée dans la banque livrée : on y entend la prise « pied levé » jouée deux octaves plus bas. Sans ce réglage elle sonnait aussi fort que tout le reste |
| **Désaccord des couches** | Écart de justesse entre les couches d'une même famille, en centièmes de demi-ton. Au rapport exact elles sont parfaitement justes l'une par rapport à l'autre, ce qui n'arrive sur aucun moteur : les inégalités entre cylindres et les deux lignes d'échappement produisent un battement lent. L'écart est réparti de part et d'autre, donc la hauteur moyenne ne bouge pas, et il ne déplace aucun gain. Mesuré, 12 centièmes donnent un battement à 2,4 Hz à 5100 tr/min et 1,5 Hz à 3200 |
| **Renouvellement de position** | Intervalle moyen entre deux reprises de la lecture ailleurs dans l'enregistrement, en secondes. Chaque couche est une boucle de trois à cinq secondes : sans cela elle se répète à l'identique toutes les quatre à vingt secondes selon la vitesse de lecture, et l'oreille apprend le motif. L'intervalle réel est tiré à quarante pour cent près, sinon on remplacerait une périodicité par une autre. À zéro, le comportement est celui d'avant ce réglage |
| **Début / fin de bascule** | Régimes entre lesquels la couche haute remplace la basse. **Indépendants des régimes d'ancrage**, qui règlent la justesse |
| **Accélération pleine charge** | Accélération au-delà de laquelle la charge est maximale. Faute de pédale dans une voiture électrique, c'est elle qui mesure l'intention du conducteur — et c'est la charge qui pilote la boîte |
| **Repère de traînée** | Vitesse à laquelle **tenir** l'allure demande la moitié de l'effort maximal. Sans lui, tenir une vitesse valait toujours la même chose, à 30 comme à 130 km/h, alors que la traînée croît comme le carré de la vitesse : la croisière était plate d'un bout à l'autre. Livré à 130 km/h sur Route, 150 sur Sport. Bas, tout devient chargé tôt ; haut, la traînée compte peu |
| **Lissage de la charge** | Évite que le fondu papillonne sur le bruit d'accélération |
| **Effacement du ralenti** | Régime au-dessus duquel la couche de ralenti disparaît |
| **Gain pied levé** | Curseur de goût sur toute la famille « pied levé ». La compensation des prises plus douces vit dans le gain de chaque couche, où le déficit se mesure — 9,6 dB pour la basse, 6,5 pour la haute : à laisser à 1 sauf pour forcer le trait |
| **Coupe-bas**, **Saturation**, **Seuil du limiteur** | Chaîne de sortie, décrite plus haut. Le seuil du limiteur n'a presque pas d'effet au niveau où le son sort : il ne travaille que sur des crêtes brèves |

### Caractère

Trois comportements qui tiennent moins de la mécanique que du tempérament, et
qu'on remarque surtout par leur absence. Chacun s'active séparément.

| Réglage | Ce qu'il fait |
|---|---|
| **Rétrogradage forcé** | Enfoncer la pédale fait descendre chercher le couple, au lieu d'attendre le seuil de passage. Mesuré : 6<sup>e</sup> à 1927 tr/min → 4<sup>e</sup> à 2724 en une demi-seconde |
| **Déclenché au-delà de** | Charge à partir de laquelle la demande est jugée franche. Le niveau ne suffit pas : il faut aussi que la charge ait **monté** franchement dans la seconde et demie écoulée. Sans cette condition, le rétrogradage partait dès 3,6 km/h par seconde — c'est-à-dire en remettant délicatement les gaz — puisque, faute de pédale, la charge est déduite de l'accélération |
| **Régime visé** | Ce qu'on cherche à retrouver après la descente, en fraction du rupteur |
| **Rapports descendus au plus** | Deux suffisent sur un profil routier, trois donnent une réponse plus vive |
| **Pétarade** | Claquements à l'échappement au lever de pied. Synthétisés, la banque sonore n'en contenant pas |
| **À partir de** | Régime en deçà duquel rien ne se produit : il ne reste pas assez à brûler. C'est le régime **au moment où l'on coupe**, non celui constaté une demi-seconde plus tard |
| **À-coup de passage** | Le creux du couple coupé, puis la reprise. Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est |
| **Profondeur** | Combien le **niveau** baisse pendant la coupure. Mesuré sur le profil Route : 3,8 dB au creux à 0,35 |
| **Coupure de couple** | Combien le moteur passe en roue libre le temps du passage. C'est ce qui fait entrer les couches pied levé, donc changer le **timbre** et pas seulement le niveau. Mesuré sur le profil Route : la part d'énergie tenue par les couches en charge passait de 0,926 à 0,926 — elle ne bougeait pas — et tombe à 0,223 au creux. Zéro garde le son de pleine charge d'un bout à l'autre |
| **Plongée du régime** | De combien le moteur tombe **sous** le régime du nouveau rapport quand la boîte passe au neutre. Mesuré à 450 tr/min sur le profil Route, première en seconde : 4 692 tr/min, fond de la chute à 2 337 |
| **Coup de gaz** | De combien le moteur remonte au-dessus du rapport visé, entre la chute au neutre et l'engagement. C'est le mouvement qui s'entend le mieux dans un passage : une montée de régime, l'oreille la suit. Mesuré à 550 tr/min sur Route : creux à 2 337, sommet à 3 364. Zéro laisse une séquence en trois temps |
| **Clac de la boîte** | Le choc mécanique quand le rapport s'engage, au sommet du coup de gaz. Attaque en une milliseconde, trois composantes — la masse sous deux cents hertz, le corps du carter vers quatre cent cinquante, un soupçon de médium vers douze cents. Mesuré au réglage livré, en écart au moteur : −5,7 dB à 125 Hz, et seize décibels en dessous au-delà de deux kilohertz. Rien à voir avec le claquement d'échappement, qui est grave et traînant |
| **Clac au rétrogradage** | Part du clac gardée quand la boîte descend un rapport. Le son est le même dans les deux sens ; ce qui change, c'est ce qu'il y a autour — on rétrograde pied levé ou en freinant, donc avec un moteur bien plus doux, et le même clac y ressort deux fois plus. Un pour le même niveau qu'en montant |
| **Claquement de reprise** | Une détonation à l'échappement au moment où le couple revient. C'est la pétarade du lever de pied, tirée en un seul coup. Zéro n'en produit aucune |

### Couches

**La banque se choisit dans une liste** — les dossiers présents sur le serveur,
avec le nombre de fichiers de chacun. Le nom se tape aussi à la main, pour une
banque que le serveur ne sait pas lister : c'était la seule façon de faire
jusqu'ici, et une faute de frappe se découvrait à l'activation du son, sous la
forme d'un silence.

Quand la banque choisie est listée, **les fichiers que le profil déclare en vain
sont nommés**, tout de suite. C'est le cas le plus courant en changeant de
banque : une banque nouvelle a rarement les mêmes noms de fichiers que
l'ancienne. Sur une banque tapée à la main, rien n'est signalé — ne rien savoir
n'est pas savoir qu'il manque quelque chose.

Une ligne par échantillon. Le bouton **Analyser** mesure le fichier et propose
des ancrages.

| Colonne | Ce qu'elle fait |
|---|---|
| **Rôle** | « en charge », « pied levé », « ralenti » ou « rupteur ». Détermine la famille dans laquelle la couche est fondue |
| **Ancrage** | Régime auquel l'échantillon a été enregistré. Fixe la **justesse**, pas le point de bascule |
| **Gain** | Niveau propre à la couche |
| **Lecture min / max** | Bornes d'étirement. Au-delà d'une octave environ, le son devient métallique vers le haut, pâteux vers le bas |

Ces bornes définissent le **domaine jouable** de chaque couche : un échantillon
ancré à 8000 tr/min avec une borne basse de 0,25 ne descend pas sous 2000 tr. En
deçà, sa hauteur se fige — et une couche figée qu'on laisserait s'entendre donne
l'impression d'un second moteur tournant à régime constant derrière le premier.

Le mixage l'efface donc à mesure qu'elle s'écarte de la hauteur demandée, et la
réduit au silence au-delà d'une demi-octave. C'est ce qui explique qu'une couche
puisse afficher un gain nul alors que le fondu devrait la faire entrer : elle
n'est simplement pas jouable à ce régime. Deux remèdes, selon le cas — abaisser
sa borne basse, ou reculer le début de bascule pour ne l'appeler que dans son
domaine.

### Le tempérament de la boîte

**Entre les cadrans**, sous le rapport engagé : un bouton qui porte **Route** ou
**Sport** et donne l'autre au clic. Les commandes de boîte — automatique ou
manuelle, et les deux flèches — sont juste au-dessus du rapport, du même côté :
la main se trouve là où le regard est déjà. C'est ce qui décide à quel régime les rapports passent, et c'est le
seul réglage de tempérament qui reste au volant.

Les régimes de passage ne se règlent plus un par un. Ils se déduisent du
**rupteur du moteur** et du tempérament choisi, comme la descente le faisait
déjà. Sans cela la boîte ignorait le moteur : mesuré au banc, un moteur de moto
qui monte à 11 000 tr/min passait ses rapports au même endroit qu'un V8 qui
s'arrête à 6 500, et un gros bloc à 5 500 tapait son rupteur avant d'avoir le
droit de monter.

Les deux tempéraments disent explicitement ce que les profils livrés faisaient
sans le dire : **Route monte de plus en plus tôt** — on cherche le rapport
long — et **Sport de plus en plus tard** — on garde le régime.

Le choix appartient à l'appareil, comme le volume : il ne voyage pas avec un
profil. Au premier lancement, il se déduit du profil actif.

### Profils

**Un** profil est livré avec l'application — le **V8** —, et le bouton
**Profils d'usine** le réintroduit si on l'a supprimé.

Il y en avait deux, Route et Sport, et leur différence tenait à leurs seuils de
passage. Ceux-ci se déduisant du rupteur et du tempérament, garder deux profils
reviendrait à proposer deux fois le même moteur avec deux tempéraments figés. Un
profil se nomme donc d'après ce qu'on entend — son moteur — et non d'après une
façon de conduire : c'était la source d'une confusion, deux boutons
« Route / Sport » à l'écran ne commandant pas la même chose.

**Un profil désigne un moteur.** Un moteur, ici, c'est tout ce qui fait qu'on le
reconnaît : ses réglages, sa banque de sons, ses couches et son mixage. Il vit à
part, il a un nom, et la section **Moteur** de l'écran de configuration permet
de le choisir, de l'enregistrer, de l'exporter seul et d'en reprendre un reçu
d'ailleurs. Trois conséquences :

- on envoie **un moteur seul**, sans faire suivre tout un profil ;
- on le **corrige une fois** pour tous les profils qui le jouent — l'écran dit
  combien ils sont avant d'y toucher ;
- un profil qu'on a affiné depuis qu'il a chargé son moteur le dit, et laisse le
  choix : garder les écarts pour lui, ou les reporter dans le moteur.

Ce qu'un moteur **n'emporte pas** : les rapports, le pont, la façon de passer
les vitesses, ni les réglages de mesure du signal. Changer de moteur change le
son, pas la conduite. Les moteurs livrés sont les deux profils d'usine — leurs
rupteurs diffèrent de deux mille tours, ce sont bien deux moteurs.

**Route** — calibré sur les vitesses que l'on pratique vraiment. **Sept
rapports** depuis le 11 septembre 2026, dont une septième longue pour
l'autoroute. Dès qu'on tient une vitesse, la boîte monte d'elle-même : mesuré,
la quatrième à 50 km/h (1487 tr/min), la cinquième à 70 (1520), la sixième à 110
(1734), et la septième vers 124 — 1508 tr/min à 130. Pied au plancher, les
passages reculent : il reste de quoi s'amuser sans que ce soit le régime
ordinaire.

La croisière tient ainsi entre 1487 et 1954 tr/min de 50 à 130 km/h, là où elle
allait de 1532 à 2355 avec six rapports. Les trois premiers rapports n'ont pas
bougé — c'est le haut de la boîte qui a été redessiné, et les sauts y valent
maintenant 1,36 à 1,38 au lieu de s'écraser à 1,19.

**Sport** — le calibrage d'origine, taillé pour une plage que l'on n'atteint
jamais sur route. Il garde ses rapports plus longtemps et croise plus haut :
la troisième à 50 km/h (2460 tr/min) là où Route est en quatrième, et 3386 tr/min
à 130. Intéressant sur une portion dégagée, fatigant au quotidien.

Le tout se règle : c'est la différence entre les deux, pas une nature.

| | Route | Sport |
|---|---|---|
| Rupteur | 6500 tr/min | 8500 |
| Pont | 3,7 | 4,5 |
| Passage 1 → 2 (charge moyenne) | 35 km/h | 40 |
| Nombre de rapports | 7 | 6 |
| Plancher de croisière | 1400 tr/min | 2000 |
| Rapport tenu à 50 km/h | 4<sup>e</sup>, 1487 tr/min | 3<sup>e</sup>, 2460 |
| Rapport tenu à 90 km/h | 5<sup>e</sup>, 1954 tr/min | 6<sup>e</sup>, 2344 |
| Rapport tenu à 110 km/h | 6<sup>e</sup>, 1734 tr/min | 5<sup>e</sup>, 3422 |
| Régime à 130 km/h en dernier rapport | 1508 tr/min | 3386 |

Sélection, renommage, duplication, suppression, **export** et **import** en JSON.

Le bouton **☆ Épingler** place un profil en accès direct sur l'écran de conduite,
mode plein écran compris : changer de son en roulant n'oblige pas à passer par la
configuration.

La première section de l'écran, **Créer un profil**, ouvre une création guidée. Quatre choix décrits en langage de
conducteur — tempérament, usage, moteur, nombre de rapports — dont on déduit la
trentaine de réglages qui ne s'accordent pas indépendamment : rapports en
progression géométrique, pont calculé pour la croisière visée, régimes de
passage, écart de charge, caractère. Un aperçu chiffré se recalcule à chaque
choix, et le résultat reste entièrement modifiable.

Un menu **Réinitialiser** ramène une section — ou le profil entier — à son état
d'usine, en deux temps pour éviter la fausse manœuvre. Sept portées : tout le
profil, le moteur, la transmission, le signal de vitesse, le mixage, le
caractère, les couches et la banque. Cette dernière portée les prend ensemble à
dessein : des noms de fichiers d'usine dans une autre banque ne joueraient rien.
Une valeur mal saisie dans la transmission ne coûte donc
plus ce qui a été trouvé ailleurs, et l'identifiant comme le nom sont conservés
dans tous les cas — le profil est remis à neuf, pas remplacé.

**Son état d'usine, c'est ce qu'il était à sa création.** Un profil sorti du
guide, ou dupliqué, garde ses valeurs de départ et y revient. Les deux profils
livrés reviennent aux leurs. Seul un profil enregistré par une version
antérieure de l'application, qui n'a pas gardé son état de départ, retombe sur
des valeurs génériques.

Un profil créé de toutes pièces, sans équivalent d'usine, retombe sur les valeurs
par défaut génériques.
Les profils sont conservés dans le navigateur ; l'export sert à les transporter
d'un appareil à l'autre.

---

## Étalonner sur la vraie voiture

Les réglages qui décident de la charge et des seuils ont tous été choisis par le
calcul, faute de savoir ce que fait la voiture. `fullLoadAccelMs2` vaut 2 m/s²
sur le profil Route — une valeur raisonnée, jamais mesurée, sur un véhicule qui
en fait bien davantage. L'étalonnage remplace ce raisonnement par un relevé.

Il se trouve **en bas de l'écran Télémétrie**. Tout se passe dans la voiture :
l'analyse ne demande que du calcul, et le résultat se voit tout de suite.

### La marche à suivre

1. Démarrer l'application, source **GPS**.
2. Lire la consigne de l'étape, et son **critère**. Le critère est annoncé avant
   l'enregistrement, pas après.
3. Appuyer sur **Enregistrer l'étape**, rouler comme demandé, appuyer sur
   **Arrêter**.
4. Le verdict s'affiche : étape valide et valeur obtenue, ou étape refusée et
   raison du refus.
5. Le tableau **Mesuré face à réglé** met les deux chiffres côte à côte, avec
   leur écart. **Recopier** applique la valeur, un réglage à la fois.

Chaque étape s'enregistre séparément et vaut séparément : une session
incomplète reste utile, et ce qui n'a pas été mesuré est dit **non mesuré**,
jamais estimé. L'analyse en tire le même chiffre à chaque relecture.

**L'étalonnage garde son propre enregistrement, borné par étape**, là où la
capture du trajet, elle, tourne toute seule du début à la fin. Ce n'est pas un
oubli : délimiter une mesure n'est pas capturer une session, et une étape mal
bornée donne une mesure fausse.

### Les étapes

Six étapes, dans deux familles. Les trois premières donnent des
**distributions** — ce qu'on fait tous les jours ; les trois dernières donnent
des **extrêmes**, et ce sont eux qui manquaient le plus.

| Étape | Ce qu'on demande | Ce qu'elle informe |
|---|---|---|
| Conduite en ville | une minute de ville, feux compris | la vitesse de fin de première, les seuils bas, le bruit du GPS |
| Conduite sur route | une minute de route | les seuils intermédiaires, le plancher de croisière |
| Conduite sur autoroute | une minute d'autoroute | les seuils hauts, la vitesse plausible |
| Accélération franche | de l'arrêt, accélérer franchement jusqu'à 50 km/h | l'accélération à charge pleine |
| Décélération pied levé | au-dessus de 50 km/h, lever le pied sans freiner | avec le freinage, la frontière de rétrogradage ; la borne basse |
| Freinage franc | au-dessus de 40 km/h, freiner franchement | la même frontière, et la borne basse |

### Ce qu'on tire de la conduite ordinaire

Un **palier** est une portion où la vitesse est tenue : l'accélération reste
dans une bande étroite pendant au moins deux secondes. Un arrêt n'en est pas un
— un feu rouge est une accélération nulle qui dure. De la distribution des
paliers, pondérée par leur durée, viennent :

- les **seuils de passage**, placés de sorte que chaque rapport couvre une part
  égale du temps passé à vitesse tenue. Le profil Route a été décrit comme
  « calibré sur les vitesses que l'on pratique vraiment » ; c'était de mémoire ;
- le **plancher de croisière**, à la vitesse la plus basse réellement tenue ;
- le **délai de montée en croisière**, au dixième centile de la durée des
  paliers : neuf paliers sur dix durent alors assez pour que la montée se
  produise, et les plus brefs ne la déclenchent pas.

Les seuils de passage sont mesurés en **kilomètres-heure** et le réglage du
profil s'affiche dans la même unité, converti avec le pont, les
démultiplications et le rayon de roue — sans quoi les deux ne seraient pas
comparables. C'est le profil qui fournit la conversion : lui a déjà choisi une
boîte, la voiture mesurée n'en a pas.

### Le bruit du GPS, et la fenêtre qui s'en déduit

L'étalonnage chiffre le **bruit de mesure** du GPS de cette voiture-là, en
km/h, ainsi que sa **cadence**. La pente d'accélération étant ajustée aux
moindres carrés sur une fenêtre, son écart-type vaut `√(12 σ² Δ / T³)` pour un
bruit `σ`, une cadence `Δ` et une fenêtre `T`. On renverse la formule pour
trouver la fenêtre qui atteint 0,1 m/s² de précision, soit un vingtième de la
charge pleine du profil Route.

Vérifié sur traces synthétiques, à trois bruits et deux cadences : l'écart-type
obtenu tient entre 0,100 et 0,104 m/s² pour une cible de 0,100.

**La raideur du lissage, elle, n'est pas proposée.** Le ressort arrondit ce que
le bruit laisse passer, et le réglage juste est celui à partir duquel le
tremblement ne s'entend plus : c'est un jugement d'oreille, pas une mesure. Le
déduire d'une formule serait habiller une convention en résultat.

Le seuil de rétrogradage au freinage se place **au milieu** des deux
décélérations. Le milieu, parce que c'est le point qui laisse la même marge
contre les deux erreurs possibles : rétrograder sur un simple lever de pied, et
ne pas rétrograder sur un vrai freinage.

**Et il peut ne pas y avoir de milieu.** Une voiture électrique récupère au
lever de pied, ce qui rapproche les deux cas au lieu de les séparer. Si les deux
étapes rendent la même décélération à moins de 0,5 m/s² près, aucun seuil n'est
proposé, et la raison est dite : soit le frein a servi pendant le lever de pied,
soit la récupération suffit à elle seule. C'est pour la même raison que le lever
de pied n'a **pas** de plafond de décélération dans son critère : rien dans une
trace GPS ne dit si le frein a été touché, et refuser un lever de pied « trop
fort » reviendrait à refuser cette voiture-là.

### Une étape peut être refusée, et c'est le point

Une « accélération franche » qui n'atteint que 1 m/s² n'en est pas une.
L'accepter donnerait une charge pleine atteinte au premier filet de gaz — donc
un fondu faux, un volume faux, des passages faux : exactement le défaut que
l'étalonnage doit corriger. Le critère de l'accélération franche est donc :
départ à l'arrêt, 30 km/h gagnés au minimum, et **2 m/s² d'accélération
soutenue**. Deux mètres par seconde carré, c'est zéro à cinquante en sept
secondes — très en dessous de ce qu'une électrique fait sans effort.

### Le récapitulatif

Un seul tableau, sous les étapes. Chaque ligne porte le nom du réglage, la
phrase qui dit d'où vient la mesure, la valeur **mesurée**, la valeur
**réglée**, et l'**écart** entre les deux. Une ligne d'en-tête compte où en est
la session — combien d'étapes enregistrées, combien valides, combien de réglages
proposés et combien non mesurés — parce que sans ce compte on ne sait pas si un
« non mesuré » vient d'une étape oubliée ou d'une étape refusée.

Le tableau se relit tel quel après un rechargement : une session ne retient que
le lien entre une étape et sa trace, et les traces sont conservées. Le
récapitulatif se **recalcule** donc, plutôt que de rejouer des chiffres
mémorisés qui pourraient avoir divergé de l'analyse.

### Elle propose, elle n'applique pas

C'est la règle déjà retenue pour l'analyse d'échantillon : la mesure est plus
sûre que le souvenir, elle n'est pas plus sûre que le jugement. Rien n'est écrit
dans le profil sans un geste, et jamais en bloc — un réglage à la fois.

Deux retours en arrière, à deux échéances. **Annuler**, à côté du bouton qui
vient d'écrire, rend la valeur écrasée immédiatement et pour ce réglage seul.
Plus tard, **Réinitialiser** dans l'écran de configuration ramène une section
entière du profil à ce qu'elle était à sa création.

### Ce que l'étalonnage ne dira jamais

Une voiture électrique n'a pas de rapports. L'étalonnage mesure des vitesses,
des accélérations et du bruit de mesure ; il informe donc des seuils **en
vitesse**, jamais en régime. Le régime est une fiction qu'on choisit, et le
choix reste entier : l'étalonnage ne dira pas quel rupteur ni combien de
cylindres.

C'est pour cette raison que le **plancher de croisière** est rendu en km/h et ne
se recopie pas : le réglage est un régime, et le déduire de cette vitesse
demanderait de choisir dans quel rapport la boîte se trouve — ce que le réglage
sert justement à décider. La mesure s'arrête où commence le choix, et le dit.

---

## Partager un profil

Trois façons de retrouver ses réglages sur un autre appareil, sans compte ni
serveur applicatif.

**Par lien.** Le bouton **Partager…** encode le profil entier dans l'adresse,
compressé. L'application prévient lorsque cette adresse n'est joignable que
depuis le poste courant — un lien produit sur `localhost` ou sur une adresse de
réseau local ne mènerait nulle part ailleurs, alors que le code paraît valide — environ 1100 caractères pour un profil de 1,8 ko. L'ouvrir ailleurs
l'y installe. Le fragment d'adresse n'étant jamais transmis au serveur, rien
n'en est journalisé.

**Par code à scanner.** Le même lien sous forme de code, ce qui évite de recopier
une adresse entre un poste de travail et un téléphone. Il est produit sur place,
sans service extérieur.

**Par le NAS.** Les fichiers déposés dans `/volume1/docker/speed/profiles/` avec
File Station apparaissent sur tous les appareils, via le bouton **Profils du
serveur**. nginx sait rendre le contenu d'un dossier en JSON, ce qui suffit à les
découvrir : ni base, ni service à maintenir, et la protection est celle qui garde
déjà l'accès au site. Le dossier est facultatif.

Dans tous les cas, **les échantillons ne voyagent pas** — seuls leurs noms
suivent, l'autre appareil devant disposer de la même banque. Et l'identifiant est
renouvelé à l'import : un profil reçu n'écrase jamais l'un des siens.

## La remontée au serveur

Le navigateur de la voiture n'a pas de console, ne télécharge rien, et rien ne
s'y consulte au volant : ce qui naît en roulant y restait, et comprendre après
coup ce que l'application a vécu demandait de deviner. Elle peut désormais
**déposer toute seule** sur le serveur ce qu'elle produit.

**Rien n'est envoyé par défaut.** Le réglage est dans l'écran de configuration,
en mode avancé, et il a trois positions :

| Position | Ce qui part |
|---|---|
| **Rien n'est envoyé** | rien, et le journal n'est même pas tenu |
| **Le minimum** | le journal de bord, les relevés de mesure, et vos profils, qui rejoignent la bibliothèque partagée |
| **Et la conduite** | tout ce qui précède, **plus votre position** — un point par seconde — et **la capture complète de vos trajets**, qui démarre toute seule avec le GPS et porte toute la conduite à la cadence de l'appareil |

Passer à l'une des deux dernières demande une confirmation, qui dit ce qui sera
envoyé avant que cela ne parte. Le troisième cran ne se déduit jamais du second :
une position est une donnée de déplacement, et une trace porte la conduite à la
cadence du GPS là où le journal n'en garde qu'un relevé toutes les dix secondes.
Cela se dit avant. Couper, en revanche, est immédiat — on n'a pas à confirmer
qu'on ne veut plus rien envoyer.

Chaque nature va dans son dossier : `journal/`, `traces/`, `mesures/` et
`profiles/`. Il n'y a plus de dépôt à la demande : tout ce qui part est gouverné
par ce seul réglage.

**Les tranches partent compressées** — `.jsonl.gz` —, par le compresseur du
navigateur, sans bibliothèque. Le gain est d'environ 85 % sur du journal réel, et
il porte d'abord sur la 4G en roulant, pas sur la place du serveur. Là où le
navigateur ne sait pas compresser, la tranche part en clair. Les profils et les
relevés de mesure, eux, restent en clair : l'application les retélécharge et les
lit, et la bibliothèque de profils cesserait de fonctionner.

### Le relecteur

Une page à part, `/relecteur.html`, pour revoir un trajet au bureau au lieu de
le raconter de mémoire. Elle n'est jamais chargée par l'application de conduite :
sa carte et son code vivent dans leur propre paquet, tiré seulement quand on
ouvre son adresse.

Il liste les sessions du serveur, la plus récente en tête, et recolle leurs
tranches tout seul. Il lit les fichiers en clair comme les compressés, le
journal comme la capture — les essais des 8, 9 et 10 septembre 2026, antérieurs
à la capture continue, restent relisibles avec leur seul journal.

La **timeline** porte lecture, pause et déplacement libre, jusqu'à vingt fois la
vitesse réelle. Elle est marquée des faits du journal : arrêts, redémarrages du
suivi, salves de positions rejetées, coupures du son, changements de
configuration. Ce sont les moments qu'on cherche. Le survol d'une marque dit ce
qu'elle est, combien de fois et quand ; un clic y emmène la lecture.

Elle marque aussi les **rapports enchaînés** — plusieurs passages en peu de
temps —, qui ne sont pas inscrits dans un fichier mais se déduisent des relevés.
Ce qui est mesuré et ce qui est déduit se distinguent : un journal relève toutes
les dix secondes, si bien que voir la deuxième puis la quatrième prouve deux
passages sans dire s'ils se sont suivis en une seconde ou étalés sur neuf. Le
critère, quand la durée n'est pas mesurable, est la densité : plus d'un rapport
franchi par relevé, c'est que la boîte a bougé plusieurs fois entre deux
regards. Monter de la première à la sixième en cinquante secondes ne compte pas.

Sous la barre, un **relief de vingt-huit pixels** trace l'accélération en une
courbe continue, verte au-dessus de l'axe et rouge en dessous — le même tracé
découpé à zéro, pour que la couleur change sans que le trait se coupe. Chaque
colonne garde l'extrême de ce qu'elle couvre, et non la moyenne, qui effacerait
un freinage bref. Un trou d'enregistrement, lui, coupe le trait : le relier
tracerait une pente qui n'a pas eu lieu. Les **passages de rapport** s'y posent en chevrons sur l'axe :
vers le haut pour une montée, vers le bas pour un rétrogradage, d'autant plus
hauts qu'ils franchissent de rapports. Les lire sur la même ligne que l'effort
montre d'un coup ce qu'on cherche — un rétrogradage en pleine accélération, une
montée en freinant.

Sous le rapport, une **jauge de charge** montre ce que le moteur croit qu'on
demande — l'équivalent d'une position d'accélérateur, et donc l'effort qu'on
entend. Elle est **calculée et jamais mesurée** : la voiture ne dit pas ce que
fait le pied, la charge se déduit de l'accélération. C'est pourquoi elle prend
la forme d'une barre et non d'un cadran, qui suggérerait un instrument dont il
n'existe pas d'équivalent à bord.

L'instant se lit sur **les cadrans de la voiture** — le même composant, la même
échelle de vitesse fixe à 180 km/h, le rapport en grand entre les deux. Relire
un trajet, c'est revoir ce qu'on avait sous les yeux ; deux dessins pour la même
valeur donneraient deux impressions différentes du même instant. La zone rouge
du compte-tours vient du rupteur enregistré dans l'en-tête de la session, donc
du moteur qui jouait ce jour-là — une session sans capture n'en a pas.

**Ce qui est deviné se voit.** Un journal ne porte le régime, le rapport et la
charge qu'une fois toutes les dix secondes : entre deux relevés, les valeurs
sont interpolées et l'écran dit à quelle distance se trouve le relevé le plus
proche. Le rapport n'est jamais interpolé — entre la troisième et la quatrième,
il n'y a pas de trois et demi.

La **carte** occupe tout ce que l'écran laisse. Elle montre le trajet et le
véhicule qui le suit ; un clic sur le tracé emmène la timeline à cet endroit, et
un bouton **garde la vue centrée** sur le véhicule — coupé, on peut examiner un
endroit pendant que la lecture continue. Elle demande le réseau, ce qui est sans
conséquence : le debriefing se fait au bureau.

Le bouton **Copier le repère** met dans le presse-papier une ligne lisible —
session, moment, vitesse, régime, rapport — suivie de l'état complet et des
coordonnées. C'est ce qu'on colle dans une conversation pour désigner un moment
précis.

**Où l'ouvrir.** En production, à l'adresse de l'application suivie de
`/relecteur.html`. Il lit le serveur avec le compte de dépôt réglé sur
l'appareil : depuis un poste qui n'en a pas encore, il faut le saisir une fois à
l'écran de configuration de l'application.

En développement, les dossiers du serveur n'existent pas et il faut les lui
donner :

```powershell
npm run relecteur   # puis http://localhost:5173/relecteur.html
```

Ce script n'est que `vite` avec la variable `SPEED_DATA`, qui désigne un dossier
contenant `journal/` et `traces/` — le partage du NAS par défaut. Pour en viser
un autre :

```powershell
$env:SPEED_DATA = 'D:\copie-du-nas'; npm run dev
```

Le serveur de développement sert alors ces dossiers comme le ferait nginx, y
compris leur listage.

### La capture du trajet

Elle **démarre au démarrage du GPS**, si la remontée est au dernier cran, et
s'arrête avec lui. Il n'y a rien à penser avant de partir : le 10 septembre 2026,
un essai de trente-six minutes n'a laissé aucune trace parce que le bouton
d'enregistrement n'avait pas été touché.

Elle enregistre, à la cadence de l'appareil, **ce que la source livre** — vitesse
brute, précision, origine — et **ce que la chaîne en fait** au même instant —
vitesse conditionnée, accélération, régime, rapport, charge. Chaque tranche
réécrit un en-tête qui décrit la session : profil, moteur, boîte, version de
l'application, et le profil assemblé en entier. Un changement de configuration en
cours de route s'inscrit, daté.

La sortie enregistrée sert à autre chose que le rejeu : comparer ce que la chaîne
a produit ce jour-là à ce qu'elle produit aujourd'hui montre les régressions, et
rien d'autre dans ce projet ne les montre.

Un **témoin** sur l'écran de conduite dit si la session sera récupérable. Vert :
la capture tourne et les tranches partent. Orange : ça se rattrapera tout seul —
pas de réseau, ou un GPS qui rejette beaucoup. Rouge : c'est perdu — compte
refusé, GPS mort. Absent si l'envoi est coupé : un rouge permanent pour un choix
délibéré est une alarme qu'on apprend à ignorer. La frontière entre orange et
rouge est la récupérabilité, pas la gravité ressentie. Le détail se lit sur
l'écran de télémétrie.

Les tranches partent toutes les cinq minutes, et **ce qui reste part après
quinze secondes à l'arrêt** : la dernière tranche n'a pas cinq minutes devant
elle, et une voiture s'éteint toute seule une fois qu'on s'en éloigne. Le temps
de se garer suffit à déclencher l'envoi ; un feu rouge n'y suffit pas, et un
embouteillage ne produit qu'un fichier, pas un par quart de minute.

Rien n'est gardé dans le téléphone : une session de trente-six minutes à dix
relevés par seconde fait vingt-deux mille lignes, et le stockage local du
navigateur ne l'absorberait pas trajet après trajet.

### Ce qui n'a pas pu partir

Une voiture traverse des tunnels et des parkings couverts, et c'est le cas
normal, pas l'exception. Ce qui n'a pas pu partir **attend** et repart de
lui-même au retour du réseau. L'écran de configuration dit ce qui attend, et
permet de relancer sans attendre.

La file est bornée : au-delà, le plus ancien cède la place, et cela se dit. Une
file qui grossirait sans fin rendrait l'échec d'écriture du stockage local plus
fréquent, pas moins.

Un profil ne part pas à la frappe : il attend que la main s'arrête, et son
fichier porte un nom stable — le redéposer remplace sa version précédente au lieu
d'accumuler des copies. Le statut de favori ne voyage pas.

### Le chemin du retour

Ce qui est monté sur le serveur y reste : le navigateur de la voiture ne
télécharge rien, et rien ne redescend tout seul. Le bouton **Tout récupérer**,
dans la section Profils, referme la boucle — il liste les quatre dossiers, tire
tous les fichiers et les rend en un seul paquet compressé, nommé à la seconde
pour que deux récupérations du même jour ne se recouvrent pas.

Il se fait **depuis un téléphone ou un ordinateur**, pas depuis la voiture, qui
refuse les téléchargements. Le compte de dépôt sert aussi à lire : sans lui,
aucune requête ne part et l'écran le dit.

Le paquet part **incomplet plutôt que pas du tout**. Un dossier refusé, un
fichier illisible : les autres sont emportés quand même, et le message nomme ce
qui manque — un essai à moitié rapatrié reste exploitable, mais il ne doit pas
se faire passer pour complet. Un dossier **absent**, en revanche, ne compte pas
comme un échec : ils naissent au premier dépôt.

Le paquet n'est pas compressé, seulement assemblé : cela tient en une centaine
de lignes sans dépendance, là où la compression demanderait une bibliothèque à
une application qui doit se charger hors réseau. Une tranche de journal fait
vingt-huit kilo-octets, et le paquet les garde toutes.

## Le journal de bord

Ce que l'application a vécu pendant le trajet, en événements horodatés.

Le journal porte aussi **ce que le son a coûté** quand il est synthétisé :
facteur temps réel, creux du lecteur, écrêtage et charge du calcul. C'est ce qui
permet de savoir après coup si la synthèse a tenu dans la voiture. Un profil qui
joue des échantillons n'inscrit rien : un zéro se lirait comme une mesure.

Le dépôt se fait par tranches, toutes les cinq minutes ou dès qu'une tranche
atteint sa taille, avec le même compte que celui des traces. Ce qui n'a pas pu
partir — un tunnel, un parking couvert — est gardé et joint à la tranche
suivante : un trou de réseau ne coûte pas un journal, et ne produit pas un
fichier par tentative. Les tranches portent un nom qui les regroupe et les trie
par trajet, ce qui permet d'en supprimer un d'un geste.

Ce que cela pèse, pour une demi-heure de conduite : environ 25 Ko au cran
minimum, 200 Ko avec la position. À deux trajets par jour, de 1,5 à 12 Mo par
mois.

### Ce qui n'est pas dans le journal

Les positions ne circulent pas dans le flux des mesures de vitesse, et ce n'est
pas un détail : ce flux est recopié tel quel par l'enregistreur de traces, et
une trace s'exporte en fichier et se dépose d'un geste. Y faire entrer des
coordonnées les aurait fait sortir par une porte déjà ouverte. C'est aussi
pourquoi la remontée automatique d'une trace demande le troisième cran, celui-là
même qui autorise la position.

## Les échantillons

Le dossier `public/audio/` **n'est pas versionné**, volontairement, et le code
n'y référence rien en dur : chaque profil déclare un sous-dossier et la liste de
ses couches.

Il faut, par moteur, des boucles stationnaires à régime connu : montée en charge
bas et haut régime, décélération bas et haut régime, un ralenti, un rupteur.
C'est le format standard de l'audio de jeu — voir
[Audiokinetic](https://www.audiokinetic.com/en/blog/loop-based-car-engine-design-with-wwise-part-2/)
et [Game Developer](https://www.gamedeveloper.com/audio/capturing-engine-sounds-for-games).

### Analyser un échantillon

Le bouton **Analyser** donne la durée, le format, la qualité du raccord de
boucle, le centroïde spectral, signale les prises en rampe, et propose des
régimes d'ancrage cliquables.

**Les propositions ne sont pas appliquées d'office, et c'est délibéré.** Le
régime se déduit en principe de la raie d'allumage, mais un moteur émet une raie
à chaque demi-tour de vilebrequin et pas seulement à l'allumage : le spectre est
bien plus dense qu'une série harmonique simple, et la détection confond une
fréquence avec sa moitié, son tiers ou ses trois demis.

Mesurée sur le jeu de test, la méthode place la bonne valeur en tête sur les
prises stationnaires bas régime et se trompe sur les prises haut régime. Rendre
une valeur unique reviendrait à se tromper une fois sur deux avec assurance.

Trois garde-fous entourent cette opération, car appliquer une proposition écrase
un réglage parfois trouvé à l'oreille après plusieurs essais :

- le champ **Cylindres enregistrés** annonce qu'il ne touche pas au son et qu'une
  valeur fausse décale les propositions ;
- l'analyse recoupe l'ancrage en place avec la raie mesurée et **signale
  l'incohérence** — « l'ancrage correspondrait à 8 cylindres, non 4 » — ce qui
  détecte aussi bien un champ erroné qu'un ancrage erroné ;
- chaque couche garde son ancrage précédent et propose de **revenir en arrière**.

Ce retour vaut pour la session en cours. Pour un réglage auquel on tient,
l'export en JSON reste le filet.

D'où la liste classée : comme le son tourne pendant l'édition, en essayer un se
juge à l'oreille immédiatement. L'indication **timbre** aide à recouper — d'un
même moteur, la prise haut régime a forcément le centroïde le plus aigu.

### Relever une banque entière

Le bouton **Analyser** traite une couche à la fois, dans l'application. Pour une
banque nouvelle, où il faut aussi comparer les prises entre elles, un script
fait le tour du dossier :

```bash
npm run banque -- <dossier> [--cylindres N] [--reference fichier.wav]
```

Il imprime, prise par prise : durée et format, niveau efficace, écart en
décibels avec la prise de référence et le **gain** qui en découle, les **six
ancrages candidats** classés, les régimes qui s'en déduisent par un rapport
simple, et le raccord de boucle. Il finit par un récapitulatif à recopier,
couche par couche.

Aucun échantillon n'entre dans le dépôt : le dossier se passe en argument, et
le script n'écrit rien.

**Il mesure, il ne décide pas.** Les ancrages sont ceux de la même analyse que
le bouton, avec la même ambiguïté d'octave — c'est l'oreille qui tranche.
Mesuré sur les 33 prises des deux banques produites par `generate-bank`, dont
le régime est connu par construction : le bon régime arrive en tête 23 fois, il
est parmi les six candidats 32 fois. D'où six candidats affichés et non trois.

Le **gain** est le rapport de niveau avec la prise de référence, la plus forte
par défaut. `--reference` la déplace, et c'est souvent utile : dans la banque
livrée, la plus forte est le rupteur, une prise à part. Rapportées à la prise
en charge de leur registre, les deux prises « pied levé » retombent sur 3,03 et
2,11 — les gains 3 et 2,1 du profil, relevés à la main en son temps.

**Le nombre de cylindres commande les régimes** : le passer faux les décale
tous, sans que rien ne le signale. Huit par défaut, celui de la banque livrée.

### Compression

```bash
npm run transcode
```

Convertit en FLAC : **−50 %** sur le jeu de test, 5,73 Mo → 2,84 Mo, sans aucune
perte (écart maximal mesuré après décodage : 1,5 × 10⁻⁷). Les fichiers d'origine
sont conservés ; il reste à changer l'extension des couches dans l'écran de
configuration.

FLAC plutôt qu'AAC ou Opus parce que les codecs avec perte insèrent un silence
d'amorçage en tête de fichier, qui sur une boucle revient à chaque tour.

### Ce qui manque au jeu actuel

Il n'y a **pas de couche de ralenti**. Le moteur étire donc l'enregistrement bas
régime, ancré vers 3100 tr/min, jusqu'au ralenti à 780 — un rapport de 4 pour 1,
bien au-delà de ce qu'un échantillon supporte. La vitesse de lecture est bornée,
ce que la télémétrie signale par la mention « bornée », et le son à l'arrêt sonne
une octave trop haut.

Y remédier demande de la matière, pas du code : une prise de ralenti, déclarée
comme une couche de rôle « ralenti ».

---

## Comment ça marche

```
src/
  core/
    loop.ts              cadence unique, avec repli quand la page est masquée
    session.ts           verrou d'écran et session média du système
    offline.ts           service worker, mise en cache, installation
    speed/
      source.ts          interface commune aux trois sources
      simulator.ts       vitesse au clavier, pour travailler sur un poste fixe
      geolocation.ts     GPS réel, repli haversine, rejet des aberrations
      replay.ts          rejeu d'une trace enregistrée, et son enregistreur
      conditioner.ts     fenêtre glissante, extrapolation, ressort amorti
    engine/engine.ts     régime, charge, rupteur
    drivetrain/gearbox.ts  rapports, passages automatiques et manuels, croisière
    audio/
      mix.ts             gains et vitesses de lecture des couches (fonction pure)
      engine.ts          graphe Web Audio, chargement, horloge sur le fil audio
      analyze.ts         mesure d'un échantillon : ancrage, raccord, timbre
    preset/              schéma d'un profil, valeurs par défaut, persistance
  ui/                    les trois écrans
  state.ts               assemblage et télémétrie
public/sw.js             service worker
public/icons/            icônes, produites par npm run icons
public/audio/            échantillons, non versionnés
docker/                  piles Portainer et configuration nginx
.github/workflows/       construction et publication de l'image
scripts/                 compression FLAC, déploiement
```

Chaque module de `core/` a son fichier de tests à côté de lui —
`conditioner.test.ts` auprès de `conditioner.ts`. Il n'y a pas de dossier de
tests à part : ce qui décrit un module vit avec lui.

Les trois sources de vitesse exposent la même interface, donc rien en aval ne
sait d'où vient le chiffre : on développe au clavier, on met au point en rejouant
un trajet capturé, on roule pour de vrai, sans branche conditionnelle nulle part.

### Ce que la boîte regarde

**Un seul nombre décide : le plancher d'un rapport**, c'est-à-dire le régime en
dessous duquel ce rapport n'a pas sa place. On monte dès que le **rapport
suivant** tournerait au-dessus de ce plancher, et on descend quand le rapport
engagé tombe sous un plancher un peu plus bas. Le plancher vaut le ralenti du
moteur plus une marge, et c'est cette marge qui porte le tempérament : le mode
de conduite l'ajuste, la demande la déplace — plus on demande, plus on laisse
monter dans les tours.

Deux conséquences valent d'être dites. Le critère porte sur le régime du rapport
**visé**, donc il s'adapte de lui-même à l'étagement de la boîte : un saut court
et un saut long ne reçoivent plus le même seuil. Et un seul nombre gouvernant les
deux sens, la montée et la descente **ne peuvent plus se contredire** — c'est ce
qui ouvrait, sur chaque rapport, une plage de vitesse où la croisière autorisait
un rapport que la descente au régime refusait, et la boîte y faisait le
va-et-vient. Mesuré sur le profil Route, en accélération douce, mode Route : les
rapports cèdent à 2210, 1983, 1999, 1995 et 1969 tr/min, contre 3700, 3350, 3050
et 2950 avant le plancher — et 3005, 2597, 2367 et 2324 avant que la marge du
mode Route ne passe de 900 à 640, le 11 septembre 2026. Les cinq valeurs sont
maintenant presque égales : c'est la signature d'une boîte régulièrement étagée,
puisque le critère porte sur le rapport visé.

La marge a baissé sur une remarque de David après cette sortie — « ça reste trop
longtemps en deux ». Le ralenti étant un plancher fixe, la baisse ne se reporte
pas telle quelle : le seuil perd vingt pour cent pied au plancher, quinze en
conduite ordinaire.

Le **premier passage** échappe à la règle : la première n'est qu'une amorce de
lancement, et la deuxième s'engage dès qu'elle tient au-dessus du ralenti, sans
regarder ni le mode ni la charge.

Ce qui suit décrit les règles telles qu'elles étaient jusqu'au 10 septembre 2026,
et **ce qu'il en reste** : l'inhibition de la montée pendant qu'on ralentit, qui
tient toujours. La montée en croisière et la descente au freinage, elles, n'ont
plus de mécanisme à elles — le plancher fait les deux.

Elle ne décidait pas seulement sur le régime. Trois règles se partageaient le
travail, et chacune répondait à une question différente :

- **le régime**, pour les passages en accélération — chaque rapport a son seuil ;
- **la stabilité de la vitesse**, pour la croisière. Un palier ne fait plus
  monter le régime, donc rien ne déclencherait de passage : sans cette règle, la
  boîte restait figée où elle était, et 50 km/h tenus laissaient la deuxième à
  3034 tr/min. Elle monte donc d'un rapport dès que la vitesse est stable depuis
  quelques secondes, et s'arrête juste avant de descendre sous le plancher de
  croisière. **Tenir une vitesse, c'est ne pas la perdre** : la bande de
  stabilité est asymétrique, bien plus serrée du côté du ralentissement — un
  lever de pied sur du plat passait autrement pour une croisière, et le dernier
  rapport se gardait jusqu'à l'arrêt ;
- **la décélération**, pour descendre. Le seuil de régime seul ne distinguait pas
  un lever de pied d'un freinage : la boîte redescendait aux mêmes vitesses dans
  les deux cas, et ne servait donc jamais à ralentir. Et **on ne monte pas
  pendant qu'on freine**, comme une vraie boîte : sans cette inhibition, la
  montée au régime défaisait la descente aussitôt et l'on entendait un
  aller-retour tous les trois km/h.

Et **on ne monte pas non plus pendant qu'on ralentit**, ce qui n'est pas la même
chose que pendant qu'on freine — lever le pied ne franchit pas le seuil de
freinage. Cela vaut pour les deux façons de monter, et il a fallu les traiter
l'une après l'autre : la montée en croisière, puis la montée au régime. Cette
dernière lance un compte à rebours dès que le seuil est franchi, et plus rien ne
l'annulait : le seuil atteint, un lever de pied dans la foulée, et le passage se
produisait une demi-seconde plus tard alors que la voiture ralentissait déjà. Le
compte à rebours est maintenant abandonné, pas suspendu — reprendre les gaz
repart d'un compte neuf. La bande de croisière juge sur la dérive de la
vitesse mesurée sur trois secondes : robuste au bruit, mais lente. Quand on lève
le pied après une longue croisière, la stabilité est déjà acquise et la dérive
met plus d'une seconde à voir le ralentissement — assez pour laisser passer un
rapport de plus. Mesuré : un passage du quatrième au cinquième une seconde après
le lever de pied, sur une perte de 0,5 km/h par seconde. L'accélération
instantanée le sait tout de suite mais elle est bruitée ; on la cumule donc dans
un compteur qui monte en ralentissant et redescend deux fois plus vite sinon, si
bien qu'une croisière qui tremble autour de zéro ne l'atteint jamais.

Et surtout, **le seuil de montée suit la demande et non la charge de l'instant**.

Il se décale de seize cents tours selon l'effort, pour distinguer une conduite
tranquille — qui monte tôt sur un rapport long — d'une accélération franche qui
étire chaque rapport. Ce qu'il attend est l'**intention** du conducteur ; sur une
vraie automatique, c'est la position de la pédale. Faute de pédale, la charge se
déduit de l'accélération, c'est-à-dire du **résultat**, et les deux ne sont pas la
même chose. David l'a relevé des deux côtés à la fois : « les rapports montent
plus tôt quand on accélère moins, et plus tard après un kickdown ». En côte, pied
au plancher, l'accélération est faible : la charge tombe, le seuil descend de huit
cents tours et la boîte monte tôt — l'inverse de ce qu'il faudrait. Et au lever de
pied, la charge s'effondre en une demi-seconde, donc le seuil passe sous le régime
sans que le moteur ait bougé.

La **demande** monte instantanément avec la charge — garder un rapport quand on
remet les gaz doit être immédiat — et n'en redescend qu'en trois secondes. Une
accélération franche garde donc ses rapports longs quelques secondes après qu'on
a relâché, comme une boîte qui a compris qu'on conduisait vite ; et le seuil ne
peut plus tomber que d'environ cinq cent trente tours par seconde sur le profil
Route. Quatre gardes avaient été posées en aval avant d'en arriver là : trois
dépendaient du moment où l'accélération mesurée devient franchement négative — or
elle est lissée quand la charge ne l'est presque pas, si bien qu'elles arrivaient
après.

Enfin, **le passage immédiat ne vaut qu'en accélérant**. La temporisation de
confirmation est court-circuitée dès que le régime dépasse le seuil de plus de
quatre cents tours, pour qu'une forte accélération ne fasse pas filer le régime
bien au-delà du réglage. Mais le seuil, lui, se décale de seize cents tours avec
la charge : pied au plancher il est haut, et il s'effondre en une demi-seconde
dès qu'on relâche, bien plus vite que le régime ne descend. Le dépassement se
trouvait alors franchi non parce que le moteur montait, mais parce que la barre
était tombée — et deux rapports passaient d'affilée, chacun voyant son propre
seuil effondré. Mesuré : quatre mille huit cents tours en quatrième, lever de
pied, cinquième puis sixième.

Le rétrogradage forcé, lui, répond à une **montée** de charge et non à son
niveau. Faute de pédale dans une voiture électrique, la charge est déduite de
l'accélération : son niveau ne dit pas « on demande fort » mais « on accélère ».
Le seuil se franchissait dès 3,6 km/h par seconde, et la boîte descendait pour
cela.

### Ce qu'on entend d'un passage de rapport

Un passage se déroule en cinq temps, et c'est la description que David en a
donnée en écoutant une vraie boîte : « accélération, montée de régime ; passage
au neutre, descente rapide ; coup de gaz, montée rapide très courte ; passage du
rapport, clac ; lâcher de l'embrayage, reprise du couple, descente rapide au
régime des roues puis réaccélération. »

Relevé sur le profil Route, première en seconde à 45 km/h, un point tous les
seize millisecondes :

| t (s) | avancement | régime | roues | part en charge | |
|---|---|---|---|---|---|
| 5,633 | — | 4 692 | 4 725 | 0,93 | en accélération |
| 5,783 | 0,34 | **2 337** | 2 787 | 0,30 | fond de la chute au neutre |
| 5,850 | 0,51 | **3 364** | 2 819 | 0,21 | sommet du coup de gaz |
| 5,867 | 0,56 | 3 377 | 2 827 | 0,22 | **clac**, le rapport s'engage |
| 6,033 | 0,98 | 2 910 | 2 907 | 0,90 | le couple est repris |
| 6,050 | — | 2 912 | 2 915 | 0,93 | claquement d'échappement, puis réaccélération |

Quatre choses s'y produisent, et une cinquième les rend possibles :

- **Le couple se coupe.** L'effort vu par le mixage tombe le temps du passage,
  ce qui fait entrer les couches pied levé : le timbre change vraiment, au lieu
  que le même son baisse. Il fallait le faire à la main, car l'effort se déduit
  de l'accélération et **la voiture, elle, ne coupe rien** — elle est électrique
  et continue d'avancer pendant que la boîte imaginaire change de rapport.
  Le régime, la boîte et la télémétrie continuent de voir l'effort vrai.
- **Le régime plonge, puis remonte.** Embrayage ouvert, le moteur tombe sous le
  régime du rapport visé ; le coup de gaz le relance au-dessus ; l'engagement le
  ramène. Les deux amplitudes se règlent, et zéro supprime le mouvement
  correspondant.

  **En montée, le coup de gaz suit l'effort du moment.** Un passage dure six
  dixièmes de seconde : décidé légitimement, il s'engage quand même si l'on
  lève le pied entre-temps, et son coup de gaz tombe alors que la voiture
  ralentit déjà — on entendait le moteur se relancer juste après l'avoir
  abandonné. Pied levé, il n'y a donc plus de coup de gaz, seulement la chute.
  **Au rétrogradage il reste entier** : c'est là qu'il est le geste du
  conducteur, et l'on rétrograde précisément pied levé — le lier à l'effort le
  supprimerait exactement quand il doit s'entendre.
- **La boîte claque** au moment où le rapport s'engage, au sommet du coup de gaz
  et non à la fin du passage : ce qui reste après lui, c'est l'embrayage qui se
  lâche, et cela ne claque pas. C'est un **choc mécanique** et non un bruit
  d'échappement — attaque en une milliseconde, extinction en trente, un
  claquement clair vers deux kilohertz doublé d'un coup mat sous deux cents
  hertz. Sans le second on entend un déclic ; sans le premier, une porte.
- **L'échappement claque à la reprise**, une seule détonation quand le couple
  revient : la pétarade du lever de pied, tirée en un coup au lieu d'une salve.

**Tout cela vaut pour les deux origines de son**, échantillons comme synthèse.
Ce n'était pas le cas au départ : le clac et la pétarade vivaient dans le moteur
à échantillons, qui exige une banque chargée pour jouer quoi que ce soit, et la
coupure de couple vivait dans le mixage, qui n'est appelé que pour cette banque.
Un profil en synthèse n'entendait donc que le mouvement de régime — celui-ci
étant calculé dans le moteur et transmis tel quel. Les deux bruits sont
maintenant des pièces à part, jouées sur le graphe qui sonne, et la coupure
s'applique aussi à ce qu'on transmet au moteur simulé. Sur ce graphe-là ils
entrent après le silencieux et la résonance : un choc de carter ne traverse pas
la ligne d'échappement.

**Et le passage dure assez pour que tout cela s'entende.** C'était le point
bloquant : à 120 millisecondes, les quatre temps se chevauchaient et l'on ne
percevait qu'un trou. Le temps de passage est monté à **600 ms** sur le profil
Route et 480 sur Sport, ce qui donne 204 ms de chute, 108 de coup de gaz, 48
d'engagement et 240 de reprise. C'est l'ordre de grandeur d'une boîte manuelle
avec double débrayage, là où une boîte à double embrayage moderne tient en
cinquante millisecondes. Le réglage monte jusqu'à 1 500 ms : il commande toute
la séquence, la raccourcir la comprime, l'allonger l'étale.

**Le clac ne passe pas par le saturateur, et c'est la seule façon qu'il
s'entende.** Deux versions ont échoué avant celle-ci. La première était trop
faible — 15,6 dB sous les crêtes du moteur, un passe-bande étroit jetant
l'essentiel de l'énergie. La seconde, portée 4,2 dB **au-dessus** du moteur,
était tout aussi inaudible, et le compteur de télémétrie montait pendant ce
temps : ce n'était donc pas le déclenchement.

La cause est la courbe du saturateur, indexée sur [-1, 1] — au-delà, Web Audio
prend la valeur du bord. Le moteur crête déjà à 1,74 sur le bus, donc il sature
en permanence, et **tout ce qui entre au-dessus de lui en sort au même niveau**.
Mesuré à la courbe du profil Route : un clac 4,2 dB plus fort, un clac au
maximum du curseur, et un clac dix fois trop fort sortent tous les trois à
0,00 dB d'écart du moteur. Aucun réglage ne pouvait le rendre audible.

Les événements brefs — le clac comme la pétarade — sont donc injectés **après le
saturateur**, directement sur le limiteur. La sortie reste protégée, et l'attaque
de deux millisecondes du limiteur laisse passer le début du transitoire, qui est
exactement ce qui fait le claquement.

**Et une crête n'est pas un niveau.** Une fois sorti du saturateur, le clac
s'entendait au bouton mais pas en roulant. Sa crête dépassait pourtant celle du
moteur : c'est cette mesure-là qui était trompeuse. Reprise par bandes d'octave,
elle donne l'écart réel — le clac arrivait **24 à 40 dB sous le moteur** partout
où l'oreille écoute. Sa rampe d'extinction descendait si vite que toute son
énergie tenait dans la première milliseconde.

Il s'éteint maintenant à constante de temps, sur cinq à douze centièmes de
seconde selon la composante.

**Et il est grave, pas aigu.** Une première version corrigée plaçait son énergie
vers trois kilohertz et au-delà : audible enfin, mais « trop sèche, aiguë et
courte », et si perçante qu'au vingtième du réglage elle dominait encore. Elle
culminait à −4 dB du moteur à huit kilohertz et à +13 dB à seize. La version
livrée fait l'inverse — mesurée en écart au moteur : **−5,7 dB à 125 Hz**,
−10,7 à 250, et seize décibels en dessous partout au-dessus de deux kilohertz.
Un choc dans un carter n'est pas un claquement de fouet.

Trois composantes : la masse sous deux cents hertz, le corps du carter vers
quatre cent cinquante, et juste assez de médium vers douze cents pour qu'on
entende une pièce et non un coup sourd. Un bouton
**« Écouter le clac »**, dans la configuration, le joue seul — un événement d'un
centième de seconde ne se règle pas en attendant le prochain passage de rapport.
Et le compteur « Clacs de boîte », en télémétrie, dit s'il est tiré : il monte
alors même qu'on n'entend rien quand le défaut est dans la chaîne.

La coupure de couple, la plongée, le coup de gaz, le clac et le claquement se
règlent séparément et se coupent à zéro. La synchronisation du régime sur la
durée du passage, elle, n'a pas d'interrupteur : c'est la correction d'un
défaut, non un effet.

### Deux grandeurs, et non une : la charge et l'effort

Faute de pédale, tout se déduit de l'accélération. Mais la boîte et le son ne
demandent pas la même chose :

- la **charge** dit l'**intention** du conducteur — demande-t-il de
  l'accélération ? Cela ne dépend pas de la vitesse. C'est elle que lit la boîte,
  avec ses seuils de passage et son rétrogradage appuyé ;
- l'**effort** dit le **travail du moteur** — combien il pousse. C'est
  l'accélération **plus** la traînée à vaincre, laquelle croît comme le carré de
  la vitesse. C'est lui que suit le son : le fondu entre « en charge » et « pied
  levé », et le relief de charge.

Les avoir confondues rendait la croisière plate : tenir 30 km/h et tenir 130
donnaient la même charge, donc le même niveau et le même timbre, alors que l'un
ne demande presque rien et l'autre beaucoup. Mesuré avant : cinq allures tenues
à 0,50 au centième près, de l'arrêt à 130 km/h.

Le repère de traînée est la vitesse à laquelle tenir l'allure consomme la moitié
de l'effort maximal — 130 km/h sur Route. Mesuré après, profil Route :

| Situation | Charge | Effort | Relief de charge |
|---|---|---|---|
| Arrêt, au ralenti | 0,50 | 0,00 | −4,0 dB |
| 50 km/h tenu | 0,54 | 0,15 | −2,8 dB |
| 90 km/h tenu | 0,51 | 0,26 | −1,9 dB |
| 130 km/h tenu | 0,53 | 0,57 | +0,6 dB |
| 110 km/h roue libre | 0,19 | 0,00 | −4,0 dB |
| 130 km/h, reprise douce | — | 0,85 | +2,8 dB |

La croisière s'étage désormais sur 3,4 dB entre 50 et 130 km/h, là où elle était
plate. Et la charge, elle, n'a pas bougé d'un centième : aucun seuil de passage
n'est à recaler, ce qui était la condition pour que ce changement n'en défasse
pas d'autres.

Le ralenti, lui, perdait les 4 dB que le relief lui retire maintenant que
l'effort y vaut zéro : `idleLevelDb` les lui rend.

### La pièce importante, et ce n'est pas le son

C'est `conditioner.ts`. Le GPS ne livre qu'une mesure par seconde : piloter
directement une hauteur avec ce signal donne un escalier qui saute chaque
seconde. Trois traitements se composent — une pente calculée sur une fenêtre
glissante, une extrapolation entre deux mesures, et un ressort amorti critique
intégré à pas fixe.

Mesuré sur une trace synthétique à 1 Hz : l'écart de suivi reste **sous 1 km/h**
en accélération régulière, et la sortie est continue. Il monte à une dizaine de
km/h sur un freinage brutal, le temps que la pente bascule — c'est le compromis
inhérent au procédé, et c'est ce qu'arbitrent les réglages « raideur du lissage »
et « fenêtre d'accélération ».

**Deux sorties, et il faut les distinguer.** La vitesse continue vient du
ressort ; l'accélération, elle, est la **pente estimée** — pas la vitesse de la
masse du ressort. C'est un point qui a coûté cher : les deux mesurent la même
chose, et l'une est huit fois plus bruitée que l'autre. Le ressort a pour métier
de rattraper une cible qui saute à chaque mesure sans la dépasser, donc sa
vitesse porte tout le bruit du GPS. Mesuré sur une vitesse parfaitement tenue,
avec un bruit de mesure de ±1 km/h : 0,83 m/s² d'écart-type pour le ressort,
0,10 pour la pente ; et sur une reprise établie à 2 m/s², 1,96 contre 2,00.

Cette valeur décide la charge, donc le fondu entre les couches, et les passages
de la boîte. C'est pour cela qu'elle mérite la meilleure estimation disponible
et non la plus immédiate.

### Le son

Toutes les couches jouent en permanence, en boucle, dès l'activation ; seuls
leurs gains et leurs vitesses de lecture bougent. Démarrer et arrêter des sources
au fil du régime produirait des discontinuités de phase, donc des clics.

Deux fondus se composent, tous deux à puissance constante : en régime, entre les
couches d'un même rôle ; en charge, entre « en charge » et « pied levé ».

À puissance constante, c'est-à-dire **sans creux au milieu d'une bascule** — mais
aussi sans relief : ces fondus changent la couleur du son et jamais son volume.
Mesuré, ralenti, croisière, reprise douce et reprise franche tenaient dans
1,3 dB, et lever le pied franchement était même plus fort qu'écraser. Trois
réglages de **relief** s'appliquent donc par-dessus, à toutes les couches à la
fois : l'effort, le régime, et le ralenti. Ils déplacent le niveau d'ensemble
sans toucher à l'équilibre entre les couches, donc sans rouvrir le creux que les
fondus évitent.

Un moteur ne tourne pas juste, et c'est cela qui le fait entendre comme un
moteur plutôt que comme un échantillon. Deux écarts sont donc introduits, tous
deux calculés dans `core/`, donc mesurables sans sortir un son.

**Le régime tremble.** Le conditionnement produit un signal d'une régularité
qu'aucun moteur thermique n'a. On y ajoute un tremblement lent — trois
sinusoïdes, dont deux dans un rapport irrationnel, si bien que la somme n'a pas
de période — d'amplitude décroissante avec le régime et avec la charge : un moteur
se stabilise en montant et sous couple, il tremble au ralenti et à vide. Mesuré
sur Sport : 34 tr/min d'excursion au ralenti, ±18 à 3000 tr/min pied levé, ±7 à
3000 tr/min pied au plancher.

Le moteur sort donc **deux** régimes, et c'est le point délicat. Le régime net
alimente la boîte, ses seuils et la télémétrie ; le régime **entendu** porte le
tremblement et ne sert qu'aux vitesses de lecture. Les seuils de passage
travaillent sur le régime : quelques dizaines de tours de tremblement les
feraient osciller, et trois défauts d'oscillation de la boîte venaient déjà d'un
compteur portant deux sens. Un compteur, un usage.

Le tremblement est fait de sinusoïdes et non d'un tirage au sort : il est
reproductible sans graine à gérer, une même situation donne toujours le même
son, et un test peut l'affirmer.

**Les couches ne jouent plus d'accord.** Deux couches d'une même famille jouées
au rapport exact sont parfaitement justes l'une par rapport à l'autre, ce qu'un
moteur réel n'est jamais : les inégalités entre cylindres et les deux lignes
d'échappement produisent un battement lent. Elles sont donc désaccordées de
quelques centièmes de demi-ton, l'écart étant réparti de part et d'autre pour
que la hauteur moyenne ne bouge pas. Mesuré, douze centièmes donnent un
battement à 2,4 Hz au milieu de la bascule de Sport.

Le désaccord est constant par couche — il dépend du rang de la couche dans sa
famille, jamais du temps — et il s'applique **après** la décision de domaine
jouable : régler ce curseur ne peut donc déplacer aucun gain, et ne peut pas
sortir une couche de son domaine.

**La boucle ne se referme plus au même endroit.** Chaque couche est un
enregistrement de trois à cinq secondes lu en boucle ; à la vitesse de lecture
réelle, de 0,26 à 0,81, il se répète toutes les quatre à vingt secondes, toujours
identique. Le matériau, lui, n'est pas uniforme : le niveau varie de 2,4 dB sur
la prise haut régime à 9,2 dB sur la prise bas régime au fil d'un tour de boucle,
et deux tranches distantes d'une seconde diffèrent deux fois plus que deux
tranches voisines. C'est ce motif-là que l'oreille apprend.

Toutes les six secondes en moyenne, la lecture reprend donc ailleurs dans
l'enregistrement, par un fondu croisé de vingt millisecondes. Le fondu est à
**puissance constante** : deux positions d'un même enregistrement sont
décorrélées, donc leurs énergies s'ajoutent et non leurs amplitudes — un fondu
linéaire creuserait un trou de 1,8 dB à chaque passage. Mesuré ainsi, le raccord
reste sous la respiration naturelle du son : 1,2 à 3,3 dB d'écart de niveau
pendant le fondu, contre 2,3 à 2,8 dB pour le son qui ne saute pas.

Aligner la nouvelle position sur le cycle moteur, comme le fait le recollement de
boucle, a été essayé et abandonné : cela ne change rien (1,23 dB contre 1,19), le
fondu étant trop court pour que la phase compte.

Ce que ces trois écarts ne font pas : un moteur. Cinq fichiers restent cinq
fichiers, et ce plafond-là ne se franchit qu'avec plus de bancs moteur.

Trois points ont demandé une attention particulière :

- **Le raccord des boucles.** Mesurée canal par canal après décodage, la
  discontinuité atteignait 21,6 % du niveau crête sur la montée haut régime et
  39,4 % sur le rupteur : de quoi claquer à chaque tour.

  Un simple fondu ne suffit pourtant pas. Les deux portions raccordées sont
  décorrélées : leurs harmoniques se combinent au hasard des phases et
  s'annulent en partie, ce qui creuse le niveau à chaque tour — un saut de
  20,4 % sur la prise bas régime, trois fois les variations ordinaires du signal,
  entendu comme un gargouillis revenant toutes les quelques secondes.

  Le chargement cherche donc *où* boucler : l'endroit, vers la fin, dont le
  voisinage ressemble le plus au début, en niveau comme en forme. Mais aucun
  critère indirect ne garantit le résultat — sur une prise en rampe, l'alignement
  dégrade au lieu d'améliorer. Le saut d'énergie réel est donc mesuré sur les
  deux versions et la meilleure l'emporte, si bien que la réparation ne peut
  jamais empirer ce qu'elle corrige. Sur le jeu de test, quatre couches sur cinq
  y gagnent et retombent au niveau des variations ordinaires.
- **La cadence en arrière-plan.** Le navigateur gèle l'affichage et ralentit les
  minuteurs dès que la page n'est plus visible, mais le fil audio continue. Une
  horloge `AudioWorklet` bat donc la mesure dès qu'elle est disponible. Un média
  silencieux tourne en parallèle pour que le système ne libère pas la session.
- **La phase des couches.** Deux boucles issues du même enregistrement, démarrées
  ensemble, se renforcent en peigne. Chacune démarre à une position tirée au sort.

---

## Banc de mise au point

Le navigateur gèle `requestAnimationFrame` et ralentit les minuteurs dès que la
page passe en arrière-plan, ce qui rend toute mesure prise à la montre
inexploitable. En développement, `window.__speed` expose l'état complet et de
quoi reprendre la main sur le temps :

```js
const s = window.__speed
s.start()
s.pauseLoop()                  // coupe la cadence, garde la source et le son actifs
s.setThrottle(1)
s.advanceManually(1 / 60, 600) // dix secondes simulées, à pas fixe
s.telemetry.value
s.resumeLoop()
```

C'est ainsi que les seuils de passage ont été vérifiés : la boîte monte un
rapport 0,6 s après avoir franchi 94 % du rupteur à pleine charge, et bien plus
tôt en charge partielle.

Les traces sont **conservées d'une session à l'autre**, exportables en un fichier
et réimportables ailleurs — c'est ainsi qu'un trajet enregistré au volant se
rejoue au poste de travail.

L'autre outil est le **rejeu de traces** : un trajet réel s'enregistre une fois
depuis l'écran Télémétrie, puis se rejoue à l'identique sur un poste fixe. Régler
le lissage devient reproductible, au lieu de demander un aller-retour sur route à
chaque essai.

---

## État du projet

| Lot | Contenu | État |
|---|---|---|
| 0 | Squelette, boucle, écrans, simulateur clavier | fait |
| 1 | Conditionnement du signal, GPS, enregistrement et rejeu de traces | fait |
| 2 | Modèle moteur et boîte de vitesses | fait |
| 3 | Moteur audio à échantillons, compression, calage des boucles | fait |
| 4 | Analyse des échantillons dans l'éditeur | fait |
| 5 | Écran de la voiture, session média, verrou d'écran | fait |
| 6 | Déploiement sur NAS, HTTPS en développement | fait |
| 7 | Application installable et utilisable hors réseau | fait |
| 8 | Publication automatique de l'image, installation sans terminal | fait |
| 9 | Process de développement écrit, git flow, contrôle d'intégration | fait |
| 10 | Mise sous test du cœur : 211 tests, 94 % de `core/` couvert | fait |
| 11 | Les quatre défauts que la mise sous test a trouvés | corrigé, reste à écouter |
| 12 | Son maintenu quand le navigateur passe en arrière-plan | fait, vérifié en roulant |
| 13 | Boîte qui regarde la vitesse : montée en croisière, descente au freinage, rétrogradage sur la demande | à écouter |
| 14 | Relief du volume : l'effort, le régime et le ralenti s'entendent | à écouter en roulant ; la chaîne de sortie est mesurée hors de cause |
| 15 | Trois défauts de la boîte relevés en roulant : ralentir n'est plus croiser | à écouter |
| 16 | Pente : la cadence réelle du GPS faussait la mesure d'accélération | corrigé, reste à écouter |
| 17 | Défilement de l'écran de configuration sans dérégler un curseur | corrigé, reste à essayer |
| 18 | Le volume général sort du profil : c'est une préférence d'appareil | fait |
| 19 | Mode simplifié : deux curseurs globaux, le détail derrière un mode avancé | fait, reste à écouter |
| 20 | Tableau de bord à cadrans | fait, reste à essayer ; le décor défilant est retiré, et ne sera pas refait |
| 21 | Imperfections : tremblement de régime, couches désaccordées, boucle qui ne se répète plus | fait, reste à écouter |
| 22 | Étalonnage : mesurer la vraie voiture pour régler les virtuelles | fait, reste à rouler |
| 23 | Le serveur accepte le dépôt d'une trace | fait, éprouvé sur le NAS |
| 24 | Ce que l'appareil réel impose : positions imprécises écartées, largeur utile, verrou d'écran et autorisation GPS affichés | fait, reste à relever en roulant |
| 25 | Un étalonnage ne s'applique qu'entier, et une source qui rejette tout dit pourquoi | fait, reste à rouler |
| 26 | Une manette Xbox conduit le simulateur, gâchettes analogiques comprises | fait |
| 27 | Trois modes de simulation, dont un qui traverse la vraie source GPS | fait |
| 28 | L'effort du moteur tient compte de la vitesse : la croisière n'est plus plate | fait, reste à écouter |
| 29 | Une banque produite ici par engine-sim, une prise par demi-octave, rejouée telle quelle dans la voiture | fait, reste à écouter |
| 30 | engine-sim en WebAssembly : le son sort en direct et suit le régime | fait, reste à écouter |
| 31 | Tout ce qui naît dans la voiture remonte tout seul : traces, journal, relevés de mesure, profils | fait, NAS en place, reste un essai en roulant |
| 32 | Plusieurs banques de son : découvertes sur le serveur, mesurées par un outil, choisies par profil | fait, reste à essayer hors réseau |
| 33 | Le passage de rapport s'entend : couple coupé, plongée, coup de gaz, clac de boîte, et un seuil de montée qui suit la demande | écouté au simulateur, échantillons et synthèse, reste à rouler |
| 34 | Le chemin du retour : les quatre dossiers du serveur se récupèrent en un paquet, depuis un téléphone | fait, reste l'essai de David |
| 35 | Refonte : le son change d'origine, la boîte cesse de deviner de deux façons, l'application se sépare en deux, et un compte fait le lien | spécifié, en cours |
| 36 | L'accélération était mille fois trop petite : le navigateur de la voiture horodate en microsecondes | corrigé, reste à écouter en roulant |
| 37 | La capture d'un trajet se fait toute seule, compressée, avec un témoin qui dit si la session sera récupérable | fait, reste le premier trajet réel |
| 38 | Un relecteur : timeline, carte et repère copiable, pour revoir un trajet au bureau | fait, éprouvé sur l'essai du 10 septembre ; le rejeu sonore attend une capture |
| 39 | La boîte se décide sur un seul plancher de régime : on monte dès que le rapport suivant tient | **écouté le 11 septembre au soir : le va-et-vient a disparu, le départ est conforme** |
| 40 | Un sélecteur de boîte pour démarrer et arrêter, et une boîte qui remonte les rapports après un arrêt | fait, reste l'essai en roulant |
| 41 | Le serveur apprend la vraie voiture depuis les traces ordinaires et propose son profil | livré ; la chaîne servie était coupée, réparée le 11 septembre — reste à recoller la pile |
| 42 | Trois retours de la sortie du 11 septembre au soir : le rétrogradage forcé qui rend son rapport, le clac de montée, l'aiguille du rapport suivant | fait, reste l'écoute en roulant |
| 43 | Une boîte à sept rapports, étagée pour tenir bas : 50 en quatrième, 80 en cinquième, 110 en sixième, et les passages plus tôt en mode Route | fait, reste l'écoute en roulant |

Ce tableau donne l'ordre et l'avancement d'ensemble. Le détail du périmètre et
le statut de chaque ticket vivent dans [`.backlog/`](.backlog/README.md) ; les
règles de travail du dépôt dans [`CLAUDE.md`](CLAUDE.md), son vocabulaire dans
[`CONTEXT.md`](CONTEXT.md), et ce qui a été livré dans
[`CHANGELOG.md`](CHANGELOG.md).

**Les trente-trois premiers lots s'arrêtent au repère `avant-refonte`.** L'essai
en voiture a rendu un verdict que les mesures au poste n'avaient pas vu : le
processeur de la voiture ne tient pas la synthèse en direct — environ une fois
le temps réel à 8 kHz de simulation, là où le seuil du lot était trois —, le son
ne convainc pas, la boîte et l'écran non plus. Une refonte est décidée le
10 septembre 2026 — origine du son, modèle mécanique, interface, et des
comptes utilisateurs là où il n'y avait ni serveur ni compte. Le tag marque le
dernier état qui a roulé ; il se retrouve avec
`git switch --detach avant-refonte`, et la liste des repères est dans
[`CLAUDE.md`](CLAUDE.md).

### Ce qui n'est pas vérifié

- **Le verrou d'écran.** Le code est en place, mais le navigateur de
  développement refuse la permission (`NotAllowedError`), y compris sur un appel
  direct à l'API. Seul son échec propre est établi.
- **La précision réelle des positions dans la voiture.** Le seuil de rejet est
  livré à 250 m, choisi large : il écarte ce qu'annonce une position obtenue
  sans satellites, sans toucher à ce qu'un point satellite produit. Aucune
  valeur n'a été relevée dans cette voiture — c'est ce que l'écran Télémétrie
  affiche maintenant. Tant que le relevé n'existe pas, ce seuil est un
  garde-fou et non un réglage.
- **La largeur utile de la page dans la voiture, et l'API de verrou d'écran.**
  Les deux sont affichées, aucune n'est relevée. Le zoom du navigateur de bord
  n'est pas réglable et sa valeur par défaut a changé avec le logiciel de la
  voiture ; la mise en page ne pourra se caler que sur le chiffre lu à l'écran.
- **Le GPS écran éteint.** Les systèmes mobiles espacent fortement les mesures
  quand l'écran s'éteint. C'est à cela que sert le verrou, et les deux se testent
  ensemble, en roulant.
- ~~La configuration nginx et la chaîne d'intégration.~~ Vérifiées : le workflow
  publie une image multi-architecture, et la pile tourne sur le NAS derrière le
  proxy inversé.
- **Le rendu sonore.** Les mesures établissent que le signal sort, qu'il ne
  sature pas et que les fondus sont corrects. Pas qu'il sonne juste.
- ~~Le son en arrière-plan.~~ Vérifié en roulant le 3 septembre 2026 : il
  continue sans interruption quand le navigateur de la voiture est réduit. Le
  média qui maintient la session audio avait été refait sur le modèle d'une
  application qui y arrive — fichier servi plutôt que fabriqué en mémoire,
  élément inséré dans le document, deux minutes de silence plutôt que quatre
  secondes.
- **La mesure d'accélération dans la voiture.** Elle était fausse, et on sait
  maintenant pourquoi : le navigateur de la Tesla horodate ses positions en
  **microsecondes**, là où la norme du web dit millisecondes. L'accélération
  étant une pente, elle sortait mille fois trop petite — relevé sur le journal
  de l'essai du 9 septembre 2026, elle est sous le seuil d'arrondi dans 476
  relevés sur 480. Le volume, le timbre et la boîte travaillaient donc sur zéro.

  C'est corrigé : le conditionnement déduit l'échelle du plus petit écart entre
  deux mesures. Rejouées dans le code corrigé, les deux traces du même essai
  rendent une accélération exploitable sur 83 % et 70 % de leurs mesures, de
  médiane 0,36 m/s² et d'étendue −1,39 à +3,37. **Ce qui n'est pas vérifié, c'est
  l'écoute** : ni le relief de charge ni la boîte n'ont jamais été entendus sur
  une accélération juste.

  Deux relevés du même essai bornent ce qu'on peut attendre du signal : la
  cadence réelle est de **dix positions par seconde**, et la vitesse annoncée est
  **quantifiée au kilomètre-heure entier** — seuls 9 à 11 % des échantillons
  portent une valeur nouvelle.
