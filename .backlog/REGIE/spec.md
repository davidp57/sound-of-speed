# RÉGIE — administrer les comptes depuis un écran

**Statut :** ⬜ prêt — cadre posé le 15 septembre 2026, instruit et spécifié le
même jour, pas encore découpé
**Branche :** `feature/regie`
**Version visée :** à décider au moment de la release

## Ce qu'il faut obtenir

Une page d'administration où l'on voit les comptes, où l'on donne et reprend un
rôle, où l'on accorde une banque réservée, où l'on pose un plafond de volume et
où l'on efface un compte — sans redéployer le serveur.

Et, quand quelqu'un signale un défaut, de quoi regarder ce que son compte porte,
**après qu'il l'a autorisé depuis son propre écran**, pour une durée qui expire
toute seule.

## Le problème

Le lot [DURCIR](../DURCIR/spec.md) a posé les contrôles côté serveur et les a
réglés par la configuration : quel compte a quel rôle, quelle adresse peut jouer
une banque réservée. C'est ce qu'il y a de plus sûr — aucune route ne peut
accorder un droit, donc aucune route ne peut le donner par erreur.

Mais ça ne se tient pas à l'usage. Changer un droit demande de modifier une
variable dans Portainer et de redéployer la pile. David, le 15 septembre 2026 :
il faut un écran d'administration, un rôle d'administrateur, de quoi attribuer
les rôles et les banques, et les plafonds plus tard.

Il y a un second manque, découvert en instruisant le premier. Quand un
conducteur dit « ça ne marche pas », le serveur ne sait lire que le compte de la
session en cours : il n'existe aucun moyen de regarder ce qu'un autre compte
porte. La seule sortie est de lui demander d'exporter son archive et de
l'envoyer — ce qui lui livre tout, sans durée et sans trace.

## Ce qu'on construit

### La porte : une liste d'adresses dans la configuration

Le serveur lit une liste d'adresses de courrier dans son environnement. Un
compte dont l'adresse y figure est administrateur ; tous les autres ne le sont
pas. La comparaison se fait en minuscules, sur l'adresse enregistrée du compte.

**Aucune route n'accorde ni ne retire l'administration.** C'est ce qui rend
l'écran sûr : même un défaut dans la régie ne peut pas fabriquer un
administrateur. C'est le même principe que la liste des banques réservées, qui
vit déjà dans l'environnement.

Conséquence assumée : un compte sans adresse enregistrée ne peut pas être
administrateur. C'est déjà vrai pour les banques réservées.

La variable est déclarée dans le fichier de composition de la pile, à côté de
celles des banques et des fournisseurs — faute de quoi elle n'est pas modifiable
depuis Portainer. La variable des rôles offerts, elle, ne l'est toujours pas ;
ce lot la déclare aussi.

### La page : une troisième entrée, comme le relecteur

La construction produit déjà deux pages : l'application et le relecteur. Le
commentaire qui les sépare dit pourquoi — « c'est ce qui garde le relecteur hors
de la voiture ». La régie prend une troisième entrée, pour la même raison : son
code n'a aucune raison d'être téléchargé par une application qui doit se charger
hors réseau.

Elle ne partage pas l'état de l'application. Elle n'a besoin que du témoin de
session, que le navigateur envoie tout seul.

### Ce que voit quelqu'un qui n'est pas administrateur

**404**, sur toutes les routes de régie, et une page qui n'annonce rien.

Le dépôt a deux façons de refuser et elles ne disent pas la même chose : une
route gardée par un rôle rend 403 avec le motif, une banque réservée rend 404
parce que « l'existence d'une banque ne doit pas fuir plus que son contenu ». La
régie suit la banque réservée : c'est le cas le plus proche — quelque chose
auquel presque personne n'a droit.

Ce n'est pas une protection : l'adresse se trouve, et c'est le contrôle serveur
qui garde. Ça retire seulement une carte à qui cherche.

### La liste des comptes

Un compte par ligne, **les derniers créés en haut**, avec une recherche par nom
ou par adresse. Chaque ligne donne le nom, l'adresse, la date de création, les
rôles et le poids déposé.

Le serveur sait déjà tout fournir : lister les comptes, les peser, lire leurs
droits.

### La fiche d'un compte

Elle montre **tout ce que le serveur sait** : identité, adresse, portrait,
anonyme ou non, date de création, fournisseurs rattachés, sessions ouvertes,
rôles, banques accordées, plafond, et le détail de ce que le compte porte —
combien de profils, de moteurs, de boîtes, de dépôts, combien d'octets, combien
de trajets mesurés.

