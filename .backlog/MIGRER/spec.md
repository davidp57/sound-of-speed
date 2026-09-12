# MIGRER — les réglages quittent le navigateur de la voiture et les dossiers du NAS

**Statut :** ✅ fait le 12 septembre 2026 — les quatre tickets
**Branche :** `feature/migrer`
**Version visée :** 0.4
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [SERVEUR](../SERVEUR/spec.md) — il n'y a rien où migrer tant
que la base n'existe pas.

## Ce qu'il faut obtenir

Tout ce qui compte vit dans la base, et plus rien d'important ne dort dans le
stockage local d'un navigateur de voiture ni dans un dossier du NAS.

Le jour où c'est fait, le navigateur de la voiture peut perdre son stockage
sans que rien ne se perde, et ce qu'on règle au bureau se retrouve au volant.

**Ce lot ne fait que rapatrier.** Décidé par David le 12 septembre 2026 : le
serveur écrit en base dès [SERVEUR](../SERVEUR/spec.md), donc le chemin est déjà
tracé et éprouvé quand on arrive ici. Le découpage d'origine laissait à ce lot la
bascule du code **et** la reprise des données ; il aurait fallu écrire deux fois
le code d'accès, et ce lot serait devenu une refonte déguisée en migration.

## Le problème

Les réglages vivent à deux endroits qui ne se parlent pas : le stockage local du
navigateur de la voiture, et les dossiers du NAS. Ni l'un ni l'autre n'est
sauvegardé, et le premier disparaît avec le navigateur qui le porte — un cache
vidé, une mise à jour du navigateur.

**Il n'y a pas de téléphone.** L'application tourne dans le navigateur de la
voiture ; le second appareil, quand il y en a un, c'est le bureau — pour régler,
relire une trace, préparer un profil.

Le stockage local porte aujourd'hui les profils, les moteurs, les boîtes, les
traces, la voiture réelle, le mode de conduite et les préférences d'appareil,
sous des clés préfixées `speed.` — préfixe conservé délibérément au renommage du
12 septembre, parce que le stockage local ne suit aucun renommage.

## Ce qu'on construit

### Tout migre, sauf ce qui se recalcule

Profils, moteurs, boîtes, traces, journal, relevés. Les deux sources rejoignent
la base.

**Le profil mesuré n'est pas repris.** Le serveur le recalcule depuis les traces
qu'il a en base, à chaque démarrage, et son propre code dit pourquoi l'ancien ne
vaut rien : « un procédé corrigé rend l'ancien cumul sans valeur ». Une fois les
traces entrées, le cumul se refait tout seul, sur les quarante et une traces et
avec le procédé d'aujourd'hui. Qu'il porte plus ou moins que le fichier qu'on
aurait copié n'est pas vérifié, et ne se saura qu'après.

### La voiture reste le patron de ses réglages

Tranché par David le 12 septembre 2026. Le navigateur de la voiture garde sa
copie et continue d'écrire dedans tout de suite, y compris hors réseau ; la copie
part en base par la file de dépôt qui existe déjà. Au lancement, si la base a une
version plus récente, la voiture la prend.

Les deux autres issues ont été écartées. Faire de la base le patron obligerait
toute écriture à remonter, y compris celles faites sans réseau : c'est une vraie
synchronisation, avec ses conflits, et c'est exactement la refonte que ce lot
refuse d'être. Ne pas toucher au navigateur ne coûterait rien mais laisserait son
stockage seul dépositaire des réglages, ce qui est le problème.

### Les traces reprises entrent épinglées

Sans quoi la règle de rétention de [RETENTION](../RETENTION/spec.md) les
effacerait un mois après leur migration — c'est-à-dire qu'on les aurait
déplacées pour les perdre.

### Ce qui reste local reste local

Les préférences d'appareil — volume, visage de l'écran, verrou, mode de boîte —
ne rejoignent rien. Elles décrivent l'appareil, pas le conducteur, et
[REFONTE 04](../REFONTE/tickets/04-le-profil-devient-un-assemblage.md) l'avait
déjà tranché.

### La reprise est rejouable et sans perte

Elle se lance deux fois sans rien casser ni rien dupliquer. C'est ce que fait
déjà la scission des profils en entités, qui est sans effet au second passage.

Et elle **ne détruit rien à la source** tant que David n'a pas dit que c'est
bon : le stockage local et les dossiers du NAS restent en place, en lecture.
Une migration qui efface au fur et à mesure est une migration qu'on ne peut pas
reprendre.

**Elle n'écrase jamais ce qui est déjà en base.** Au premier passage la base est
vide, la règle ne se voit pas ; à tous les suivants, elle empêche un profil du
disque d'effacer celui qu'on aura réglé entre-temps dans la voiture. Ce qui est
écarté est nommé au décompte.

### Ce que le relevé du 12 septembre a changé

Le NAS a été mesuré avant d'écrire les tickets, et trois choses annoncées se sont
révélées fausses.

- **Il n'y a qu'une source, pas deux.** `sound-of-speed/` et
  `sound-of-speed-dev/` portent les mêmes fichiers, aux mêmes tailles, aux mêmes
  dates. Il n'y a pas de fusion à arbitrer.
- **Il y a quatre dossiers à reprendre, pas cinq** : 41 traces (2,3 Mo), 53
  tranches de journal (904 Ko), 4 profils (18 Ko), 0 relevé de mesure. Le
  cinquième, `mesure-voiture`, se recalcule.
- **La base du serveur neuf n'était pas vide** : deux profils et trois traces
  d'essai y avaient été déposés le 12 septembre. David a dit qu'on pouvait la
  remettre à blanc — c'est la suppression du fichier de base avant la reprise.

## Ce qu'on ne construit pas

- **L'effacement des anciennes sources.** Il vient après la vérification, et il
  se demande.
- **Les comptes.** Tout entre sous le compte unique de
  [SERVEUR](../SERVEUR/spec.md) ; [COMPTES](../COMPTES/spec.md) répartira.
- **La rétention.** Les traces migrées sont épinglées, donc hors de sa portée.

## Critères d'acceptation

- [x] Les profils, moteurs et boîtes du navigateur de la voiture sont dans la
      base, et l'application les y lit
- [x] Les quatre dossiers du NAS sont repris : traces, journal, relevés,
      profils ; le profil mesuré, lui, se recalcule depuis les traces reprises
- [x] Les traces reprises sont épinglées
- [x] Les préférences d'appareil sont restées locales
- [x] Relancer la reprise ne crée aucun doublon, ne change rien, et n'écrase
      rien de ce qui est déjà en base
- [x] Rien n'est effacé à la source par ce lot
- [x] Un décompte avant/après est produit et vérifié, source par source
