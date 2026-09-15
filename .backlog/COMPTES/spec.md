# COMPTES — un compte porte des droits, et ce qu'il ouvre décide de ce qu'on voit

**Statut :** 🔄 en cours — 18/20
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
fabrication. Sa spec refaite le 14 septembre 2026 précise la suite : le droit
n'ouvre que l'atelier, et ce qui sépare conduire de régler est d'être à
l'arrêt.

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

## Les tickets

Découpés le 13 septembre 2026, et repris le soir même — voir les décisions
ci-dessous. Un seul démarre tout de suite : la bibliothèque
doit exister avant qu'on parle d'identité. Les deux derniers vérifient — hors
réseau, et le poids — ce que les six premiers promettent chacun de leur côté.

| | Sujet | Bloqué par |
|---|---|---|
| [01](tickets/01-better-auth-entre-dans-le-serveur.md) ✅ | Better Auth entre dans le serveur, sans rien casser | — |
| [02](tickets/02-un-compte-se-cree-tout-seul.md) ✅ | Un compte se crée tout seul, et l'application démarre sans lui | 01 |
| [03](tickets/03-ce-que-porte-solo-change-de-mains.md) ✅ | Ce que porte `solo` devient celui du premier compte | 02 |
| [04](tickets/04-la-voiture-depose-avec-son-compte.md) ✅ | La voiture dépose avec son compte, et le mot de passe partagé s'efface | 02, 03 |
| [05](tickets/05-relier-un-appareil-par-un-code.md) ✅ | Un jeton de liaison, deux rendus : un code à scanner et un code court à taper | 02 |
| [10](tickets/10-l-ecran-du-compte.md) ✅ | L'écran du compte : le lieu unique où tout se passe | 05 |
| [11](tickets/11-un-vrai-compte.md) ✅ | Un vrai compte : une adresse et un mot de passe, choisis depuis un clavier | 10 |
| [12](tickets/12-un-compte-tiers.md) ✅ | Un compte tenu ailleurs, et seulement s'il est configuré | 11 |
| [13](tickets/13-tenir-son-compte.md) ✅ | Tenir son compte : changer, oublier, emporter, supprimer | 11 |
| [06](tickets/06-les-droits-ouvrent-les-ecrans.md) ✅ | Les rôles ouvrent les écrans, et un droit expiré les referme | 02 |
| [14](tickets/14-l-appareil-porte-les-fonctions.md) ✅ | L'appareil porte les fonctions, et le drapeau de construction s'en va | 06 |
| [07](tickets/07-hors-reseau-rien-ne-change.md) | Hors réseau, rien ne change : vérifié réseau coupé | 04, 06 |
| [08](tickets/08-le-poids-charge-par-la-voiture.md) ✅ | Le poids chargé par la voiture, mesuré avant et après | 06, 14 |
| [15](tickets/15-le-navigateur-se-dit-dans-le-journal.md) ✅ | Le navigateur se dit dans le journal, une fois par session | 14 |
| [19](tickets/19-le-compte-tiers-ne-se-dit-pas-a-l-ecran.md) | Un compte tiers rattaché continue de s'annoncer comme anonyme — vu le 14 septembre 2026 | — |
| [20](tickets/20-l-ecran-du-compte-cache-ce-qu-on-vient-y-faire.md) | L'écran du compte cache ce qu'on vient y faire : se connecter à son compte existant est replié tout en bas | — |

Le [ticket 09](tickets/09-reprendre-son-compte.md) est **remplacé** par les
tickets 10 à 13 : voir l'élargissement ci-dessous.

**Quatre points tranchés par David le 13 septembre 2026**, à l'ouverture du
découpage :

1. **Une seule table d'identité, et c'est `accounts`** : la bibliothèque s'y
   accroche par `modelName` et `fields` plutôt que d'imposer la sienne. Six
   tables y pendent par clé étrangère, et SQLite ne déplace pas une clé
   étrangère — il refait la table.
2. **La remise à zéro ne touche pas l'identité.** Ce bouton remet les *réglages*
   de l'application de la voiture à leurs valeurs d'usine ; il n'efface ni les
   données ni les comptes.
