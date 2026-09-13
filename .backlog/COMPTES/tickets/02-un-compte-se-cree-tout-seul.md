# 02 — Un compte se crée tout seul, et l'application démarre sans lui

**Statut :** ⬜ prêt

**Bloqué par :** [01 — Better Auth entre dans le serveur](01-better-auth-entre-dans-le-serveur.md).

## Ce qu'il faut obtenir

On monte dans la voiture et ça marche. Aucun écran d'inscription, rien à saisir :
l'appareil obtient une identité au premier contact avec le serveur, et la garde.

Et surtout : **l'application démarre sans elle**. Elle part de ce qu'elle a en
local, fait du son, et se présente au serveur quand le réseau revient. C'est
l'exigence qui commande tout le lot.

## Ce à quoi il faut faire attention

- **Jamais d'appel au serveur en préalable au démarrage.** C'est une décision
  d'architecture, pas une option de la bibliothèque. Une voiture qui attendrait
  une réponse avant d'afficher ses cadrans serait inutilisable là où elle roule.
- **Le compte survit au redémarrage du navigateur.** Il vit dans le stockage
  local, avec les préférences d'appareil, mais il n'en est pas une :
  [REMISE-A-ZERO](../../REMISE-A-ZERO/spec.md) remet les **réglages** à leurs
  valeurs d'usine et ne touche ni aux données ni à l'identité. Un bouton qui
  déconnecterait en remettant le volume à zéro serait un piège.
- **Un compte anonyme n'a rien à récupérer.** Vider le stockage local d'un
  appareil qui n'a rattaché aucune adresse, c'est perdre l'accès à ce qu'il avait
  déposé. Le dire à l'écran vaut mieux que le découvrir.
- **Deux appareils font deux comptes** tant que rien ne les relie. C'est le
  comportement attendu à ce ticket ; les réunir est le ticket 05.
- **Créer un compte à la main reste hors périmètre** : la spec le renvoie à une
  variable d'environnement, comme le compte semé au premier démarrage.

## Critères d'acceptation

- [ ] Au premier lancement, on conduit sans avoir rien créé ni saisi
- [ ] L'application démarre et joue le son **sans attendre aucune réponse du
      serveur** — vérifié réseau coupé
- [ ] L'identité survit à une fermeture du navigateur
- [ ] Hors réseau au premier lancement, l'application marche et prend son compte
      au retour du réseau
- [ ] La remise à zéro des réglages ne déconnecte pas et ne perd pas l'identité
