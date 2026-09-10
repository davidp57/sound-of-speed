# Tous les réglages, pour décider lesquels restent dans la voiture

Inventaire complet des réglages de Speed au 10 septembre 2026, dressé pour la
refonte : deux applications, l'atelier sur PC et la voiture. La question posée à
chaque ligne est **celle-ci et pas une autre** — ce réglage doit-il rester
accessible au volant ?

Marque la colonne de droite : `V` pour la voiture, rien pour l'atelier.

**Repères de lecture.** *Profil* = le réglage voyage avec le profil (export,
lien de partage, dépôt sur le NAS). *Appareil* = il reste sur cet appareil et ne
voyage jamais. Les six sections détaillées de l'écran de configuration ne
s'affichent qu'en mode avancé.

**Compte** : 130 réglages, dont 61 champs numériques dans le seul écran de
configuration.

## Moteur — 11 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Cylindres enregistrés | Combien de cylindres avait le moteur enregistré ; ne change pas le son, sert à l'analyse d'un fichier | Config › Moteur | |
| Ralenti | Régime à l'arrêt, débrayé — le son du feu rouge | Config › Moteur | |
| Régime de décollage | Régime que l'embrayage impose dès que la voiture avance | Config › Moteur | |
| Seuil de coupure | Régime auquel l'allumage commence à être coupé | Config › Moteur | |
| Rupteur | Plafond absolu du régime | Config › Moteur | |
| Durée de coupure | Durée d'une coupure au rupteur — c'est ce hachage qui crépite | Config › Moteur | |
| Inertie | Poids du volant moteur : lourd, il met du temps à prendre ses tours | Config › Moteur | |
| Montée à vide | Rapidité de montée quand les roues n'entraînent pas le moteur | Config › Moteur | |
| Frein moteur | Rapidité avec laquelle le régime retombe pied levé | Config › Moteur | |
| Tremblement au ralenti | Amplitude de l'oscillation d'un thermique ; ne va que dans le son | Config › Moteur | |
| Vitesse du tremblement | Fréquence de ce tremblement | Config › Moteur | |

## Transmission — 17 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Démultiplications | La liste des rapports, du plus court au plus long | Config › Transmission | |
| Pont | Démultiplication commune : la baisser fait tourner le moteur moins vite partout | Config › Transmission | |
| Rupteur atteint à | Vitesse à laquelle le rupteur tombe en dernier rapport ; recalcule le pont | Config › Transmission | |
| Rayon de roue | Une roue plus grande fait moins de tours pour la même vitesse | Config › Transmission | |
| Temps de passage | Durée de toute la séquence : coupure, chute, coup de gaz, clac, reprise | Config › Transmission | |
| Passage 1→2, 2→3… | Régime auquel chaque rapport cède la place, à charge moyenne (5 curseurs) | Config › Transmission | |
| Écart selon la charge | De combien le passage recule pied au plancher et avance pied levé | Config › Transmission | |
| Dispersion aléatoire | Tirage au sort à chaque passage, pour ne pas sonner comme une machine | Config › Transmission | |
| Première réservée au lancement | La première n'est qu'une amorce, on n'y revient plus | Config › Transmission | |
| Passage en seconde à | Vitesse au-delà de laquelle la première cède | Config › Transmission | |
| Ne jamais monter sous | Plancher appliqué aux régimes de passage | Config › Transmission | |
| Descente sous | Fraction du rupteur sous laquelle la boîte rétrograde | Config › Transmission | |
| Croisière au-dessus de | Régime sous lequel la boîte refuse de monter à vitesse tenue | Config › Transmission | |
| Monter après | Durée de vitesse stable avant de tenter un rapport de plus | Config › Transmission | |
| Descendre en freinant à | Décélération à partir de laquelle la boîte descend pour aider | Config › Transmission | |
| Temporisations de montée | Délai avant chaque montée, une valeur par rapport, volontairement inégales | Config › Transmission | |
| Nombre de rapports | Redistribue les rapports en gardant le premier, le dernier et le pont | Config › Réglage (simplifié) | |

