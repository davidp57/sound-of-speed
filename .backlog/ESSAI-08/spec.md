# ESSAI-08 — quatre constats de l'essai du 8 septembre

**Statut :** 🧑 attend David — tout est livré, restent deux écoutes en roulant
**Branches :** `fix/essai-08`, `feature/banc-et-gps-au-demarrage`, `feature/moteur-qui-respire`
**Versions :** 0.1.64 à 0.1.66

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

**Une position déjà connue du système est acceptée, jusqu'à dix secondes.**
`maximumAge: 0` la refusait, ce qui faisait attendre un point neuf à chaque
démarrage. Dix secondes, parce qu'une position de dix secondes annonce une
vitesse de dix secondes : prise garé elle dit zéro, prise en roulant elle est
proche de l'allure du moment.

Reste un fait sans correctif, et il n'en demande pas : l'autorisation de
localisation se donne par adresse, production et intégration en ont donc chacune
une.

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

**Le dynamomètre ne fait pas respirer le moteur.** Le code annonçait que
baisser son couple « laisse le régime respirer entre les explosions ». Balayé à
2 950 tr/min, en livres-pied :

| couple | demandé | entendu | écart |
|---|---|---|---|
| 10 000 | 2 955 | 2 955 | 0 |
| 40 | 2 944 | 2 944 | 0 |
| 30 | 2 959 | 2 728 | −231, figé |
| 25 | 2 963 | 2 576 | −387, figé |
| 20 | 2 941 | 2 435 | −506, figé |

Le moteur n'oscille à aucun réglage : il tient exactement la consigne, ou il
s'établit plus bas et tout aussi figé. Le baisser ne fait pas respirer le
régime, il le fausse.

Le curseur avait d'abord été exposé, à la demande de David ; il a été retiré le
jour même, celui-ci ayant relevé qu'« ça ne sert à rien en l'état ». C'était
juste : au-dessus de quarante il ne change rien, en dessous il fausse le régime.
La mesure est écrite sur `dynoTorque` dans `core/synth/settings.ts`, là où
quelqu'un serait tenté de recommencer.

Une réserve sur cette mesure : le régime tenu est publié quatre fois par
seconde, et une oscillation à la fréquence des explosions — une centaine de
hertz — n'y apparaîtrait que comme du bruit d'échantillonnage. Deux relevés
successifs donnent le même chiffre au tour près, ce qui rend une telle
oscillation très improbable, mais ne l'exclut pas formellement.

**Reste les deux bruits d'engine-sim**, réglables à chaud, et que le projet a
uniformisés pour toute la bibliothèque à 0,15 et 0,05 — là où les fichiers
d'origine déclaraient jusqu'à 0,195 de bruit et 0,5 de gigue. C'est le seul
levier qui reste, et son réglage est un jugement d'oreille : un chiffre ne dira
pas lequel sonne juste.

**L'interface.** Tranché par David le 8 septembre : c'est un **lot neuf**,
[MENAGE-UI](../MENAGE-UI/spec.md), et non l'élargissement de MODE-SIMPLE — « faut
faire du ménage ». Le périmètre y est décrit, et attend un entretien avant tout
découpage.

## Ce qui n'est pas tranché

1. ce que l'oreille dira des deux bruits d'engine-sim, seul levier qui reste
   après la mesure du dynamomètre — la gigue est à 0,05 pour toute la
   bibliothèque, contre 0,195 et 0,5 dans les fichiers d'origine.

Tout le reste est tranché : le régime transmis au moteur simulé est désormais le
régime **entendu**, celui qui porte le tremblement, et le couple du dynamomètre
n'est exposé nulle part — la mesure a montré qu'il n'a aucun emploi utile.
