# Protocole d'essai — ce qui reste à vérifier au volant

Écrit le 17 septembre 2026, après le parcours complet de ce que le backlog
attendait de David. Ce document est **transverse** : il ne suit pas les lots
mais les gestes, parce que c'est ainsi qu'on conduit.

**Il se périme.** Chaque ligne renvoie à son ticket ; c'est le ticket qui fait
foi, et ce document se réécrit quand le reliquat change.

*Revu le 17 septembre 2026, tard* : le son ne sature plus, l'écran a changé de
disposition et le rétrogradage forcé se réarme en roulant. Trois points entrent,
et ce qui était « à ne pas tester parce qu'on va refaire l'écran » redevient
testable.

*Revu le 17 septembre 2026 au soir* : les points à l'arrêt passent de deux à
cinq. Le relevé du taux d'échantillonnage y entre — c'est le chiffre qui
manque pour comprendre pourquoi les parasites s'entendent dans la voiture et
pas sur un PC —, avec l'appareil déclaré, dont dépend désormais la garde des
écrans, et le ralenti, qui a retrouvé la moitié de tremblement qu'une borne lui
mangeait.

## Avant de partir — cinq minutes à l'arrêt

**0.1 · La version.** Écran Télémétrie, section Appareil. Elle doit être **au
moins 0.2.103**. En dessous, les seuils du rétrogradage forcé sont les anciens,
le tremblement du ralenti est amputé, et la moitié des écoutes ci-dessous ne
veut rien dire.

**0.2 · Le taux d'échantillonnage.** Écran Télémétrie, section du son :
relever la valeur, une seule fois. **C'est le chiffre le plus utile de cette
liste.**

S'il n'est **pas 44 100 Hz**, toute la banque est rééchantillonnée par le
navigateur de bord en plus du rééchantillonnage que le régime impose déjà — et
un interpolateur sans filtre anti-repliement fabrique des fréquences qui
n'existent dans aucun fichier. Ce serait l'explication des « fréquences
parasites » que David entend dans la voiture et **pas sur son PC**, sur la même
banque.

Cette valeur discrimine la piste à elle seule ; sans elle on en est aux
hypothèses. → [ESSAI-16/11](ESSAI-16/tickets/11-frequences-parasites-sur-les-v8.md)

**0.3 · L'appareil déclaré.** Écran Compte, « Cet appareil » : il doit dire
**Voiture**. Depuis le 17 septembre 2026, c'est lui qui décide si les écrans de
réglage se ferment en roulant — déclaré « poste », la voiture n'a plus de garde
du tout. → [MENAGE-UI](MENAGE-UI/spec.md)

**0.4 · Le son au repos.** Mettre sur **P**, puis changer de profil. **Aucun
son ne doit sortir.** C'était le défaut du 16 septembre ; il est corrigé et
mesuré au poste, ce geste le confirme dans la voiture.
→ [ESSAI-16/13](ESSAI-16/tickets/13-jamais-de-son-au-repos.md)

**0.5 · Le ralenti, moteur en marche, voiture arrêtée.** Écouter dix secondes :
le ralenti ne doit plus sonner comme une **fréquence pure**. Le compte-tours
doit frémir des deux côtés de 750, et non rester collé dessus. Les deux vont
ensemble — c'est la même moitié de tremblement qu'une borne mangeait.
→ [ESSAI-16/09](ESSAI-16/tickets/09-tremblement-ampute-au-ralenti.md),
[ESSAI-16/10](ESSAI-16/tickets/10-aiguille-sans-tremblement.md)

## Pendant le trajet — rien à faire

Tout se dépose seul : traces, journal, profil mesuré. Il n'y a **aucun chiffre à
noter**, aucune console à ouvrir. Ce qui suit se juge à l'oreille et se raconte
après.

## Une accélération franche, sur route dégagée

Un seul aller-retour suffit, et il solde cinq points d'un coup.