Elle ne montre **pas** le contenu déposé : ni un nom de profil, ni une date de
trajet, ni un fichier. Ça, c'est derrière l'accord.

Depuis la fiche, l'administrateur peut :

- donner et reprendre chacun des trois rôles ;
- accorder et retirer une banque réservée ;
- poser un plafond de volume particulier, ou revenir au plafond commun ;
- forcer un passage de rétention sur ce compte ;
- régler l'abandon de ce compte ;
- effacer le compte.

Les deux avant-derniers n'inventent rien : ils avancent une horloge qui tourne
déjà, avec des règles écrites et testées. Le verdict de rétention se lit avant
d'agir — le serveur sait déjà dire ce qui serait effacé et ce qui serait retenu.

### L'effacement d'un compte

Une confirmation, et c'est fait. Pas de délai de grâce, pas de nom à recopier :
le bouton de l'utilisateur sur son propre écran est déjà immédiat, et on ne
fabrique pas un second comportement pour le même mot.

**La ligne de trace s'écrit avant l'effacement**, sinon la cascade l'emporte.

L'administrateur n'a aucune exception sur son propre compte : il peut y faire ce
qu'il fait sur les autres. La seule chose qu'il ne peut pas, c'est se retirer
l'administration — elle vient de la configuration.

### L'accord du conducteur

**Il n'y a aucun canal de demande.** Le serveur ne sait pas parler à une voiture
— pas de sondage, pas de connexion ouverte, les rôles sont relevés une fois au
démarrage — et la voiture roule souvent hors réseau. Construire ce canal
coûterait du trafic permanent dans l'application qui en veut le moins.

Donc : on demande de vive voix, et le conducteur ouvre son écran de compte, où
une section « autoriser l'assistance » attend.

**Un seul interrupteur, tout ou rien.** Pas de crans par nature de donnée :
celui qui accorde n'a alors aucun choix à faire, donc aucun mauvais choix à
faire.

**L'accord est une date d'échéance en base, et rien d'autre.** Elle vaut
24 heures par défaut. Le droit de lire tombe dès qu'elle est dépassée, sans
qu'aucun passage périodique n'ait à s'exécuter. **Pas de date, pas de droit** :
c'est l'absence qui est l'état normal.

Le conducteur voit en clair jusqu'à quand c'est ouvert, et peut refermer avant
l'échéance.

### Par où la régie lit les données

**Des routes de régie dédiées, en lecture seule.** Elles prennent l'identifiant
du compte visé, vérifient l'administrateur **et** l'accord non échu, et ne
savent que lire.

La régie n'emprunte **jamais** l'identité de quelqu'un. Une session empruntée
serait une session complète, donc en écriture : la régie pourrait alors modifier
ou effacer en se faisant passer pour le conducteur, et la trace attribuerait ces
gestes au conducteur. La séparation est structurelle, pas une discipline.

L'archive du compte n'est pas la porte non plus. Elle n'exige aujourd'hui aucun
rôle, délibérément — « ce sont ses données » — et l'ouvrir à l'administrateur en
ferait la porte dérobée qui contourne l'accord.

### Les banques réservées : le drapeau dehors, les accords en base

Aujourd'hui, deux variables d'environnement : quels dossiers sont réservés, et
qui y a droit — **par adresse de courrier**.

Ce qui change :

- **Le drapeau reste dans l'environnement.** C'est la défaillance qui décide :
  si une table de drapeaux est vide — base neuve, migration ratée — toutes les
  banques deviennent libres. C'est exactement le trou que DURCIR vient de
  fermer. Une variable, elle, est déclarée dans la composition de la pile et
  suit le déploiement.
- **Les accords passent en base, par identifiant de compte**, écrits par
  l'écran. Une table d'accords vide ne fait que refuser.
- **La variable d'accords reste et se cumule** avec la table, comme la variable
  des rôles offerts se cumule déjà avec la table des droits. C'est la façon de
  faire sans écran, et le code le dit déjà en commentaire.

Passer de l'adresse au compte lève une conséquence acquise : un compte sans
adresse pourra désormais avoir droit à une banque réservée. C'est voulu — le
compte est la bonne unité, l'adresse était un pis-aller.

### Le plafond de volume

Un plafond commun dans la configuration, surchargeable par compte depuis
l'écran. Un compte neuf est donc borné dès sa création sans que personne ait
rien à faire — et c'est le cas qui compte, puisque le risque est une voiture qui
boucle, pas un compte connu.

**Le plafond refuse un envoi. Il n'efface jamais rien.** Le comportement est
celui que DURCIR a déjà tranché : un refus avec un code que le client ne rejoue
pas, un écran qui dit quoi faire — emporter, effacer — et une ligne dans le
journal du serveur. La borne par requête, à 16 Mio, ne change pas ; celle-ci
porte sur le total déposé par le compte.

