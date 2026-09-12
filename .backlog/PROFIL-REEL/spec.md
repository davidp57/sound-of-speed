# PROFIL-REEL — le serveur apprend la vraie voiture et propose son profil

**Statut :** ⬜ prêt — spécifié le 11 septembre 2026, découpé en huit tickets
**Branche :** `feature/profil-reel`, à ouvrir
**Version visée :** à décider

## L'idée

Les traces d'un trajet partent déjà au serveur, toutes seules, depuis le
10 septembre 2026. Une seule sortie en a laissé vingt-quatre mille relevés.

Le serveur peut donc **dériver le profil de la vraie voiture** — sa reprise, son
freinage, son ralentissement pied levé, les vitesses qu'on y pratique — à partir
de la conduite ordinaire. Sans protocole, sans qu'on roule exprès, sans qu'on
touche à rien.

Quand il estime en avoir assez, il le propose : **« profil de la voiture généré,
voulez-vous l'appliquer ? »**

David, le 11 septembre 2026 :

> le serveur peut utiliser ces enregistrements pour dériver les données de profil
> de la vraie voiture (performance) comme ce qui est fait avec l'écran dédié.
> Une fois qu'on estime avoir assez de données pour générer un profil, on popup
> un message sur l'écran de la voiture qui dit « profil de la voiture généré,
> voulez-vous l'appliquer ? ». Si oui, alors on l'applique. Si non, il est juste
> mis à disposition dans le navigateur. Dans tous les cas il reste disponible sur
> le serveur, on peut ajouter un bouton pour le récupérer.

## Ce que cela n'est pas

C'est la troisième pièce d'une série, et il faut les distinguer :

| | Qui mesure | Comment | Ce qu'on en fait |
|---|---|---|---|
| [ETALONNAGE](../ETALONNAGE/spec.md) | l'appareil | six étapes guidées, on roule exprès | on lit et on recopie à la main |
| [REFONTE](../REFONTE/spec.md) | l'appareil | idem | un interrupteur applique tout |
| **PROFIL-REEL** | **le serveur** | **la conduite ordinaire, sans rien demander** | **il propose, on accepte ou non** |

ETALONNAGE reste utile : il mesure vite et sur commande, et c'est l'outil quand
on veut un chiffre tout de suite. PROFIL-REEL mesure lentement et tout seul.

## Ce qui existe déjà, et qu'on ne réécrit pas

Le relevé du 11 septembre 2026 a établi que **le calcul est écrit**, et qu'il est
sous test :

| Module | Ce qu'il sait faire |
|---|---|
| `core/calibration/measure.ts` | extraire d'une trace : cadence, bruit, pentes, crêtes, vitesse pratiquée, paliers, départs arrêtés |
| `core/calibration/analyze.ts` | juger si un enregistrement contient bien ce qu'on cherche |
| `core/calibration/suggest.ts` | convertir les mesures en réglages |
| `core/calibration/onboard.ts` | composer profil × mesures, sans toucher au profil |
| `core/preset/real-car.ts` | l'objet « la voiture qu'on a », déjà sorti du profil |

Deux conséquences.

**La couche existe.** `withCalibration(profile, overrides)` produit le profil
d'exécution sans modifier celui qu'on édite ; `state.ts` le câble déjà. Ce lot
n'invente pas la composition, il lui fournit d'autres mesures.

**La position ne sert à rien.** Une trace ne porte que vitesse et horodatage
(`core/speed/source.ts:11`), et aucune grandeur d'étalonnage ne lit une
latitude. **Une trace déposée sans position se mesure exactement comme une
autre** — le choix de l'utilisateur de ne pas déposer sa position ne coûte rien
ici.

## Les décisions

Prises au cours de l'entretien du 11 septembre 2026.

### Le serveur calcule, dans un conteneur Node

Un **second conteneur** dans la pile Portainer, à côté de nginx, construit et
publié par la même chaîne d'intégration. Il importe `src/core/` tel quel.

