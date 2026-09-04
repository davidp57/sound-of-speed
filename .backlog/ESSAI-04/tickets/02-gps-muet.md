# 02 — le GPS ne se tait plus pour de bon

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'application continue de suivre la vitesse quelle que soit la cadence du GPS,
et quelle que soit sa façon de la rapporter — vitesse lue directement, ou
déduite de deux positions.

Aujourd'hui, quand la vitesse est déduite, une position qui arrive trop tôt est
refusée **et** remplace la référence, si bien que l'écart entre deux positions
ne s'accumule jamais. Au-delà de six positions par seconde, plus une seule
vitesse n'est produite, et cela ne se répare pas : le chien de garde relance le
suivi sans que la cadence change. Mesuré : zéro vitesse sur une minute à
110 km/h.

Trois corrections, et la troisième est celle qui rendra le défaut visible la
prochaine fois.

La référence doit être **gardée** jusqu'à ce que l'écart soit exploitable, au
lieu d'être écrasée à chaque refus.

Une mesure jugée aberrante ne doit plus être remplacée par la dernière valeur
saine puis émise comme si elle avait été mesurée : elle doit être ignorée, ce
que le conditionnement du signal fait déjà de son côté. Les deux modules ne
disent pas la même chose, et ce maquillage prive le chien de garde du silence
qui lui aurait permis d'agir.

Enfin, l'écran de télémétrie doit dire si la vitesse est lue ou déduite, combien
de positions la source a reçues, combien de vitesses elle a produites, et
combien elle a rejetées, avec le motif. Le drapeau qui distingue une vitesse
déduite d'une vitesse lue existe depuis le premier jour et n'est affiché nulle
part : c'est précisément ce qui a rendu ce défaut invisible.

## Critères d'acceptation

- [x] Une minute de route à vitesse déduite produit des vitesses à toutes les
      cadences éprouvées, de 30 ms à une seconde.
- [x] La vitesse déduite est juste à ces cadences, à la précision près de ce que
      deux positions permettent.
- [x] Une mesure au-delà du plausible n'est jamais émise ; le silence qu'elle
      laisse est visible dans le compte des rejets.
- [x] L'écran de télémétrie permet, sans ouvrir de console, de dire lequel des
      deux cas on est en train de vivre : origine de la vitesse, positions
      reçues, vitesses produites, rejets par motif.
- [x] Les tests couvrent les deux cadences et les deux façons de rapporter.
      `geolocation.ts` était le seul module de `speed/` sans aucun test, et
      c'est ce qui a laissé passer le défaut : il en a sept.

## Ce qui reste à vérifier

Que le navigateur de la voiture cesse bien de renseigner la vitesse à certains
moments — c'est l'hypothèse qui relie ce défaut au symptôme observé, et elle ne
se vérifie qu'en roulant. La ligne « Origine de la vitesse » de l'écran de
télémétrie le dira d'un coup d'œil. Le correctif vaut de toute façon : la source
se taisait pour de bon dans un cas qui se produit.
