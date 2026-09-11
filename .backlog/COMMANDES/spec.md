# COMMANDES — un interrupteur qui a la forme d'un sélecteur de boîte

**Statut :** 🧑 attend David — le code est livré, la preuve demande la voiture
**Branche :** `feature/commandes`
**Version visée :** 0.1.100

## Ce qui a déclenché

Un trajet de cinquante et un kilomètres, le 11 septembre 2026 au matin, premier
essai de la règle du [PLANCHER](../PLANCHER/spec.md). Il a rapporté deux défauts
que rien n'avait vus au banc, et une trace pour les prouver.

**La localisation n'a jamais démarré.** Au sortir du parking, l'application n'a
reçu que des positions annoncées à **9 999,99 m** de précision — la valeur qu'un
navigateur sert quand il n'en a pas de vraie. Le filtre les a toutes écartées, à
juste titre. Trois relances n'y ont rien changé, retirer et redonner
l'autorisation non plus. Ce qui a fonctionné : lancer la version de production,
appuyer sur son bouton **GPS**, revenir sur celle d'intégration.

Or celle-ci n'avait plus de bouton de source : le commit `4002f95`, la veille au
soir, les avait retirés de l'image avec les écrans de banc. Il n'existait donc
**aucune action possible** dans l'application quand la localisation ne partait
pas.

**La boîte n'a plus passé un seul rapport** après l'arrêt. Voir plus bas.

## Ce qu'on fait

### Le sélecteur

Les commandes de conduite deviennent un **interrupteur d'application qui a la
forme d'un sélecteur de boîte**. Le conducteur touche un objet qu'il connaît, et
l'application y gagne ce qui lui manquait : un geste, au sens du navigateur, sur
le démarrage de la géolocalisation et du son.

- **D** démarre tout. Une fois en route, le même bouton bascule le tempérament
  et affiche **S**. Rien ne l'annonce : la lettre change au premier appui, donc
  l'apprentissage coûte un appui, et l'aide le dit.
- **P** est sous la touche de marche, au-dessus de l'étiquette AUTO, et jamais
  estompé : il commande les deux colonnes, pas seulement celle où il se trouve.
  Il met au repos la géolocalisation, la boucle, le son des deux origines, et la
  capture dépose ce qu'elle avait en attente. L'affichage reste allumé — c'est
  par lui qu'on redémarre. **P fonctionne en roulant** : il remplace le bouton
  marche/arrêt, qui y était déjà accessible.
- **AUTO** et **MAN** sont deux colonnes côte à côte, chacune montrant les
  commandes de son mode. Nommer le mode disait qu'il en existait un second sans
  dire ce qu'il changeait ; les colonnes le montrent.
- Le son et le verrou d'écran montent **en haut à droite** : ce sont des
  commandes d'appareil, pas de conduite.

**L'application s'ouvre au repos.** C'est le cœur du correctif : elle démarrait
la géolocalisation depuis `onMounted`, sans qu'on ait rien touché.

### Ce qui est estompé, et ce qui ne l'est pas

Asymétrique exprès : les touches de passage ne commandent rien en boîte
automatique, mais la touche de marche garde le tempérament en boîte manuelle —
elle ne décide plus des rapports, elle décide encore du son.

### Le compteur de ralentissement

La boîte est restée en deuxième de 22 à 108 km/h, jusqu'au rupteur, pendant
164 secondes, et n'en est sortie que parce que David a touché le mode de
conduite. **Zéro passage de la deuxième à la troisième sur tout le trajet.**

Deux défauts qui se composent :

1. **Le conditionneur prêtait une accélération à une voiture garée.** Vitesse
   conditionnée à 0,000 km/h pendant quarante-quatre minutes, et une
   décélération annoncée entre 0,19 et 0,39 m/s². La garde « à l'arrêt on ne
   cherche pas de pente » ne protégeait que l'estimation, pas la valeur retenue :
   faute de mesure neuve, la dernière pente passait pour vraie.
2. **Le compteur de ralentissement de la boîte n'était pas borné.** La page en
   veille bat au ralenti — jusqu'à vingt secondes par tour —, et chaque tour
   versait vingt secondes au compteur. Mesuré à **2 706 secondes** pour un seuil
   de 0,35. Il décroît deux fois plus vite qu'il ne monte, mais rendre 2 706
   secondes demandait vingt-deux minutes d'accélération continue.

Les deux sont corrigés : accélération nulle sous le seuil d'arrêt, et plafond à
trois fois le seuil d'inhibition.

### Dire pourquoi, à hauteur du regard

Le motif du rejet existait déjà — `rejection.ts` le nomme — mais il était rangé
sous les réglages, en bas de l'écran. Il remonte **sous les cadrans**, avec la
précision réellement annoncée : « Annoncée : 9 999 m » aurait tout dit en trois
secondes.

Et l'état **« son pris par une autre application »**, qui manquait : la musique
de la voiture suspend le contexte audio, et le bouton annonçait alors « Activer
le son » alors que personne ne l'avait coupé.

## Ce que la revue a trouvé

Quatre défauts, tous introduits par ce lot, tous corrigés avant la fusion. Ils
se ressemblent : **un état déplacé vers une copie que quelque chose d'autre
écrit déjà**.

- **« P » ne coupait pas le son.** Seule la boucle d'affichage s'arrêtait, alors
  que la banque d'échantillons est cadencée par l'horloge du fil audio. Le
  correctif était donc inopérant dans la seule configuration qu'il visait, et
  l'essai au navigateur ne pouvait pas le voir faute d'échantillons sur le poste.
- **« D » pouvait installer deux cadences**, l'ordre n'étant plus garanti depuis
  que le démarrage est un bouton et non le chargement de la page.
- **Le bouton du son annonçait « Son actif » au repos.**
- **La manette désynchronisait l'étiquette de boîte**, qui parlait à la boîte
  sans passer par l'état que l'écran lit.

Deux points instruits et clos : le plafond du compteur de ralentissement ne
rouvre pas la montée sur une décélération bruitée — un test le vérifie —, et
l'accélération rendue à l'arrêt s'aligne sur `atStandstill` plutôt que d'inventer
un troisième critère.

## Ce qui reste supposé

Que le navigateur de la voiture n'accorde une position précise que sur geste, et
serve `9 999,99` sinon. C'est l'hypothèse qui a guidé la conception, elle n'est
pas prouvée. Tout le reste est mesuré dans la trace du 11 septembre.

**Elle se teste toute seule à la prochaine sortie** : si D démarre la
localisation à tous les coups, c'était le geste. Sinon, le journal dira quoi.

Le symptôme avait déjà eu lieu le 8 septembre — « la version de production
obtenait un signal, celle d'intégration lancée juste après ne le voyait pas »,
dans le commentaire de `geolocation.ts`. Le correctif d'alors, `maximumAge` de 0
à 10 s, n'a pas tenu. C'est la deuxième occurrence.

## Hors périmètre

- **L'unification de la notion de mouvement**, qui reste le lot
  [MOUVEMENT](../MOUVEMENT/spec.md). Le plafond posé ici est une borne, pas la
  refonte.
- **Le réglage des marges de PLANCHER**, que le trajet n'a pas pu juger : la
  boîte était bloquée.
- **Le mode plein écran**, qui garde son propre bouton de son.

## Ce qu'il faut regarder, à la prochaine sortie

1. **D démarre-t-il la localisation ?** C'est la question du lot.
2. **La boîte monte-t-elle les rapports après un arrêt ?** Deuxième, troisième,
   quatrième doivent s'enchaîner comme au début d'un trajet.
3. **Les cinq points d'écoute de PLANCHER**, enfin jugeables.
