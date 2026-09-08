# ESSAI-08 — quatre constats de l'essai du 8 septembre

**Statut :** 🔄 en cours — GPS corrigé, banc livré, son mesuré, interface à cadrer
**Branche :** `fix/essai-08`
**Version visée :** 0.1.64

## Ce qui a déclenché

Un essai sur route le 8 septembre 2026, sur l'image `develop`. Quatre constats,
rapportés par David :

- **le GPS ne démarre pas.** Départ d'un parking souterrain ; aucune vitesse.
  Le suivi n'a fini par fonctionner qu'après avoir lancé l'ancienne version
  déployée en production, obtenu un signal avec elle, puis rebasculé sur
  `develop` ;
- **le son de la synthèse sonne faux en roulant.** Plusieurs moteurs essayés ;
  l'EJ25 et le Hayabusa rendent bien au ralenti, mais dès qu'on roule le son
  devient synthétique, « trop propre, une fréquence trop simple ». David avance
  une piste : la chaîne audio de la voiture qui filtrerait ;
- **l'interface est devenue compliquée** et demande une passe de
  consolidation ;
- **le dépôt refuse les identifiants.** Reste à vérifier de son côté si les
  identifiants employés étaient les bons.

## Ce que la lecture du code établit

Deux constats sur quatre ont une cause identifiée sans rouler.

**Le chien de garde du GPS est aveugle au démarrage à froid.** Il se déclenche
sur le silence de la source, `sinceLastSampleMs`, que le conditionneur calcule
ainsi (`core/speed/conditioner.ts`) :

```ts
const sinceLastSampleMs =
  this.lastSampleReceivedAt > 0 ? now - this.lastSampleReceivedAt : 0
```

Tant qu'**aucune** position n'est jamais arrivée, `lastSampleReceivedAt` vaut
zéro, donc le silence vaut zéro, donc il ne dépasse jamais les vingt secondes
qui déclencheraient une relance. Le chien de garde couvre la perte du signal en
route ; il ne couvre pas le cas où le signal n'a jamais été acquis. C'est
exactement le départ en souterrain : pas de premier point, donc pas de relance,
donc rien ne repart quand on ressort à l'air libre.

Deux détails s'y ajoutent, à confirmer :

- `watchPosition` est appelé avec `maximumAge: 0`, ce qui interdit d'employer
  une position déjà connue du système — celle-là même que l'ancienne version
  avait obtenue ;
- production et intégration sont deux adresses distinctes, donc deux
  autorisations de géolocalisation distinctes. Tant que la demande d'accord
  n'est pas répondue, le compte à rebours de quinze secondes ne court pas :
  aucune erreur n'est remontée et l'écran reste sur « démarrage » sans rien
  dire.

**Le dépôt : rien à corriger.** La piste ouverte ici — le fichier de mots de
passe non monté, la ligne étant commentée dans les trois modèles de pile — était
fausse pour la pile réellement déployée, qui le monte bien. David, le
8 septembre : le fichier déposé ne contenait pas le compte qu'il avait saisi. Le
message affiché par l'application sur un refus disait déjà juste. Point clos.

## Ce qui a été corrigé

**Le suivi GPS repart d'un démarrage à froid.** L'attente d'une première mesure
s'ouvre à la mise en marche, et non à la première mesure reçue. Mesuré sur une
source muette, dans le navigateur : le compteur de silence passe de 0 ms figé à
250 s, et le suivi est relancé toutes les cinq secondes au lieu de jamais.
L'écran de conduite annonce le silence, le nombre de relances, et distingue une
source qui n'a jamais rien reçu d'une source qui s'est tue en route.

Deux pistes secondaires restent ouvertes, sans changement pour l'instant :
`maximumAge: 0` interdit d'employer une position déjà connue du système, et
l'autorisation de localisation se donne par adresse — production et intégration
en ont chacune une.

**Les écrans de banc sont dans l'image `:develop`.** Simulateur de vitesse et
écran de réglage de la synthèse, absents de la production. Le drapeau `BENCH=1`
est posé par le workflow pour cette étiquette et pour elle seule.

## Ce que la mesure du son a donné

Une réponse de David tranche la première question : le mode « procar » — la
banque d'échantillons — ne souffre pas du défaut en roulant. La chaîne audio de
la voiture n'est donc pas en cause, et le défaut est dans la synthèse.

Mesuré au poste le 8 septembre 2026, dans le navigateur, sur la sortie du moteur
simulé captée avant les haut-parleurs (analyse par transformée de Fourier sur
32 768 points, résolution 1,5 Hz) :

**Le moteur simulé ne respire pas.** Le régime tenu est **exactement** le régime
demandé : 780 pour 780 au ralenti, 2 952 pour 2 952 en roulant. Le dynamomètre
travaille au couple maximum que le domaine autorise — `dynoTorque: 10000`, la
borne haute — et écrase toute fluctuation. Un moteur réel, même à régime
stabilisé, oscille à chaque cycle.

Cela contredit ce que `state.ts` affirme pour justifier de transmettre au moteur
simulé le régime **net** plutôt que le régime entendu : « le tremblement que le
moteur à échantillons ajoute à la main sort tout seul du modèle physique ». Il
n'en sort pas. Le son synthétisé n'a donc aucune variation de régime, nulle
part, et un régime rigoureusement constant donne un signal rigoureusement
périodique — ce qui décrit bien « une fréquence trop simple ».

**La fréquence de simulation n'est pas le facteur limitant.** Hypothèse
essayée : à 10 kHz de simulation, un cycle moteur serait décrit par trop peu de
points quand le régime monte. Passée à 20 kHz, à régime égal (2 952), le spectre
ne s'enrichit pas — le centroïde monte de 1 833 à 2 018 Hz mais l'énergie se
concentre davantage, pas moins. Et le calcul tombe à ×0,99 du temps réel, avec
neuf creux et 35 ms de silence : inexploitable de toute façon.

**Trois leviers, dont un inaccessible.** Le couple du dynamomètre décide de la
raideur avec laquelle le régime est tenu ; il est déjà transmis à chaud au
calculateur, mais **aucun réglage ne l'expose** dans l'écran de synthèse. Les
deux bruits d'engine-sim, eux, sont réglables à chaud — et le projet les a
uniformisés pour toute la bibliothèque, à 0,15 et 0,05, là où les fichiers
d'origine déclaraient jusqu'à 0,195 et 0,5 de gigue.

Ce qui reste à faire est un jugement d'oreille, pas une mesure : ces trois
leviers changent un timbre, et un chiffre ne dira pas lequel sonne juste.

**L'interface.** Le besoin est réel et chiffrable : `ConfigView.vue` fait 2 236
lignes, dix sections et soixante-cinq champs ; `SynthView.vue` en fait 1 030 et
`DriveView.vue` 1 063. Le périmètre d'une consolidation n'est pas cadré, et il
recoupe deux lots déjà ouverts — [MODE-SIMPLE](../MODE-SIMPLE/spec.md) et
[UI-DEFILEMENT](../UI-DEFILEMENT/spec.md). À reprendre par un entretien avant
tout découpage.

## Ce qui n'est pas tranché

1. si l'on expose le couple du dynamomètre dans l'écran de synthèse, pour que le
   levier soit essayable dans la voiture ;
2. si le régime transmis au moteur simulé devient le régime **entendu**, celui
   qui porte le tremblement — le motif écrit pour ne pas le faire est démenti
   par la mesure, mais le tremblement décroît avec le régime et n'attaquerait
   donc qu'une part du défaut ;
3. si la consolidation de l'interface est un lot neuf ou l'élargissement de
   MODE-SIMPLE.
