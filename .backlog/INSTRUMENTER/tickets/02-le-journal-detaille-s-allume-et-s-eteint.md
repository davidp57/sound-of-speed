# 02 — Le journal détaillé s'allume, et s'éteint tout seul

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite. Il ne touche pas au bruit du
ticket 01 et peut être mené en parallèle.

## Ce qu'il faut obtenir

**Pouvoir demander un journal plus fin le jour d'un essai, et n'avoir rien à
défaire ensuite.** On allume avant de partir, on roule, et le réglage s'éteint de
lui-même vingt-quatre heures plus tard.

Le seul effet de ce ticket sur le journal : **le relevé périodique passe de dix
secondes à une seconde**. Ce qu'il porte en plus est le ticket 03.

## Ce à quoi il faut faire attention

- **Les trois crans de remontée ne bougent pas, et l'interrupteur n'en est pas un
  quatrième.** Les crans forment une échelle de **vie privée** — ce qu'on accepte
  de laisser partir ; la finesse du journal est une échelle **technique**. Les
  mettre sur la même rangée forcerait qui veut du détail à accepter aussi sa
  position. L'interrupteur densifie ce qui part **au cran déjà choisi** et
  n'ouvre aucune nature de fichier nouvelle : à « Le minimum », toujours ni
  position ni trace. Il ne demande donc **pas** de consentement supplémentaire.

- **Vingt-quatre heures glissantes, à l'heure près** — et non jusqu'à la fin de
  la journée. Le cas qui tranche : activé à 23 h 30, on roule jusqu'à 0 h 30 ;
  une coupure au changement de date tomberait en plein essai.

- **L'instant est reçu, jamais lu.** C'est ce qui rend l'expiration vérifiable
  sans attendre un jour, et c'est la forme qu'a déjà la règle de rétention.

- **Ce qui le signale comme exceptionnel**, et l'ordre compte : il est hors de la
  rangée, donc plus personne ne le lit comme « le dernier cran, donc le plus
  complet » ; son libellé dit **à qui il s'adresse** — à n'activer que si on vous
  l'a demandé — et non ce qu'il fait ; son heure d'extinction est affichée ; et
  l'écran de conduite porte un témoin tant qu'il est actif, comme celui de la
  capture.

- **Pas de couleur d'alerte.** Le rouge attire l'œil plus qu'il ne dissuade, et
  annonce un danger qui n'existe pas : on ne dérègle rien, on dépose un journal
  plus gros. Traitement discret.

- **Le poids n'est pas un sujet** : les tranches de journal partent gzippées.

## Critères d'acceptation

- [x] Un interrupteur « Journal détaillé » existe, **hors** de la rangée des trois
      crans, avec un libellé qui dit de ne l'activer que si on vous l'a demandé.
- [x] Il n'ouvre aucune nature de fichier nouvelle : à « Le minimum », ni position
      ni trace ne partent, avant comme après.
- [x] Il s'éteint vingt-quatre heures après son activation, à l'heure près.
- [x] Activé à 23 h 30, il est encore actif à 0 h 30 — vérifié sans attendre.
- [x] L'écran dit jusqu'à quand il tient, avec l'heure.
- [x] L'écran de conduite le signale tant qu'il est actif.
- [x] Quand il est actif, le relevé périodique passe à une seconde ; quand il ne
      l'est pas, la cadence et les champs sont exactement ceux d'aujourd'hui.
- [x] Contrôle qualité vert.

## Ce qui a été fait

La règle vit dans `core/journal/detail.ts` : une fonction pure de (activé à,
maintenant), vérifiée sans attendre un jour. Ce qui est rangé est **la date
d'activation**, pas un booléen — c'est elle qui porte l'extinction.

**Vérifié dans l'application** : l'écran annonce « s'éteint tout seul demain à
11:06 », et le témoin de conduite porte le même horaire.

Un cas n'était pas au ticket et a été ajouté : **une date d'activation dans le
futur éteint le réglage** au lieu de le prolonger. L'horloge d'un navigateur se
règle, parfois de plusieurs heures, et un réglage de mise au point ne doit pas
pouvoir se rendre permanent par un changement d'heure.

## Un défaut trouvé à la relecture, et pas par la CI

L'extinction était branchée sur le **mauvais battement**. Le bloc qui la constate
s'était glissé dans le minuteur de la garde d'écran — lequel ne tourne qu'à
l'arrêt, écran de réglage fermé, source GPS — au lieu de la boucle. Le réglage ne
serait donc jamais mort **pendant un trajet**, c'est-à-dire exactement au moment
où il sert.

Rien ne pouvait l'attraper : le typecheck, le lint et les 1 679 tests passaient
tous. La règle d'extinction est vérifiée seule, et elle était juste ; c'est son
branchement qui ne l'était pas, et `state.ts` — l'assemblage — n'est testé nulle
part dans ce dépôt. C'est une limite connue, pas un oubli de ce ticket.
