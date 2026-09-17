# INSTRUMENTER — savoir ce que le récepteur donne, et pouvoir en demander plus le jour d'un essai

**Statut :** ✅ clos le 17 septembre 2026 — 4/4. Le chiffre que le lot cherchait est relevé sur les traces déposées : bruit du récepteur entre 0,27 et 0,42 km/h, contre un seuil de 1,5
**Branche :** `feature/instrumenter`
**Version visée :** 0.2.63

## Ce qu'il faut obtenir

Deux choses, qui servent la même fin : comprendre en roulant ce qu'on ne peut
pas reproduire au bureau.

1. **Le bruit du récepteur se lit dans la voiture**, en télémétrie et au journal,
   sans qu'il faille rapatrier une trace ni interroger la base.
2. **Un interrupteur de mise au point** densifie le journal le jour d'un essai,
   et s'éteint tout seul vingt-quatre heures plus tard.

## D'où vient ce lot

Le lot [MOUVEMENT](../MOUVEMENT/spec.md) a mesuré combien de bruit la boîte
supporte avant de se remettre à faire des allers-retours de rapport : **1,5 km/h
à la cadence de la voiture**, et elle décroche à 1,75. Le chiffre est net.

Ce qui manque est l'autre moitié de la comparaison : **combien vaut ce bruit dans
la voiture de David**. Personne ne le sait. Le banc travaille à 1 km/h, une valeur
posée à l'époque du simulateur et jamais confrontée au récepteur réel. Si la
voiture est au-dessus de 1,5, la boîte oscille encore en roulant et le lot
MOUVEMENT n'est pas fini ; si elle est en dessous, le sujet est clos.

**Le chiffre existe pourtant déjà — au mauvais endroit.** `measureNoise`, dans le
calcul d'étalonnage, l'établit sur une trace entière, **après coup**, **sur le
serveur**, et le range dans le profil mesuré. Deux conséquences : il faut le cran
« Et la conduite » pour l'obtenir, puisque c'est la trace qui le porte, et il faut
aller le lire en base.

**Et le journal reste trop maigre pour un essai.** Un relevé toutes les dix
secondes : c'est ce qui a manqué le 10 septembre, où dix-neuf allers-retours ont
été repérés sans pouvoir dire leur fréquence réelle. Les passages de rapport et
l'allure sont inscrits à chaque changement depuis, mais tout le reste — les
seuils de la boîte, la demande, l'accélération avant lissage — reste invisible
entre deux relevés.

## Ce qu'on construit

### Le bruit, mesuré par le conditionneur lui-même

Le conditionneur ajuste **déjà** une droite par les moindres carrés sur les
mesures de sa fenêtre glissante — une seconde par défaut — pour en tirer la
pente. L'écart entre les mesures et cette droite **est** le bruit : il est déjà
calculé, il suffit d'en publier le résidu, corrigé des deux degrés de liberté
que la droite consomme, comme le fait le calcul du serveur.

Aucune pièce nouvelle, aucun calcul en plus, et la couture de test existe déjà.

**Ce chiffre n'est pas celui du serveur, et l'écran doit le dire.** Le serveur
ajuste une fenêtre **centrée** : il voit les mesures avant et après chaque point.
La voiture ne connaît que le passé. Les deux valeurs sont voisines, pas égales,
et les comparer aveuglément ferait conclure à un défaut là où il n'y a qu'une
différence de méthode.

Il paraît en télémétrie sous « Qualité du signal », à côté de la cadence typique,
et entre dans le relevé périodique du journal — donc il part dès le cran
« Le minimum ».

### L'interrupteur de mise au point

**Les trois crans de remontée ne bougent pas.** C'est une échelle de vie privée —
qu'est-ce que j'accepte de laisser partir. La finesse du journal est une échelle
technique. Les mettre sur la même rangée forcerait qui veut du détail à accepter
aussi sa position, et le module de consentement l'interdit dans son propre
commentaire : *une promesse faite à l'utilisateur ne peut pas être écrite à
quatre endroits, un par nature de fichier, sans finir par diverger.*

Donc un **interrupteur séparé**, posé sous la rangée : **« Journal détaillé »**.
Il densifie ce qui part **au cran déjà choisi** et n'ouvre aucune nature de
fichier nouvelle — à « Le minimum », toujours ni position ni trace. Il ne demande
donc pas de consentement supplémentaire.

**Il s'éteint vingt-quatre heures après son activation**, à l'heure près et non
au jour près : activé à 23 h 30, il tient jusqu'au lendemain 23 h 30. Une
expiration au changement de date couperait en plein essai de nuit.

**Ce qui le signale comme exceptionnel**, et l'ordre compte :

- il est **hors de la rangée**, donc plus personne ne peut le lire comme « le
  dernier cran, donc le plus complet » ;
- son libellé dit **à qui il s'adresse** et non ce qu'il fait — « à n'activer que
  si on vous l'a demandé » ;
- son **expiration est affichée**, avec l'heure : un réglage qui s'éteint tout
  seul s'annonce de lui-même comme exceptionnel ;
- l'écran de conduite porte un **témoin** tant qu'il est actif, comme celui de la
  capture.

**Pas de couleur d'alerte.** Le rouge attire l'œil plus qu'il ne dissuade, et
annonce un danger qui n'existe pas : on ne dérègle rien, on dépose un journal
plus gros. Le traitement est discret — texte de note, pas de bouton coloré.

### Ce que le journal détaillé ajoute

