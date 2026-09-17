# 13 — Le son ne doit jamais repartir quand la boîte est au repos

**Statut :** ✅ fait — 17 septembre 2026, cause trouvée et mesurée dans
l'application, au volume coupé

David, après la sortie du 16 septembre 2026 :

> « Quand on change le profil (en mode P) le son reprend alors qu'on est encore
> en P. **On ne doit jamais allumer le son en mode P.** »

La seconde phrase est une règle, pas la description d'un cas : ce n'est pas
seulement le changement de profil qu'il faut corriger, c'est toute voie qui
rallume le son au repos.

## Ce qui est établi

Changer de profil déclenche le rechargement des échantillons quand la signature
des couches change — `sampleSignature` dans `src/state.ts`, qui appelle
`audio.load()`. Et **`load()` démarre les voix** : pour chaque couche, il crée un
gain, le met à zéro, puis appelle `startVoice()` avec une position de départ
tirée au sort (`core/audio/engine.ts`).

Les gains partent donc à zéro. Ce qui reste à établir est **qui leur redonne du
niveau alors que la boîte est au repos** : le mixage appliqué une fois après le
chargement, la reprise du contexte audio suspendu, ou un chemin qui ne consulte
pas l'état de marche.

Rien n'est conclu ici : c'est la première chose à mesurer, et elle se voit au
poste de travail sans rouler — passer au repos, changer de profil, regarder le
gain du bus.

## La règle à faire tenir

Au repos, aucune voie ne produit de son. Ni un changement de profil, ni un
changement de banque, ni un rechargement, ni la reprise d'un contexte suspendu.

Un test doit la tenir, sans quoi elle se reperdra au prochain chemin ajouté :
c'est le genre de défaut qui revient par une porte qu'on n'avait pas prévue.

## Critères d'acceptation

- [x] Au repos, changer de profil ne produit aucun son — vérifié dans
      l'application, pas seulement au test.
- [x] Même chose pour un changement de banque et pour un rechargement des
      couches.
- [x] Un test tient la règle au niveau du mixage : au repos, le gain de sortie
      est nul quelle que soit la voie empruntée. Six cas dans `mix.test.ts`.
- [x] Le son repart normalement dès qu'on remet en marche.

## Ce qui se passait, et ce qui a été mesuré

**La cause est la cadence, pas le chargement.** `stop()` détache bien ce que
l'horloge du fil audio appelle, mais il ne l'arrête pas — le worklet continue de
battre. Or `syncDriver()` ne consultait l'état de marche que dans une seule de ses
deux branches : celle de la boucle d'affichage. La branche du fil audio, elle,
rebranchait son horloge sans rien demander. Il suffisait donc qu'une voie
quelconque rappelle cette fonction pour que tout reparte, et changer de profil le
faisait — le rechargement des couches finit par `refreshAudioStatus`, qui appelle
`syncDriver`. Les gains partaient bien à zéro comme le ticket le supposait ; c'est
le tour de boucle suivant qui les relevait.

**Deux gardes, parce qu'une seule ne tient que le chemin connu.**

1. `syncDriver()` ne branche plus aucune des deux cadences au repos.
2. `computeMix()` rend des gains nuls au repos, et c'est là que vit la règle :
   c'est le seul point par lequel toutes les voies passent. Les couches gardent
   leur ordre et leur hauteur, seul le niveau tombe.

Deux autres voies ont été fermées en cherchant : changer d'origine du son au repos
démarrait le moteur simulé (`applySoundOrigin`), et le bouton « Activer le son »
restait cliquable au parking — il est grisé, et `activateAudio()` ne fait plus rien
au repos.

## La mesure

Faite dans l'application, **volume général à 0,001** (−60 dB, inaudible), sur le
signal lui-même : un analyseur lu à la main plutôt que le niveau affiché, qui est
une valeur périmée dès que la boucle s'arrête — zéro mesure prise en trois secondes
au repos.

| État | Pic du signal |
|---|---|
| En marche, au ralenti | 3,4·10⁻⁴ |
| Au repos | **0** |
| Au repos, après changement de profil — **avant correctif** | 0,9 à 1,4·10⁻⁴, huit relevés tous différents |
| Au repos, après changement de profil — **après correctif** | **0**, six relevés |
| Remise en marche | 3,0 à 4,9·10⁻⁴ |

Le protocole a été vérifié des deux côtés : gardes neutralisées, il retrouve le
défaut ; gardes en place, il rend zéro. Deux banques différentes ont été
traversées, ce qui couvre aussi le changement de banque.