**La valeur par défaut est un nombre rond, proposé et non mesuré : 10 Gio.**
DURCIR écarte en principe le seuil inventé, parce qu'un seuil inventé « refuse
ou efface des données sans que rien ne rougisse ». Ici il ne peut que refuser,
et la valeur se règle sans reconstruire l'image. Elle sera revue quand le
ticket 04 de DURCIR aura livré sa ligne de dépense quotidienne. Le chiffre est
annoncé comme proposé, à la façon des délais de rétention.

### La trace

Chaque geste d'administration écrit une ligne : quand, quel administrateur, quel
compte, quoi. Y compris la consultation de données sous accord.

Elle est lisible **dans la régie et sur l'écran du compte concerné**. C'est ce
qui rend l'accord sérieux au lieu d'être une case à cocher : celui qui autorise
peut voir ce qu'on en a fait.

Elle se garde **sans limite** — quelques dizaines de lignes par an, et son
intérêt est justement de retrouver tard qui a effacé un compte. Mais quand un
compte est effacé, ses lignes gardent l'identifiant opaque et **perdent le nom
et l'adresse** : la trace dit toujours qu'un compte a été effacé, par qui et
quand, sans conserver l'identité de quelqu'un qu'on vient d'effacer. Le dépôt
sait déjà faire ça, c'est la raison d'être des identifiants opaques de
DURCIR 03.

### Deux pièges de schéma, relevés avant d'écrire

1. **Toutes les tables liées sont en effacement en cascade sur le compte.** La
   table de trace doit donc porter l'identifiant **en clair, sans clé
   étrangère** — sinon la seule ligne qu'on voudra retrouver est précisément
   celle que l'effacement emporte.
2. **Deux colonnes se ressemblent et disent le contraire.** Dans la table des
   droits, une échéance nulle veut dire « sans échéance » ; dans l'accord, une
   date nulle veut dire « aucun droit ». Ne pas copier l'une pour écrire
   l'autre.

## Les histoires d'usage

1. En tant qu'exploitant du serveur, je veux désigner l'administrateur par une
   variable de la pile, afin qu'aucune route ne puisse fabriquer un
   administrateur.
2. En tant qu'exploitant, je veux que cette variable soit déclarée dans la
   composition de la pile, afin de la modifier depuis Portainer sans toucher au
   dépôt.
3. En tant qu'administrateur, je veux ouvrir une page dédiée, afin de ne pas
   alourdir l'application que la voiture télécharge.
4. En tant qu'administrateur, je veux voir la liste des comptes avec les
   derniers arrivés en haut, afin de trouver tout de suite celui qui vient de se
   créer.
5. En tant qu'administrateur, je veux chercher un compte par son nom ou son
   adresse, afin de le retrouver quand la liste s'allonge.
6. En tant qu'administrateur, je veux voir le poids déposé de chaque compte,
   afin de repérer celui qui fait grossir le serveur.
7. En tant qu'administrateur, je veux ouvrir la fiche d'un compte, afin de voir
   d'un coup ce que le serveur sait de lui.
8. En tant qu'administrateur, je veux donner un rôle à un compte, afin de lui
   ouvrir un écran sans redéployer.
9. En tant qu'administrateur, je veux reprendre un rôle, afin de refermer ce que
   j'ai ouvert.
10. En tant qu'administrateur, je veux accorder une banque réservée à un compte,
    afin qu'il puisse l'écouter.
11. En tant qu'administrateur, je veux retirer cet accord, afin qu'il cesse de
    pouvoir l'écouter.
12. En tant qu'administrateur, je veux poser un plafond particulier sur un
    compte, afin de laisser plus de place à celui qui en a besoin.
13. En tant qu'administrateur, je veux revenir au plafond commun, afin de ne pas
    laisser traîner une exception oubliée.
14. En tant qu'administrateur, je veux forcer un passage de rétention sur un
    compte, afin de libérer de la place sans attendre le lendemain.
15. En tant qu'administrateur, je veux lire le verdict avant de forcer, afin de
    savoir ce qui va disparaître.
16. En tant qu'administrateur, je veux régler l'abandon d'un compte, afin de
    nettoyer un compte anonyme vide resté en travers.
17. En tant qu'administrateur, je veux effacer un compte, afin d'honorer une
    demande de quelqu'un qui ne peut plus se connecter.
18. En tant qu'administrateur, je veux que l'effacement demande une
    confirmation, afin de ne pas le déclencher d'un clic.
