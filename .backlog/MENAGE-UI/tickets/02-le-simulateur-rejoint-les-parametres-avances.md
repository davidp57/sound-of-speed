# 02 — Le simulateur et le sélecteur de source rejoignent le second niveau, hors voiture

**Statut :** ⬜ prêt

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

- [ ] Le simulateur et le sélecteur de source vivent dans l'écran des paramètres
      avancés
- [ ] Sur l'appareil « voiture », ni l'un ni l'autre n'apparaît, quel que soit
      le rôle du compte
- [ ] Sur un poste ou un téléphone, passer au simulateur lève la garde, et
      l'écran reste ouvert pendant qu'on simule une vitesse
- [ ] Revenir au GPS remet la garde, et l'écran se referme si l'on roule
- [ ] On règle un frein moteur et on l'entend sans quitter l'écran