**1 · Écraser franchement depuis 60 ou 70 km/h, en mode Route.**
Le rétrogradage forcé doit descendre chercher du couple et **rendre le rapport
dès que le pied se relâche**. C'est le correctif d'hier : avant, il ne partait
que deux fois en deux heures et demie.
→ [RETOUR-11/01](RETOUR-11/tickets/01-borner-la-cible-du-kickdown.md),
[ESSAI-16/01](ESSAI-16/tickets/01-kickdown-inatteignable.md)

**2 · Dans la même accélération, écouter où les rapports passent.**
Ils passent 15 à 20 % plus tôt qu'avant. La question est simple : **est-ce trop
tôt ?** Un moteur qui n'a plus le temps de chanter serait le signe qu'on a trop
baissé. → [ETAGEMENT/02](ETAGEMENT/tickets/02-passer-plus-tot-en-route.md)

**3 · Lever le pied franchement, sans freiner, et laisser ralentir.**
Les rapports doivent descendre l'un après l'autre sans remonter. David trouve
déjà que cela pourrait se produire **plus tôt** : confirmer ou nuancer.
→ [ESSAI-16/12](ESSAI-16/tickets/12-retrograder-plus-tot-en-ralentissant.md)

**4 · Refaire la même accélération avec un autre moteur.**
Le GM LS monte à 6 500 tr/min, la Hayabusa à plus de 11 000. Les passages
doivent arriver à des endroits **nettement** différents. S'ils tombent au même
endroit, le lot a échoué. → [REFONTE/02](REFONTE/tickets/02-la-boite-se-deduit-du-moteur-et-du-mode.md)

**5 · Le clac de montée.**
Il a été baissé de 30 %, David le trouve encore trop fort et a validé une baisse
supplémentaire à 0,25. Vérifier après livraison.
→ [RETOUR-11/02](RETOUR-11/tickets/02-le-claquement-a-la-montee.md)

**5 bis · Les quatre profils au même volume.**
Passer de V8 à L6 puis à L4, sans toucher au volume. Les trois doivent sonner à
la même force. Le six en ligne sortait 5,7 dB sous le V8, mesuré à travers le
mixage ; ses gains ont été remontés d'autant. Le quatre à plat n'a pas été
touché — sa mesure ne montre pas d'écart de niveau —, donc s'il paraît encore
plus faible, c'est autre chose que du volume.
→ [BANQUES/06](BANQUES/tickets/06-les-banques-ne-sonnent-pas-au-meme-niveau.md)

**5 ter · Le son à fort volume.** Mettre le volume général au maximum et
accélérer franchement. Le son ne doit plus se salir quand ça monte : la chaîne
écrêtait un échantillon sur onze à ce niveau, et c'est corrigé. **Si les
fréquences parasites des V8 disparaissent, la cause était là** — c'est la
réponse au ticket qui traîne depuis l'essai du 16.
→ [ESSAI-16/08](ESSAI-16/tickets/08-volume-plaque-contre-le-limiteur.md),
[ESSAI-16/11](ESSAI-16/tickets/11-frequences-parasites-sur-les-v8.md)

**5 quater · Deux rétrogradages forcés de suite, en mode Sport.**
Écraser, relâcher, écraser à nouveau quelques secondes plus tard. Les deux
doivent partir. Avant, la boîte restait désarmée 86 % du temps en Sport et le
second ne venait pas. → [ESSAI-16/07](ESSAI-16/tickets/07-rearmement-proportionnel.md)

## Sur autoroute, à allure stabilisée

**6 · Tenir 50 km/h une minute, puis tenir 130 une minute.**
Les deux doivent sonner **différemment** : 130 comme un effort, 50 comme une
promenade. Avant le lot, les deux donnaient exactement le même son.
→ [EFFORT/02](EFFORT/tickets/02-leffort-connait-la-vitesse.md)

## Au premier parking souterrain

**7 · Descendre, puis recharger la page.**
C'est le seul vrai hors réseau accessible : la voiture a son propre modem, il n'y
a rien à couper. L'application doit revenir, et ce qui n'a pas été déposé doit
repartir en remontant.