19. En tant que conducteur, je veux autoriser l'assistance depuis mon écran de
    compte, afin qu'on puisse regarder ce qui cloche chez moi.
20. En tant que conducteur, je veux que cette autorisation ait une date de fin,
    afin qu'elle ne reste pas ouverte par oubli.
21. En tant que conducteur, je veux qu'elle vaille 24 heures par défaut, afin de
    n'avoir aucune décision à prendre.
22. En tant que conducteur, je veux voir en clair jusqu'à quand c'est ouvert,
    afin de savoir où j'en suis.
23. En tant que conducteur, je veux pouvoir refermer avant l'échéance, afin de
    reprendre la main quand j'estime que c'est fini.
24. En tant que conducteur, je veux voir qui a regardé mes données et quand,
    afin que mon autorisation veuille dire quelque chose.
25. En tant qu'administrateur, je veux lire les données d'un compte quand
    l'accord est ouvert, afin de comprendre un défaut sans lui demander de
    m'envoyer son archive.
26. En tant qu'administrateur, je veux que cette lecture s'arrête d'elle-même à
    l'échéance, afin de ne pas garder un accès dont personne ne se souvient.
27. En tant que conducteur, je veux que la régie ne puisse jamais écrire chez
    moi, afin qu'aucun geste d'administration ne se confonde avec les miens.
28. En tant que conducteur, je veux qu'un envoi refusé pour cause de plafond me
    dise quoi faire, afin de ne pas rester bloqué sans comprendre.
29. En tant que conducteur, je veux qu'un plafond atteint n'efface jamais ce que
    j'ai déjà déposé, afin de ne rien perdre.
30. En tant que visiteur sans droit, je veux que la régie ne me dise rien, afin
    que son existence ne soit pas une information gratuite.
31. En tant qu'administrateur, je veux retrouver dans six mois qui a effacé un
    compte, afin de répondre à une question qui viendra tard.
32. En tant que personne effacée, je veux que la trace ne garde ni mon nom ni
    mon adresse, afin que l'effacement veuille dire quelque chose.
33. En tant que développeur du projet, je veux qu'une route de régie ajoutée
    plus tard sans son contrôle fasse rougir un test, afin que la garantie dure.

## Ce qu'on ne construit pas

- **Aucun canal de demande d'accès.** Pas de fenêtre poussée chez le conducteur,
  pas de sondage périodique, pas de connexion ouverte. On demande de vive voix.
- **Pas de crans dans l'accord.** Un interrupteur, tout ou rien. Pas de
  distinction entre ce qu'un compte a fabriqué et ce qu'il a roulé, pas de
  sélection trajet par trajet.
- **Pas de délai de grâce sur l'effacement**, pas de compte marqué à effacer.
- **Pas d'emprunt d'identité.** La régie ne se connecte jamais au nom de
  quelqu'un.
- **Pas de journal d'audit général.** La trace couvre les gestes
  d'administration, pas les connexions, les créations de compte ni les refus.
- **Pas de plafond mesuré.** Le chiffre définitif appartient aux tickets 04 et
  05 de DURCIR ; ici on pose un plafond provisoire qui refuse.
- **Pas de test d'écran.** Aucun composant Vue n'est testé dans ce dépôt, et la
  régie n'inaugure pas cette pratique : le contrôle mord côté serveur.
- **Le rôle de synthèse reste un verrou d'affichage.** Il ne commande aucune
  route ; la régie l'attribue comme les autres, sans lui donner un pouvoir qu'il
  n'a pas.

## Comment on teste

Le dépôt a deux portes d'entrée pour les essais, et **on n'en ouvre aucune
troisième**.

**Le serveur monté en mémoire.** Un fichier d'essai construit l'application
complète sur une base SQLite jetable et lui envoie de vraies requêtes. C'est ce
que font déjà les essais d'isolation, de serveur et de compte. Trois comptes :
un administrateur, un conducteur, un inconnu correctement annoncé. On y vérifie
tout le comportement — qui passe et qui prend un 404, l'accord qui ouvre, la
date échue qui referme, l'absence de date qui refuse, le plafond qui laisse
passer puis qui refuse, la ligne de trace qui s'écrit, l'effacement qui écrit sa
ligne avant de partir, et la trace d'un compte effacé qui a perdu son nom.

**Le contrôle en HTTP contre un serveur qui tourne.** Le contrat rejoué par
`npm run accord` porte déjà le cas « le relecteur a sa propre page ». La régie
en ajoute le jumeau : sa page est bien servie, et ses routes répondent 404 sans
administrateur. C'est le seul contrôle qui regarde une vraie réponse — les
essais du dépôt tournent sur les sources et n'en voient aucune. Une image qui ne
se construisait plus est passée à travers une pull request entièrement verte le
12 septembre 2026, pour cette seule raison.

