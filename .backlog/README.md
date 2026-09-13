# Backlog — Speed

Backlog **par lot**. Un lot actif est un dossier `.backlog/<LOT-ID>/`
(`spec.md` + `tickets/NN-slug.md`) ; un lot terminé est compacté dans
`.backlog/archive/<LOT-ID>.md`.

Ce dossier est la source de vérité du **périmètre et du statut**. Le
**séquencement** vit dans le tableau « État du projet » du
[`README.md`](../README.md) — il n'y a pas de `docs/roadmap.md` dans ce projet.

Index tenu **à la main** à la création et à la clôture d'un lot, pas de script
générateur. Les artefacts naissent à `⬜ prêt`. La convention détaillée est dans
[`docs/agents/issue-tracker.md`](../docs/agents/issue-tracker.md).

## Légende

- **Statut** : ⬜ prêt · 🔄 en cours · 🧑 attend David · ✅ fait · 🚫 abandonné
  (voir [`docs/agents/triage-labels.md`](../docs/agents/triage-labels.md)).
- **🧑 attend David** est le statut des tickets dont la vérification demande la
  voiture : le code est prêt, la preuve ne l'est pas.

## Lots actifs

| Lot | Statut |
|-----|--------|
| [FIX-CORE](FIX-CORE/spec.md) — les quatre défauts que la mise sous test a trouvés | 🧑 |
| [BOITE-VIVANTE](BOITE-VIVANTE/spec.md) — une boîte qui regarde la vitesse, pas seulement le régime | 🧑 |
| [FIX-BOITE](FIX-BOITE/spec.md) — ralentir n'est pas croiser : deux défauts de la boîte, relevés en roulant | 🧑 |
| [MOTEURS-EN-VOITURE](MOTEURS-EN-VOITURE/spec.md) — choisir moteur, échappement et point d'écoute au volant | 🧑 |
| [RELIEF](RELIEF/spec.md) — faire entendre l'effort : relief de charge, de régime, et niveau au ralenti | 🧑 |
| [UI-DEFILEMENT](UI-DEFILEMENT/spec.md) — faire défiler l'écran de configuration sans dérégler un curseur | 🧑 |
| [MODE-SIMPLE](MODE-SIMPLE/spec.md) — quelques curseurs globaux qui commandent les quarante-huit autres | 🧑 |
| [DEPOSER](DEPOSER/spec.md) — sortir un profil ou une trace d'une voiture qui refuse les fichiers | 🧑 |
| [ETALONNAGE](ETALONNAGE/spec.md) — mesurer la vraie voiture pour régler les virtuelles | 🧑 |
| [TABLEAU-DE-BORD](TABLEAU-DE-BORD/spec.md) — un vrai tableau de bord, et un paysage qui défile | 🧑 |
| [BANQUES](BANQUES/spec.md) — accueillir plusieurs banques de son : découverte, mesure outillée, choix par profil | 🧑 |
| [PENTE](PENTE/spec.md) — le GPS de la Tesla livre dix fois par seconde, et le conditionneur en attend une | 🧑 |
| [EFFORT](EFFORT/spec.md) — la charge doit connaître la vitesse : tenir 50 km/h et tenir 130 ne sonnent pas pareil | 🧑 |
| [PASSAGE](PASSAGE/spec.md) — un passage de rapport doit s'entendre comme un passage | 🧑 |
| [JOURNAL](JOURNAL/spec.md) — savoir ce que la voiture a vécu, sans avoir à le demander : journal déposé tout seul, en deux crans d'accord | 🧑 |
| [NAVIGATEUR-VOITURE](NAVIGATEUR-VOITURE/spec.md) — ce que l'appareil réel impose : filtrer sur la précision, mesurer la largeur utile | 🧑 |
| [SYNTHESE](SYNTHESE/spec.md) — produire le son au lieu de le rejouer : engine-sim reste un outil d'atelier, qui fabrique des banques ; la génération en direct dans la voiture est abandonnée | 🧑 |
| [REMONTEE](REMONTEE/spec.md) — tout ce qui naît dans la voiture remonte tout seul : traces, journal, relevés de mesure, profils, sur un accord unique | 🧑 |
| [ESSAI-08](ESSAI-08/spec.md) — quatre constats de l'essai du 8 septembre : GPS qui ne démarre pas, son faux en roulant, interface à consolider, dépôt qui refuse les identifiants | 🧑 |
| [MENAGE-UI](MENAGE-UI/spec.md) — faire le ménage dans l'interface : sept mille lignes d'écrans pour une application qui affiche trois chiffres | ⬜ n'est plus une séparation à la fabrication mais une affaire de droits, voir [PLATEFORME](PLATEFORME/spec.md) |
| [DELISSER](DELISSER/spec.md) — un régime qui ne soit pas une fréquence pure : le moteur simulé tient la consigne au tour près, et ça s'entend | 🧑 |
| [RAPATRIER](RAPATRIER/spec.md) — faire redescendre ce que la voiture a déposé : les quatre dossiers du serveur en un paquet, depuis un téléphone | 🧑 |
| [MOUVEMENT](MOUVEMENT/spec.md) — une seule notion de « est-ce qu'on ralentit ? » : deux compteurs se contredisent depuis le 8 septembre, et la boîte reste bloquée ou monte à contretemps | ⬜ |
| [HORODATAGE](HORODATAGE/spec.md) — le navigateur de la Tesla compte en microsecondes : l'accélération sortait mille fois trop petite, et toute la chaîne travaillait sur zéro | 🧑 |
| [REFONTE](REFONTE/spec.md) — le cadre de la refonte du 10 septembre : le son change d'origine, la boîte cesse de deviner de deux façons, l'application se sépare en trois, et un compte fait le lien | 🔄 |
| [RELECTURE](RELECTURE/spec.md) — revoir un trajet au bureau au lieu de le raconter de mémoire : une seule capture, automatique, et un relecteur avec timeline et carte | 🧑 les huit tickets sont livrés, les 46 critères établis le 12 septembre ; reste l'écoute du rejeu |
| [PLANCHER](PLANCHER/spec.md) — la boîte se décide sur un seul plancher de régime : on monte dès que le rapport suivant tient, on ne descend qu'en ralentissant, et le rétrogradage forcé redevient exceptionnel | ✅ écouté le 11 septembre au soir : le va-et-vient a disparu, le départ est conforme ; la suite est dans RETOUR-11 et ETAGEMENT |
| [COMMANDES](COMMANDES/spec.md) — un interrupteur qui a la forme d'un sélecteur de boîte : D démarre, P met au repos, et la boîte remonte les rapports après un arrêt | 🧑 livré, reste l'essai en roulant |
| [PROFIL-REEL](PROFIL-REEL/spec.md) — le serveur apprend la vraie voiture depuis les traces ordinaires et propose son profil | 🧑 neuf tickets livrés ; la chaîne servie est réparée, reste à recoller la pile dans Portainer |
| [SUITE-ESSAI-11](SUITE-ESSAI-11/spec.md) — deux points de l'essai du 11 septembre : sept cent vingt-six dépôts manqués à l'arrêt, et une relance GPS de secours | 🔄 relance livrée ; les dépôts manqués restent à instruire |
| [RETOUR-11](RETOUR-11/spec.md) — trois demandes de la sortie du 11 septembre au soir : le rétrogradage forcé qui rend le rapport, le claquement à la montée, l'aiguille du rapport suivant | 🧑 les trois sont livrés ; deux s'écoutent en roulant |
| [ETAGEMENT](ETAGEMENT/spec.md) — une boîte à sept rapports, étagée pour tenir bas : 50 en quatrième, 80 en cinquième, 110 en sixième, et les passages plus tôt en mode Route | 🧑 les trois tickets sont livrés ; reste l'écoute en roulant |
| [REMISE-A-ZERO](REMISE-A-ZERO/spec.md) — tout remettre comme au premier jour, en un bouton : seize clés de stockage, et trois questions de périmètre à trancher | ⬜ |
| [ATELIER](ATELIER/spec.md) — l'atelier fabrique les moteurs, la voiture les reçoit : un chemin du bureau au volant, et deux effets sonores qui restent réglables | ⬜ |
| [PLATEFORME](PLATEFORME/spec.md) — Speed devient un service qu'on déploie, qu'on partage et qu'on fait vivre : le **cadre**, découpé le 12 septembre 2026 en cinq lots d'exécution | ⬜ cadre |
| [PLATEFORME/banques-libres](PLATEFORME/banques-libres.md) — relevé : aucune banque libre n'est à la fois redistribuable et au bon format ; engine-sim reste la voie pour l'image publique | ✅ |
| [OUVRIR](OUVRIR/spec.md) — 1/5 · le dépôt devient forkable et le conteneur fait du bruit tout seul : AGPL-3.0, banque de démonstration, de quoi contribuer et déployer | ✅ |
| [SERVEUR](SERVEUR/spec.md) — 2/5 · un seul service TypeScript à la place de nginx et du profileur, avec une base et des migrations, à compte unique | 🧑 8/8 — livré et mesuré sur le NAS ; reste l’essai hors réseau |
| [MIGRER](MIGRER/spec.md) — 3/5 · les réglages quittent le navigateur de la voiture et les dossiers du NAS pour la base | ✅ 4/4 — repris du NAS, remonté du navigateur, et rendu au lancement |
| [RETENTION](RETENTION/spec.md) — 4/5 · analyser puis oublier, sauf ce qu'on épingle ou qu'on emporte ; 8 tickets | 🧑 8/8 — livré ; verdict lu sur la base de production, il est vide |
| [IMAGE-ARM64](IMAGE-ARM64/spec.md) — l'image du serveur échoue une fois sur deux en arm64 : QEMU rend une instruction illégale pendant `npm ci` | ⬜ constaté le 13 septembre |
| [COMPTES](COMPTES/spec.md) — 5/5 · un compte anonyme d'abord, une adresse quand elle sert, et des droits qui ouvrent les écrans | 🔄 7/12 — une adresse et un mot de passe rouvrent le compte n'importe où ; restent le compte tiers, la tenue du compte, et les droits |

