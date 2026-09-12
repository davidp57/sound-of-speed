# BG-AUDIO — tenir le son quand le navigateur passe en arrière-plan

**Statut :** ✅ fait — clos le 2026-09-03
**Branche :** `fix/bg-audio`
**Version visée :** 0.2

Relevé en roulant : le son s'arrêtait net dès que le navigateur de la Tesla
était réduit. L'application ne servait donc que si l'on renonçait à la carte —
exactement la situation qu'on voulait éviter, un son de moteur s'écoutant en
conduisant.

Le média silencieux censé maintenir la session existait et démarrait bien. Il ne
suffisait pas : la différence tenait entièrement à la plomberie autour de lui,
relevée dans une application qui, elle, y arrivait — un fichier de silence réel
et long, et un média inséré dans le document plutôt que construit à part.

Vérifié en roulant le 3 septembre 2026 : le son tient, navigateur réduit.

## Tickets

| # | Titre | Statut |
|---|---|---|
| 01 | Un fichier de silence réel, servi et long | ✅ fait |
| 02 | Le média de maintien, construit et inséré comme celui qui marche | ✅ fait |
| 03 | Rendre l'échec visible sur l'écran Télémétrie | ✅ fait |
| 04 | Relancer le suivi GPS quand il se tait | ✅ fait |
