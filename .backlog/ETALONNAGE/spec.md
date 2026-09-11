# ETALONNAGE — mesurer la vraie voiture pour régler les virtuelles

**Statut :** 🧑 attend David
**Branche :** `feature/etalonnage`
**Version visée :** 0.4

## L'idée

Relevée à l'usage : « j'aimerais une fonction qui nous demande de rouler
(normalement, en ville, sur route, autoroute, puis une franche accélération, une
décélération, un freinage) et qui utiliserait ces données télémétriques
enregistrées — un profil de la vraie voiture — pour mieux régler les profils des
voitures virtuelles ».

C'est l'idée la plus prometteuse du carnet, et pour une raison précise : **tous
les réglages ajoutés récemment attendent exactement ces mesures.** Ils ont été
choisis par le calcul, faute de savoir ce que fait la voiture réelle.

| Réglage | Ce que la mesure lui donnerait |
|---|---|
| `fullLoadAccelMs2` | l'accélération d'une reprise franche, réellement obtenue |
| `brakeDownshiftAccelMs2` | la décélération d'un freinage franc, distinguée d'un lever de pied |
| `minAccelMs2` / `maxAccelMs2` | les bornes réelles, au lieu de ±14 m/s² qui ne sont atteints jamais |
| `cruiseMinRpm`, `cruiseUpshiftAfterS` | les vitesses réellement tenues, et combien de temps |
| `upshiftRpm` | les passages placés aux vitesses où l'on roule vraiment |
| `launchUpshiftKmh` | la vitesse à laquelle on quitte l'arrêt en ville |
| `maxPlausibleKmh` | la vitesse maximale réellement pratiquée |
| `springOmega`, `accelWindowMs` | le bruit réel du GPS de cette voiture-là |

Aujourd'hui ces valeurs viennent d'un raisonnement. Le profil Route a été
« calibré sur les vitesses que l'on pratique vraiment » — mais de mémoire, pas
d'un relevé.

## Ce dont la mesure a besoin, et qui existe déjà

- **L'enregistrement de traces** : `TraceRecorder` capture ce que la source
  émet, et les traces survivent d'une session à l'autre.
- **Le rejeu** : une trace se rejoue à l'identique, ce qui permet de vérifier un
  réglage proposé sans reprendre la voiture.
- **La télémétrie complète** : vitesse brute et lissée, pente, accélération,
  qualité du signal, intervalles entre mesures.

Ce qui manque : un **protocole guidé**, une **analyse**, et une **proposition**.

## La forme

Un protocole en étapes, annoncées à l'écran, chacune enregistrée séparément :

1. rouler normalement en ville ;
2. rouler sur route ;
3. rouler sur autoroute ;
4. une accélération franche, depuis l'arrêt ;
5. une décélération pied levé, sans toucher au frein ;
6. un freinage franc.

Les trois premières donnent des **distributions** — vitesses tenues, durée des
paliers, accélérations ordinaires. Les trois dernières donnent des **extrêmes**,
et ce sont eux qui manquent le plus : on ne sait pas aujourd'hui ce que vaut une
« reprise franche » dans cette voiture.

Puis une analyse qui rend, pour chaque réglage concerné, la valeur mesurée et
celle du profil, côte à côte. **Elle propose, elle n'applique pas** — c'est la
règle qu'on s'est déjà donnée pour l'analyse d'échantillon, dont les candidats
d'ancrage se départagent à l'oreille.

## L'analyse se fait dans la voiture

**Décision prise le 3 septembre 2026.** L'analyse ne demande que du calcul : elle
se fait sur place, et le résultat se voit tout de suite. Ce lot ne dépend donc
pas de [DEPOSER](../DEPOSER/spec.md).

L'argument qui a tranché : six traces enregistrées qu'on ne peut pas sortir de la
voiture ne servent à rien tant que le dépôt n'existe pas. Faire dépendre le lot
le plus prometteur du carnet d'un lot d'infrastructure non vérifié — la présence
du module d'écriture dans l'image du serveur reste à établir — l'aurait retardé
sans nécessité.

