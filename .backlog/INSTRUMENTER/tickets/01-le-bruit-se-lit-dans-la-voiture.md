# 01 — Le bruit du récepteur se lit dans la voiture

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

**Savoir, en roulant, à quel point le récepteur de la voiture est bruité** — sans
rapatrier une trace, sans interroger la base, sans attendre le lendemain.

C'est la moitié manquante du lot [MOUVEMENT](../../MOUVEMENT/spec.md) : il a
mesuré que la boîte encaisse 1,5 km/h de bruit avant de se remettre à faire des
allers-retours de rapport, et personne ne sait combien la voiture en produit.

Le conditionneur ajuste **déjà** une droite par les moindres carrés sur les
mesures de sa fenêtre glissante, pour en tirer la pente. L'écart des mesures à
cette droite **est** le bruit : il ne reste qu'à le publier, corrigé des deux
degrés de liberté que la droite consomme. Aucune pièce nouvelle, aucun calcul en
plus.

Il paraît en télémétrie sous la qualité du signal, à côté de la cadence typique,
et entre dans le relevé périodique du journal — donc il part dès le cran
« Le minimum », sans la trace.

## Ce à quoi il faut faire attention

- **Ce chiffre n'est pas celui du serveur, et l'écran doit le dire.** Le calcul
  d'étalonnage ajuste une fenêtre **centrée** : il voit les mesures avant et après
  chaque point. La voiture ne connaît que le passé. Les deux valeurs sont
  voisines, jamais égales, et les comparer aveuglément ferait conclure à un
  défaut là où il n'y a qu'une différence de méthode.
- **Une droite suit exactement une rampe.** Une accélération franche et régulière
  ne doit donc rien ajouter au bruit mesuré : c'est le meilleur contrôle que le
  calcul mesure bien ce qu'il annonce.
- **La fenêtre est celle du conditionneur**, réglable par profil, une seconde par
  défaut. Le bruit rendu en dépend, comme la pente : c'est une propriété du
  couple récepteur-réglage, pas du récepteur seul. À dire à l'écran plutôt qu'à
  corriger.
- **Rien tant qu'il n'y a rien à mesurer.** À l'arrêt, avec deux mesures, ou sur
  une fenêtre trop courte, la valeur n'a pas de sens : elle s'annonce absente
  plutôt que nulle.

## Critères d'acceptation

- [x] Le conditionneur rend le bruit de mesure, en km/h, avec ses autres sorties.
- [x] Sur un signal fabriqué sans bruit, la valeur est nulle — **rampe comprise**.
- [x] Sur un signal fabriqué avec un bruit connu, elle le retrouve à la tolérance
      près, et elle suit quand ce bruit change.
- [x] Elle s'annonce absente quand la fenêtre ne porte pas de quoi conclure.
- [x] La télémétrie l'affiche à côté de la cadence typique, et dit qu'il est
      mesuré à bord — donc différent de celui que le serveur établit après coup.
- [x] Le relevé périodique du journal le porte, dès le cran « Le minimum ».
- [x] Contrôle qualité vert.

## Ce qui a été fait

Le conditionneur rend `noiseKmh` avec ses autres sorties : mêmes points, même
droite, on publie le résidu au lieu de le jeter, divisé par `n − 2` parce que la
droite consomme deux degrés de liberté.

**Vérifié dans l'application** : au simulateur, qui injecte exactement 1 km/h de
bruit, l'écran affiche **1,01 km/h**.

**Un test a été corrigé, pas le calcul.** Le premier jet comparait la mesure à la
valeur *nominale* du bruit injecté ; sur la graine employée, soixante tirages
d'écart-type un rendent 0,788. Le test compare maintenant à l'écart-type
réellement injecté, et moyenne les relevés — un estimateur sur dix points se
disperse de trente pour cent.
