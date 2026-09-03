# 05 — Le nombre de rapports, réglable depuis le mode simplifié

**Statut :** ⬜ prêt

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

- [ ] Le nombre de rapports se change en un geste, sans saisir de liste
- [ ] De trois à huit rapports, la boîte reste cohérente et jouable
- [ ] Le rapport le plus long tourne à un régime tenable à 110 km/h
- [ ] Le premier rapport ne dépasse pas son seuil de passage dès le démarrage
- [ ] Le champ des démultiplications reste disponible en mode avancé, pour qui
      veut les poser à la main
