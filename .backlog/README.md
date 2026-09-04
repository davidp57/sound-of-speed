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
| [TEST-CORE](TEST-CORE/spec.md) — mettre le cœur sous test : Vitest, ESLint, 211 tests, 94,6 % de `core/` | ✅ |
| [FIX-CORE](FIX-CORE/spec.md) — les quatre défauts que la mise sous test a trouvés | 🧑 |
| [BG-AUDIO](BG-AUDIO/spec.md) — tenir le son quand le navigateur passe en arrière-plan | ✅ |
| [BOITE-VIVANTE](BOITE-VIVANTE/spec.md) — une boîte qui regarde la vitesse, pas seulement le régime | 🧑 |
| [FIX-BOITE](FIX-BOITE/spec.md) — ralentir n'est pas croiser : trois défauts de la boîte, relevés en roulant | 🧑 |
| [RELIEF](RELIEF/spec.md) — faire entendre l'effort : relief de charge, de régime, et niveau au ralenti | 🧑 |
| [ORIGINE](ORIGINE/spec.md) — réinitialiser un profil à ce qu'il était, et non aux réglages de Sport | ✅ |
| [UI-DEFILEMENT](UI-DEFILEMENT/spec.md) — faire défiler l'écran de configuration sans dérégler un curseur | 🧑 |
| [VOLUME-GLOBAL](VOLUME-GLOBAL/spec.md) — le volume est une préférence d'appareil, pas un caractère de profil | ✅ |
| [MODE-SIMPLE](MODE-SIMPLE/spec.md) — quelques curseurs globaux qui commandent la cinquantaine d'autres | 🧑 |
| [DEPOSER](DEPOSER/spec.md) — sortir un profil ou une trace d'une voiture qui refuse les fichiers | 🧑 |
| [ETALONNAGE](ETALONNAGE/spec.md) — mesurer la vraie voiture pour régler les virtuelles | 🧑 |
| [TABLEAU-DE-BORD](TABLEAU-DE-BORD/spec.md) — un vrai tableau de bord, et un paysage qui défile | 🧑 |
| [BANQUES](BANQUES/spec.md) — accueillir plusieurs banques de son : découverte, mesure outillée, choix par profil | ⬜ |
| [PENTE](PENTE/spec.md) — le GPS de la Tesla livre trente fois par seconde, et le conditionneur en attend une | 🧑 |
| [EFFORT](EFFORT/spec.md) — la charge doit connaître la vitesse : tenir 50 km/h et tenir 130 ne sonnent pas pareil | ⬜ |
| [IMPERFECTIONS](IMPERFECTIONS/spec.md) — un moteur ne tourne pas juste : tremblement de régime, couches désaccordées | 🔄 |
| [ESSAI-04](ESSAI-04/spec.md) — six défauts relevés en roulant le 4 septembre : GPS muet, accélération bruitée, étalonnage bloqué, relief écrasé, sortie du plein écran, décor retiré | 🔄 |
| [JOURNAL](JOURNAL/spec.md) — savoir ce que la voiture a vécu, sans avoir à le demander : journal déposé tout seul, en deux crans d'accord | 🧑 |
| [NAVIGATEUR-VOITURE](NAVIGATEUR-VOITURE/spec.md) — ce que l'appareil réel impose : filtrer sur la précision, mesurer la largeur utile | 🧑 |
| [DECOR-PERSPECTIVE](DECOR-PERSPECTIVE/spec.md) — un décor vu de la place du conducteur, et non de côté | ⬜ |
| [BANC-GPS](BANC-GPS/spec.md) — éprouver toute la chaîne sans rouler : trois modes de simulation, dont un qui traverse la vraie source GPS | ✅ |
| [SYNTHESE](SYNTHESE/spec.md) — produire le son au lieu de le rejouer : trois origines au choix par profil — enregistré, généré en direct, généré à l'avance | 🔄 |

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

EFFORT et IMPERFECTIONS attendaient cette mesure juste. **Les chiffres d'EFFORT
sont donc à refaire** : ils avaient été relevés sur une accélération qu'on sait
maintenant fausse, et le lot vaut peut-être moins qu'annoncé.

**IMPERFECTIONS est à moitié livré** : tremblement de régime et couches
désaccordées sont faits et mesurés, il reste la vérification en roulant. Son
troisième ticket — la boucle qui ne se répète plus — attend une mesure qui ne
peut pas se faire depuis le dépôt : la durée des boucles de la banque livrée, et
les échantillons vivent dans un volume du NAS.

**Tous les lots sont découpés en tickets**, sauf PENTE dont le travail est
livré. Les huit lots nés de l'essai sur route du 3 septembre 2026 l'ont été le
jour même, après deux décisions de conception prises par David :

- **La règle « aucune animation » est levée pour le paysage qui défile**, et pour
  lui seul. L'exception est écrite dans [`CLAUDE.md`](../CLAUDE.md), avec sa
  raison et ses limites. Le cadran à aiguille, lui, n'en relevait pas : son
  mouvement est la valeur.
- **L'étalonnage s'analyse dans la voiture**, sur place. ETALONNAGE ne dépend
  donc pas de DEPOSER, dont le préalable technique — la présence du module
  d'écriture dans l'image du serveur — n'est pas encore établi.

Un point reste ouvert à l'intérieur des tickets, et il est posé là où il se
tranche : si EFFORT garde sa raison d'être maintenant que la mesure
d'accélération est juste (EFFORT, ticket 01). Le second — ce qu'un curseur global
fait d'un réglage trouvé à la main — est tranché : **on écrase, avec un retour**
(MODE-SIMPLE, spec).

## Ce qui n'est pas dans le backlog

Les points listés dans « Ce qui n'est pas vérifié » à la fin du README — verrou
d'écran, GPS écran éteint, rendu sonore — n'ont pas de ticket. Ce ne sont pas
des travaux à faire mais des vérifications qui demandent de rouler. Ils restent
là où ils sont, et n'entrent ici que le jour où l'un d'eux se révèle défaillant
et demande une correction.