Neuf lots sont nés d'un essai sur route du 3 septembre 2026 — UI-DEFILEMENT,
VOLUME-GLOBAL, MODE-SIMPLE, DEPOSER, ETALONNAGE, TABLEAU-DE-BORD, puis PENTE,
EFFORT et IMPERFECTIONS. Ils n'ont pas de tickets : leur découpage attend qu'on
les reprenne, `/to-tickets` s'en chargera. Écrire des tickets pour un lot dont
la conception n'est pas tranchée donnerait des frontières qui ne survivraient
pas à la première décision.

**PENTE est livré** (PR #11, dans `develop`). Une remarque de passage sur la
cadence de rafraîchissement d'un compteur avait mené à un défaut de mesure qui
faussait tout l'aval : à la cadence réelle du GPS de la Tesla, une accélération
douce était vue à zéro. Restent ses deux vérifications en roulant.

**Sa cadence annoncée était fausse, et son correctif insuffisant.** Le titre du
lot dit « trente fois par seconde » ; le journal de l'essai du 9 septembre donne
**dix**. Et PENTE ne pouvait pas suffire : la vraie cause était une unité
d'horodatage, trouvée le 10 septembre par [HORODATAGE](HORODATAGE/spec.md) — le
navigateur de la voiture compte en microsecondes, et l'accélération sortait mille
fois trop petite. C'est pourquoi David avait raison de dire que PENTE était bon
en roulant, et pourquoi la mesure restait morte malgré lui.

EFFORT et IMPERFECTIONS attendaient cette mesure juste. **Les chiffres d'EFFORT
ont été refaits** le 4 septembre 2026, après PENTE et ESSAI-04 : le lot continue
inchangé, et il est livré. Il ne lui reste qu'une écoute en roulant.

**IMPERFECTIONS est livré et archivé**, trois tickets sur trois ; il restait
l'écoute en roulant, jamais faite sur une accélération juste. Le troisième — la boucle qui ne se répète plus — était réputé bloqué par
une mesure impossible depuis le dépôt. Il ne l'était pas : la banque livrée est
présente en local, ses boucles font 3,14 s à 5,37 s, et le ticket prévoyait de
s'abandonner si elles étaient longues. La lecture reprend maintenant ailleurs
dans l'enregistrement toutes les six secondes en moyenne, par un fondu croisé à
puissance constante de vingt millisecondes. Deux parades prévues au ticket ont
été essayées et écartées sur mesure : les deux instances permanentes en fondu
croisé lent, et l'alignement de la nouvelle position sur le cycle moteur.

**PROFIL-REEL est livré**, ses huit tickets faits en une journée : le calcul sait
lire une capture, y retrouver les moments, séparer le pied levé du freinage,
cumuler ce que les trajets montrent et dire s'il en sait assez ; le service le
fait sur le serveur ; l'écran le propose et l'applique. Éprouvé de bout en bout
sur le trajet du 11 septembre, qui rend neuf réglages.

Deux choses restent, et elles demandent David : que le conteneur tourne sur le
NAS, et que le résultat s'entende en roulant. Et une question de fond demeure —
rien ne prouve encore qu'il y ait deux façons de ralentir à lire dans la
distribution. Son point dur reste ouvert — la distribution des ralentissements du
trajet du 11 septembre n'a qu'une bosse et une queue, et rien ne prouve encore
qu'il y ait deux façons de ralentir à y lire. Le lot est faisable sans attendre
les comptes, puisqu'on travaille à compte unique.

**Douze lots n'ont pas de tickets**, et c'est délibéré dans chaque cas : soit le
travail est livré d'une pièce (PENTE, BANC-GPS, DELISSER, ESSAI-08, JOURNAL,
MOTEURS-EN-VOITURE, NAVIGATEUR-VOITURE, PASSAGE, RAPATRIER, HORODATAGE), soit la
conception n'est pas tranchée et des frontières écrites d'avance ne survivraient
pas à la première décision (MENAGE-UI, MOUVEMENT).