3. **Un second appareil ne se devine pas.** Rien ne distingue « le second
   appareil de quelqu'un » du « premier appareil de quelqu'un d'autre » : un
   appareil neuf crée toujours son compte anonyme, et c'est la connexion, geste
   explicite, qui relie. Reste à décider ce qu'on fait de ce qu'il portait avant.
4. **`htpasswd` part s'il ne sert plus à rien**, et les six endroits qui le
   connaissent se vérifient avant de le retirer.

**Cinq points de plus, tranchés le soir du 13 septembre 2026**, après quatre
questions de David sur ce que l'identité recouvre vraiment :

5. **Le code à scanner passe devant l'adresse.** Le découpage initial n'avait
   retenu que « on saisit une adresse », alors que
   [REFONTE](../REFONTE/spec.md) portait déjà les récits 36 et 37 : *rattacher un
   appareil en scannant un code affiché par un autre, parce que taper un jeton sur
   l'écran d'une voiture est pénible*, et *en saisissant un code court quand
   l'appareil n'a pas de caméra*. Relier deux appareils qu'on possède et reprendre
   un compte perdu sont **deux besoins distincts** : ils font désormais deux
   tickets, le 05 et le 09, dans cet ordre.
6. **Rien ne s'affiche au premier lancement.** Une fenêtre proposant de saisir une
   adresse ou de scanner un code au premier démarrage serait l'écran d'inscription
   que ce lot supprime — et elle tomberait au moment où l'on veut juste rouler.
   Les deux voies vivent dans l'écran de configuration ; une bannière escamotable
   les rappelle une fois.
7. **Le compte anonyme sert de jeton.** L'adresse que la bibliothèque lui fabrique
   sous `.invalid` plus un mot de passe posé par le serveur font un identifiant
   complet, sans envoyer le moindre courriel. Vérifié sur le vrai serveur.
8. **Un compte, une voiture — limite assumée.** `measured_cars` a `account_id`
   pour clé primaire : **un seul profil mesuré par compte**. Un téléphone dans la
   même voiture ne pose rien, un poste de bureau non plus. Deux voitures sous un
   même compte mélangeraient leurs cumuls, et rendraient une reprise et un
   freinage moyens qui ne décrivent ni l'une ni l'autre. On n'y touche pas ici :
   le rendre multi-voitures toucherait le profil mesuré, l'étalonnage et les
   écrans, ce qui n'a rien à faire dans un lot sur l'identité.
9. **La connexion par compte tiers vient en plus de l'adresse et du mot de
   passe**, jamais à la place. La recommandation inverse tenait sur une
   présomption — « personne n'est sans compte tiers » — que David a écartée : il y
   en a, et d'autres ne veulent pas s'en servir pour se connecter ailleurs. Se
   connecter avec son compte **Tesla** est à essayer : ça existe, c'est le
   fournisseur dont le compte correspond à la personne assise dans la voiture, et
   ce qui reste à vérifier est l'approbation de l'application côté Tesla.
10. **Ce qui identifie un appareil n'est pas l'appareil.** Il n'y a ni identifiant
   de navigateur ni empreinte : l'identifiant est produit par le serveur, et ce
   qui « reconnaît » l'appareil, c'est son navigateur qui se souvient — un témoin
   de connexion fermé au code de la page, valable un an, et une entrée de stockage
   local qui n'ouvre rien. Deux navigateurs sur la même machine font donc deux
   comptes.

## L'élargissement du 13 septembre 2026 : un écran pour les comptes

Le ticket 05 livré, David a demandé ce que porte le code à scanner, et ce qui se
passe sur un poste de travail **sans caméra**. Deux constats en sont sortis.

**Le premier est technique, et il défait une partie du 05.** La bibliothèque
d'identité ne garde qu'une preuve « mot de passe » par compte. Le code de
liaison, tel qu'il a été livré, **remplace** ce mot de passe — donc afficher un
code effacerait celui que l'on aurait choisi, dès que choisir un mot de passe
devient possible. La conséquence est nette : **le code à scanner et le code court
sont la même chose**, un jeton de liaison à usage unique, avec deux rendus. Un
lien, ou huit caractères à taper. Le mot de passe machine disparaît, et avec lui
l'effet de bord sur `is_anonymous`.

