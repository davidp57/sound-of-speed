# 02 — Le volume ne voyage plus avec un profil

**Statut :** ✅ fait

**Bloqué par :** 01 — Le volume devient une préférence de l'appareil

## Ce qu'il faut obtenir

Les trois façons dont le volume s'échappait d'un appareil ou revenait sans
raison cessent :

- **Le partage par lien** n'emporte pas le niveau. Celui qui reçoit un profil
  garde le sien, réglé pour sa voiture, ses haut-parleurs, son habitude.
- **L'export en fichier** ne l'emporte pas non plus. C'est le même argument, et
  un fichier voyage aussi.
- **Réinitialiser la section de mixage** ne touche plus au niveau : on voulait
  retrouver un caractère, pas remettre le son au niveau d'usine.

Le curseur de l'écran de configuration disparaît, celui de l'écran de conduite
reste.

Ce qui **ne** part **pas** avec : le relief de charge, le relief de régime, le
niveau au ralenti, le seuil du limiteur, le coupe-bas et la saturation. Ce sont
du caractère — un profil sportif exagère l'effort — et le relief a pour point
neutre la croisière, précisément pour ne pas déplacer le niveau moyen.

## Critères d'acceptation

- [x] Un aller-retour par lien ne transporte pas le volume
- [x] Un aller-retour par fichier ne le transporte pas
- [x] Réinitialiser la section de mixage laisse le volume intact
- [x] Les reliefs, le niveau au ralenti, le limiteur, le coupe-bas et la
      saturation restent dans le profil et voyagent avec lui
- [x] Le volume n'apparaît plus qu'à un seul endroit de l'interface
