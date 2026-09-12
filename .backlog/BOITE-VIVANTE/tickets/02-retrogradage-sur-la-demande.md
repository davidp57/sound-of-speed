# 02 — Le rétrogradage forcé répond à une demande, pas à un niveau

**Statut :** ✅ fait

**Bloqué par :** 01 — La boîte reçoit l'accélération

## Ce qu'il faut obtenir

Écraser la pédale fait descendre la boîte. Remettre délicatement les gaz ne fait
rien.

Aujourd'hui le déclenchement tient au **niveau** de charge, et comme la charge
est déduite de l'accélération faute de pédale, « charge ≥ 0,75 » ne veut dire
que « on accélère à 1 m/s² » — 3,6 km/h par seconde, une reprise douce. D'où un
rétrogradage qui tire en permanence.

Ce qui distingue les deux gestes n'est pas le niveau atteint mais la **montée** :
la pédale qui bouge. Le déclenchement demande donc trois conditions réunies —
le niveau du profil, une montée de charge d'au moins 0,35 en une seconde et
demie, et trois secondes depuis le dernier déclenchement.

Le seuil de niveau du profil reste où il est. Monter les deux rendrait le
rétrogradage presque inatteignable sur un signal déjà lissé d'une seconde.

La fenêtre d'une seconde et demie se compare à la mesure **la plus récente qui
soit assez ancienne**, et non à la plus ancienne de l'historique : c'est
exactement l'erreur que le lot FIX-CORE vient de corriger dans le
conditionnement, et elle ne se refait pas ici.

## Critères d'acceptation

- [x] Une reprise douce — 1 m/s² tenus — ne déclenche aucun rétrogradage forcé
- [x] Une reprise franche — la charge qui monte de 0,4 en une seconde — en
      déclenche un
- [x] Deux déclenchements ne peuvent pas se suivre à moins de trois secondes
- [x] Une charge élevée mais **stable** depuis longtemps n'en déclenche pas :
      c'est une montée, pas un plateau
- [x] Le nombre de rapports descendus et le plafond de régime visé sont
      inchangés — seule la condition de déclenchement bouge
- [x] Au simulateur, où la pédale est connue, la règle s'applique telle quelle
- [x] Le README dit ce que le réglage déclenche réellement
