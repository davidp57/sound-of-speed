# 01 — Mesurer vraiment l'espace dont on dispose

**Statut :** 🧑 attend David le 17 septembre 2026 — les trois volets sont
livrés ; il reste à ouvrir la mire une fois, carte en main, et à faire un trajet

David : « j'aimerais qu'on puisse mesurer vraiment l'espace d'affichage dont on
dispose ». Tant que ce ticket n'est pas fait, toute décision de mise en page
repose sur deux chiffres lus une fois sur une photo, et sur des suppositions
quant à ce qui mange le reste.

## Ce qu'on ne sait pas, et pourquoi

Trois trous, et ils expliquent qu'on en soit réduit à supposer.

1. **Ce qui remonte ne porte pas la page.** L'événement `device` du journal
   (`core/appareil.ts`, `entreeDAppareil`) n'enregistre que `screen.width` et
   `screen.height` — l'écran annoncé. La largeur utile de 773 px et la hauteur de
   575 ont été lues à l'écran par David ; elles ne sont dans aucune trace.
2. **Rien ne distingue les barres du zoom.** Il manque 481 px de largeur et
   209 px de hauteur entre l'écran annoncé et la page. Savoir si c'est le
   navigateur qui les prend, la voiture, ou un zoom, change la conception : de la
   place reprise sur une barre n'est pas de la place qu'on n'aura jamais. Le lot
   [NAVIGATEUR-VOITURE](../../NAVIGATEUR-VOITURE/spec.md) note depuis le
   4 septembre que le zoom du navigateur de la Tesla n'est pas réglable et que sa
   valeur par défaut a augmenté avec le logiciel 2026.26 — c'est une piste, pas
   une mesure.
3. **Rien ne dit ce qu'un pixel fait en millimètres.** Les unités physiques du
   CSS — `mm`, `in` — sont fausses par définition : la spécification les fixe à
   96 px CSS par pouce, quelle que soit la dalle. Or c'est la taille physique qui
   décide si un texte se lit en conduisant et si une cible se touche sans viser.

## Ce qu'il faut faire — les trois volets

### a. Enrichir le relevé qui remonte déjà tout seul

L'événement `device` du journal passe de quatre champs à une douzaine :

- `documentElement.clientWidth` / `clientHeight` — la page ;
- `innerWidth` / `innerHeight`, `outerWidth` / `outerHeight` — ce que le chrome
  du navigateur prend ;
- `screen.width` / `height` et `availWidth` / `availHeight` — ce que le système
  prend ;
- `devicePixelRatio`, et surtout **`visualViewport.scale`**, qui dénonce un zoom ;
- l'orientation.

Et il se **ré-émet à chaque changement** : rotation, passage en plein écran,
zoom, redimensionnement. Un seul relevé au chargement ne dirait rien de ce qui
bouge.

**C'est ce volet qui rend le reste inutile à recopier.** David roule, le journal
remonte tout seul, les chiffres se lisent au bureau. Six valeurs à noter à la
main dans une voiture, cela ne se fait pas deux fois.

### b. Une mire, pour ce que les chiffres ne peuvent pas dire

Un écran d'atelier qui dessine :

- un cadre occupant exactement la zone utile, avec des repères tous les 100 px —
  on voit d'un coup où la page s'arrête vraiment ;
- un rectangle aux dimensions d'une **carte bancaire**, 85,60 × 53,98 mm. C'est
  la norme ISO/IEC 7810 ID-1 : n'importe quelle carte fait exactement cela, ce
  qui en fait un étalon qu'on a toujours sur soi.

David pose sa carte sur l'écran. Si le rectangle correspond, le millimètre par
pixel est confirmé ; sinon, un curseur l'ajuste et donne la vraie valeur.

**Ce que cela apporte de plus que le calcul.** On peut déjà calculer : 15,4
pouces en 1920 × 1200 donnent 147 PPI, et avec le facteur 1,53 un pixel CSS vaut
0,265 mm. Mais ce calcul repose sur une diagonale lue dans un article qui se
trompait par ailleurs sur le format de la dalle — il annonçait du 16:9 pour une
résolution qui est du 16:10, ce qui donnerait des pixels non carrés. La mire
tranche en dix secondes, une fois pour toutes.

### c. Le même relevé, en plein écran

Il répond à la question 2 de la spec : le plein écran rend-il de la place, ou
l'écart est-il un zoom qu'on ne récupérera jamais ?

Avec le volet **a**, cela ne coûte rien de plus : le relevé se ré-émet de
lui-même à la bascule. Il suffit que David appuie une fois sur le bouton pendant
un trajet.

## Critères d'acceptation

- [x] Un trajet ordinaire suffit à connaître, sans que David note quoi que ce
      soit, la page, la fenêtre, l'écran, le facteur de pixels et l'échelle du
      viewport visuel.
- [x] Le relevé est repris à chaque changement d'état, et non seulement au
      chargement.
- [ ] On sait si les 481 et 209 px manquants viennent des barres ou du zoom —
      **le relevé le dira au premier trajet** : c'est l'écart entre la page et
      le châssis, et l'échelle du viewport visuel à côté.
- [ ] On sait ce qu'un pixel CSS fait en millimètres — la mire est là, il faut
      l'ouvrir une fois avec une carte.
- [ ] La valeur en millimètres est écrite quelque part où la conception du lot
      ira la chercher — spec ou README, pas une conversation.

## Ce qui vient après

La refonte de l'écran elle-même, qui est l'objet du lot. Ce ticket ne change rien
à ce qui s'affiche : il donne les chiffres sans lesquels la refonte se ferait à
l'estime.

## Ce qui est livré, et ce qu'il reste à faire

**Les trois volets sont en place.**

| Volet | Où |
|---|---|
| a. le relevé qui remonte tout seul | `core/appareil.ts`, `mesurerLEcran` et `entreeDAppareil` ; l'émission et sa reprise dans `state.ts` |
| b. la mire à la carte bancaire | `ui/components/MireDEcran.vue`, atelier, volet *Écran* |
| c. le même relevé en plein écran | gratuit : la bascule ré-émet |

**Un piège trouvé en vérifiant, et il valait le détour.** La première ouverture
de la mire a tout affiché à zéro — page, fenêtre, écran, jusqu'à la densité
retombée à 1. Le navigateur suspend le rendu d'un onglet masqué, et le volet de
prévisualisation l'était. Une ligne pareille au journal ne dit pas « l'écran
fait zéro pixel » mais « personne ne regardait », et rien ne les distinguerait
une fois écrite : `mesureUtilisable()` la refuse, et la mesure se reprend au
retour au premier plan.

**Ce qui reste demande David, deux fois et brièvement :**

1. **Ouvrir la mire une fois, une carte bancaire à la main** (atelier, volet
   Écran), régler le curseur, appuyer sur « Retenir ». La valeur part au journal.
2. **Rouler**, en appuyant une fois sur *Plein écran* pendant le trajet : le
   relevé se reprend de lui-même, et l'écart entre les deux dit si les 481 points
   manquants sont une barre ou un zoom.

Ensuite seulement la valeur en millimètres s'écrit dans la spec, et le lot peut
se découper.
