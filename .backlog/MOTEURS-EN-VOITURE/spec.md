# MOTEURS-EN-VOITURE — essayer les moteurs simulés au volant

**Statut :** 🔄 en cours

## Le besoin, dans les mots de David

> « la page de réglage des moteurs c'est pour nous, sur PC ; rien à faire dans
> l'app en voiture. En voiture on peut choisir un profil de synthèse, avec le
> choix du moteur (profil préréglé sur PC), le choix de l'échappement (plus ou
> moins de convolution) et de l'endroit d'où on écoute (intérieur / extérieur).
> On ajoutera des curseurs si besoin plus tard. »

> « on pourra choisir les autres profils moteur en voiture aussi ? j'aimerais
> bien en tester plusieurs »

Le banc de synthèse est un atelier : vingt-huit valeurs de moteur, la
fréquence de simulation, la taille de bloc. Rien de tout cela ne se règle en
conduisant. Ce qui doit passer en voiture, c'est le **choix** — quel moteur,
quel échappement, écouté d'où — et rien de plus.

## Ce qui existe déjà

- Le moteur vit **dans le profil** (`activeProfile.engineDefinition`), et
  l'écran de synthèse l'y écrit.
- Un profil déclare déjà que son son vient de la synthèse plutôt que de la
  banque d'échantillons (`soundOrigin === 'live'`).
- Huit moteurs sont **en bibliothèque** (`core/preset/engine-library.ts`),
  chacun avec sa définition et son rupteur.
- Le point d'écoute existe comme réglage — le silencieux a déjà des repères
  « dedans » et « dehors » — mais il n'est pas présenté comme un choix.

## Ce qui manque

**Les réglages qui font le son ne font partie de rien.** Résonance
d'échappement, volume, silencieux, crête visée, réponse d'échappement : tout
vit dans un `synthSettings` global, en mémoire, **perdu au rechargement de la
page**. Un moteur réglé à l'atelier n'emporte donc rien de son réglage.

## Deux décisions de structure

### 1. Les réglages de rendu appartiennent au moteur, pas à la voiture

David veut essayer plusieurs moteurs **en roulant**. Si les réglages de rendu
étaient attachés au profil de voiture, chaque moteur essayé sonnerait avec les
réglages du précédent — donc mal, et sans qu'on sache si c'est le moteur ou le
réglage qu'on entend.

Ils vont donc dans `LibraryEngine`, à côté de la définition : choisir un moteur
amène **son** échappement, **son** volume, **sa** crête visée. Le profil en
garde une copie modifiable, comme il garde déjà une copie modifiable de la
définition — c'est ce qui permet d'affiner au banc sans toucher à l'usine.

### 2. La réserve reste une préférence d'appareil

`reserveMs` décrit la machine qui calcule, pas le moteur : c'est l'arbitrage
entre la latence et le risque de creux. David tient 60 ms, mesuré sans un seul
creux — **sur PC**. Embarquer 60 ms dans un moteur d'usine imposerait cette
latence à un téléphone qui n'a pas la même marge, et le creux serait attribué
au moteur.

Elle reste donc là où elle est, avec les réglages du calcul.

## Périmètre

1. Un type `SynthRendering` — ce qui fait le son, séparé de ce qui décrit le
   calcul. Il entre dans le profil, avec montée de `PROFILE_FORMAT_VERSION` et
   reprise des profils déjà enregistrés.
2. Chaque moteur de la bibliothèque porte son rendu d'usine. Le GM reçoit les
   valeurs relevées par David.
3. L'écran de conduite gagne trois choix : le moteur, l'échappement, le point
   d'écoute. Pas de curseur.
4. Le banc ne bouge pas : il reste l'atelier, PC seulement.

Hors périmètre, à traiter séparément : pousser les relevés de mesure sur le
NAS.

## Les réglages relevés par David, le 6 septembre 2026

| Réglage | Valeur | Défaut d'avant |
|---|---|---|
| Volume | 0,70 | 0,25 |
| Résonance d'échappement | 0,45 | 1,00 |
| Réponse d'échappement | V8 Chevrolet 454 (`smooth_39`) | inchangé |
| Crête visée | 32 000 (0,98) | 12 000 |
| Réserve | 60 ms | 120 ms |

Le silencieux n'a pas été touché : 22 kHz, c'est-à-dire transparent.

**À vérifier** : à crête visée 32 000 et volume 0,70, la sortie écrête
franchement. David ne l'entend pas — vérifié deux fois — mais le taux réel n'a
pas été relevé dans sa configuration finale. S'il est élevé, le son d'usine du
GM sera un son écrêté en permanence, et c'est une décision à prendre les yeux
ouverts.
