# BANC-GPS — éprouver toute la chaîne sans rouler

**Statut :** ✅ fait — clos le 2026-09-04
**Branche :** `feature/banc-gps`
**Version visée :** 0.2

David avait remarqué que le son est plus juste au simulateur qu'en voiture — « je
me demande bien pourquoi ». Deux causes furent corrigées le jour même ; la
troisième était structurelle : au simulateur la charge vient de la gâchette, en
voiture elle est déduite d'une vitesse **mesurée**.

Mesuré au banc, en croisière tenue à 110 km/h, l'écart-type de l'accélération
passe de 0 sur une vitesse exacte à 0,148 m/s² sur un GPS réel, avec des pointes
à 0,51 — un quart de charge pleine sur une vitesse parfaitement tenue. Le lot
donne donc trois modes de simulation, dont un qui **traverse la vraie source
GPS** en lui fabriquant des positions.

**Ce que son statut disait sans qu'on l'entende : « reste à s'en servir ».** Il
n'a jamais servi à juger la boîte, et c'est ce qui a laissé passer le défaut
d'horodatage trouvé le 10 septembre 2026 — tous les bancs de la boîte
fabriquaient un signal propre. La spécification de la refonte en fait désormais
un point de test à part entière.

Aucun ticket : le lot a été livré d'une pièce.