## Signal de vitesse — 6 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Raideur du lissage | Réactivité du suivi GPS : haut il colle mais saute, bas il est doux mais en retard | Config › Signal | |
| Fenêtre d'accélération | Durée sur laquelle l'accélération est calculée : courte elle tremble, longue elle retarde | Config › Signal, proposé par l'Étalonnage | |
| Vitesse plausible max | Au-delà, la mesure GPS est rejetée comme aberrante | Config › Signal | |
| Précision GPS acceptée | Incertitude au-delà de laquelle une position est écartée (250 m, jamais mesuré) | Config › Signal | |
| Accélération max retenue | Plafond de l'accélération : au-dessus, c'est un saut du GPS | Config › Signal | |
| Décélération max retenue | Le même plafond en freinage | Config › Signal | |

## Caractère et imperfections — 17 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Rétrogradage forcé | Descendre chercher le couple quand on enfonce, sans attendre le seuil | Config › Caractère | |
| Déclenché au-delà de | Charge à partir de laquelle la demande est jugée franche | Config › Caractère | |
| Régime visé | Régime cherché après la descente, en fraction du rupteur | Config › Caractère | |
| Rapports descendus au plus | Nombre maximal de rapports descendus d'un coup | Config › Caractère | |
| Pétarade | Claquements à l'échappement au lever de pied | Config › Caractère | |
| À partir de | Régime en deçà duquel aucun claquement | Config › Caractère | |
| Intensité | Volume des claquements | Config › Caractère | |
| Claquements par salve | Nombre de détonations à chaque lever de pied | Config › Caractère | |
| À-coup de passage | Le petit trou et la reprise pendant le changement | Config › Caractère | |
| Profondeur | Combien le niveau baisse pendant la coupure | Config › Caractère | |
| Coupure de couple | Combien le moteur passe en roue libre — c'est ce qui change le timbre | Config › Caractère | |
| Plongée du régime | De combien le moteur tombe sous le rapport visé pendant la coupure | Config › Caractère | |
| Coup de gaz | De combien il remonte au-dessus avant l'engagement — le double débrayage | Config › Caractère | |
| Clac de la boîte | Le choc mécanique sec de l'engagement | Config › Caractère | |
| Clac au rétrogradage | Part du clac gardée quand la boîte descend | Config › Caractère | |
| Claquement de reprise | Détonation au moment où le couple revient | Config › Caractère | |

## Mixage et niveaux — 16 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Relief de charge | Autant en moins pied levé, autant en plus pied au plancher : ce qui fait entendre l'effort | Config › Mixage | |
| Relief du régime | Gain gagné entre le ralenti et le rupteur | Config › Mixage | |
| Niveau au ralenti | Écart de niveau au ralenti, faute de couche dédiée dans la banque | Config › Mixage | |
| Gain pied levé | Curseur de goût sur toute la famille « pied levé » | Config › Mixage | |
| Contraste de charge | À 1 le fondu va d'un extrême à l'autre ; plus bas, les familles se mélangent | Config › Mixage | |
| Désaccord des couches | Écart de justesse entre deux couches, qui produit un battement lent | Config › Mixage | |
| Renouvellement de position | Intervalle entre deux reprises ailleurs dans l'échantillon, pour casser la boucle | Config › Mixage | |
| Début de bascule | Régime où la couche haut régime commence à entrer | Config › Mixage | |
| Fin de bascule | Régime au-delà duquel seule la couche haut régime joue | Config › Mixage | |
| Accélération pleine charge | Accélération au-delà de laquelle la charge est maximale | Config › Mixage, Étalonnage | |
| Repère de traînée | Vitesse à laquelle tenir l'allure demande la moitié de l'effort | Config › Mixage | |
| Lissage de la charge | Temps que met la charge à suivre : court le fondu papillonne, long le son traîne | Config › Mixage | |
| Effacement du ralenti | Régime au-dessus duquel la couche de ralenti disparaît | Config › Mixage | |
| Coupe-bas | Retire les graves que les petits haut-parleurs ne rendent pas | Config › Mixage | |
| Saturation | Épaissit le son ; trop poussé, il devient sale | Config › Mixage | |
| Seuil du limiteur | Niveau à partir duquel le son est retenu | Config › Mixage | |