**Le second est un élargissement de périmètre**, et il tient en une idée : le
chemin normal va de la voiture au poste de travail. On relie le poste par un
code, et c'est **là**, sur un vrai clavier, qu'on se fabrique un vrai compte. La
voiture n'est pas un endroit où taper une adresse.

D'où un **écran dédié aux comptes**, qui porte tout : afficher un code à scanner,
afficher un code court, saisir un code court, se connecter avec une adresse,
créer un vrai compte, changer de mot de passe, « j'ai oublié », emporter ses
données, supprimer son compte.

**Quatre points tranchés par David le 13 septembre 2026 :**

11. **L'écran du compte est un onglet de la barre**, à côté d'Étalonnage — pas
    une vue par-dessus, pas une section de Configuration. Le ticket 06 décidera
    ensuite s'il se montre au volant.
12. **Le jeton d'abord, l'écran ensuite.** L'écran a besoin du code court pour
    avoir quelque chose à montrer.
13. **Le compte tenu ailleurs vient après** les tickets 10, 11 et 13 : c'est le
    seul morceau qui dépend d'un tiers et d'une configuration que personne n'a
    par défaut.
14. **Supprimer son compte emporte tout** — profils, moteurs, boîtes, trajets,
    profil mesuré —, avec une confirmation en deux temps, et **une option pour
    emporter ses données d'abord** : un fichier à télécharger, ou un envoi par
    courriel quand un relais est configuré. Le navigateur de la voiture refuse
    les téléchargements : sur la voiture, sans relais, l'écran doit le dire au
    lieu de proposer un bouton qui ne fait rien.

## Le recadrage du 13 septembre 2026 : deux axes, pas un

Le ticket 06 allait être écrit sur un seul axe — le compte porte des droits, les
droits ouvrent les écrans. David l'a arrêté : **ce qu'un écran demande tient sur
deux axes indépendants**, et ils se croisent par un et.

**L'appareil** dit quelles fonctions ont un sens là où l'on est. En voiture, on
conduit, on tient son compte simplement et on touche à quelques réglages. Sur un
téléphone, on ajoute le banc et on ouvre plus de réglages. Sur un poste de
travail, on ajoute l'atelier et la synthèse.

**Le rôle** dit ce que la personne a le droit d'ouvrir : `conduite` — conduire,
la télémétrie, les réglages, l'étalonnage, le banc —, `atelier` — fabriquer des
moteurs —, `synthese` — régler un timbre.

Six points tranchés dans la foulée :

15. **Le rôle se défend, l'appareil non.** Un navigateur peut mentir sur ce
    qu'il est : l'axe appareil reste un confort d'affichage, local, que le
    serveur ignore. Le rôle vit dans `rights`, et le serveur refuse ce qu'il
    n'ouvre pas. Le ticket 06 porte le premier axe, le ticket 14 le second.
16. **L'appareil se devine et se corrige.** La détection par chaîne d'agent est
    un pari qui vieillit mal, et un poste posé dans la voiture n'entre dans
    aucune case : l'écran du compte laisse changer ce choix, qui reste local.
17. **La télémétrie reste en voiture.** C'est un écran de lecture, pas de
    réglage, et c'est là qu'on voit ce que le son suit.
18. **L'étalonnage sort de la voiture.** Il se fait tout seul depuis les traces ;
    le panneau manuel est un reste, et ATELIER prévoyait déjà son retrait.
19. **Les rôles se cumulent.** Un compte en porte zéro à trois, une ligne par
    rôle : c'est la forme de la table, et c'est ce qui permet « atelier sans
    synthèse ».
20. **La profondeur des réglages reste à MENAGE-UI.** « Simple », « étendu » et
    « tout » désignent le tri des cent cinquante-huit réglages de Configuration,
    qui a son classeur et son lot. Les tickets 06 et 14 ouvrent et ferment des
    écrans entiers.
