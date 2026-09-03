# 05 — Le nombre de rapports, réglable depuis le mode simplifié

**Statut :** ✅ fait

**Bloqué par :** 01 — Les tables suivent le nombre de rapports ; 03 — Un curseur
« calme ↔ sportif », en continu

## Ce qu'il faut obtenir

Le nombre de rapports se choisit dans le mode simplifié, sans passer par la
saisie d'une liste de démultiplications. Le changer donne une boîte complète et
cohérente — démultiplications réparties, seuils de passage et temporisations
redimensionnés — et non un profil à rafistoler.

Le 01 a rendu le redimensionnement correct ; ce ticket le met à portée de main et
recalcule aussi les démultiplications elles-mêmes, ce que le 01 ne fait pas : il
ne s'occupait que des tables qui les accompagnent.

La contrainte à respecter est celle qui a motivé le profil Route : le rapport le
plus long doit tourner à un régime tenable à la vitesse de croisière habituelle,
et le plus court ne doit pas hurler en ville.

## Critères d'acceptation

- [x] Le nombre de rapports se change en un geste, sans saisir de liste
- [x] De trois à huit rapports, la boîte reste cohérente et jouable — mesuré, la
      boîte monte jusqu'au dernier rapport à 110 km/h tenus en n − 1 passages,
      et ne tape pas dans le rupteur pied au plancher
- [x] Le rapport le plus long tourne à un régime tenable à 110 km/h — mesuré,
      2355 tr/min sur Route et 2865 sur Sport, quel que soit le nombre de
      rapports : le premier et le dernier sont conservés, le pont avec eux
- [x] Le premier rapport ne dépasse pas son seuil de passage dès le démarrage —
      mesuré, 528 tr/min à 5 km/h sur Route pour un seuil à 3110
- [x] Le champ des démultiplications reste disponible en mode avancé, pour qui
      veut les poser à la main
