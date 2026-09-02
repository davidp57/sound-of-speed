# BG-AUDIO — tenir le son quand le navigateur passe en arrière-plan

**Statut :** 🧑 attend David
**Branche :** `fix/bg-audio`
**Version visée :** 0.2

## Le problème

Relevé en roulant : **le son s'arrête net dès que le navigateur de la Tesla est
réduit.** L'application ne sert donc que si l'on renonce à la carte, ce qui est
exactement la situation qu'on veut éviter — un son de moteur s'écoute en
conduisant, pas en regardant l'application.

Le média silencieux censé maintenir la session audio existe pourtant, et il est
bien démarré : `activate()` appelle `startKeepAlive()`. Il ne suffit pas.

**Dribe, lui, y arrive** : son continue sans interruption, navigateur réduit. Et
ce n'est pas une affaire d'architecture — leur son est fait des mêmes
échantillons que le nôtre (`procar-on-low.wav` et les quatre autres, aux mêmes
noms), monté de la même façon : `decodeAudioData`, une `BufferSource` en boucle
par couche, un gain par couche, une somme, la destination. Ils ont même le fondu
à puissance constante en cosinus. La différence est entièrement dans la
plomberie autour du média silencieux.

Relevé dans leur code, chunk par chunk :

| | Speed | Dribe |
|---|---|---|
| Insertion | `new Audio()`, **jamais dans le DOM** | `document.body.appendChild`, `display:none` |
| Source | `blob:` d'un WAV **fabriqué en mémoire** | **fichier réel** servi, `<source type="audio/mpeg">` |
| Durée | **4 s**, donc un passage de boucle toutes les 4 s | **597 s**, donc presque jamais |
| Reprise du contexte | `setInterval` de 2 s | **aucune** en arrière-plan, seulement au retour |

Leur fichier : `/audio/silence/silence-600.mp3`, 583 Ko, 597 s, MP3 mono à
8 kbit/s. Le reste est identique au nôtre — `loop`, `volume = 1`, `preload`,
`playsinline`, et `playbackState` tenu à jour sur la session média.

Deux enseignements. D'abord **le silence n'est pas le problème** : leur fichier
s'appelle « silence » et il fonctionne. Ensuite **ils n'ont aucun chien de garde
en arrière-plan**, ce qui veut dire que chez eux le contexte n'est jamais
suspendu : la session média tient toute seule. Notre `setInterval` de 2 s
combattait un symptôme, et il est de toute façon gelé au moment précis où il
servirait.

Restent donc trois écarts, par ordre de vraisemblance : l'élément hors du
document, le `blob:`, et la boucle courte. Le navigateur de la Tesla est un
Chromium ancien, et un `blob:` porté par un élément détaché du document est
exactement le genre de chose que sa pile média peut refuser de traiter comme une
lecture véritable.

## La solution

Aligner le média silencieux sur celui qui marche, et **rendre l'échec visible**
au lieu de l'avaler. Aujourd'hui `play()` est suivi d'un `.catch(() => undefined)` :
si la Tesla refuse, rien ne le dit, ni à l'écran ni ailleurs.

Les deux vont dans le même lot pour qu'**un seul essai en voiture** tranche :
soit le son tient, soit le bloc de télémétrie dit lequel des trois écarts reste
en cause. Le réglage « son en arrière-plan » devient le moyen de comparer avec
et sans, au volant.

Et puisque le son tiendra, la vitesse doit tenir aussi : le GPS espace fortement
ses mesures en arrière-plan, et rien ne le relance aujourd'hui.

## Histoires

1. En tant que conducteur, je veux que le son continue quand je reviens à la
   carte, parce que c'est là que je conduis.
2. En tant que conducteur, je veux que la vitesse continue d'être suivie en
   arrière-plan, sinon le son se figera sur la dernière mesure.
3. En tant que David au volant, je veux voir sur l'écran Télémétrie si le média
   de maintien joue, si le contexte a été suspendu et ce que le navigateur a
   refusé — sans ouvrir de console, ce qui est impossible en conduisant.
4. En tant que David, je veux pouvoir couper le maintien de session pour
   comparer, puisque c'est le seul moyen d'attribuer un changement à sa cause.

## Décisions d'implémentation

