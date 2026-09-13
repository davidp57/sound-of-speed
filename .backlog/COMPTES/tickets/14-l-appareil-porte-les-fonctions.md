# 14 — L'appareil porte les fonctions, et le drapeau de construction s'en va

**Statut :** ⬜ prêt

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

- [ ] L'appareil est deviné, et le choix se corrige depuis l'écran du compte
- [ ] Le choix corrigé survit à une réouverture, et reste local à cet appareil
- [ ] Les écrans suivent le tableau ci-dessus, croisés avec les rôles
- [ ] `__BENCH__` a disparu, et une seule image sert les trois usages
- [ ] Le banc et la synthèse n'apparaissent pas sur l'écran de la voiture