- Le **relevé périodique passe de dix secondes à une seconde**.
- Il porte en plus les **seuils de la boîte** — montée et descente —, la
  **demande**, et l'**accélération brute** à côté de la lissée.

Ces quatre-là sont exactement les grandeurs dont l'absence a laissé des questions
ouvertes : un rapport qui passe au mauvais moment s'explique par le croisement du
régime et d'un seuil, et aucun des deux n'était inscrit.

**Le poids n'est pas un sujet** : les tranches de journal partent gzippées, et
seuls les profils et les relevés de mesure voyagent en clair.

**La liste des grandeurs doit pouvoir s'allonger** sans qu'on rouvre le sujet le
jour où un essai demande autre chose. C'est une contrainte de conception, pas une
fonctionnalité à livrer : ce qui s'ajoute au relevé détaillé doit tenir en un
endroit, pas en trois.

## Les coutures, et pourquoi celles-là

Trois, dont deux existent déjà — et aucune n'est nouvelle au sens d'un point
d'entrée à inventer.

| Ce qui se vérifie | Où | Art antérieur |
|---|---|---|
| Le bruit rendu par le conditionneur | `SpeedConditioner`, par ses sorties | `conditioner.test.ts` : signal fabriqué en entrée, grandeurs rendues en sortie |
| Ce qui s'inscrit au journal, et à quelle cadence | `JournalCollector`, par les événements produits | `collect.test.ts` : un instantané entre, des événements sortent |
| L'interrupteur est-il actif à cet instant | une fonction pure de (activé à, maintenant) | `retention/regle.ts`, même forme : une règle de date, vérifiée sans horloge réelle |

**Le bruit se vérifie par une propriété, pas par une valeur.** Un signal fabriqué
avec un bruit connu doit rendre ce bruit-là à la tolérance près, et un signal
parfait doit rendre zéro — y compris sur une rampe, où une droite suit exactement
le mouvement. C'est la même épreuve que celle de `measureNoise` côté serveur, et
le banc de positions fabriquées permet en plus de la mener à travers la vraie
source de géolocalisation.

**L'expiration se vérifie sans attendre vingt-quatre heures** : la fonction reçoit
l'instant, elle ne le lit pas. C'est ce qui permet d'éprouver le cas qui a motivé
la règle — activé à 23 h 30, encore actif à 0 h 30.

## Ce qu'on ne construit pas

- **La trace n'est pas enrichie.** Elle porte déjà tout à la cadence de
  l'appareil ; c'est le journal qui est pauvre.
- **Aucun nouveau cran de remontée.** Les trois restent, et l'interrupteur
  n'ouvre aucune nature de fichier.
- **Rien n'est envoyé qui ne l'était pas.** Le journal détaillé densifie, il
  n'élargit pas.
- **On ne corrige pas la boîte ici.** Ce lot fournit le chiffre qui dira si
  MOUVEMENT est fini ; il ne décide pas à sa place.
- **On ne réconcilie pas les deux mesures de bruit.** Celle du bord et celle du
  serveur diffèrent par construction ; on le dit, on ne l'efface pas.

## Critères d'acceptation

- [ ] La télémétrie affiche le bruit du récepteur, en km/h, à côté de la cadence
      typique, et dit qu'il est mesuré à bord.
- [ ] Le relevé périodique du journal le porte, dès le cran « Le minimum ».
- [ ] Sur un signal fabriqué sans bruit, la valeur rendue est nulle — rampe
      comprise ; sur un signal bruité connu, elle retrouve ce bruit.
- [ ] Un interrupteur « Journal détaillé » existe, hors de la rangée des trois
      crans, et n'ouvre aucune nature de fichier nouvelle.
- [ ] Il s'éteint vingt-quatre heures après son activation, à l'heure près, et
      l'écran dit jusqu'à quand.
- [ ] L'écran de conduite le signale tant qu'il est actif.
- [ ] Quand il est actif, le relevé passe à la seconde et porte les seuils de la
      boîte, la demande et l'accélération brute.
- [ ] Quand il ne l'est pas, rien ne change — même cadence, mêmes champs
      qu'aujourd'hui.
- [ ] Contrôle qualité vert.

## Les tickets

| # | Ticket | Bloqué par | Statut |
|---|---|---|---|
| 01 | [Le bruit du récepteur se lit dans la voiture](tickets/01-le-bruit-se-lit-dans-la-voiture.md) | aucun | ✅ |
| 02 | [Le journal détaillé s'allume, et s'éteint tout seul](tickets/02-le-journal-detaille-s-allume-et-s-eteint.md) | aucun | ✅ |
| 03 | [Ce que le relevé détaillé porte en plus](tickets/03-ce-que-le-releve-detaille-porte-en-plus.md) | 02 | ✅ |
| 04 | [Le chiffre, relevé en roulant](tickets/04-le-chiffre-releve-en-roulant.md) | 01 | 🧑 |

Les deux premiers sont indépendants et peuvent être menés en parallèle.

## Notes

**Ce lot répond à une question qui en attend une autre.** Une fois le bruit connu,
le tableau de MOUVEMENT dit quoi en conclure : sous 1,5 km/h la marge est
confortable, au-delà de 1,75 la boîte oscille encore en roulant. Le lot suivant,
s'il y en a un, dépend de ce chiffre — et il ne s'écrit pas avant.

**L'interrupteur sert au-delà de ce lot.** C'est l'outillage d'un essai en
voiture, pas le confort d'un ticket : chaque sortie depuis le 3 septembre a buté
sur une question à laquelle le journal ne répondait pas.
