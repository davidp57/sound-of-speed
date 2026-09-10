# 03 — La voiture réelle sort du profil

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite. Indépendant de 01 et 02 :
il déplace des réglages que ni le moteur ni la boîte ne lisent.

## Ce qu'il faut obtenir

Les six réglages du signal de vitesse — raideur du lissage, fenêtre
d'accélération, vitesse plausible, précision acceptée, bornes d'accélération —
ne décrivent ni un moteur, ni une boîte, ni un goût. Ils décrivent **la vraie
voiture** et son récepteur GPS. Ils n'ont donc rien à faire dans un profil de
son.

C'est David qui l'a formulé, en remplissant le relevé des réglages :

> tous les params « signal de vitesse » sont liés au profil de la voiture (la
> vraie) — donc valeurs par défaut en atelier, potentiellement adaptées avec le
> profil « voiture réelle » quand il est disponible

Et cette entité a une propriété qu'aucune des quatre autres n'a : **il n'y en a
qu'une**. On ne choisit pas sa vraie voiture comme on choisit un V8 — c'est
celle qu'on a. Elle appartient donc à l'appareil, et plus tard au compte, jamais
à un profil.

Au bout : changer de profil ne change plus le comportement de la mesure, et
l'étalonnage écrit à un endroit qui ne dépend pas du son qu'on écoutait ce
jour-là.

Ce que ce ticket ne fait pas : le catalogue de modèles de voiture, et l'analyse
automatique des données remontées pour bâtir ce profil tout seul. Ce sont deux
idées de David qui vivent dans la spécification du lot, et elles supposent le
serveur.

## Critères d'acceptation

- [ ] Les six réglages du signal de vitesse quittent le profil pour une entité
      « voiture réelle », unique sur l'appareil.
- [ ] Changer de profil ne change plus aucun réglage de mesure.
- [ ] L'étalonnage recopie ses valeurs mesurées dans la voiture réelle, et non
      dans le profil actif.
- [ ] Les profils déjà enregistrés sont repris : leurs réglages de signal
      alimentent la voiture réelle de l'appareil, et le comportement de la mesure
      ne change pas.
- [ ] Un profil importé ou partagé n'écrase jamais la voiture réelle de celui
      qui le reçoit — c'est le sens même de la séparation.
- [ ] README à jour sur les deux points : où vivent ces réglages, et pourquoi.
- [ ] Contrôle qualité vert.
