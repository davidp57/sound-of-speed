# 03 — un enregistrement d'étalonnage s'arrête toujours

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

On peut lancer une étape d'étalonnage, aller regarder l'écran de conduite — ce
que fait forcément quelqu'un qui roule — et revenir arrêter son enregistrement.

Aujourd'hui c'est impossible. L'étape en cours est retenue dans l'écran
d'étalonnage lui-même, et cet écran est démonté dès qu'on change d'onglet. Au
retour, l'application sait qu'un enregistrement tourne mais plus lequel : toutes
les étapes affichent « un autre enregistrement est en cours » et aucun bouton ne
permet plus de l'arrêter. L'enregistrement continue à accumuler des mesures, et
la seule sortie est le bouton d'arrêt de l'écran de télémétrie.

L'étape en cours doit vivre là où vit la session d'étalonnage, c'est-à-dire dans
l'état de l'application. Et un enregistrement dont l'écran ne connaîtrait pas
l'étape doit rester arrêtable depuis cet écran, plutôt que de le condamner.

## Critères d'acceptation

- [x] Lancer une étape, changer d'onglet, revenir : l'étape est toujours
      annoncée comme en cours et le bouton qui l'arrête est là.
- [x] L'étape arrêtée après un aller-retour est bien rattachée à sa trace.
      Vérifié dans le navigateur : 300 mesures, trace « étalonnage — Conduite en
      ville », rattachée à l'étape.
- [x] Un enregistrement lancé hors de cet écran ne le condamne pas : un bandeau
      l'annonce et l'arrête d'un geste, et la trace n'est pas perdue.
- [x] Aucun état de l'écran ne laisse l'utilisateur sans moyen d'arrêter un
      enregistrement en cours.