Ce geste unique solde **cinq tickets** :
[COMPTES/07](COMPTES/tickets/07-hors-reseau-rien-ne-change.md),
[BANQUES/04](BANQUES/tickets/04-cache-hors-reseau.md),
[DURCIR/01](DURCIR/tickets/01-fermer-la-banque-derriere-un-compte.md),
[SERVEUR/08](SERVEUR/tickets/08-un-seul-service-sur-develop.md),
[REMONTEE/02](REMONTEE/tickets/02-une-trace-part-toute-seule.md).

## Au bureau, sans voiture

**8 · Le service worker hors réseau.** Ouvrir l'application sur le poste, la
laisser charger, couper le réseau, recharger. C'est 80 % du critère de
SERVEUR/08, et cela ne demande pas la route.

**9 · Le rejeu sonore d'une capture.** Ouvrir un des trajets du 16 dans le
relecteur et l'écouter. → [RELECTURE/08](RELECTURE/tickets/08-rejeu-sonore.md)

**10 · Le bouton de rapatriement.** Un appui depuis un appareil qui télécharge.
David : « je testerai plus tard ». → [RAPATRIER](RAPATRIER/spec.md)

**11 · Reprendre les profils du serveur.** Dans l'atelier, le bouton du même
nom. Il efface les profils de l'appareil et prend ceux du serveur à la place, en
deux appuis. Vérifié contre un serveur simulé ; ce qui reste à voir est le
chemin réel, compte compris. → [REMONTEE/08](REMONTEE/tickets/08-reprendre-du-serveur-sans-dupliquer.md)

## L'écran, qui vient de changer

**12 · La nouvelle disposition.** Le rapport et le sélecteur de boîte sont
maintenant **entre les deux compteurs**, le rapport au-dessus. Les cadrans ont
gagné : 213 pixels de diamètre au lieu de 176, et 277 en plein écran. Deux
choses à juger d'un coup d'œil, à l'arrêt puis en roulant :

- le rapport se lit-il encore assez gros ? Son chiffre a été réduit pour tenir
  dans la colonne ;
- le sélecteur tombe-t-il bien sous le pouce, au milieu de l'écran plutôt qu'en
  bas ?

Et le bandeau d'alerte du bas ne doit plus être recouvert par les commandes.
→ [INTERFACE](INTERFACE/spec.md), [ESSAI-16/02](ESSAI-16/tickets/02-bandeaux-sous-les-commandes.md)

**13 · La mire, une fois, avec une carte bancaire.** Atelier, volet *Écran*,
« Ouvrir la mire ». Régler le curseur jusqu'à ce que la carte recouvre le
rectangle, puis « Retenir ». C'est le seul moyen de savoir ce qu'un pixel fait en
millimètres. → [INTERFACE/01](INTERFACE/tickets/01-mesurer-l-espace-reel.md)

**14 · Un appui sur *Plein écran* pendant le trajet.** Rien d'autre : le relevé
se reprend tout seul, et l'écart entre les deux états dira si les pixels
manquants sont une barre ou un zoom.

## Ce qu'il ne faut pas tester, et pourquoi

**Le reste de l'écran attend le lot INTERFACE.** Le cadran de régime en plein
soleil, le défilement, l'accueil du premier lancement, le choix du moteur au
volant, les curseurs globaux. David, le 17 septembre : « on va d'abord refaire
l'écran proprement et on testera ça ensuite ». La colonne du milieu est faite ;
le reste du lot ne l'est pas. → [INTERFACE](INTERFACE/spec.md)

## Ce qui ne se teste plus du tout

- Le **parcours d'étalonnage manuel** : abandonné, l'automatique le remplace.
- La **sonde** et le **coût de la synthèse** : sans objet, le son en direct dans
  la voiture est abandonné.
- La **distinction entre lever le pied et freiner** : mesurée inexistante sur
  cette voiture — la régénération freine dès qu'on lève le pied.
