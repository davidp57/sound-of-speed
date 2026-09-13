# 07 — Hors réseau, rien ne change : vérifié réseau coupé

**Statut :** ⬜ prêt

**Bloqué par :** [04 — La voiture dépose avec son compte](04-la-voiture-depose-avec-son-compte.md),
[06 — Les droits ouvrent les écrans](06-les-droits-ouvrent-les-ecrans.md).
Les deux endroits où l'identité peut se mettre en travers de la route.

## Ce qu'il faut obtenir

Une voiture hors réseau démarre, affiche ses cadrans, fait du son, enregistre sa
trace et remplit sa file — exactement comme avant ce lot. L'identité n'ajoute
aucune attente, aucun écran, aucun refus.

C'est le ticket qui **vérifie**, réseau coupé, ce que les six précédents
promettent chacun de leur côté. La contrainte commande tout le lot ; elle mérite
d'être mesurée une fois pour de bon, d'un bout à l'autre.

## Ce à quoi il faut faire attention

- **La voiture est normalement hors réseau.** Ce n'est pas un cas dégradé, c'est
  le cas courant. Un chemin qui marche « sauf au premier lancement dans un
  tunnel » ne marche pas.
- **Couper le réseau n'est pas couper le serveur.** Les deux se comportent
  différemment — l'un échoue tout de suite, l'autre fait attendre. Il faut les
  deux : réseau coupé, et serveur injoignable mais réseau présent.
- **Un délai d'attente est un démarrage raté.** Même réussi au bout de dix
  secondes, un appel bloquant au démarrage est un défaut : on démarre la voiture
  et on part.
- **Le service worker sert la page**, et c'est lui qui rend le hors-réseau
  possible. Une réponse d'authentification mise en cache par erreur ferait croire
  à une session qui n'existe plus.
- **Le rejeu d'un trajet au bureau** passe par le même code. Il ne doit pas
  demander un compte pour relire une archive du disque.

## Critères d'acceptation

- [ ] Réseau coupé, l'application démarre, affiche, sonne et enregistre
- [ ] Serveur injoignable, même résultat, sans attente perceptible
- [ ] La file de dépôt garde et repart au retour du réseau
- [ ] Aucun appel au serveur n'est un préalable au démarrage — vérifié en lisant
      le réseau, pas en le supposant
- [ ] Le relecteur rouvre une archive du disque sans compte