Les neuf lots nés de l'essai sur route du 3 septembre 2026 ont été découpés le
jour même, après deux décisions de conception prises par David :

- **La règle « aucune animation » avait été levée pour le paysage qui défile**,
  et pour lui seul. Le paysage a été retiré le 4 septembre, le lot qui devait le
  redessiner est abandonné depuis le 7, et **l'exception est retirée** de
  [`CLAUDE.md`](../CLAUDE.md) avec lui : la règle n'a plus d'exception. Le cadran
  à aiguille n'en relevait pas de toute façon — son mouvement est la valeur.
- **L'étalonnage s'analyse dans la voiture**, sur place. ETALONNAGE ne dépend
  donc pas de DEPOSER, dont le préalable technique — la présence du module
  d'écriture dans l'image du serveur — n'est pas encore établi.

Un point reste ouvert à l'intérieur des tickets, et il est posé là où il se
tranche : si EFFORT garde sa raison d'être maintenant que la mesure
d'accélération est juste (EFFORT, ticket 01). Le second — ce qu'un curseur global
fait d'un réglage trouvé à la main — est tranché : **on écrase, avec un retour**
(MODE-SIMPLE, spec).

**Trois lots ont tous leurs tickets faits et restent pourtant 🧑** —
BOITE-VIVANTE, FIX-BOITE et RELIEF. Ce n'est pas un oubli : c'est le sens du
statut. Le code est livré, la preuve demande la voiture, et ce qu'il reste à
faire ne se découpe pas en tickets — cela s'écoute. Les trois attendent en outre
une accélération juste, que le correctif du 10 septembre vient seulement de
rendre.

