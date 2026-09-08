# ESSAI-08 — quatre constats de l'essai du 8 septembre

**Statut :** 🔄 en cours — GPS corrigé, banc livré, son à mesurer, interface à cadrer
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

## Ce qui reste à mesurer

**Le son.** Une réponse de David tranche la première question : le mode
« procar » — la banque d'échantillons — ne souffre pas du défaut en roulant. La
chaîne audio de la voiture n'est donc pas en cause, et le défaut est dans la
synthèse.

Reste à savoir ce qui s'y passe. Deux variables changeaient ensemble entre le
ralenti et la conduite : le régime monte, et le bruit de roulement monte. La
mesure à faire ne demande plus la voiture — faire monter le régime au banc, à
l'arrêt, et voir si le timbre se dégrade déjà là.

Une piste à instruire : le régime transmis au moteur simulé est le régime
**net**, sans tremblement (`state.ts`), au motif que le modèle physique
produirait ses propres irrégularités. À régime établi, avec un dynamomètre qui
tient la consigne, il reste à vérifier que c'est vrai — un régime rigoureusement
constant donne un signal rigoureusement périodique, ce qui décrit assez bien
« une fréquence trop simple ».

**L'interface.** Le besoin est réel et chiffrable : `ConfigView.vue` fait 2 236
lignes, dix sections et soixante-cinq champs ; `SynthView.vue` en fait 1 030 et
`DriveView.vue` 1 063. Le périmètre d'une consolidation n'est pas cadré, et il
recoupe deux lots déjà ouverts — [MODE-SIMPLE](../MODE-SIMPLE/spec.md) et
[UI-DEFILEMENT](../UI-DEFILEMENT/spec.md). À reprendre par un entretien avant
tout découpage.

## Ce qui n'est pas tranché

1. ce que la mesure du son au banc donnera, et ce qu'on en fait ;
2. si la consolidation de l'interface est un lot neuf ou l'élargissement de
   MODE-SIMPLE ;
3. si `maximumAge: 0` doit être assoupli au démarrage — un changement de
   comportement du signal, qui demande sa propre mesure.