C'est ce qui garantit **un seul calcul**. Un service écrit dans un autre langage
donnerait deux procédés pour la même grandeur, et ils divergeraient — la revue du
11 septembre a trouvé cinq défauts de ce genre en une seule journée, tous nés
d'un état dupliqué.

Le NAS ne construit rien et n'ouvre pas de terminal : le conteneur arrive prêt,
comme celui de l'application.

### Une couche, jamais un profil

Le profil décrit un **son** — un moteur, une boîte, un mixage. Ce lot mesure une
**voiture**. Les deux se composent, et le profil réglé à la main n'est jamais
écrasé. La couche profite à tous les profils à la fois, et se retire d'un
interrupteur.

### Un bandeau, y compris en roulant

La proposition s'affiche sous les cadrans, avec deux réponses : **Appliquer**,
**Plus tard**. Elle ne bloque rien, donc elle n'a pas à attendre l'arrêt.

David : « y'a pas de raison, si je suis pas dispo je l'ignore et je clic plus
tard ».

Pas de fenêtre qui prend l'écran : une fenêtre s'ouvre au moment où l'on veut
justement appuyer sur D et partir.

### On recalcule à chaque tranche déposée

Le profil est donc à jour à la minute près.

**Contrainte qui en découle** : le calcul doit être **incrémental** — un agrégat
gardé, la tranche neuve ajoutée. Relire l'historique entier douze fois par trajet
tient aujourd'hui et ne tiendra pas dans six mois. Un recalcul complet reste
forçable, pour le jour où l'on corrige un procédé.

### Une fois acceptée, la couche s'affine seule, et le dit quand ça bouge

L'accord vaut pour la suite : on ne redemande pas douze fois par trajet. Mais
quand une mesure se déplace de plus de **20 %**, un bandeau le signale, sans rien
demander — on sait alors que le son a changé, et pourquoi.

Les 20 % sont un **point de départ**, pas un résultat. Un seul nombre à régler à
l'usage, et le défaut est assumé : vingt pour cent sur un freinage et vingt pour
cent sur une vitesse tenue ne s'entendent pas pareil.

### Le frein se déduit de la forme de la distribution

C'est le point dur du lot. Rien dans une trace ne dit si le frein a été touché ;
dans le protocole, c'est le conducteur qui le garantit. Sur un trajet ordinaire,
personne ne le garantit.

Mais un trajet contient des **centaines** de ralentissements. Groupés par force,
ils forment deux tas : les doux — pied levé, la récupération freine seule — et
les francs. **La frontière entre les deux tas est le seuil recherché**, et c'est
exactement la valeur que `suggest.ts` place aujourd'hui « au milieu » des deux
mesures du protocole.

La règle existante se transpose telle quelle : **si les deux tas ne se séparent
pas**, on ne propose rien. `protocol.ts` refuse déjà une frontière quand les deux
étapes rendent la même décélération à moins de 0,5 m/s² près.

### « Assez de données » est une couverture, pas un volume

On propose quand **chaque mesure a sa matière** : au moins un départ à l'arrêt,
des vitesses tenues dans les trois régimes — ville, route, autoroute —, une
accélération franche, et deux tas de ralentissements séparés.

Pas un nombre de trajets ni de kilomètres : quatre cents kilomètres d'autoroute
ne disent rien de la ville.

C'est la leçon déjà payée, le 4 septembre 2026 : une seule étape enregistrée dans
un bouchon à moins de 30 km/h avait porté la vitesse plausible maximale à
40 km/h, et au-delà **tout se figeait** sans que rien à l'écran n'en dise la
cause. C'est pourquoi un étalonnage ne s'applique qu'entier, et pourquoi celui-ci
ne se proposera pas incomplet.

### Capacités et habitudes ne vieillissent pas pareil

Deux familles, deux fenêtres :

| Famille | Ce que c'est | Sur quoi on calcule |
|---|---|---|
| **Capacités** — accélération et freinage maximum, bornes du signal | ce que la voiture **peut** | tout l'historique |
| **Habitudes** — vitesses tenues, seuils de passage, vitesse de passage en deuxième | ce qu'on **fait** | les derniers trajets |

