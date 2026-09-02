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
| [BG-AUDIO](BG-AUDIO/spec.md) — tenir le son quand le navigateur passe en arrière-plan | 🧑 |
| [BOITE-VIVANTE](BOITE-VIVANTE/spec.md) — une boîte qui regarde la vitesse, pas seulement le régime | 🧑 |
| [RELIEF](RELIEF/spec.md) — faire entendre l'effort : relief de charge, de régime, et niveau au ralenti | 🧑 |
| [ORIGINE](ORIGINE/spec.md) — réinitialiser un profil à ce qu'il était, et non aux réglages de Sport | ✅ |
| [BANQUES](BANQUES/spec.md) — accueillir plusieurs banques de son : découverte, mesure outillée, choix par profil | ⬜ |

## Ce qui n'est pas dans le backlog

Les points listés dans « Ce qui n'est pas vérifié » à la fin du README — verrou
d'écran, GPS écran éteint, rendu sonore — n'ont pas de ticket. Ce ne sont pas
des travaux à faire mais des vérifications qui demandent de rouler. Ils restent
là où ils sont, et n'entrent ici que le jour où l'un d'eux se révèle défaillant
et demande une correction.