Ce qu'on y perd : refaire l'analyse autrement, plus tard, demandera d'avoir
déposé les traces. Elles restent enregistrées localement, et DEPOSER les sortira
quand il existera.

## Décisions à prendre

- ~~Sur place ou au poste ?~~ **Tranché** : sur place.
- **Que faire d'une session incomplète ?** Un freinage franc ne se commande pas
  au milieu du trafic. Chaque étape doit valoir séparément, et l'analyse doit
  dire ce qu'elle n'a pas pu mesurer plutôt que d'inventer.
- **Comment reconnaître qu'une étape a bien été faite ?** Une « accélération
  franche » qui n'atteint que 1 m/s² n'en est pas une, et l'accepter donnerait
  un `fullLoadAccelMs2` faux, donc une charge fausse, donc un fondu faux. Il faut
  un critère, et il faut le dire à l'écran.
- **Une voiture électrique n'a pas de rapports.** L'étalonnage mesure un véhicule
  qui accélère sans passer de vitesses ; il informe donc les seuils **en
  vitesse**, jamais en régime. Le régime reste une fiction qu'on choisit.

## Cinq décisions prises en cours de route

1. **Le lever de pied n'a pas de plafond de décélération dans son critère.** On
   voulait en poser un pour refuser un freinage déguisé en lever de pied. C'est
   impossible : rien dans une trace GPS ne dit si la pédale a été touchée, et une
   électrique récupère au lever de pied assez fort pour dépasser à elle seule tout
   plafond plausible. Le refus a été déplacé là où il est juste : si les deux
   étapes rendent la même décélération à moins de 0,5 m/s² près, aucune frontière
   n'est proposée et la raison est dite.

2. **Le plancher de croisière est rendu en vitesse et ne se recopie pas.**
   `cruiseMinRpm` est un régime ; le déduire de la vitesse la plus basse tenue
   demanderait de choisir dans quel rapport la boîte se trouve — or c'est ce que
   le réglage sert à décider. La mesure s'arrête où commence le choix.

3. **`springOmega` n'est pas proposé.** Le bruit du GPS est chiffré, la fenêtre
   d'accélération s'en déduit par une formule vérifiée, mais la raideur du lissage
   dépend du moment où le tremblement cesse de s'entendre. C'est un jugement
   d'oreille ; le déduire d'une formule aurait habillé une convention en résultat.

4. **Les seuils de passage sont proposés en km/h, et le réglage du profil est
   affiché dans la même unité.** C'était la seule façon de tenir les deux
   contraintes du lot à la fois : comparer la mesure au réglage, et ne rien
   formuler en régime. La conversion n'emploie que le pont, les démultiplications
   et le rayon de roue — des choix déjà faits, pas des mesures.

5. **Deux défauts de mesure trouvés en mesurant.** Le bruit du GPS coupait un
   palier en morceaux : vingt-sept paliers au lieu de deux sur une trace de deux
   paliers de 80 et 90 s avec 0,5 km/h de bruit. Les morceaux sont maintenant
   recollés. Et le délai de montée en croisière était pris comme une fraction de
   la durée médiane d'un palier, ce qui donne un délai que la ville n'atteint
   jamais quand l'autoroute tient une minute — c'est le dixième centile qu'il faut.

## Hors périmètre

- Appliquer les valeurs automatiquement. La proposition se lit, se compare, et
  se recopie — comme les candidats d'ancrage de l'analyse d'échantillon. C'est
  [PROFIL-REEL](../PROFIL-REEL/spec.md) qui lèvera cette limite, par un autre
  chemin : le serveur dérive le profil depuis les traces ordinaires, sans
  protocole, et le propose.
- Deviner le caractère du moteur. L'étalonnage mesure une voiture réelle sans
  moteur thermique : il ne dira jamais quel rupteur choisir.