**REMONTEE reprend deux tickets de DEPOSER** — déposer un profil, et le dépôt en
attente qui part au retour du réseau. Ils y sont marqués abandonnés, avec le
renvoi : ce ne sont plus des travaux séparés mais deux tranches d'un même
mécanisme, décidé le 6 septembre 2026 quand le périmètre est passé des relevés de
mesure à tout ce que la voiture produit.

## Lots archivés

Clos depuis plus de trois jours, compactés dans `.backlog/archive/` :

| Lot | Clos le |
|-----|---------|
| [TEST-CORE](archive/TEST-CORE.md) — mettre le cœur sous test : Vitest, ESLint, 211 tests, 94,6 % de `core/` | 2026-09-02 |
| [ORIGINE](archive/ORIGINE.md) — réinitialiser un profil à ce qu'il était, et non aux réglages de Sport | 2026-09-02 |
| [BG-AUDIO](archive/BG-AUDIO.md) — tenir le son quand le navigateur passe en arrière-plan | 2026-09-03 |
| [VOLUME-GLOBAL](archive/VOLUME-GLOBAL.md) — le volume est une préférence d'appareil, pas un caractère de profil | 2026-09-03 |
| [BANC-GPS](archive/BANC-GPS.md) — éprouver toute la chaîne sans rouler, en traversant la vraie source GPS | 2026-09-04 |
| [ESSAI-04](archive/ESSAI-04.md) — six défauts relevés en roulant le 4 septembre, huit tickets | 2026-09-06 |
| [IMPERFECTIONS](archive/IMPERFECTIONS.md) — un moteur ne tourne pas juste : tremblement, désaccord, boucle qui ne se répète plus | 2026-09-06 |
| [DECOR-PERSPECTIVE](archive/DECOR-PERSPECTIVE.md) — un décor vu de la place du conducteur, abandonné au découpage | 2026-09-07 |

## Ce qui n'est pas dans le backlog

Les points listés dans « Ce qui n'est pas vérifié » à la fin du README — verrou
d'écran, GPS écran éteint, rendu sonore — n'ont pas de ticket. Ce ne sont pas
des travaux à faire mais des vérifications qui demandent de rouler. Ils restent
là où ils sont, et n'entrent ici que le jour où l'un d'eux se révèle défaillant
et demande une correction.
