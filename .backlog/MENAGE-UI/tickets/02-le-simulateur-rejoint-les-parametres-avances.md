# 02 — Le simulateur et le sélecteur de source rejoignent le second niveau, hors voiture

**Statut :** ✅ fait

**Bloqué par :** 01 — Les paramètres avancés deviennent un écran à part, gardé

## Ce qu'il faut obtenir

Régler une inertie ou un frein moteur sans l'entendre n'a pas de sens. Le
simulateur est le seul moyen d'entendre sans rouler : il rejoint donc les
paramètres avancés, avec le sélecteur de source qui permet de le choisir.

Ni l'un ni l'autre n'apparaît sur l'appareil « voiture », à aucun niveau. C'est
ce que demandait le croquis du 10 septembre, et la garde ne s'y substitue pas :
l'appareil range l'écran, la garde le protège, et les deux se cumulent.

Le rejeu suit le simulateur : il fait partie du même sélecteur, et rejouer un
trajet capturé est exactement ce dont on a besoin après un essai raté.

Une conséquence à vérifier plutôt qu'à supposer : passer au simulateur lève la
garde, puisque la source n'est plus le GPS. C'est voulu — sans cela, régler et
écouter se chasseraient l'un l'autre.

## Critères d'acceptation

- [x] Le simulateur et le sélecteur de source vivent dans l'écran des paramètres
      avancés
- [x] Sur l'appareil « voiture », ni l'un ni l'autre n'apparaît, quel que soit
      le rôle du compte
- [x] Sur un poste ou un téléphone, passer au simulateur lève la garde, et
      l'écran reste ouvert pendant qu'on simule une vitesse
- [x] Revenir au GPS remet la garde, et l'écran se referme si l'on roule
- [x] On règle un frein moteur et on l'entend sans quitter l'écran

## Ce qui a été fait, et mesuré

L'onglet **Banc** disparaît : la barre repasse de huit à sept entrées sur un
poste. Le banc reste chargé à la demande — il l'était depuis `App.vue`, il l'est
maintenant depuis l'écran avancé, et c'est vérifié au build : 6,45 ko dans son
propre morceau, morceau principal inchangé à 108,4 ko compressés.

Vérifié dans le navigateur, appareil déclaré « voiture » : cinq onglets, et
l'écran Avancé n'y montre ni la source ni le banc. Déclaré « poste » : la source
et le banc sont en tête, avant Moteur.

## Une friction connue, laissée telle quelle

Sur un poste, si la source est le GPS **et** que l'application tourne, l'écran
avancé se ferme — or c'est lui qui porte désormais le sélecteur de source. La
sortie existe : repasser au repos, attendre les trente secondes, choisir le
simulateur.

Laissée en l'état à dessein : la décision du 14 septembre est que l'écran gardé
soit vide, avec la seule phrase qui dit pourquoi. Y glisser un sélecteur
reviendrait à rouvrir cette décision pour un cas où l'on n'a aucune raison de
rester — tester au GPS sur une machine immobile.
