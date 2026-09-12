# REMISE-A-ZERO — tout remettre comme au premier jour, en un bouton

**Statut :** ⬜ prêt
**Branche :** à ouvrir
**Version visée :** à décider

**Sa limite tombe**, le 12 septembre 2026, par
[PLATEFORME](../PLATEFORME/spec.md) : « sans toucher au serveur » n'était pas un
choix de périmètre mais une impossibilité — nginx n'accorde que l'écriture, pas
la suppression. Avec une base, effacer ce qu'un compte a déposé devient possible,
et la question de périmètre se repose.

Demandé par David le 11 septembre 2026 : **un bouton « tout réinitialiser »**
dans l'application.

## Pourquoi

Tout ce que Speed retient vit dans le stockage local du navigateur, et rien
d'autre ne l'efface : ni recharger la page, ni réinstaller, ni changer de
profil. Quand un réglage s'est mis de travers — un profil au format repris de
travers, une décision de profil mesuré qu'on veut reprendre, un consentement
de dépôt donné par erreur —, la seule issue aujourd'hui est de vider les
données du site depuis les réglages du navigateur, ce qui ne se fait pas d'une
main au volant et qui ne s'explique pas en une phrase.

Il existe déjà un « revenir à l'origine » **par profil**, livré par le lot
ORIGINE. Ce lot-ci est l'échelon au-dessus : l'appareil entier.

## Ce que l'application retient

Seize clés, relevées dans le code :

| Clé | Ce qu'elle porte |
|---|---|
| `speed.profiles.v1` | les profils enregistrés |
| `speed.selectedProfile.v1` | celui qui est actif |
| `speed.engines.v1` | les moteurs enregistrés |
| `speed.gearboxes.v1` | les boîtes enregistrées |
| `speed.realCar.v1` | la vraie voiture décrite à la main |
| `speed.measuredCar.v1` | la réponse donnée à la proposition du serveur |
| `speed.calibration.v1` | la session d'étalonnage en cours |
| `speed.masterVolume.v1` | le volume de l'appareil |
| `speed.driveMode.v1` | Route ou Sport |
| `speed.driveFace.v1` | la disposition de l'écran de conduite |
| `speed.advancedMode.v1` | le mode avancé de la configuration |
| `speed.helpSeen.v1` | l'aide déjà lue |
| `speed.journal.v1` | le consentement au journal de bord |
| `speed.deposit.v1` | le consentement à la remontée |
| `speed.traces.v1` | les traces connues |
| `speed.uploads.v1` | les dépôts en attente |

## Ce qui reste à trancher

Trois questions, et aucune n'a de réponse évidente. Elles sont posées ici
plutôt que devinées.

**a. Tout, ou seulement les réglages ?** Effacer les seize clés remet
l'application à son premier démarrage — profils livrés, aucune préférence,
aucun consentement. Mais cela emporte aussi les **dépôts en attente**
(`speed.uploads.v1`) : une trace enregistrée hors réseau et pas encore remontée
serait perdue pour de bon. *Reco : tout effacer, mais prévenir nommément quand
un dépôt attend, et proposer d'attendre.*

**b. Ce qui est sur le serveur ?** Les profils déposés sur le NAS, les traces,
le journal : un « tout réinitialiser » côté appareil n'y touche pas, et c'est
sans doute ce qu'il faut — le serveur est une mémoire partagée entre appareils.
*Reco : ne toucher à rien sur le serveur, et le dire dans la confirmation.*

**c. Où le mettre, et comment le protéger ?** Ce n'est pas un bouton qu'on
frôle en conduisant. *Reco : tout en bas de l'écran de configuration, dans une
zone à part, avec une confirmation qui énumère ce qui va disparaître.*

## Les tickets

| | Sujet |
|---|---|
| [01](tickets/01-tout-reinitialiser.md) | Le bouton, la confirmation, et ce qu'il efface |
