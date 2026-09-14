# REMISE-A-ZERO — tout remettre comme au premier jour, en un bouton

**Statut :** ⬜ prêt
**Branche :** à ouvrir
**Version visée :** à décider

Demandé par David le 11 septembre 2026 : **un bouton « tout réinitialiser »**
dans l'application.

**Ce lot ne touche pas au serveur, et c'est un choix.** Confirmé par David le
12 septembre 2026. Le bouton remet les réglages de l'appareil à leurs valeurs
d'usine ; les traces, le journal et les profils déposés ne le regardent pas. La
spec l'avait tranché dès l'origine au point b ci-dessous ; un préambule ajouté
le 12 septembre par [PLATEFORME](../PLATEFORME/spec.md) a dit l'inverse pendant
quelques heures, en prenant ce choix pour une limite technique subie. Il est
retiré.

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

Dix-neuf clés, relevées dans le code :

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
| `speed.helpSeen.v1` | l'accueil du premier lancement, déjà vu |
| `speed.visiteVue.v1` | la visite guidée, déjà vue |
| `speed.journal.v1` | le consentement au journal de bord |
| `speed.deposit.v1` | le consentement à la remontée |
| `speed.traces.v1` | les traces connues |
| `speed.uploads.v1` | les dépôts en attente |
| `speed.ouvertures.v1` | combien de fois l'application a été ouverte |
| `speed.compteSignale.v1` | à quelle ouverture le rappel du compte a été écarté |

Les deux dernières manquaient au relevé : elles sont arrivées avec le rappel du
compte, le 13 septembre 2026, et la liste n'a pas suivi. Le décompte est donc à
refaire au moment d'écrire le bouton, pas à recopier d'ici.

**Une vingtième clé existe depuis le 13 septembre 2026, et ce bouton ne doit
pas l'effacer** : `speed.identity.v1` porte le compte de cet appareil, arrivé
avec le lot [COMPTES](../COMPTES/spec.md). Son ticket 02 le tranche : la remise
à zéro remet des **réglages** à leurs valeurs d'usine, elle ne déconnecte pas.
Et l'effacer coûterait plus qu'une déconnexion — un compte anonyme n'a pas de
mot de passe, donc rien à reprendre : ce que l'appareil avait déposé sous ce
compte deviendrait inaccessible. Un bouton qui ferait cela en remettant le
volume à zéro serait un piège.

## Ce qui reste à trancher

Trois questions, et aucune n'a de réponse évidente. Elles sont posées ici
plutôt que devinées.

**a. Tout, ou seulement les réglages ?** Effacer les seize clés remet
l'application à son premier démarrage — profils livrés, aucune préférence,
aucun consentement. Mais cela emporte aussi les **dépôts en attente**
(`speed.uploads.v1`) : une trace enregistrée hors réseau et pas encore remontée
serait perdue pour de bon. *Reco : tout effacer, mais prévenir nommément quand
un dépôt attend, et proposer d'attendre.*

**b. Ce qui est sur le serveur ? — tranché le 12 septembre 2026 : on n'y touche
pas.** Les profils déposés, les traces, le journal : un « tout réinitialiser »
côté appareil n'y touche pas, parce que le serveur est une mémoire partagée
entre appareils. La confirmation le dit. Que la base rende l'effacement
techniquement possible ne change rien à cet arbitrage : c'est le lot
[RETENTION](../RETENTION/spec.md) qui porte l'effacement côté serveur, et il le
porte pour lui-même.

**c. Où le mettre, et comment le protéger ?** Ce n'est pas un bouton qu'on
frôle en conduisant. *Reco : tout en bas de l'écran de configuration, dans une
zone à part, avec une confirmation qui énumère ce qui va disparaître.*

## Les tickets

| | Sujet |
|---|---|
| [01](tickets/01-tout-reinitialiser.md) | Le bouton, la confirmation, et ce qu'il efface |