**Et l'inventaire qui fait durer la garantie.** Les routes de régie s'inscrivent
dans la liste de routes en fin d'essai d'isolation. C'est ce qui fait rougir le
jour où quelqu'un ajoutera une route sans son contrôle.

Ce qui fait un bon essai ici, comme ailleurs dans ce dépôt : il regarde ce que
le serveur **répond**, jamais comment il s'y prend.

## Critères d'acceptation

- [ ] Un compte dont l'adresse est dans la variable ouvre la régie ; tout autre
      compte reçoit 404 sur chaque route, et une page qui n'annonce rien.
- [ ] Aucune route ne permet d'accorder ni de retirer l'administration —
      vérifié, pas seulement affirmé.
- [ ] La régie donne et reprend un rôle, et le contrôle serveur suit
      immédiatement.
- [ ] La régie accorde et retire une banque réservée ; le drapeau, lui, reste
      dans la configuration, et la variable d'accords se cumule toujours.
- [ ] Le conducteur ouvre et referme l'assistance depuis son écran, et voit
      jusqu'à quand c'est ouvert.
- [ ] Sans date, la régie ne lit rien. Avec une date passée, elle ne lit plus
      rien. Aucun passage périodique n'est nécessaire pour ça.
- [ ] Les routes de lecture de la régie ne savent que lire — vérifié route par
      route.
- [ ] Un dépôt qui ferait dépasser le plafond est refusé, et rien de déjà déposé
      n'est effacé.
- [ ] Chaque geste d'administration écrit une ligne de trace, lisible dans la
      régie et sur l'écran du compte concerné.
- [ ] L'effacement d'un compte laisse sa ligne de trace, et cette ligne ne porte
      plus ni nom ni adresse.
- [ ] Les routes de régie figurent dans l'inventaire de l'essai d'isolation.
- [ ] `regie.html` est servie par l'image construite, vérifié par le contrat en
      HTTP.
- [ ] Le poids de l'application que la voiture télécharge n'augmente pas.
- [ ] Contrôle qualité vert : typage, style, essais, construction.

## Les tickets

Neuf tranches, chacune vérifiable seule, les bloquantes d'abord. Tout passe par
le 03 : c'est lui qui crée la table de trace, et chaque geste doit y inscrire sa
ligne dès le premier jour plutôt que d'être complété plus tard.

| № | Ticket | Bloqué par |
|---|---|---|
| 01 | [La porte et la liste des comptes](tickets/01-la-porte-et-la-liste-des-comptes.md) | aucun |
| 02 | [La fiche d'un compte](tickets/02-la-fiche-d-un-compte.md) | 01 |
| 03 | [Donner et reprendre un rôle, et la trace qui l'inscrit](tickets/03-donner-un-role-et-la-tracer.md) | 02 |
| 04 | [Les banques réservées passent en base](tickets/04-les-banques-passent-en-base.md) | 03 |
| 05 | [Le conducteur autorise l'assistance, et ça expire](tickets/05-autoriser-l-assistance.md) | 02 |
| 06 | [La régie lit les données d'un compte sous accord](tickets/06-lire-les-donnees-sous-accord.md) | 05, 03 |
| 07 | [Le conducteur voit ce qu'on a fait de son accord](tickets/07-le-conducteur-voit-les-consultations.md) | 06 |
| 08 | [Les gestes de la fiche : effacer, forcer, régler, plafonner](tickets/08-les-gestes-de-la-fiche.md) | 03 |
| 09 | [Prouver la régie contre un serveur qui tourne](tickets/09-prouver-la-regie-en-http.md) | tous |

Le 08 rassemble quatre boutons de la même fiche, tracés de la même façon —
décision de David au découpage. Le plafond y est le point délicat : c'est le
seul des quatre qui touche la route de dépôt.

## Notes

L'entretien de cadrage du 15 septembre 2026 a doublé le périmètre du lot. Il ne
portait au départ que l'attribution des rôles et des banques ; il porte
maintenant un mécanisme d'accès consenti, un plafond de volume et une table de
trace — trois choses qui n'existent nulle part dans le dépôt aujourd'hui.

Deux décisions y ont été prises contre ma recommandation, et elles sont assumées
telles quelles : l'effacement sur simple confirmation, et le plafond provisoire
à un nombre rond. La première est cohérente avec le bouton que l'utilisateur a
déjà sur son écran ; la seconde ne peut que refuser, jamais effacer, ce qui la
rend rattrapable.
