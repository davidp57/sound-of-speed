# 14 — L'appareil porte les fonctions, et le drapeau de construction s'en va

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** [06 — Les rôles ouvrent les écrans](06-les-droits-ouvrent-les-ecrans.md),
qui pose l'autre axe et le croisement.

**Ouvert le 13 septembre 2026**, sur un recadrage de David : ce qu'un écran
demande tient sur deux axes. Le rôle est au ticket 06 ; l'appareil est ici.

## Ce qu'il faut obtenir

Ce qu'on voit dépend d'où l'on est. Un banc de simulation n'a rien à faire sur
l'écran d'une voiture qui roule ; un atelier n'a rien à faire sur un téléphone.

| | voiture | téléphone | PC |
|---|---|---|---|
| Conduite | ✅ | ✅ | ✅ |
| Télémétrie | ✅ | ✅ | ✅ |
| Compte | simple | complet | complet |
| Configuration | simple | étendu | tout |
| Étalonnage | ❌ | ✅ | ✅ |
| Banc (simulateur) | ❌ | ✅ | ✅ |
| Atelier | ❌ | ❌ | ✅ |
| Synthèse | ❌ | ❌ | ✅ |

Un écran s'ouvre quand l'appareil le porte **et** qu'un rôle du compte l'ouvre.
Les deux axes se croisent par un et, jamais par un ou.

`__BENCH__` disparaît avec ce ticket : le banc ne se cache plus à la
construction, il se cache parce qu'on est dans une voiture. Une seule image sert
les trois usages.

## Ce à quoi il faut faire attention

- **La détection se corrige.** On devine l'appareil — le navigateur de la
  voiture s'annonce, un téléphone aussi —, et l'écran du compte laisse changer
  ce choix, qui reste local à cet appareil. Sans recours, un poste posé dans la
  voiture ou un cas non prévu se retrouverait coincé ; et reconnaître un
  navigateur à sa chaîne d'agent est un pari qui vieillit mal.
- **Cet axe ne se défend pas**, et n'a pas à l'être : il ne protège rien, il
  range. Le serveur l'ignore — voir le ticket 06.
- **La profondeur des réglages n'est pas ici.** « Simple », « étendu » et
  « tout » désignent le tri des réglages de Configuration, qui est le travail de
  [MENAGE-UI](../../MENAGE-UI/spec.md) et de son classeur. Ce ticket ouvre et
  ferme des écrans entiers ; le tri fin vient avec ce lot-là.
- **L'atelier n'a pas encore d'écran.** Fabriquer un moteur se fait aujourd'hui
  depuis Configuration et Synthèse. Sa ligne dans le tableau attend
  [ATELIER](../../ATELIER/spec.md) ; d'ici là, elle n'ouvre rien.
- **Le poids suit.** Une seule image qui porte les trois usages fait tirer à la
  voiture du code qu'elle n'ouvrira pas. C'est ce que mesure le
  [ticket 08](08-le-poids-charge-par-la-voiture.md), et c'est ce ticket-ci qui
  crée la situation qu'il mesure.

## Critères d'acceptation

- [x] L'appareil est deviné, et le choix se corrige depuis l'écran du compte
- [x] Le choix corrigé survit à une réouverture, et reste local à cet appareil
- [x] Les écrans suivent le tableau ci-dessus, croisés avec les rôles
- [x] `__BENCH__` a disparu, et une seule image sert les trois usages
- [x] Le banc et la synthèse n'apparaissent pas sur l'écran de la voiture

## Ce qui a été mesuré

Application construite **sans** `BENCH`, servie par le serveur construit,
navigateur réel :

| Ce qui a été fait | Ce qu'on a vu |
|---|---|
| Premier chargement, agent d'un poste Windows | Sept onglets, Synthèse et Banc compris — en production |
| « Voiture » choisi dans l'écran du compte | Quatre onglets : Conduite, Télémétrie, Configuration, Compte |
| Rechargement | Le choix tient ; la rangée des sources de vitesse reste absente |
| Simulateur actif, puis « Voiture » choisi | La source repasse au GPS toute seule |

**Ce qui n'a pas pu être vérifié :** le marqueur qui reconnaît le navigateur de
la voiture. Le journal que la voiture dépose ne porte pas sa chaîne d'agent, et
le volume du NAS n'a pas de base à interroger. Un premier lancement en voiture le
dira ; en attendant, la correction manuelle est le filet.
