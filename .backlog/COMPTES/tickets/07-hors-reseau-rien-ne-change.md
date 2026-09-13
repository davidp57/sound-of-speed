# 07 — Hors réseau, rien ne change : vérifié réseau coupé

**Statut :** 🧑 attend David — 13 septembre 2026 : tout ce qui se mesure au poste est vert, un défaut réel a été corrigé, et le reste se voit en roulant

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

## Ce que la vérification a trouvé

**Un défaut réel, et c'est celui que ce ticket annonçait.** Le service worker
mettait en cache tout ce qui répondait 200 — son dernier cas était un
fourre-tout. Donc la session, les droits, les profils et la liste des trajets,
que le serveur déclare pourtant `no-store`. Deux conséquences, et la seconde est
la grave : une liste périmée resservie en croyant bien faire, et **une session
resservie alors qu'elle n'existe plus**.

Corrigé : ce qui appartient à un compte n'est plus intercepté du tout. Hors
réseau la requête échoue, et le client sait déjà traiter « sans réseau » — c'est
même ce sur quoi il est bâti.

**Le service worker n'avait aucun test**, alors que c'est la pièce qui fait
démarrer une voiture dans un tunnel. Il en a six, dont le repli de la page et
celui du relecteur. Vérifié qu'ils attrapent le défaut : sur l'ancien fichier,
trois échouent.

## Ce qui a été mesuré

Un serveur qui **sert la page et ne répond jamais** sur les chemins de données —
c'est le cas « serveur injoignable » que ce ticket distingue du réseau coupé :

| Ce qui a été mesuré | Résultat |
|---|---|
| Chargement de l'application, API pendantes | **51 ms**, cadrans et onglets affichés |
| Chargement du relecteur, API pendantes | **33 ms**, aucun compte demandé |
| État des requêtes au moment du rendu | `get-session` et `profil-voiture.json` **sans réponse** |
| La file de dépôt garde et repart | couvert par `core/upload/queue.test.ts` |

## Critères d'acceptation

- [x] Serveur injoignable, l'application démarre et affiche, sans attente
      perceptible
- [x] La file de dépôt garde et repart au retour du réseau
- [x] Aucun appel au serveur n'est un préalable au démarrage — vérifié en lisant
      le réseau, pas en le supposant
- [x] Le relecteur s'ouvre sans compte
- [ ] Réseau coupé, l'application démarre, affiche, **sonne et enregistre**

## Ce qui reste, et pourquoi

Le dernier critère demande un vrai navigateur, et il n'y en a pas ici : celui de
la fenêtre d'essai **refuse d'enregistrer un service worker** — le fichier est
pourtant servi en 200, c'est l'environnement qui l'interdit —, aucune instance
Chrome n'est connectée, et le Firefox de David ne se pilote pas. Sans service
worker, il n'y a pas de hors-réseau à observer : la page elle-même ne se charge
plus.

Deux autres choses ne se mesurent pas au poste : le **son**, qui sortirait sur
les enceintes du bureau, et l'**enregistrement**, qui demande un GPS que ce
navigateur refuse.

Ce qui reste à faire, et qui prend une minute en voiture : partir hors réseau,
ouvrir l'application, vérifier qu'elle démarre, qu'elle sonne et qu'elle
enregistre. Le journal du trajet dira le reste — il porte désormais la chaîne
d'agent du navigateur, ce qui confirmera ou non la détection d'appareil.