## Couches d'échantillons — 11 réglages, tous dans le profil

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Banque d'échantillons | Choisit un des dossiers de banque que le serveur sait lister | Config › Profils | |
| Dossier d'échantillons | Le même nom tapé à la main, pour une banque non listée | Config › Profils | |
| Couche active | Une couche décochée reste dans le profil mais ne joue pas | Config › Couches | |
| Clé | Identifiant de la couche | Config › Couches | |
| Fichier | Nom du fichier son dans la banque | Config › Couches | |
| Rôle | Famille de mixage : en charge, pied levé, ralenti, rupteur | Config › Couches | |
| Ancrage | Régime auquel l'échantillon a été enregistré ; fixe la justesse | Config › Couches | |
| Gain | Niveau propre à la couche, avant mixage | Config › Couches | |
| Lecture min | Borne basse d'étirement : en dessous, le son devient pâteux | Config › Couches | |
| Lecture max | Borne haute : au-dessus, il devient métallique | Config › Couches | |

## Origine du son et raccourcis — 4 réglages, tous dans le profil

Les trois derniers sont **déjà sur l'écran de conduite** aujourd'hui.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Origine du son | Enregistré, généré en direct, ou généré à l'avance | Config › Profils | |
| Moteur | Charge d'un coup un moteur entier de la bibliothèque (9 entrées) | **Conduite** + Config | V |
| Échappement | Combien de résonance passe par-dessus le son direct (Direct / Mesuré / Enveloppé) | **Conduite** + Config | V |
| On écoute | Point d'écoute : de l'habitacle, ou de l'extérieur | **Conduite** + Config | V |

## Définition du moteur simulé — 28 nombres, tous dans le profil

L'atelier, sans discussion possible : ce sont les cotes d'un moteur.
Alésage, course, bielle, chambre, conduits et sections d'admission et
d'échappement, écartement et centres des lobes, levées, durées, boîte à air,
débits, papillon au ralenti, tube primaire, collecteur, poids dans le son,
collecteur du premier cylindre, durée de coupure, bruit d'air, gigue.

Réglés dans **Synthèse › Le moteur**, écran déjà réservé au poste de travail.

## Calcul et banc de synthèse — 13 réglages, préférences d'appareil

Également l'atelier — sauf peut-être les deux marqués d'un point
d'interrogation, qui touchent au rendu et non au calcul.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Simulation | Cadence de la simulation physique (6 à 20 kHz) | Synthèse › Le calcul | |
| Convolution interne | Résonance calculée dans engine-sim, ou déportée sur le navigateur | Synthèse › Le calcul | |
| Bloc rendu | Nombre d'échantillons rendus d'un coup | Synthèse › Le calcul | |
| Réserve visée | Marge de son d'avance : absorbe les pointes mais retarde le son | Synthèse › Le timbre | ? |
| Volume de la synthèse | Niveau produit avant le niveleur | Synthèse › Le timbre | ? |
| Régime délissé | Amplitude du bruit qui module le régime, sans quoi le son est une fréquence pure | Synthèse › Le timbre | |
| Vitesse de la dérive | Vitesse de cette dérive : bas on entend un pleurage, haut une friture | Synthèse › Le timbre | |
| Balayage du régime | Fait monter et descendre le régime tout seul, pour écouter sans conduire | Synthèse › Le banc | |
| Durée d'un aller-retour | Durée d'un cycle de balayage | Synthèse › Le banc | |
| Effort imposé | Impose un effort constant au lieu de suivre la chaîne | Synthèse › Le banc | |
| Valeur imposée | L'effort imposé | Synthèse › Le banc | |
| Mesurer en silence | Coupe la sortie sans rien arrêter derrière | Synthèse | |

## Échappement et point d'écoute — 12 réglages, tous dans le profil

Ils voyagent avec le moteur : chaque entrée de bibliothèque pose les siennes.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Papillon au repos | Ouverture des gaz quand l'effort est nul | Synthèse › Le timbre | |
| Papillon à plein effort | Ouverture des gaz à plein effort | Synthèse › Le timbre | |
| Niveleur | Ramène la crête à une valeur constante quel que soit le moteur | Synthèse › Le calcul | |
| Gain fixe, niveleur coupé | Le gain appliqué quand le niveleur est coupé | Synthèse › Le calcul | |
| Crête visée | La crête que vise le niveleur | Synthèse › Le calcul | |
| Échappement | D'où vient la résonance : quatre captations réelles, ou un tube fabriqué | Synthèse › Le timbre | |
| Résonance d'échappement | Part de son réverbéré : à 0 le rauque revient, à 1 plus rien du son direct | Synthèse + **Conduite** | V |
| Accord de l'échappement | Accord du tube fabriqué ; sans effet sur une captation | Synthèse › Le timbre | |
| Longueur de la résonance | Durée de la queue : 220 ms faisaient une salle | Synthèse › Le timbre | |
| Déboucher en charge | Rend en accélérant la clarté qu'on entend pied levé | Synthèse › Le timbre | |
| Silencieux / point d'écoute | Coupure du silencieux, qui est le point d'écoute | Synthèse + **Conduite** | V |

