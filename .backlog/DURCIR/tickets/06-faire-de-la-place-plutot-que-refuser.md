# 06 — Prévenir avant le plafond, et faire de la place plutôt que refuser

**Statut :** 🧑 attend David — demandé le 15 septembre 2026, trois points de
conception à trancher avant de découper

**Bloqué par :** rien ; le plafond lui-même est livré (REGIE, ticket 08)

## D'où ça vient

Le plafond livré **refuse** un dépôt et n'efface jamais rien. David, le
15 septembre 2026 : « ça serait malin de prévenir l'utilisateur quand il arrive à
75 % du quota, puis d'effacer les plus vieilles données à mesure que de nouvelles
arrivent quand il est à 95 % ou 100 % ».

Le fond est juste, et il pointe un défaut réel du refus : **il fait perdre le
présent pour garder le passé.** Le journal du trajet en cours vaut plus que celui
d'il y a trois mois, et c'est pourtant le premier que le refus jette.

## Ce qui est déjà tranché ailleurs, et qu'il ne faut pas défaire

- **Une seule règle efface, et c'est la rétention** (`core/retention/regle.ts`) :
  elle juge sur l'âge, respecte les épingles et les archives, et son verdict se
  lit avant d'agir. Une seconde règle qui effacerait sur la place finirait par ne
  plus dire la même chose que la première — le dépôt a déjà payé ce prix avec les
  cinq lectures de l'accélération (lot MOUVEMENT).
- **Un seuil inventé ne doit pas effacer** (DURCIR) : il fait disparaître des
  données sans que rien ne rougisse. Or le plafond vaut aujourd'hui 10 Gio, un
  nombre rond **proposé et non mesuré**.
- **L'épingle veut dire « ce trajet, je le garde ».** Ce qui l'efface la vide de
  son sens.

## Ce qu'on construirait

### a. Prévenir à 75 %

L'application ne sait aujourd'hui **ni ce qu'elle pèse, ni son plafond** : rien ne
le lui dit. Il faut donc que le serveur le rende — une route, ou la réponse du
dépôt lui-même — et que l'écran du compte l'affiche à côté d'« emporter ses
données ».

Rien à trancher ici : c'est utile, et ça ne défait rien.

### b. Faire tomber la rétention au lieu d'ouvrir un roulement

Plutôt qu'un roulement qui efface le plus ancien à l'aveugle, **déclencher un
passage de la règle de rétention sur ce compte** quand la place manque. C'est la
règle qui existe : elle garde les épingles et les archives, elle est testée, et
son verdict se lit.

Si après ce passage la place manque encore — un compte qui n'a que des trajets
épinglés —, on **refuse**, comme aujourd'hui. Le refus ne disparaît pas ; il
devient rare.

### c. Accepter d'abord, faire de la place ensuite

Le ménage se déclenche **après** avoir accepté le dépôt, pas avant : la voiture
ne perd jamais ce qu'elle vient d'enregistrer. Le motif existe déjà dans le
serveur — la reprise du profil mesuré court après un dépôt de trace, et son échec
ne fait pas échouer le dépôt.

Le dépassement momentané est borné par la taille d'une tranche, quelques dizaines
de kilo-octets.

## Les points à trancher

1. **Le seuil d'alerte** : 75 %, et où on le montre — écran du compte seul, ou
   aussi l'écran de conduite ?
2. **Le seuil de ménage** : 95 % ou 100 % ? Un ménage à 95 % laisse une marge
   pour les tranches qui arrivent pendant ; à 100 % on refuse au moins une fois
   avant que la place soit faite.
3. **Un trajet épinglé peut-il partir quand la place manque ?** Proposition :
   non, jamais — sinon l'épingle ne veut plus rien dire, et le refus reste la
   sortie pour un compte qui n'a que des épingles.

## Ce qu'on ne construit pas

- Pas de seconde règle d'effacement. Ce qui efface reste la rétention.
- Pas de suppression d'un trajet archivé (repris d'un ancien serveur) : ils ont
  été déménagés pour être gardés.

## Ce qui reste dû par ailleurs

La valeur du plafond est toujours le nombre rond que le ticket 04 devait
remplacer : le relevé de dépense quotidien tourne depuis le 14 septembre 2026 et
n'a pas été lu. À faire avant de régler quoi que ce soit sur des pourcentages
d'un chiffre inventé.
