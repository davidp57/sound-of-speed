# BANC-GPS — éprouver toute la chaîne sans rouler

**Statut :** ✅ fait — reste à s'en servir
**Branche :** `feature/banc-gps`
**Version visée :** 0.2

## Ce qui a déclenché

La manette venait de rendre le simulateur agréable à conduire, et David a
remarqué que **le son y est plus juste qu'en voiture** — « je me demande bien
pourquoi ». Trois causes ont été trouvées, dont deux corrigées le jour même
(l'étalonnage partiel, le plafond de plausibilité). La troisième est
structurelle : au simulateur, la charge vient de la gâchette ; en voiture, elle
est déduite d'une vitesse **mesurée**.

Mesuré au banc, même trajet des deux côtés, en croisière tenue à 110 km/h :

| | vitesse exacte | GPS réel (±1 km/h, 30 ms) |
|---|---|---|
| Écart-type de l'accélération | 0 | 0,148 m/s² |
| Pointe d'accélération | 0 | 0,51 m/s² |
| Écart-type de la charge | 0 | 0,026 |

Un quart de charge pleine en pointe sur une vitesse parfaitement tenue : le
simulateur ne montre rien de cela, parce qu'il livre une vitesse propre à chaque
image. D'où la demande de David : que les gâchettes pilotent une **vitesse
mesurée au GPS**, « ainsi on testerait vraiment tout le moteur de notre outil ».

## Trois modes, et ce que chacun éprouve

| Mode | Ce qui sort du simulateur | Ce qui est éprouvé en plus |
|---|---|---|
| **Vitesse exacte** | une vitesse par image, sans bruit | rien : c'est l'existant, et il reste utile pour juger un réglage de son sans le bruit du signal |
| **Mesure GPS** | une vitesse à la cadence et au bruit d'un GPS | le conditionnement sur un signal réel : extrapolation, ressort, fenêtre de pente, charge qui frémit, passages parasites, plafond de plausibilité, chien de garde |
| **Positions GPS** | des positions complètes, lues par la vraie source | la source elle-même : dérivation par distance, rejet des positions trop rapprochées, filtre de précision, position de référence |

Les deux derniers défauts relevés en roulant — le GPS muet et le plafond de
plausibilité — vivent dans ce que seul le troisième mode éprouve. C'est la raison
de le faire, et non l'exhaustivité pour elle-même.

Le troisième mode permet aussi de choisir si `coords.speed` est renseigné : on ne
sait toujours pas ce que fait la Tesla, et l'attendre coûterait un trajet.

## La forme

La physique du simulateur ne change pas. Ce qui change est **ce qu'il émet** :

- en *mesure GPS*, il retient sa vitesse et ne l'émet qu'à la cadence réglée,
  bruitée ;
- en *positions GPS*, il intègre sa vitesse en une trajectoire — une route droite
  suffit, rien en aval ne lit les coordonnées — et fabrique des positions
  complètes. Elles entrent dans `GeolocationSource` par une **couture** : un
  fournisseur de géolocalisation injectable, `navigator.geolocation` par défaut.
  C'est le module réel qui les traite, sans branche conditionnelle.

L'invariant tient : les trois modes passent par `SpeedSource`, et rien en aval ne
sait d'où vient le chiffre.

## Le simulateur ne va pas en production

Décidé par David : **un simulateur n'a aucun sens dans une voiture.** Il n'est
donc proposé qu'en développement.

Ce qu'on y perd, et qui doit être dit : le simulateur a servi de **test
discriminant en roulant** — « le simulateur fonctionne encore, repasser au GPS
rebloque aussitôt » est la phrase qui a orienté le diagnostic du GPS muet. En
production, ce moyen-là disparaît. Le journal de bord et les comptes de rejet le
remplacent en partie, et ils sont désormais lisibles à l'écran.

Conséquence : en production, la source par défaut au démarrage devient le GPS.

Ce qui reste ouvert, et qui appartient à David : faut-il une **porte de secours**
— un paramètre d'adresse qui ramène le simulateur en production — pour retrouver
le test discriminant en roulant le jour où quelque chose se fige ? Cela tient en
une ligne, et n'encombre aucun écran.

## Hors périmètre

Une trajectoire réaliste — virages, altitude, tunnels. Une route droite suffit :
rien en aval ne lit les coordonnées, et la seule chose qui compte est la suite de
positions dont on tire une vitesse. Le jour où le cap ou la pente entreront dans
le calcul, ce sera un autre lot.
