# MIGRER — les réglages quittent le navigateur et les cinq dossiers

**Statut :** ⬜ prêt
**Branche :** `feature/migrer`
**Version visée :** 0.4
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [SERVEUR](../SERVEUR/spec.md) — il n'y a rien où migrer tant
que la base n'existe pas.

## Ce qu'il faut obtenir

Tout ce qui compte vit dans la base, et plus rien d'important ne dort dans le
stockage local d'un navigateur de voiture ni dans un dossier du NAS.

Le jour où c'est fait, changer de téléphone ne fait plus perdre ses réglages.

**Ce lot ne fait que rapatrier.** Décidé par David le 12 septembre 2026 : le
serveur écrit en base dès [SERVEUR](../SERVEUR/spec.md), donc le chemin est déjà
tracé et éprouvé quand on arrive ici. Le découpage d'origine laissait à ce lot la
bascule du code **et** la reprise des données ; il aurait fallu écrire deux fois
le code d'accès, et ce lot serait devenu une refonte déguisée en migration.

## Le problème

Les réglages vivent à deux endroits qui ne se parlent pas : le stockage local du
navigateur de la voiture, et cinq dossiers du NAS. Ni l'un ni l'autre n'est
sauvegardé, et le premier disparaît avec le navigateur qui le porte — un cache
vidé, un téléphone changé.

Le stockage local porte aujourd'hui les profils, les moteurs, les boîtes, les
traces, la voiture réelle, le mode de conduite et les préférences d'appareil,
sous des clés préfixées `speed.` — préfixe conservé délibérément au renommage du
12 septembre, parce que le stockage local ne suit aucun renommage.

## Ce qu'on construit

### Tout migre

Profils, moteurs, boîtes, traces, journal, relevés, profil mesuré. Les deux
sources rejoignent la base.

### Les traces reprises entrent épinglées

Sans quoi la règle de rétention de [RETENTION](../RETENTION/spec.md) les
effacerait un mois après leur migration — c'est-à-dire qu'on les aurait
déplacées pour les perdre.

### Ce qui reste local reste local

Les préférences d'appareil — volume, visage de l'écran, verrou, mode de boîte —
ne rejoignent rien. Elles décrivent le téléphone, pas le conducteur, et
[REFONTE 04](../REFONTE/tickets/04-le-profil-devient-un-assemblage.md) l'avait
déjà tranché.

### La reprise est rejouable et sans perte

Elle se lance deux fois sans rien casser ni rien dupliquer. C'est ce que fait
déjà la scission des profils en entités, qui est sans effet au second passage.

Et elle **ne détruit rien à la source** tant que David n'a pas dit que c'est
bon : le stockage local et les dossiers du NAS restent en place, en lecture.
Une migration qui efface au fur et à mesure est une migration qu'on ne peut pas
reprendre.

## Ce qu'on ne construit pas

- **L'effacement des anciennes sources.** Il vient après la vérification, et il
  se demande.
- **Les comptes.** Tout entre sous le compte unique de
  [SERVEUR](../SERVEUR/spec.md) ; [COMPTES](../COMPTES/spec.md) répartira.
- **La rétention.** Les traces migrées sont épinglées, donc hors de sa portée.

## Critères d'acceptation

- [ ] Les profils, moteurs et boîtes du navigateur de la voiture sont dans la
      base, et l'application les y lit
- [ ] Les cinq dossiers du NAS sont repris : traces, journal, relevés, profils,
      profil mesuré
- [ ] Les traces reprises sont épinglées
- [ ] Les préférences d'appareil sont restées locales
- [ ] Relancer la reprise ne crée aucun doublon et ne change rien
- [ ] Rien n'est effacé à la source par ce lot
- [ ] Un décompte avant/après est produit et vérifié, source par source
