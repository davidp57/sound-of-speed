# ETALONNAGE — mesurer la vraie voiture pour régler les virtuelles

**Statut :** ⬜ prêt
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

## Ce qui rend ce lot dépendant d'un autre

Une session d'étalonnage produit six traces, enregistrées **dans la voiture**.
Elles ne servent que si on peut les en sortir — or le navigateur de la Tesla
refuse tout téléchargement. Le lot [DEPOSER](../DEPOSER/spec.md) est donc un
préalable, à moins de faire l'analyse **dans la voiture**, ce qui est possible
puisqu'elle ne demande que du calcul.

Ce choix — analyser sur place ou déposer puis analyser — est le premier à
trancher, et il détermine tout le reste.

## Décisions à prendre

- **Sur place ou au poste ?** Sur place, on voit le résultat tout de suite et on
  se passe de DEPOSER ; au poste, on peut refaire l'analyse autrement sans
  reprendre la route. Le second est plus sûr, le premier est plus utile.
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

## Hors périmètre

- Appliquer les valeurs automatiquement. La proposition se lit, se compare, et
  se recopie — comme les candidats d'ancrage de l'analyse d'échantillon.
- Deviner le caractère du moteur. L'étalonnage mesure une voiture réelle sans
  moteur thermique : il ne dira jamais quel rupteur choisir.
