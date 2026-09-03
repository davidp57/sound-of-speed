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
| [UI-DEFILEMENT](UI-DEFILEMENT/spec.md) — faire défiler l'écran de configuration sans dérégler un curseur | ⬜ |
| [VOLUME-GLOBAL](VOLUME-GLOBAL/spec.md) — le volume est une préférence d'appareil, pas un caractère de profil | ⬜ |
| [MODE-SIMPLE](MODE-SIMPLE/spec.md) — quelques curseurs globaux qui commandent les quarante-huit autres | ⬜ |
| [DEPOSER](DEPOSER/spec.md) — sortir un profil ou une trace d'une voiture qui refuse les fichiers | ⬜ |
| [ETALONNAGE](ETALONNAGE/spec.md) — mesurer la vraie voiture pour régler les virtuelles | ⬜ |
| [TABLEAU-DE-BORD](TABLEAU-DE-BORD/spec.md) — un vrai tableau de bord, et un paysage qui défile | 🧑 |
| [BANQUES](BANQUES/spec.md) — accueillir plusieurs banques de son : découverte, mesure outillée, choix par profil | ⬜ |
| [PENTE](PENTE/spec.md) — le GPS de la Tesla livre trente fois par seconde, et le conditionneur en attend une | 🧑 |
| [EFFORT](EFFORT/spec.md) — la charge doit connaître la vitesse : tenir 50 km/h et tenir 130 ne sonnent pas pareil | 🧑 |
| [IMPERFECTIONS](IMPERFECTIONS/spec.md) — un moteur ne tourne pas juste : tremblement de régime, couches désaccordées | 🧑 |

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

**Huit lots n'ont pas de tickets** — DEPOSER, EFFORT, ETALONNAGE,
IMPERFECTIONS, MODE-SIMPLE, TABLEAU-DE-BORD, UI-DEFILEMENT et VOLUME-GLOBAL.
`/to-tickets` les découpera quand on les reprendra ; il se lance lot par lot et
demande validation du découpage avant d'écrire.

Trois d'entre eux portent une **décision préalable** qui changerait leur
découpage : TABLEAU-DE-BORD attend la levée de la règle « aucune animation » ;
ETALONNAGE attend le choix entre analyser dans la voiture ou déposer les traces
d'abord, ce qui détermine s'il dépend de DEPOSER ; EFFORT attend que ses mesures
soient refaites, PENTE ayant invalidé celles sur lesquelles il a été écrit.

## Ce qui n'est pas dans le backlog

Les points listés dans « Ce qui n'est pas vérifié » à la fin du README — verrou
d'écran, GPS écran éteint, rendu sonore — n'ont pas de ticket. Ce ne sont pas
des travaux à faire mais des vérifications qui demandent de rouler. Ils restent
là où ils sont, et n'entrent ici que le jour où l'un d'eux se révèle défaillant
et demande une correction.
