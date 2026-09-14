# 04 — La bande passe sur les autres écrans, et seulement au doigt

**Statut :** ✅ fait — 14 septembre 2026

**Bloqué par :** aucun — [02](02-bande-de-defilement.md) l'avait posée sur un
seul écran.

## Ce qui a déclenché

David, le 14 septembre 2026, en reprenant les lots bloqués : « UI-DEFILEMENT
c'est bon mais uniquement dans l'écran paramètres ; à étendre aux autres écrans,
uniquement en voiture et téléphone (pas PC) ».

## Ce que la mesure a montré avant d'écrire

**Les deux moitiés du lot n'avaient pas le même périmètre**, et une seule était
à étendre :

- le comportement tactile des curseurs (ticket 01) était déjà déclaré **une fois
  pour toutes** dans `src/style.css`, sur `input[type='range']` — donc sur les
  quatre écrans qui montrent des curseurs, pas seulement la configuration. Et il
  ne concerne que le tactile : un poste à la souris n'est pas visé, sans qu'on
  ait à l'exclure ;
- la bande, elle, était écrite en dur dans `ConfigView.vue`.

Il n'y avait donc qu'une chose à déplacer.

## Ce qu'il faut obtenir

La bande à gauche de **tout écran qui se lit en colonne** : télémétrie,
étalonnage, compte, aide, et la configuration comme avant. Elle ne paraît que
sur un appareil `voiture` ou `telephone` — l'axe posé par le ticket 14 de
[COMPTES](../../COMPTES/spec.md), corrigeable à la main dans l'écran du compte
quand la détection se trompe.

**L'écran de conduite n'en reçoit pas.** Il ne défile pas, et la bande prendrait
aux cadrans une largeur qui leur manque déjà.

## Ce à quoi il a fallu faire attention

**La bande se pose sur le contenu, jamais sur le conteneur qui défile.** C'est
ce que faisait déjà la configuration sans le dire : un fond absolu dans
l'élément défilant reste collé au haut de la fenêtre et sort de vue au premier
glissement. Elle est donc portée par un enveloppe d'écran qui fait toute la
hauteur du contenu, `min-height: 100%` pour couvrir aussi les écrans courts.

L'aide est un panneau qui couvre l'écran et défile pour son compte : elle porte
la même enveloppe, à l'intérieur.

## Critères d'acceptation

- [x] La bande est à gauche de la télémétrie, de l'étalonnage, du compte et de
      l'aide, en plus de la configuration — relevé en mode voiture : classe
      posée, bande de 44 px, retrait de 60 px
- [x] Aucune bande sur un poste de travail — relevé sur les quatre écrans,
      retrait de 0 px
- [x] Aucune bande sur l'écran de conduite, quel que soit l'appareil
- [x] La bande couvre toute la hauteur du contenu, y compris sur un écran plus
      court que la fenêtre
- [x] Un seul endroit la décrit : `src/style.css`, classe `.bande-defilement`
- [ ] 🧑 Vérifié dans la voiture : elle se trouve au pouce sur chaque écran
