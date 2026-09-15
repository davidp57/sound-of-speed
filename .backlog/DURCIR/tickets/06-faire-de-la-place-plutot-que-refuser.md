# 06 — Prévenir avant le plafond, et faire de la place plutôt que refuser

**Statut :** ✅ cadre — conception posée par David le 15 septembre 2026, tranchée
et découpée le même jour en trois tickets. Ce fichier n'est plus un travail à
faire : c'est le cadre que les trois suivants exécutent.

| № | Ticket | Bloqué par |
|---|---|---|
| 07 | [Le serveur dit la place sur chaque dépôt](07-le-serveur-dit-la-place.md) | aucun |
| 08 | [La rotation fait de la place, et le refus dit ce qui bloque](08-la-rotation-fait-de-la-place.md) | 07 |
| 09 | [L'application prévient : bandeau et télémétrie](09-le-bandeau-et-la-telemetrie.md) | 07, 08 |

La chaîne est linéaire, et c'est assumé : l'écran ne peut pas annoncer que la
rotation est activée avant qu'elle existe, sinon il promet ce qui n'arrive pas.

**Bloqué par :** rien ; le plafond lui-même est livré (REGIE, ticket 08)

## D'où ça vient

Le plafond livré **refuse** un dépôt et n'efface jamais rien. Il fait donc perdre
le présent pour garder le passé — or le journal du trajet en cours vaut plus que
celui d'il y a trois mois. David, le 15 septembre 2026, a décrit la suite.

## Ce qu'on construit

**Le signal voyage sur la réponse de chaque dépôt.** C'est le point de départ, et
il décide du reste : la voiture dépose une tranche toutes les cinq minutes, donc
l'information arrive toute seule, sans qu'on ajoute une requête ni un sondage.
L'application peut réagir à n'importe quel moment.

Quatre états, dans l'ordre où on les rencontre :

| Place prise | Le serveur | L'application |
|---|---|---|
| jusqu'à 75 % | accepte, et le dit | rien à dire |
| 75 % à 95 % | accepte, et signale que le plafond approche | prévient le conducteur |
| au-delà de 95 % | accepte, et signale que **la rotation est activée** | prévient que les plus anciens trajets vont partir |
| au-delà de 100 % | accepte quand même, puis fait le ménage | l'état du dépôt suivant le confirme |
| plus rien à libérer | **refuse**, avec un motif à lui | dit qu'il faut décrocher une épingle |

Le dépassement des 100 % est donc **temporaire et borné** par la taille d'une
tranche, quelques dizaines de kilo-octets : on accepte d'abord, on fait la place
ensuite. La voiture ne perd jamais ce qu'elle vient d'enregistrer, et c'est le
motif déjà en place dans le serveur — la reprise du profil mesuré court après un
dépôt de trace, et son échec ne fait pas échouer le dépôt.

### Ce qui efface, et ce qui ne s'efface pas

La rotation **n'est pas la rétention**, et c'est ce qui a été tranché en écrivant
ce ticket : la rétention juge sur l'âge, donc elle ne libère rien quand tout est
récent — exactement le cas d'une voiture qui roule beaucoup. La rotation, elle,
juge sur la place : le plus ancien part, jusqu'à repasser sous le seuil.

**Seule l'épingle protège de la rotation.** Elle veut dire « ce trajet, je le
garde », et c'est la seule chose qu'on ne peut pas prendre à quelqu'un pour faire
de la place.

L'exemption « archive » — les dépôts déménagés de l'ancien serveur de fichiers
par la reprise — retient la **rétention**, qui juge sur l'âge, mais ne retient
pas la rotation, qui manque de place. Tranché par David le 15 septembre 2026 :
il est seul sur ce serveur, et le cas ne mérite pas un second garde-fou. Un
compte qui n'a plus que des épingles tombe sur le refus.

## Comment le serveur dit l'état — **tranché : des en-têtes**

Le code reste `201`, et trois en-têtes portent l'état :

```
Speed-Place: libre | bientot | rotation
Speed-Place-Octets: 190840832
Speed-Place-Plafond: 262144000
```

Trois en-têtes plats, rien à décoder. Absents, l'application ne sait pas et
n'affiche rien — c'est le cas d'un serveur d'avant, et il ne casse rien. Les
chiffres sont là pour que l'écran dise « 182 Mio sur 250 » plutôt qu'un adjectif.

Un **code HTTP** par état avait trois défauts : le client teste `response.ok` et
traite tout le reste comme un échec, un proxy inversé peut normaliser un code
inhabituel, et le jeu d'accord fige déjà `201` sur un dépôt réussi — le changer
casse le contrat pour un serveur plus ancien.

Le refus final, lui, garde son code : **507**, avec un message qui dit ce qui
bloque — « tout est épinglé » et non plus « effacez des trajets ».

## Où l'application prévient — **tranché : un bandeau, et la télémétrie**

**Le bandeau existe déjà** : `.banner` dans `App.vue`, au-dessus de tous les
écrans, avec quatre usages — une version prête, le hors-réseau, un profil reçu,
le rappel d'enregistrer son compte. Deux d'entre eux se ferment d'un bouton. Il
n'y a donc rien à inventer : le quota s'y greffe comme les autres.

**La télémétrie porte le doublon**, et sous la forme qui lui convient : une
valeur, pas un message — « 182 Mio sur 250 ». C'est l'écran des chiffres, et
celui-là reste lisible quand le bandeau a été fermé.

**Rien sur l'écran de conduite.** Il se lit d'un coup d'œil, rien n'y bouge, et
un compte plein ne se règle pas en roulant.

### Quand un bandeau fermé revient-il ?

**À chaque changement d'état, et pas avant.** Franchir 75 %, puis 95 %, puis
tomber au refus sont trois faits neufs, et chacun mérite d'être dit une fois.
Entre deux, le chiffre reste en télémétrie et sur l'écran du compte : fermer le
bandeau ne doit pas être un piège, et le laisser revenir en boucle serait
harceler au lieu de prévenir — c'est déjà le mot du rappel de compte.

## Ce qui n'est pas dans ce ticket

David : « ça serait bien que tous les messages importants soient affichés comme
ça ». C'est juste, et c'est un manque réel — les erreurs de dépôt et de journal
se disent aujourd'hui dans un coin de l'écran de configuration, là où personne ne
les voit en roulant.

Mais c'est **un lot à part** : il touche tous les écrans, et il demande une file
de messages là où le bandeau porte aujourd'hui quatre cas écrits à la main.
Ici, on ajoute un cinquième cas de la même façon. Unifier quand il y en aura
assez pour voir la bonne forme, pas avant.

## Ce qu'on ne construit pas

- Pas de sondage, pas de route à interroger : l'état voyage sur les dépôts.
- Pas de second garde-fou pour les trajets repris de l'ancien serveur : seule
  l'épingle protège de la rotation.
- Pas d'effacement d'un trajet épinglé, à aucun seuil.

## Ce que le plafond vaut, et ce que ça rend urgent

**250 Mio**, décidés par David le 15 septembre 2026 — quarante fois moins que le
nombre rond d'avant. Ce n'est pas une mesure, c'est un choix.

Cela rend ce ticket plus pressant qu'il ne l'était : à 10 Gio, le refus était
lointain ; à 250 Mio, il arrivera. Et **aujourd'hui rien ne fait de place** — le
plafond atteint, les dépôts sont refusés jusqu'à ce qu'on efface à la main.

Le relevé de dépense quotidien tourne sur le NAS depuis le 14 septembre 2026 et
n'a pas été lu : c'est lui qui dira combien de trajets tiennent dans 250 Mio, et
donc si les seuils de 75 % et 95 % laissent le temps de réagir.