## Étalonnage — 6 enregistrements et 11 recopies

Se fait **en roulant** par nature : les six enregistrements demandent la
voiture. Les recopies, elles, écrivent dans le profil — donc dans l'atelier si
le serveur fait foi. C'est le seul endroit du produit où les deux applications
se rencontrent vraiment, et il faudra trancher.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Six enregistrements | Ville, route, autoroute, accélération franche, pied levé, freinage franc | Télémétrie › Étalonnage | V ? |
| Onze recopies | Reportent les valeurs mesurées dans le profil, un geste à la fois | Télémétrie › Étalonnage | ? |

## Préférences d'appareil — 12 réglages, jamais dans le profil

Par construction locaux : ils ne peuvent pas venir de l'atelier.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Volume | Volume général ; dépend de l'autoradio et du bruit de roulement | **Conduite** › Son | V |
| Son activé ou coupé | Démarre ou coupe la sortie audio | **Conduite** › Son | V |
| Cadrans ou chiffres | Visage de l'écran : aiguilles, ou grands chiffres | **Conduite** | V |
| Garder allumé | Empêche l'écran de s'éteindre en roulant | **Conduite** › Écran | V |
| Auto ou manuelle, − / + | Boîte automatique, ou passages à la main | **Conduite** › Boîte | V |
| Profils épinglés | Met un profil en accès direct sur l'écran de conduite | Config › Profils | |
| Simplifié ou avancé | Montre ou cache les 61 réglages détaillés | Config › Réglage | |
| Calme ↔ sportif | Refait d'un geste une dizaine de réglages de boîte et de moteur | Config › Réglage | ? |
| Pépère ↔ nerveux | Refait la réactivité du signal et les temporisations | Config › Réglage | ? |
| Profil sélectionné | Retient quel profil était choisi | implicite | V |
| Vitesse de relecture | Accélère ou ralentit la relecture d'une trace | Télémétrie › Traces | |
| Source de vitesse | GPS réel, simulateur, ou relecture | **Conduite** | |

## Hors réseau et dépôt — 15 réglages

Les identifiants de dépôt et l'accord de remontée **disparaissent** avec les
comptes : c'est précisément ce que la refonte remplace.

| Réglage | Ce qu'il fait | Aujourd'hui | Voiture ? |
|---|---|---|---|
| Son en arrière-plan | Maintient la session audio quand l'écran s'éteint | Config › Hors réseau | |
| Préparer hors réseau | Met tous les échantillons en cache pour rouler sans réseau | Config › Hors réseau | V ? |
| Installer sur l'écran d'accueil | Installe l'application | Config › Hors réseau | |
| Libérer les banques inutilisées | Vide du cache les banques qu'aucun profil n'emploie | Config › Hors réseau | |
| Identifiants de dépôt | Le compte htpasswd qui sert à déposer — remplacé par les comptes | Config › Profils | — |
| Remontée au serveur | Rien / le minimum / et la conduite — à revoir avec les comptes | Config › Profils | ? |
| Réessayer | Relance le dépôt de ce qui attend | Config › Profils | |
| Profils du serveur | Va chercher les profils déposés sur le NAS | Config › Profils | |
| Réinitialiser | Ramène une section, ou tout le profil, à sa création | Config › Profils | |
| Partager, exporter, importer | Transporte un profil par lien, par code à scanner, ou par fichier | Config › Profils | |
| Profils d'usine | Réintroduit Route et Sport si on les a supprimés | Config › Profils | |
| Créer un profil | Quatre choix en langage de conducteur, d'où découlent trente réglages | Config › Créer | |
| Nom du profil | Nom affiché | Config › Profils | |
