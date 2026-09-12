# 06 — La carte

**Statut :** ✅ fait

**Bloqué par :** 05 — le relecteur déroule une session

## Ce qu'il faut obtenir

Le trajet apparaît sur une vraie carte, et le véhicule s'y déplace au rythme de
la timeline. Reconnaître un endroit vaut mieux que lire un horodatage : « c'est
au rond-point avant l'autoroute » se dit sans effort, « à douze minutes
trente-quatre » ne se dit pas du tout.

La carte s'alimente des positions du journal, une par seconde, et de celles de
la capture quand elle existe, à la cadence du GPS.

Elle demande **Leaflet et les tuiles OpenStreetMap**. C'est la première
dépendance d'interface du projet et elle est acceptée pour ce seul écran, qui
n'est chargé qu'au bureau : l'attribution d'OpenStreetMap est obligatoire et
doit être affichée.

Le clic sur la carte déplace la timeline au passage le plus proche, et le
déplacement de la timeline déplace le véhicule : les deux sens marchent.

## Critères d'acceptation

- [x] Le trajet est tracé sur le fond de carte, et la vue s'ajuste à son
      étendue.
- [x] Le véhicule suit la timeline.
- [x] Un clic sur le tracé déplace la timeline à cet endroit.
- [x] L'attribution d'OpenStreetMap est affichée.
- [x] Leaflet n'est téléchargé que sur cet écran.
- [x] Une session sans position affiche une carte vide et un message, sans
      erreur.

Critères établis le 12 septembre 2026, en relisant le composant de carte et l'entrée de construction séparée : le tracé et son cadrage, le véhicule qui suit la timeline, le clic qui déplace la lecture, l'attribution d'OpenStreetMap, et la carte vide annoncée.
