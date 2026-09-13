# 02 — Un compte se crée tout seul, et l'application démarre sans lui

**Statut :** ✅ fait — 13 septembre 2026, sauf l'essai réseau coupé, qui est le ticket 07

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

- [x] Au premier lancement, on conduit sans avoir rien créé ni saisi
- [x] L'application démarre et joue le son **sans attendre aucune réponse du
      serveur** — prouvé par un test ; *l'essai réseau réellement coupé est le
      ticket 07*
- [x] L'identité survit à une fermeture du navigateur
- [x] Hors réseau au premier lancement, l'application marche et prend son compte
      au retour du réseau — le branchement est en place et testé ; *l'essai
      complet est le ticket 07*
- [x] La remise à zéro des réglages ne déconnecte pas et ne perd pas l'identité

## Ce que l'essai a donné

**Le compte se prend tout seul, et une seule fois.** Vérifié dans un navigateur
contre le vrai serveur : `speed.identity.v1` est écrite au premier chargement, un
rechargement ne redemande rien, et la base ne porte qu'un compte anonyme et une
session.

**Un défaut attrapé en vérifiant pour de vrai, et pas par les tests.** La demande
de compte partait sans `Content-Type`, et le serveur rendait **415**. Le test
passait pourtant en vert : il construisait sa requête à la main, sans l'en-tête
`Content-Length: 0` que le navigateur ajoute de lui-même à un POST sans corps.
Les deux tests demandent désormais un compte **dans la forme que le navigateur
envoie**, et un troisième vérifie que le client l'envoie bien ainsi.

**Le nom du compte est en français.** La bibliothèque nomme « Anonymous » ce
qu'elle crée, et ce nom s'affiche.

**Il est devenu une étiquette tirée au sort** le 13 septembre 2026, au
ticket [16](16-s-approprier-son-compte.md) : `houle-paisible-47`,
`orme-diurne-19`. Le nom daté qui a précédé — `Appareil du 13/09/2026` — ne
disait que le jour, et tous les comptes ouverts le même jour le partageaient.
Le vocabulaire est sans accent, pour que l'étiquette se recopie telle quelle, et
ses adjectifs ne s'accordent pas en genre : le nom et l'adjectif étant tirés
séparément, un adjectif accordable produirait une faute un tirage sur deux.
C'est une étiquette et non une clé — elle n'ouvre rien.

**Le compte anonyme ne s'efface pas au rattachement d'une adresse.** C'était le
piège : la bibliothèque supprime le compte anonyme après un rattachement, et huit
tables pendent à `accounts` en cascade — cette suppression emporterait les
profils, les moteurs, les trajets et le profil mesuré. `disableDeleteAnonymousUser`
le coupe. Le test qui le couvre a été vérifié discriminant : sans ce réglage, il
échoue.

**La remise à zéro ne déconnecte pas, et c'était déjà vrai** : elle ne touche que
le profil actif. Mais le lot [REMISE-A-ZERO](../../REMISE-A-ZERO/spec.md), qui
n'est pas livré, énumère seize clés à effacer. Sa spécification porte désormais la
dix-septième et l'exclut, avec la raison.

### Le poids, mesuré

**+2 431 octets, soit 0,55 %** — 445 576 avant, 448 007 après. C'est le code qui
demande un compte et le range, et rien d'autre : l'application parle au serveur en
deux requêtes plutôt qu'en embarquant le client de la bibliothèque. Comprimé :
99,41 ko → 100,15 ko.

### Ce qui n'a pas pu être vérifié ici

**L'application démarrant réellement sans réseau.** Le navigateur de vérification
refuse d'enregistrer le service worker — l'erreur est « unknown error occurred
when fetching the script », et le serveur, lui, rend bien `/sw.js` en
`application/javascript`. Sans service worker, couper le serveur empêche la page
de se charger du tout, et l'essai ne conclurait rien. Ce que les tests prouvent :
le démarrage rend la main en moins de 50 ms même contre un serveur qui ne répond
jamais, rien n'est gardé hors réseau, et une identité déjà gardée reste intacte.
L'essai réseau coupé est le ticket 07, qui existe pour cela.
