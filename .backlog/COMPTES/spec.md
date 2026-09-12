# COMPTES — un compte porte des droits, et ce qu'il ouvre décide de ce qu'on voit

**Statut :** ⬜ prêt
**Branche :** plusieurs
**Version visée :** 0.5
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [SERVEUR](../SERVEUR/spec.md) — le schéma porte déjà les
comptes et les droits ; ce lot les ouvre.

## Ce qu'il faut obtenir

On monte dans la voiture et ça marche, sans compte à créer. Une adresse se
rattache le jour où elle sert. Et ce qu'un compte ouvre décide des écrans qu'il
voit.

## Ce qu'on construit

### Un compte anonyme d'abord

Il se crée tout seul au premier lancement et reste anonyme tant que ça suffit.
C'est ce qui garde l'entrée sans friction, et ce qui n'impose rien à celui qui
déploie chez lui tant que personne ne rattache d'adresse.

### Une adresse quand elle sert

Une adresse — ou un compte tiers — se rattache le jour où l'on donne, où l'on
achète un droit, ou simplement pour ne pas perdre ses réglages en changeant de
téléphone. Jamais avant.

### Une seule application, dont le compte ouvre les écrans

Les trois constructions séparées prévues par [REFONTE](../REFONTE/spec.md) sont
abandonnées. Un compte porte des droits : la conduite pour un invité, les
réglages pour qui bricole, le banc pour qui fabrique des moteurs.

[MENAGE-UI](../MENAGE-UI/spec.md) n'est donc plus une séparation à la
fabrication mais une affaire de droits, et ses décisions sur ce qui reste
réglable au volant tiennent.

Le coût est connu : la voiture reçoit du code qu'elle n'utilisera pas. **Le
chargement à la demande** ramène ce coût près de zéro, au prix d'un découpage —
et il doit être mesuré, pas supposé, sur une application qui doit se charger
hors réseau.

### Les droits sont modélisés, rien n'est encaissé

La base porte la notion de droit — ce qu'il ouvre, jusqu'à quand — et le code la
lit là où il faudra. Mais tout le monde a tout, gratuitement, et aucun
encaissement n'est branché. Le jour de l'ouverture, brancher un fournisseur de
paiement et changer une valeur par défaut suffit.

### Better Auth, et l'exigence qui la borne

[Better Auth](https://better-auth.com/) est sous MIT, donc combinable avec
l'AGPL. C'est une bibliothèque qui vit dans le code de l'application, et non un
service à déployer à côté — c'est ce qui la fait préférer à PocketBase, qui
ajoutait un second moteur en Go avec ses règles dans son propre langage.

**La contrainte qui commande tout ce lot : la voiture est normalement hors
réseau.** Vérifié le 12 septembre 2026 — le cache de session de Better Auth peut
être un jeton signé, vérifiable localement sans base, et le rafraîchissement
automatique peut être coupé. Mais cela ne règle que « qui je suis ». Le vrai
sujet est que **l'application ne doit jamais faire d'un appel au serveur un
préalable au démarrage** : elle part de ce qu'elle a en local et se synchronise
au retour du réseau. C'est une décision d'architecture, pas une option à cocher
dans une bibliothèque.

Un droit payé devra fonctionner hors réseau pour la même raison : il prendra la
forme d'une preuve datée, mise en cache, qui expire. Elle est contournable par
qui veut — le code est public — et c'est assumé : l'objectif est de ne pas
perdre d'argent, pas d'en gagner.

## Ce qu'on ne construit pas

- **Encaisser de l'argent.** Les droits sont modélisés, le paiement ne l'est pas.
- **Des rôles fins.** Trois usages suffisent : conduire, régler, fabriquer.
- **Une administration.** Créer un compte à la main se fait par variable
  d'environnement, comme le premier compte.

## Critères d'acceptation

- [ ] Au premier lancement, on conduit sans avoir rien créé ni saisi
- [ ] Rattacher une adresse à un compte anonyme conserve tout ce qu'il porte
- [ ] Un compte sans réseau ouvre l'application et joue le son, sans attendre
      aucune réponse du serveur — vérifié réseau coupé
- [ ] Les écrans ouverts dépendent des droits du compte, sans reconstruire
      d'image
- [ ] Le poids chargé par la voiture est **mesuré** avant et après le découpage
- [ ] La base porte les droits, et un droit expiré referme ce qu'il ouvrait
- [ ] Celui qui déploie chez lui n'a aucune adresse à donner ni service tiers à
      configurer