Une capacité démontrée une fois reste vraie même si on ne la redemande pas : la
prendre sur une fenêtre glissante ferait « oublier » à la voiture ce qu'elle sait
faire après trois mois de conduite calme, et la charge pleine arriverait trop
tôt. Une habitude, elle, change — un déménagement déplace les seuils de passage.

**Combien de trajets font « les derniers »** n'est pas tranché : c'est un nombre
de départ à poser puis à régler, comme les 20 %.

### Un seul compte, pour commencer

David : « dans un premier temps, on considère qu'on a un seul compte et on
travaille comme ça ; quand on les aura on fera autrement, mais c'est pas la
priorité ».

Tout ce qui est déposé appartient donc au même utilisateur. Ce lot n'attend pas
[REFONTE](../REFONTE/spec.md).

Ce que le raccourci coûte, écrit pour ne pas le découvrir : le jour où les
comptes arrivent, la dérivation devra distinguer **de qui** sont les traces, et
un profil tiré d'un mélange de deux voitures ne voudra rien dire.

### Reprendre une proposition refusée

Un bouton **Appliquer maintenant**, en Configuration, avec le nombre de trajets
qui le fondent. C'est le rattrapage d'un « plus tard », pas un export.

## Les pièges déjà payés, à ne pas rouvrir

Ils sont mesurés, ils sont dans le code, et ils se reproduiront sur des traces
ordinaires — davantage même, puisqu'elles sont plus longues et moins propres.

1. **Le bruit du GPS coupe les paliers en morceaux.** Mesuré sur deux paliers
   synthétiques à 70 et 90 km/h avec 0,5 km/h de bruit : **vingt-sept paliers au
   lieu de deux**, le plus long de 11 s pour un palier réel de 80 s. La
   distribution des vitesses n'en souffrait pas, celle des **durées** devenait
   fausse — et c'est elle qui informe le délai de montée en croisière. Parade en
   place : recollage des morceaux séparés de moins d'une seconde et de moins de
   3 km/h, **avant** d'appliquer la durée minimale.
2. **Le délai de croisière se prend au dixième centile, pas à la médiane.** Sur
   autoroute un palier dure une minute ; le quart d'une minute donnerait un délai
   que la ville n'atteint jamais. Ce qu'il faut mesurer n'est pas la durée d'un
   palier typique, c'est celle du plus court dont on veuille encore qu'il compte.
3. **Une borne trop serrée ampute le signal.** Une borne basse d'accélération
   proposée à −0,5 m/s², faute d'avoir mesuré un freinage, aurait écrêté **tout**
   freinage réel. Une borne trop large ne protège de rien ; une borne trop serrée
   est bien pire.
4. **Les crêtes se prennent au centile, jamais au maximum.** Le 95ᵉ et le 5ᵉ : la
   fenêtre d'une seconde moyenne déjà le bruit, mais une mesure aberrante isolée y
   survit assez pour déplacer le maximum.
5. **Un plancher de vitesse distingue un feu rouge d'un palier.** Accélération
   nulle qui dure, à l'arrêt : sans le plancher de 5 km/h, le feu rouge est le
   palier le mieux tenu du trajet.

## Ce qu'on ne fait pas

- **Deviner le caractère du moteur.** La vraie voiture n'a pas de moteur
  thermique : aucune trace ne dira quel rupteur choisir.
- **Proposer la raideur du lissage.** Le réglage juste est celui à partir duquel
  le tremblement ne s'entend plus : un jugement d'oreille, pas une mesure. Le
  proposer par une formule serait habiller une convention en résultat.
- **Remplacer l'écran d'étalonnage.** Il mesure sur commande, en quelques
  minutes ; celui-ci mesure tout seul, en quelques trajets. Les deux servent.
- **Télécharger les mesures.** Un bouton qui applique, pas un export.
