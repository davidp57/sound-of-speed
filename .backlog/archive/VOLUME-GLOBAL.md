# VOLUME-GLOBAL — le volume est une préférence d'appareil, pas un caractère

**Statut :** ✅ fait — clos le 2026-09-03
**Branche :** `fix/volume-global`
**Version visée :** 0.3

Relevé à l'usage par David : « le volume global ne doit pas faire partie d'un
profil — c'est global ». Le volume vivait dans la section de mixage, avec trois
conséquences : changer de profil changeait le niveau, un profil partagé
transportait le volume de celui qui l'avait réglé, et réinitialiser une section
le remettait.

Le volume dépend de l'autoradio, de la position de l'appareil et du bruit de
roulement. Rien de cela n'est un attribut du moteur qu'on imite. Il est devenu
une préférence de l'appareil, et c'est resté vrai depuis : la refonte du
10 septembre 2026 le garde local, faute de quoi on ne pourrait plus y toucher
dans un parking souterrain.

## Tickets

| # | Titre | Statut |
|---|---|---|
| 01 | Le volume devient une préférence de l'appareil | ✅ fait |
| 02 | Le volume ne voyage plus avec un profil | ✅ fait |
| 03 | Retirer le champ du profil | ✅ fait |