- **Un fichier de silence réel, servi, et long.** Deux minutes à 8 kbit/s en
  MP3, soit environ 120 Ko : assez long pour que le passage de boucle soit rare,
  assez léger pour le cache hors réseau. `ffmpeg` est déjà l'outil du dépôt
  (`scripts/transcode.mjs` s'en sert), donc le fichier se produit en une
  commande et le script qui le produit est versionné avec lui.
- **Le fichier va dans `public/`, pas dans `public/audio/`** : cette
  arborescence n'est pas versionnée — c'est celle des échantillons, qui vivent
  dans un volume du NAS. Le silence, lui, appartient à l'application : il doit
  être dans l'image et dans le cache hors réseau.
- **L'élément est construit et inséré comme le leur** : `<audio>` avec un
  `<source type="audio/mpeg">`, `loop`, `volume = 1`, `preload="auto"`,
  `playsinline`, `display:none`, ajouté à `document.body` — et retiré du
  document quand on coupe le maintien.
- **Le chien de garde à `setInterval` est conservé, mais compté.** C'était le
  point 3 du plan annoncé, et je le change délibérément : le retirer serait un
  pari sur une hypothèse, et une régression possible sur les téléphones où il
  sert peut-être. Ce qui manque n'est pas de le supprimer, c'est de **savoir
  s'il se déclenche**. S'il ne se déclenche jamais en voiture, il partira dans
  un lot suivant, sur preuve.
- **Le chien de garde GPS vit dans `core/`**, comme une petite pièce à part
  plutôt qu'une condition noyée dans l'assemblage : il est ainsi testable sans
  navigateur. Il ne peut pas reposer sur un minuteur — gelé en arrière-plan
  comme le reste — donc il est interrogé à chaque tour de boucle, laquelle
  continue de battre grâce à l'horloge `AudioWorklet`.
- Vingt secondes de tolérance avant de relancer le suivi, et pas de relance plus
  d'une fois toutes les cinq secondes : les mêmes ordres de grandeur que chez
  eux, qui ont l'expérience de la voiture.

## Décisions de test

Ce qui se teste sans navigateur : le **chien de garde GPS**, entièrement, parce
qu'il est écrit comme une pièce de `core/` qui ne connaît que des nombres.

Ce qui ne se teste pas ici : l'élément média, la session audio, le contexte
suspendu. Ils demandent un navigateur, et le seul qui compte est celui de la
voiture. C'est précisément pourquoi le lot livre de l'instrumentation plutôt que
des tests sur ce point — la vérification est un essai sur route, et le bloc de
télémétrie en est le compte rendu.

## Hors périmètre

- Le comportement du GPS écran éteint, qui reste dans « Ce qui n'est pas
  vérifié » du README : ce lot lui donne une chance, il ne le prouve pas.
- La détection du navigateur Tesla par son identifiant (`qtcarbrowser`), que
  Dribe pratique. À n'introduire que si l'essai montre qu'un chemin particulier
  est nécessaire : un cas spécial non justifié est une dette.
- Le recalage des profils livrés.

## Ce que le lot a donné

Les quatre tickets sont écrits et vérifiés dans le navigateur de développement :
le média de maintien est **dans le document**, il **joue**, en boucle, sur
`/silence.mp3` typé `audio/mpeg` — 118 Ko pour deux minutes à 8 kbit/s — et le
bloc « Arrière-plan » apparaît sur l'écran Télémétrie entre « Son » et
« Mixage des couches ». Le chien de garde GPS est couvert par dix tests.

Mais **rien de tout cela ne prouve que le son tiendra dans la Tesla** : le seul
navigateur qui compte est celui de la voiture, et il n'est pas ici. Le lot reste
donc à 🧑 jusqu'à l'essai. Ce qu'il faudra regarder, dans le bloc
« Arrière-plan », après avoir réduit le navigateur puis être revenu :

| Ce qu'on lit | Ce que ça veut dire |
|---|---|
| Maintien de session : **joue** | le média a tenu ; si le son s'est tout de même arrêté, la cause est ailleurs |
| Maintien de session : **arrêté** | le navigateur a coupé le média ; regarder la ligne « Refus du navigateur » |
| **Refus du navigateur** renseigné | la Tesla a refusé la lecture, et dit pourquoi |
| **Reprises du contexte** à 0 | le contexte n'a jamais été suspendu — la surveillance périodique ne sert à rien et partira |
| **Reprises du contexte** non nul | le contexte a bien été suspendu, et la surveillance a servi |
| **Relances du suivi** non nul | le GPS s'est tu plus de vingt secondes, et a été relancé |

## Notes

Le lot est écrit à la main : il naît d'une conversation et d'une lecture du code
de Dribe, pas d'un entretien. Les mesures citées ont été relevées en direct sur
`dribe.app` — taille et durée du fichier de silence, présence des appels, noms
des échantillons.
