# ACCUEILLIR — l'écran d'aide du premier lancement, revu

**Statut :** 🧑 attend David — 5/5 livrés le 14 septembre 2026, reste l'essai au
volant
**Branche :** `feature/accueillir` (PR #171) et `fix/textes-accueil` (PR #172),
mergées dans `develop`
**Version visée :** 0.2.48

## Ce que David demande

Revoir l'écran d'aide montré au premier lancement, pour le rendre **plus clair**,
et pour que **les informations sur le compte soient évidentes : en premier, en
gros, claires**.

Le 14 septembre 2026, en instruisant le lot, il l'a élargi d'un cran : l'écrit
n'est qu'une étape, il faut aussi **montrer l'écran principal**. Sa proposition —
des **bulles fléchées** posées sur l'interface, comme dans une bande dessinée,
qui désignent les boutons de conduite et les onglets. Et, en passant, une
remarque sur la barre du haut : des onglets seraient plus clairs que des boutons.

## Ce que l'écran est aujourd'hui

Onze sections, deux cent soixante-dix-huit lignes, dans cet ordre : pour
commencer, les commandes de conduite, la vitesse reste à zéro, le son est trop
faible, en roulant, partir sans réseau, créer sa propre voiture, régler le son,
l'écran Télémétrie, code source et licence, et — **en dernier** — « Ce compte est
le vôtre ».

**Le compte est arrivé là le 13 septembre 2026**, au ticket 16 de
[COMPTES](../COMPTES/spec.md), et il a été mis à la fin. C'est exactement
l'inverse de ce qui est demandé ici : la section existe, elle est juste au
mauvais endroit et de la mauvaise taille.

**Le compte est déjà rappelé ailleurs**, et ce lot ne le défait pas : une
bannière revient à la deuxième ouverture, puis toutes les dix, tant que le compte
n'est pas enregistré (`App.vue`, `signalerLeCompte`). Elle porte le rappel *plus
tard* ; l'accueil porte le fait *tout de suite*. Les deux disent la même chose à
deux moments, et c'est voulu.

## Ce qui est tranché

Instruit avec David le 14 septembre 2026.

### a. Deux écrans, pas un

L'aide sert deux usages qui n'ont rien en commun : **accueillir** quelqu'un qui
ouvre l'application pour la première fois, et **répondre** à une question qu'on
se pose plus tard. Ils se séparent.

- Un écran d'**accueil**, court, montré une seule fois au premier lancement.
- Une **aide de référence**, complète, derrière le bouton `?`.

Le coût est connu et accepté : deux textes à tenir. Ils ne disent presque rien en
commun, ce qui limite la divergence.

### b. Ce que le compte dit en tête de l'accueil

Trois phrases, en gros, et un bouton qui mène à l'écran Compte :

> Vous avez déjà un compte. Il s'est créé tout seul, et c'est lui qui portera vos
> réglages, vos moteurs et vos trajets — il n'y a rien à saisir pour rouler. Tant
> qu'il n'est pas enregistré, il ne tient qu'à ce navigateur.

Le fait, le bénéfice, le risque. Court, donc lisible en gros corps.

### c. Une visite guidée à bulles, sur la vraie interface

Des bulles fléchées se posent **sur l'écran réel**, ancrées à des éléments
marqués dans le code, leur position lue au moment de l'affichage.

C'est la variante qui ne peut pas diverger de l'interface : une bulle dont la
cible n'est pas là — un onglet fermé par les droits, un verrou d'écran que le
navigateur ne supporte pas — se saute toute seule. Cela compte ici, puisque les
onglets dépendent du rôle du compte et de l'appareil.

Écarté : un schéma dessiné de l'écran. Il montrerait six onglets là où la voiture
en a quatre, et se périmerait sans que rien ne le signale.

Le coût est une mesure à refaire au redimensionnement, et quand la barre du haut
se replie sur deux lignes.

### d. De vrais onglets, avec une découpe

Les six entrées de navigation sont déjà des onglets au sens du balisage —
`<nav class="tabs">`, `aria-pressed`, l'actif plein couleur d'accent. Le défaut
est ailleurs : **elles ont exactement le même dessin que les boutons qui
agissent**, `Plein écran` et `?` compris, à quelques pixels de là. Rien ne dit
lequel navigue et lequel agit.

Elles prennent donc une forme d'onglet **découpée** : l'onglet actif se raccorde
au contenu, les autres restent en retrait, et les commandes de droite gardent
leur boîte. La zone tactile ne rétrécit pas — c'est un écran de voiture.

### e. Au volant

Le premier lancement a de bonnes chances d'arriver dans la voiture, où l'on ne
s'enregistre pas. La troisième phrase du bloc compte y change : elle propose de
**se donner un code** et d'ouvrir l'application sur un ordinateur, comme le fait
déjà l'écran Compte. La visite, elle, est la même — elle est encore plus utile en
voiture qu'ailleurs.

## Ce qui est tranché en écrivant le découpage

Ces points n'ont pas été soumis à David : ils découlent de ce qui précède et
n'ouvraient pas de vraie alternative. Ils sont écrits pour qu'on puisse les
contester.

- **La visite se passe et se rejoue.** Un bouton « Passer » à tout moment, et un
  lien « revoir la visite » dans l'aide de référence. Une visite qu'on ne peut
  pas quitter est une visite qu'on subit.
- **L'offre de source AGPL-3.0 reste dans l'aide de référence**, toujours joignable
  par le `?`, et l'accueil en porte une ligne en pied avec le lien et la version.
  La licence demande que la source soit offerte à qui se sert du programme à
  distance ; la porter aux deux endroits ne coûte rien et ne se discute pas.
- **L'aide de référence perd ce que la visite montre** — les commandes de
  conduite — et garde ce qui répond à une question : la vitesse reste à zéro, le
  son trop faible, hors réseau, créer un profil, régler le son, la télémétrie.

## Ce qui est déjà établi, et n'est pas à refaire

- L'aide s'affiche d'office au premier lancement et se rappelle par le bouton
  `?` ; la clé `speed.helpSeen.v1` tient ce « une seule fois ».
- Le formulaire d'enregistrement vit dans l'écran Compte **et nulle part
  ailleurs** — tranché le 13 septembre 2026 : deux copies divergeraient. L'accueil
  renvoie, il ne duplique pas.
- **La règle « aucune animation » tient.** Les bulles apparaissent et
  disparaissent, elles ne se déplacent pas et ne se fondent pas. La règle n'a pas
  d'exception, et ce lot n'en demande pas.

## Les tickets

| # | Ticket | Statut |
|---|--------|--------|
| 01 | [Un écran d'accueil, le compte en tête](tickets/01-un-ecran-d-accueil.md) | ✅ |
| 02 | [Des bulles posées sur la vraie interface](tickets/02-des-bulles-sur-l-interface.md) | ✅ |
| 03 | [De vrais onglets, avec une découpe](tickets/03-de-vrais-onglets.md) | ✅ |
| 04 | [La visite désigne la barre du haut](tickets/04-la-visite-designe-la-barre.md) | ✅ |
| 05 | [L'aide de référence, allégée](tickets/05-l-aide-de-reference-allegee.md) | ✅ |

## Ce qui reste

Deux choses ne se jugent que dans la voiture :

- **La face « au volant » de l'accueil** — la troisième phrase du bloc compte,
  qui propose le code au lieu de l'enregistrement. Elle dépend de l'appareil
  détecté, et c'est là-bas qu'on voit si elle tombe juste.
- **Le placement des bulles sur l'écran de la Tesla.** Elles sont mesurées à
  1280 et à 375 pixels au bureau ; le zoom du navigateur de bord n'est pas
  réglable et sa valeur par défaut a changé avec le logiciel de la voiture. Une
  bulle qui déborde ne se verrait qu'à l'usage.
